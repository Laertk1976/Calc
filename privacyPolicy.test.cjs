const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const babel = require('@babel/core');
const { execFileSync } = require('node:child_process');

function load(file, dependencies = {}) {
  const exports = {};
  const code = babel.transformSync(fs.readFileSync(file, 'utf8'), {
    configFile: false, babelrc: false,
    plugins: ['@babel/plugin-transform-modules-commonjs', ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]],
  }).code;
  vm.runInNewContext(code, { exports, require: name => dependencies[name] || require(name) });
  return exports;
}
const policy = load('privacyPolicy.js');
const codes = [...fs.readFileSync('i18n.js', 'utf8').matchAll(/code: '([^']+)'/g)].map(match => match[1]);

test('every app language links to a complete static policy with all language choices', () => {
  execFileSync(process.execPath, ['scripts/build-privacy-pages.cjs', '--check']);
  for (const code of codes) {
    const url = new URL(policy.privacyPolicyUrl(code));
    const html = fs.readFileSync(`public-account${url.pathname}.html`, 'utf8');
    assert.ok(html.includes(`<html lang="${code}">`));
    assert.equal([...html.matchAll(/<h2>/g)].length, 12);
    assert.ok(!html.includes('<script'));
    for (const other of codes) {
      assert.ok(html.includes(`href="${new URL(policy.privacyPolicyUrl(other)).pathname}" lang="${other}" hreflang="${other}"`));
    }
    assert.ok(html.includes(`hreflang="${code}" aria-current="page"`));
  }
});

test('regional locales resolve correctly and unknown languages fall back to English', () => {
  assert.equal(policy.privacyPolicyUrl('ko-KR'), `${policy.PRIVACY_POLICY_URL}/ko`);
  assert.equal(policy.privacyPolicyUrl('HY_am'), `${policy.PRIVACY_POLICY_URL}/hy`);
  for (const language of [undefined, '', 'fr', '../../other', 'en-US']) {
    assert.equal(policy.privacyPolicyUrl(language), policy.PRIVACY_POLICY_URL);
  }
});

test('the app opens the current language and shows its localized URL after an opening failure', async () => {
  const i18n = { resolvedLanguage: 'en' };
  let failed = false;
  let reject = false;
  const opened = [];
  const component = load('components/PrivacyPolicyLink.js', {
    '../privacyPolicy': policy,
    './SoundPressable': 'Pressable',
    react: { useState: () => [failed, value => { failed = value; }] },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n }) },
    'react-native': { Text: 'Text', View: 'View', Linking: { openURL: async url => {
      opened.push(url);
      if (reject) throw new Error('No browser');
    } } },
  }).default;
  for (const code of codes) {
    i18n.resolvedLanguage = code;
    await component().props.children[0].props.onPress();
    assert.equal(opened.at(-1), policy.privacyPolicyUrl(code));
  }
  reject = true;
  await component().props.children[0].props.onPress();
  assert.equal(failed, true);
  assert.ok(component().props.children[1].props.children.includes(policy.privacyPolicyUrl('ko')));
  i18n.resolvedLanguage = 'hy';
  assert.ok(component().props.children[1].props.children.includes(policy.privacyPolicyUrl('hy')));
});
