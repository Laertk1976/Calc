const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const languages = { en: 'English', hy: 'Հայերեն', ru: 'Русский', ja: '日本語', hi: 'हिन्दी', ko: '한국어' };
const sourcePath = path.join(root, 'public-account/privacy.html');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\n?  <!-- policy-languages -->[\s\S]*?<!-- \/policy-languages -->\n?/g, '\n');
const blockPattern = /<(h1|h2|p)[^>]*>([\s\S]*?)<\/\1>/g;
const english = [...source.matchAll(blockPattern)].map(match => match[2]);
const hrefs = value => [...value.matchAll(/href="([^"]+)"/g)].map(match => match[1]).sort();
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const output = new Map();
for (const code of Object.keys(languages)) {
  const translation = code === 'en' ? { language: 'Language', blocks: english } : JSON.parse(fs.readFileSync(path.join(root, `release/privacy-translations/${code}.json`), 'utf8'));
  assert.equal(translation.blocks.length, english.length, `${code}: incomplete policy`);
  translation.blocks.forEach((text, index) => {
    assert.ok(typeof text === 'string' && text.trim(), `${code}: empty block ${index}`);
    assert.deepEqual(hrefs(text), hrefs(english[index]), `${code}: links changed in block ${index}`);
    assert.ok(!/<\/?(?!a\b|strong\b)[a-z]/i.test(text), `${code}: unexpected markup in block ${index}`);
  });
  let index = 0;
  let html = source.replace(blockPattern, (block, tag) => block.replace(/>[\s\S]*</, () => `>${translation.blocks[index++]}<`));
  html = html.replace('<html lang="en">', `<html lang="${code}">`)
    .replace(/<title>.*?<\/title>/, () => `<title>Calc — ${escape(translation.blocks[0])}</title>`);
  if (translation.description) html = html.replace(/(<meta name="description" content=")[^"]*(">)/, (_, start, end) => start + escape(translation.description) + end);
  const links = Object.entries(languages).map(([lang, name]) => `<a href="/privacy${lang === 'en' ? '' : `/${lang}`}" lang="${lang}" hreflang="${lang}"${lang === code ? ' aria-current="page"' : ''}>${name}</a>`).join(' · ');
  html = html.replace('<div class="brand">CALC</div>', `<div class="brand">CALC</div>\n  <!-- policy-languages -->\n  <nav aria-label="${escape(translation.language)}" style="display:flex; flex-wrap:wrap; gap:8px; margin:16px 0">${links}</nav>\n  <!-- /policy-languages -->`);
  output.set(path.join(root, `public-account/privacy${code === 'en' ? '' : `/${code}`}.html`), html);
}
for (const [file, html] of output) {
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), html, `${file}: run node scripts/build-privacy-pages.cjs`);
  else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
}
console.log(`${output.size} privacy pages ${process.argv.includes('--check') ? 'verified' : 'generated'}; ${english.length} policy blocks per language.`);
