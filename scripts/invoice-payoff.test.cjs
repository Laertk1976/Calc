const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const babel = require('@babel/core');

function mount({ allowed = true, fail = false, amount = '1,250', amountField = 'fact' } = {}) {
  const state = []; let cursor = 0;
  const updates = [];
  const jsx = (type, props) => ({ type, props });
  const row = { id: 'invoice', title: 'Test invoice', [amountField]: amount, comment: 'Keep comment' };
  const modules = {
    react: { useEffect() {}, useState: initial => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], next => { state[index] = typeof next === 'function' ? next(state[index]) : next; }];
    } },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { StyleSheet: { create: x => x }, Keyboard: { dismiss() {} }, Text: 'Text', View: 'View', ScrollView: 'ScrollView', TextInput: 'TextInput', Modal: 'Modal' },
    'react-i18next': { useTranslation: () => ({ t: x => x, i18n: { resolvedLanguage: 'en' } }) },
    './ProProvider': { usePro: () => ({ hasPro: allowed, requirePro: () => allowed }) },
    '../debtList': { debtRows: rows => rows, groupDebtRows: rows => rows.map(row => ({ rows: [row] })), debtNames: () => [], monthDistance: () => 0 },
    '../calculationHistory': { normalizeCalculation: x => x, latestUndoableChange: () => null },
    '../calculatorUtils': { pretty: String, formatSavedDate: () => '' },
    '../useCalculatorStyles': { __esModule: true, default: () => ({}) },
    '@expo/vector-icons': { Ionicons: 'Icon' },
  };
  const exports = {};
  const code = babel.transformSync(fs.readFileSync('components/DebtListModal.js', 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  }).code;
  vm.runInNewContext(code, { exports, require: name => modules[name] || { __esModule: true, default: name } });
  const render = () => { cursor = 0; return exports.default({ calculations: [row], amountField, onUpdate: async change => {
    updates.push(JSON.parse(JSON.stringify(change)));
    if (fail) throw Error('offline write failed');
  } }); };
  function nodes(node) {
    if (!node || typeof node !== 'object') return [];
    return [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)];
  }
  return { updates, nodes: () => nodes(render()), press: label => nodes(render()).find(node => node.props?.onPress && nodes(node).some(child => child.type === 'Text' && child.props.children === label)).props.onPress() };
}

for (const amountField of ['fact', 'cred']) {
test(`${amountField} card pays off directly without opening the editor`, async () => {
  const app = mount({ amountField });
  await app.press('Pay off');
  assert.deepEqual(app.updates, [{ type: 'edit', id: 'invoice', payOff: true, amountField, changes: { [amountField]: '1250', comment: 'Keep comment' } }]);
  assert.ok(!app.nodes().some(node => node.type === 'TextInput'));
  await app.press('Edit');
  assert.ok(app.nodes().some(node => node.type === 'TextInput'));
});

test(`${amountField} direct payoff retains Pro gating, amount validation and visible save errors`, async () => {
  for (const options of [{ allowed: false }, { amount: '0' }, { amount: 'invalid' }]) {
    const app = mount({ ...options, amountField });
    await app.press('Pay off');
    assert.equal(app.updates.length, 0);
  }
  const app = mount({ fail: true, amountField });
  await app.press('Pay off');
  assert.ok(app.nodes().some(node => node.props?.accessibilityRole === 'alert' && node.props.children === 'Save failed'));
  assert.ok(!app.nodes().some(node => node.type === 'TextInput'));
});
}
