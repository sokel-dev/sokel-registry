const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the real card renderer so a missing publisher classification fails as visible behavior.
function renderCard(entry, lang = 'zh', variant = 'directory') {
  const element = () => ({ style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, querySelectorAll() { return []; } });
  const context = vm.createContext({
    URL, URLSearchParams, console, setTimeout, clearTimeout, entry, lang, variant,
    location: { href: 'https://registry.example/', search: '', hash: '' },
    history: { replaceState() {} }, navigator: { language: 'en' },
    localStorage: { getItem() { return null; }, setItem() {} },
    window: { addEventListener() {}, scrollTo() {}, SOKEL_CATALOG: require('../site/catalog.js') },
    document: { documentElement: element(), getElementById: element, querySelectorAll() { return []; }, querySelector: element, addEventListener() {} },
    fetch: () => new Promise(() => {}),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8'), context);
  return vm.runInContext('LANG = lang; card(entry, variant)', context);
}

test('third-party publisher identity comes from the canonical ref, even when display metadata claims Sokel', () => {
  const html = renderCard({ ref: 'community/openai', org: 'sokel', name: 'openai', label: 'Sokel 官方 OpenAI' });
  assert.match(html, /class="pill publisher-source"[^>]*>第三方发布<\/span>/);
});

test('official publishers are not marked for unofficial API descriptions or conflicting display metadata', () => {
  for (const ref of ['sokel/xueqiu', 'sokel/x-free', 'sokel/openai_compatible', 'sokel/name.with.dot']) {
    assert.doesNotMatch(renderCard({ ref, org: 'community', label: '非官方 API', desc: 'Unofficial integration' }), /publisher-source/);
  }
});

test('lookalike namespaces cannot claim the official publisher', () => {
  for (const ref of ['sokel-community/openai', 'Sokel/openai']) {
    assert.match(renderCard({ ref, org: 'sokel', name: 'openai' }), />第三方发布<\/span>/, String(ref));
  }
});

test('malformed refs show an unconfirmed source instead of asserting a publisher', () => {
  for (const ref of [' sokel/openai', 'sokel/', 'sokel/ ', 'sokel/openai/extra', 'sokel/../openai', '']) {
    const html = renderCard({ ref, org: 'sokel', name: 'openai' });
    assert.match(html, />来源待确认<\/span>/, String(ref));
    assert.doesNotMatch(html, />第三方发布<\/span>/, String(ref));
  }
});

test('publisher identity accepts SDK names without adding new slug restrictions', () => {
  const { publisherSource } = require('../site/catalog.js');
  for (const ref of ['sokel/openai', 'sokel/name.with.dot', 'sokel/name_with_underscore']) assert.equal(publisherSource(ref), 'official');
  for (const ref of ['community/openai', 'sokel-community/mail']) assert.equal(publisherSource(ref), 'third_party');
  for (const ref of [undefined, null, '', 'sokel', 'sokel/', 'sokel/one/two']) assert.equal(publisherSource(ref), 'unknown');
});

test('publisher markers are localized and present in homepage cards', () => {
  assert.match(renderCard({ ref: 'community/mail', name: 'mail' }, 'en', 'home'), />Third-party publisher<\/span>/);
  assert.match(renderCard({ ref: 'community/mail', name: 'mail' }, 'zh', 'home'), />第三方发布<\/span>/);
});
