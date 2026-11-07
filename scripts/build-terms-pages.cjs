const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const languages = { en: 'English', hy: 'Հայերեն', ru: 'Русский', ja: '日本語', hi: 'हिन्दी', ko: '한국어' };
const sourcePath = path.join(root, 'public-account/terms.html');
const source = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').replace(/\n?  <!-- terms-languages -->[\s\S]*?<!-- \/terms-languages -->\n?/g, '\n');
const blockPattern = /<(h1|h2|p)([^>]*)>([\s\S]*?)<\/\1>/g;
const english = [...source.matchAll(blockPattern)].map(match => ({ tag: match[1], attributes: match[2], text: match[3] }));
const hrefs = value => [...value.matchAll(/href="([^"]+)"/g)].map(match => match[1]).sort();
const escape = value => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const output = new Map();

for (const code of Object.keys(languages)) {
  const translation = code === 'en'
    ? { language: 'Language', description: 'Terms of use for the Calc app.', blocks: english.map(block => block.text) }
    : JSON.parse(fs.readFileSync(path.join(root, `release/terms-translations/${code}.json`), 'utf8'));
  assert.equal(translation.blocks.length, english.length, `${code}: incomplete Terms translation`);
  translation.blocks.forEach((text, index) => {
    assert.ok(typeof text === 'string' && text.trim(), `${code}: empty block ${index}`);
    assert.deepEqual(hrefs(text), hrefs(english[index].text), `${code}: links changed in block ${index}`);
    assert.ok(!/<\/?(?!a\b|strong\b)[a-z]/i.test(text), `${code}: unexpected markup in block ${index}`);
  });

  let index = 0;
  let html = source.replace(blockPattern, (_, tag, attributes) => {
    const text = translation.blocks[index++];
    if (tag === 'p' && english[index - 1].attributes.includes('class="notice"')) return `<p class="notice">${text}</p>`;
    return `<${tag}${attributes}>${text}</${tag}>`;
  });
  html = html.replace('<html lang="en">', `<html lang="${code}">`)
    .replace(/<title>.*?<\/title>/, () => `<title>Calc — ${escape(translation.blocks[0])}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/, (_, start, end) => start + escape(translation.description) + end);
  html = html.replaceAll('href="/privacy"', `href="/privacy${code === 'en' ? '' : `/${code}`}"`);
  const links = Object.entries(languages).map(([lang, name]) => `<a href="/terms${lang === 'en' ? '' : `/${lang}`}" lang="${lang}" hreflang="${lang}"${lang === code ? ' aria-current="page"' : ''}>${name}</a>`).join(' · ');
  html = html.replace('<div class="brand">CALC</div>', `<div class="brand">CALC</div>\n  <!-- terms-languages -->\n  <nav aria-label="${escape(translation.language)}" style="display:flex; flex-wrap:wrap; gap:8px; margin:16px 0">${links}</nav>\n  <!-- /terms-languages -->`);
  output.set(path.join(root, `public-account/terms${code === 'en' ? '' : `/${code}`}.html`), html);
}

for (const [file, html] of output) {
  if (process.argv.includes('--check')) assert.equal(fs.readFileSync(file, 'utf8'), html, `${file}: run node scripts/build-terms-pages.cjs`);
  else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, html);
  }
}
console.log(`${output.size} Terms pages ${process.argv.includes('--check') ? 'verified' : 'generated'}; ${english.length} blocks per language.`);
