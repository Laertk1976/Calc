const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const test = require('node:test');
const babel = require('@babel/core');

function load(file, modules, clock = Date) {
  const exports = {};
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  }).code;
  vm.runInNewContext(code, { exports, require: name => modules[name], Date: clock });
  return exports.default;
}
const jsx = (type, props) => ({ type, props });
const runtime = { jsx, jsxs: jsx };

test('press feedback happens on touch down once, preserving long press and silent controls', () => {
  const calls = [];
  const Pressable = load('components/SoundPressable.js', {
    react: { forwardRef: fn => fn },
    'react/jsx-runtime': runtime,
    'react-native': { Pressable: 'Pressable' },
    './TapSoundProvider': { useTapSound: () => ({ playTapSound: () => calls.push('sound') }) },
  });
  const props = { onPressIn: () => calls.push('down'), onPress: () => calls.push('press'), onLongPress: () => calls.push('hold') };
  const button = Pressable(props).props;
  button.onPressIn(); button.onLongPress();
  assert.deepEqual(calls, ['sound', 'down', 'hold']);
  calls.length = 0;
  button.onPressIn(); button.onPress();
  assert.deepEqual(calls, ['sound', 'down', 'press']);
  calls.length = 0;
  Pressable({ ...props, silent: true }).props.onPressIn();
  assert.deepEqual(calls, ['down']);
  calls.length = 0;
  Pressable({ disabled: true }).props.onPressIn();
  assert.deepEqual(calls, []);
  assert.equal(button.android_disableSound, true);
});

function provider(native = true) {
  let resolveRead, cleanup;
  let now = 0;
  const calls = [];
  const seeks = [];
  const player = { pause: () => calls.push('pause'), play: () => calls.push('audio'), seekTo: () => new Promise(resolve => seeks.push(resolve)) };
  const feedback = { play: () => calls.push('native'), stop: () => calls.push('stop') };
  const Provider = load('components/TapSoundProvider.js', {
    react: {
      createContext: () => ({ Provider: 'Provider' }), useRef: current => ({ current }),
      useState: value => [value, () => {}], useEffect: fn => { cleanup = fn(); },
    },
    'react/jsx-runtime': runtime,
    'react-native': { Platform: { OS: native ? 'android' : 'web' }, NativeModules: { CalcButtonFeedback: feedback }, View: 'View' },
    'expo-audio': { useAudioPlayer: () => player },
    '@react-native-async-storage/async-storage': {
      getItem: () => new Promise(resolve => { resolveRead = resolve; }), setItem: async () => {},
    },
    '../assets/tap-sound.wav': 1,
  }, { now: () => now });
  return { api: Provider({}).props.value, calls, seeks, advance: () => { now += 50; }, resolveRead: value => resolveRead(value), cleanup: () => cleanup() };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('saved mute is respected before hydration and user changes win over delayed storage', async () => {
  const p = provider();
  p.api.playTapSound();
  assert.deepEqual(p.calls, []);
  p.resolveRead('false'); await flush();
  p.advance();
  p.api.playTapSound();
  assert.deepEqual(p.calls, []);
  const changed = provider();
  changed.api.toggleSound(true);
  changed.resolveRead('false'); await flush();
  changed.api.playTapSound(); changed.api.playTapSound();
  assert.deepEqual(changed.calls, ['native']);
  changed.api.toggleSound(false);
  changed.advance(); changed.api.playTapSound();
  assert.deepEqual(changed.calls, ['native', 'pause', 'stop']);
});

test('fallback playback cannot start after mute or unmount while seeking', async () => {
  for (const action of ['mute', 'unmount']) {
    const p = provider(false);
    p.resolveRead('true'); await flush();
    p.api.playTapSound();
    assert.equal(p.seeks.length, 1);
    if (action === 'mute') p.api.toggleSound(false); else p.cleanup();
    p.seeks[0](); await flush();
    assert.ok(!p.calls.includes('audio'));
  }
  const p = provider(false);
  p.resolveRead('true'); await flush();
  p.api.playTapSound(); p.seeks[0](); await flush();
  assert.deepEqual(p.calls, ['pause', 'audio']);
});
