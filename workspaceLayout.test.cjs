const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');

function load(file, modules = {}) {
  const exports = {};
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  }).code;
  vm.runInNewContext(code, { exports, require: name => modules[name] || { __esModule: true, default: name } });
  return exports;
}
const layout = load('workspaceLayout.js');
const jsx = (type, props) => ({ type, props });
function find(node, predicate) {
  if (!node || typeof node !== 'object') return;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

test('native landscape uses the workspace; portrait keyboards do not trigger it', () => {
  for (const platform of ['android', 'ios']) {
    assert.equal(layout.getWorkspaceLayout({ platform, width: 412, height: 850 }).desktop, false);
    assert.equal(layout.getWorkspaceLayout({ platform, width: 850, height: 412 }).desktop, true);
    assert.equal(layout.getWorkspaceLayout({ platform, width: 412, height: 300, screenWidth: 412, screenHeight: 915 }).desktop, false);
  }
  assert.equal(layout.getWorkspaceLayout({ platform: 'web', width: 1100, height: 700 }).desktop, false);
  assert.equal(layout.getWorkspaceLayout({ platform: 'web', width: 1440, height: 900 }).desktop, true);
});

test('phone landscape leaves room for records and usable keys, including safe areas', () => {
  for (const [width, height] of [[640, 360], [740, 360], [850, 412], [932, 430]]) {
    const result = layout.getWorkspaceLayout({ platform: 'android', width, height, insets: { left: 24, right: 24, top: 24, bottom: 16 } });
    assert.equal(result.compact, true);
    assert.ok(width - 48 - 24 - result.calculatorWidth >= 280);
    assert.ok(result.keyHeight >= 32 && result.keyHeight <= 48);
  }
});

test('measured landscape panel fits the display and all five keypad rows', () => {
  const result = layout.getWorkspaceLayout({ platform: 'android', width: 820, height: 360, calculatorHeight: 276, displayHeight: 52 });
  assert.ok(result.keyHeight * 5 + 15 + 16 + 52 + 4 <= 276);
});

test('rotation switches the rendered view and keeps an in-progress expression edit', () => {
  let size = { width: 412, height: 850, fontScale: 1 };
  const state = [];
  let cursor = 0;
  const edits = [];
  const component = load('components/CalculatorView.js', {
    react: {
      useState: initial => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
      },
      useRef: current => ({ current }), useEffect() {},
    },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-i18next': { useTranslation: () => ({ t: value => value, i18n: {} }) },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({}) },
    'react-native': {
      Platform: { OS: 'android' }, useWindowDimensions: () => size,
      Dimensions: { get: () => size },
      Animated: { Value: class {}, View: 'AnimatedView' },
      View: 'View', Text: 'Text', TextInput: 'TextInput', ScrollView: 'ScrollView',
    },
    '../workspaceLayout': layout,
    '../calculatorConstants': { keys: [['1', '2'], ['=']], operators: ['='] },
    '../calculatorUtils': { pretty: String },
    '../useCalculatorStyles': { __esModule: true, default: () => ({}) },
  }).default;
  const render = () => {
    cursor = 0;
    return component({ display: '15', expression: '10 + 5', savedCalculations: [], onEditExpression: value => edits.push(value) });
  };
  let tree = render();
  assert.equal(find(tree, node => node.type === './DesktopWorkspace'), undefined);
  find(tree, node => node.props?.accessibilityLabel === 'Edit calculation').props.onPress();
  find(render(), node => node.type === 'TextInput').props.onChangeText('10 + 7');
  size = { width: 850, height: 412, fontScale: 1 };
  const workspace = find(render(), node => node.type === './DesktopWorkspace');
  assert.ok(workspace);
  assert.equal(find(workspace.props.display, node => node.type === 'TextInput').props.value, '10 + 7');
  size = { width: 412, height: 850, fontScale: 1 };
  tree = render();
  const input = find(tree, node => node.type === 'TextInput');
  assert.equal(input.props.value, '10 + 7');
  input.props.onBlur();
  assert.deepEqual(edits, ['10 + 7']);
});

test('compact workspace includes safe areas and a scrollable calculator', () => {
  const component = load('components/DesktopWorkspace.js', {
    react: { useEffect() {}, useState: initial => [initial, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', StyleSheet: { create: value => value } },
    'react-i18next': { useTranslation: () => ({ t: value => value }) },
    './ProProvider': { usePro: () => ({ hasPro: true, requirePro: () => true }) },
  }).default;
  const tree = component({ layout: { compact: true, calculatorWidth: 300 }, tab: 'list', calculations: [], display: 'display', keypad: 'keypad' });
  assert.equal(tree.type, './CalculatorSafeArea');
  const scroll = find(tree, node => node.props?.testID === 'landscape-calculator-scroll');
  assert.deepEqual(Array.from(scroll.props.children), ['display', 'keypad']);
  assert.ok(find(tree, node => node.props?.testID === 'desktop-records'));
});
