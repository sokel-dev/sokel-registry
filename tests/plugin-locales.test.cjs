const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadPage() {
  const element = () => ({ style: {}, dataset: {}, classList: { toggle() {}, add() {}, remove() {} }, setAttribute() {}, appendChild() {}, querySelectorAll() { return []; } });
  const context = vm.createContext({
    URL, URLSearchParams, console, setTimeout, clearTimeout,
    location: { href: 'https://registry.example/', search: '', hash: '' },
    history: { replaceState() {} },
    navigator: { language: 'en' }, localStorage: { getItem() { return null; }, setItem() {} },
    window: { addEventListener() {}, scrollTo() {}, SOKEL_CATALOG: require('../site/catalog.js') },
    document: { documentElement: element(), getElementById: element, querySelectorAll() { return []; }, querySelector: element, addEventListener() {} },
    fetch: () => new Promise(() => {}),
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/app.js'), 'utf8'), context);
  return code => vm.runInContext(code, context);
}

test('English-source cards translate into Chinese while preserving English defaults', () => {
  const run = loadPage();
  run(`globalThis.entry = { label: 'Read cells', i18n: {'zh-CN': {label: '读取单元格'}} };`);
  assert.equal(run(`LANG = 'en'; cardText(entry, 'label')`), 'Read cells');
  assert.equal(run(`LANG = 'zh'; cardText(entry, 'label')`), '读取单元格');
  assert.equal(run(`cardText({label:'Untranslated'}, 'label')`), 'Untranslated');
});

test('detail labels and complete guides follow language switches without refetching', () => {
  const run = loadPage();
  run(`CUR = {c: {locales: {'zh-CN': {'Read cells':'读取单元格', '# Guide':'# 使用说明'}}}};`);
  assert.equal(run(`LANG = 'zh'; tr('Read cells')`), '读取单元格');
  assert.equal(run(`tr('# Guide')`), '# 使用说明');
  assert.equal(run(`LANG = 'en'; tr('Read cells')`), 'Read cells');
  assert.equal(run(`LANG = 'zh'; tr('Read cells')`), '读取单元格');
});

test('legacy Chinese-source plugins and zh locale aliases remain supported', () => {
  const run = loadPage();
  run(`globalThis.entry = {label:'读取', i18n:{en:{label:'Read'}}}; CUR = {c:{locales:{en:{'读取':'Read'}}}};`);
  assert.equal(run(`LANG = 'en'; cardText(entry, 'label')`), 'Read');
  assert.equal(run(`tr('读取')`), 'Read');
  assert.equal(run(`LANG = 'zh'; tr('读取')`), '读取');
  run(`CUR = {c:{locales:{zh:{'Read':'读取'}}}};`);
  assert.equal(run(`tr('Read')`), '读取');
});

test('the actual documentation tab renders the selected translation', () => {
  const run = loadPage();
  run(`tab = 'doc'; CUR = {c:{doc:'# Guide',locales:{'zh-CN':{'# Guide':'# 使用说明'}}}};`);
  assert.match(run(`LANG = 'zh'; tabBody(CUR.c)`), /使用说明/);
  assert.match(run(`LANG = 'en'; tabBody(CUR.c)`), /Guide/);
});
