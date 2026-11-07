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
const terms = load('termsOfUse.js');
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

test('the Terms page exists and matches the app purchase and data behavior', () => {
  execFileSync(process.execPath, ['scripts/build-terms-pages.cjs', '--check']);
  const url = new URL(terms.TERMS_OF_USE_URL);
  assert.equal(url.pathname, '/terms');
  for (const code of codes) {
    const termsUrl = new URL(terms.termsOfUseUrl(code));
    const html = fs.readFileSync(`public-account${termsUrl.pathname}.html`, 'utf8');
    assert.ok(html.includes(`<html lang="${code}">`));
    assert.equal([...html.matchAll(/<h2>/g)].length, 10);
    assert.ok(!html.includes('<script'));
    for (const other of codes) {
      assert.ok(html.includes(`href="${new URL(terms.termsOfUseUrl(other)).pathname}" lang="${other}" hreflang="${other}"`));
    }
    assert.ok(html.includes(`hreflang="${code}" aria-current="page"`));
    assert.ok(html.includes(`href="${new URL(policy.privacyPolicyUrl(code)).pathname}"`));
    assert.ok(html.includes('href="mailto:laertkarap@gmail.com"'));
  }
  const english = fs.readFileSync(`public-account${url.pathname}.html`, 'utf8');
  assert.ok(english.includes('<title>Calc — Terms of Use</title>'));
  assert.ok(english.includes('one-time purchase'));
  assert.ok(english.includes('does not currently offer recurring subscriptions'));
  assert.ok(english.includes('Calculation records do not currently sync to cloud storage'));
  assert.ok(english.includes('Nothing in these Terms limits liability or consumer rights'));
});

test('the app opens both legal pages and shows a failed URL in the browser fallback', async () => {
  const i18n = { resolvedLanguage: 'en' };
  let failedUrl = '';
  let reject = false;
  const opened = [];
  const component = load('components/LegalLinks.js', {
    '../privacyPolicy': policy,
    '../termsOfUse': terms,
    './SoundPressable': 'Pressable',
    react: { useState: () => [failedUrl, value => { failedUrl = value; }] },
    'react-i18next': { useTranslation: () => ({ t: key => key, i18n }) },
    'react-native': { Text: 'Text', View: 'View', Linking: { openURL: async url => {
      opened.push(url);
      if (reject) throw new Error('No browser');
    } } },
  }).default;
  for (const code of codes) {
    i18n.resolvedLanguage = code;
    const links = component().props.children[0].props.children;
    await links[0].props.onPress();
    assert.equal(opened.at(-1), policy.privacyPolicyUrl(code));
    await links[2].props.onPress();
    assert.equal(opened.at(-1), terms.termsOfUseUrl(code));
  }
  reject = true;
  const links = component().props.children[0].props.children;
  await links[0].props.onPress();
  assert.equal(failedUrl, policy.privacyPolicyUrl('ko'));
  assert.ok(component().props.children[1].props.children.includes(policy.privacyPolicyUrl('ko')));
  i18n.resolvedLanguage = 'hy';
  await component().props.children[0].props.children[2].props.onPress();
  assert.equal(failedUrl, terms.termsOfUseUrl('hy'));
  assert.ok(component().props.children[1].props.children.includes(terms.termsOfUseUrl('hy')));
});

test('Terms URLs resolve regional locales and default unknown languages to English', () => {
  assert.equal(terms.termsOfUseUrl('ko-KR'), `${terms.TERMS_OF_USE_URL}/ko`);
  assert.equal(terms.termsOfUseUrl('HY_am'), `${terms.TERMS_OF_USE_URL}/hy`);
  for (const language of [undefined, '', 'fr', '../../other', 'en-US']) {
    assert.equal(terms.termsOfUseUrl(language), terms.TERMS_OF_USE_URL);
  }
});
