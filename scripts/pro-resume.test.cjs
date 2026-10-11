const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { transformSync } = require('@babel/core');

const code = transformSync(fs.readFileSync('components/ProProvider.js', 'utf8'), {
  babelrc: false, configFile: false,
  plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
}).code;

async function main() {
  let access, tokenChanged, snapshot, cache = null, cacheFails = false;
  const effects = [], transitions = [];
  const user = { uid: 'owner', getIdToken: async () => {}, getIdTokenResult: async () => ({ claims: { calcOwner: true } }) };
  const auth = { currentUser: user };
  let stateIndex = 0;
  const modules = {
    react: {
      createContext: () => ({ Provider: {} }), useContext: () => {},
      useRef: value => ({ current: value }), useEffect: effect => effects.push(effect),
      useState: initial => {
        if (stateIndex++ !== 0) return [typeof initial === 'function' ? initial() : initial, () => {}];
        access = initial;
        return [access, update => { access = typeof update === 'function' ? update(access) : update; transitions.push(access); }];
      },
    },
    'react/jsx-runtime': { jsx: () => null },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@react-native-async-storage/async-storage': { getItem: async () => { if (cacheFails) throw Error('storage unavailable'); return cache; }, setItem: async (_, value) => { cache = value; } },
    'firebase/auth': { onIdTokenChanged: (_, callback) => { tokenChanged = callback; return () => {}; } },
    'firebase/firestore': { doc: () => ({}), onSnapshot: (_, callback) => { snapshot = callback; return () => {}; } },
    '../authClient': { auth, db: {} },
    '../proAccess': { localDay: () => '2026-10-10', cachedProAccess: (value, uid) => value?.uid === uid && value.active && Date.now() - value.checkedAt < 7 * 86400000 },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => { assert.ok(modules[name], name); return modules[name]; }, setInterval: () => 1, clearInterval() {} });
  exports.default({ children: null });
  effects.forEach(effect => effect());
  await tokenChanged(user);
  assert.equal(access.active, true);
  for (const failStorage of [false, true]) {
    cache = null; cacheFails = failStorage; transitions.length = 0;
    await tokenChanged(user);
    assert.ok(transitions.every(value => value.active), 'resume must never temporarily revoke valid access');
  }
  cacheFails = false;
  user.getIdTokenResult = async () => ({ claims: {} });
  await tokenChanged(user);
  snapshot({ metadata: { fromCache: false }, data: () => ({ active: false }) });
  assert.equal(access.active, false, 'server revocation still applies');
  access = { uid: user.uid, active: true, expiresAt: Date.now() - 1 };
  cache = null; transitions.length = 0;
  await tokenChanged(user);
  assert.equal(transitions[0].active, false, 'expired access is not retained');
  access = { uid: user.uid, active: true, expiresAt: Date.now() + 100000 };
  await tokenChanged({ ...user, uid: 'other' });
  assert.equal(access.uid, 'other');
  assert.equal(access.active, false, 'access cannot cross accounts');
  await tokenChanged(null);
  assert.equal(access.uid, null);
  assert.equal(access.active, false, 'sign-out clears access');
  console.log('PASS: resume, missing/failed cache, revocation, expiry, account change, sign-out');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
