const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const i18next = require('i18next');
const codes = ['hy', 'en', 'ru', 'ja', 'hi'];
const resources = Object.fromEntries(codes.map(code => [code, { translation: require(`./locales/${code}.json`) }]));

test('all languages cover the same messages and interpolation variables', () => {
  const english = resources.en.translation;
  const variables = value => [...value.matchAll(/{{(.*?)}}/g)].map(match => match[1]).sort();
  for (const code of codes) {
    const messages = resources[code].translation;
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(english).sort());
    for (const [key, value] of Object.entries(messages)) {
      assert.ok(value.trim(), `${code}: ${key}`);
      assert.deepEqual(variables(value), variables(english[key]), `${code}: ${key}`);
    }
  }
});

function loadTranslationModule(storedLanguage) {
  const instance = i18next.createInstance();
  const writes = [];
  let restore;
  const storage = {
    getItem: () => new Promise(resolve => { restore = () => resolve(storedLanguage); }),
    setItem: async (key, value) => { writes.push([key, value]); },
  };
  const code = babel.transformSync(fs.readFileSync('i18n.js', 'utf8'), {
    configFile: false, babelrc: false, plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'i18next') return instance;
    if (name === 'react-i18next') return { initReactI18next: { type: '3rdParty', init() {} } };
    if (name.includes('async-storage')) return storage;
    return require(name);
  } });
  return { ...exports, writes, restore };
}

test('language changes interpolate messages and retain internal category IDs', async () => {
  const { default: instance, selectLanguage, writes, restore } = loadTranslationModule('en');
  restore();
  await new Promise(resolve => setImmediate(resolve));
  for (const code of codes) {
    selectLanguage(code);
    assert.equal(instance.t('Sign out'), resources[code].translation['Sign out']);
    assert.equal(instance.t('Cred'), resources[code].translation.Debt);
    assert.equal(instance.t('Fact'), resources[code].translation.Invoice);
    assert.equal(instance.t('Fcash'), resources[code].translation['Cash Invoice']);
    assert.ok(instance.t('Rows: {{count}}', { count: 3 }).includes('3'));
  }
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes.at(-1)[1], 'hi');
});

test('saved language restores and a delayed restore cannot overwrite a new choice', async () => {
  const saved = loadTranslationModule('hy');
  saved.restore();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(saved.default.resolvedLanguage, 'hy');
  const raced = loadTranslationModule('ru');
  raced.selectLanguage('ja');
  raced.restore();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(raced.default.resolvedLanguage, 'ja');
  raced.selectLanguage('unsupported');
  assert.equal(raced.default.resolvedLanguage, 'ja');
});
