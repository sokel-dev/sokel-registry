const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const C = require('../site/catalog.js');

const plugin = (ref, fields = {}) => ({ ref, name: ref.split('/').pop(), org: ref.split('/')[0], ...fields });
const refs = (result) => result.items.map((p) => p.ref);
const facet = (result, dimension) => Object.fromEntries(result.facets[dimension].map(({ id, count }) => [id, count]));

test('browser global and CommonJS exports expose the same discovery API', () => {
  const context = vm.createContext({ window: {}, URLSearchParams });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../site/catalog.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.SOKEL_CATALOG), Object.keys(C));
  assert.equal(context.window.SOKEL_CATALOG.query(context.window.SOKEL_CATALOG.createIndex([]), {}, 'zh').total, 0);
});

test('explicit categories override exact-ref migration and preserve future categories', () => {
  assert.deepEqual(C.categoryIds(plugin('sokel/feishu')), ['communication', 'productivity']);
  assert.deepEqual(C.categoryIds(plugin('other/feishu')), ['uncategorized']);
  assert.deepEqual(C.categoryIds(plugin('sokel/openai', { categories: ['custom', 'custom', ' finance ', '', null] })), ['custom', 'finance']);
  assert.equal(C.categoryLabel('custom', 'en'), 'custom');
  assert.equal(C.categoryLabel('finance', 'zh'), '金融与行情');
  assert.equal(C.categoryLabel('finance', 'en'), 'Finance & markets');
  assert.deepEqual(C.categoryIds(plugin('__proto__')), ['uncategorized']);
});

test('business categories and platform capabilities are independent dimensions', () => {
  const index = C.createIndex([
    plugin('sokel/github', { capabilities: [] }),
    plugin('other/model', { capabilities: ['llm/chat'] }),
    plugin('other/research', { categories: ['finance'], capabilities: ['llm/chat'] }),
  ]);
  assert.deepEqual(refs(C.query(index, { category: 'development' })), ['sokel/github']);
  assert.deepEqual(refs(C.query(index, { category: 'ai' })), []);
  assert.equal(C.query(index, { capability: 'llm/chat' }).total, 2);
  assert.deepEqual(refs(C.query(index, { category: 'finance', capability: 'llm/chat' })), ['other/research']);
});

test('search AND, category, capability, organization, events and deployment compose', () => {
  const index = C.createIndex([
    plugin('alpha/one', { label: '报告', desc: 'Search reports', categories: ['finance'], capabilities: ['websearch'], events: 2, deploy: ['container'] }),
    plugin('alpha/two', { desc: 'Search reports', categories: ['finance'], capabilities: ['websearch'], events: 0, deploy: ['container'] }),
    plugin('beta/three', { desc: 'Search reports', categories: ['finance'], capabilities: ['websearch'], events: 1 }),
    plugin('alpha/four', { desc: 'Search documents', categories: ['finance'], capabilities: ['websearch'], events: 1, deploy: ['container'] }),
  ]);
  const state = { q: 'SEARCH reports', category: 'finance', capability: 'websearch', org: 'alpha', events: true, deploy: true };
  assert.deepEqual(refs(C.query(index, state)), ['alpha/one']);
  assert.equal(C.query(index, { ...state, q: 'SEARCH missing' }).total, 0);
});

test('disjunctive facets ignore only themselves, preserve zero choices and count multiple memberships once', () => {
  const index = C.createIndex([
    plugin('a/model', { categories: ['ai', 'data', 'ai'], capabilities: ['llm/chat'], events: 1 }),
    plugin('a/search', { categories: ['search'], capabilities: ['llm/chat'], events: 1 }),
    plugin('a/vector', { categories: ['ai'], capabilities: ['embedding'], events: 1 }),
    plugin('b/model', { categories: ['ai'], capabilities: ['llm/chat'], events: 1 }),
    plugin('a/no-event', { categories: ['storage'], capabilities: ['llm/chat'] }),
  ]);
  const result = C.query(index, { category: 'ai', capability: 'llm/chat', org: 'a', events: true });
  assert.deepEqual(refs(result), ['a/model']);
  assert.deepEqual(facet(result, 'categories'), { ai: 1, search: 1, data: 1, storage: 0 });
  assert.deepEqual(facet(result, 'capabilities'), { embedding: 1, 'llm/chat': 1 });
  assert.deepEqual(facet(result, 'orgs'), { a: 1, b: 1 });
  const searched = C.query(index, { category: 'ai', q: 'b/model' });
  assert.equal(facet(searched, 'categories').search, 0);
  assert.equal(facet(searched, 'orgs').b, 1);
});

test('cross-language search indexes source and translated names/descriptions in either UI language', () => {
  const index = C.createIndex([
    plugin('sokel/feishu', { label: '飞书', desc: '收发消息', i18n: { en: { label: 'Feishu', desc: 'Send documents' } } }),
    plugin('other/read', { label: 'Read cells', i18n: { zh: { label: '读取单元格' }, 'zh-CN': { desc: '电子表格' } } }),
  ]);
  assert.deepEqual(refs(C.query(index, { q: '飞书 documents' }, 'en')), ['sokel/feishu']);
  assert.deepEqual(refs(C.query(index, { q: 'FEISHU 消息' }, 'zh')), ['sokel/feishu']);
  assert.deepEqual(refs(C.query(index, { q: '读取 cells 电子表格' }, 'en')), ['other/read']);
  assert.deepEqual(refs(C.query(index, { q: 'ｆｅｉｓｈｕ' }, 'en')), ['sokel/feishu']);
});

test('capability IDs and localized capability names are searchable independently of descriptions', () => {
  const index = C.createIndex([
    plugin('other/model', { capabilities: ['llm/chat', 'embedding'] }),
    plugin('other/store', { capabilities: ['objectstore'] }),
    plugin('other/future', { capabilities: ['new/capability'] }),
  ]);
  for (const q of ['对话模型', 'Chat model', 'llm/chat', '向量嵌入', 'embedding']) {
    assert.deepEqual(refs(C.query(index, { q }, 'en')), ['other/model']);
  }
  assert.deepEqual(refs(C.query(index, { q: 'Object storage' }, 'zh')), ['other/store']);
  assert.deepEqual(refs(C.query(index, { q: 'new/capability' })), ['other/future']);
});

test('relevance ranks exact names and refs, then prefixes, ahead of description matches', () => {
  const index = C.createIndex([
    plugin('a/description', { label: 'A description', desc: 'Notion notion notion' }),
    plugin('a/middle', { label: 'My Notion extension' }),
    plugin('a/prefix', { label: 'Notion helper' }),
    plugin('a/notion', { label: 'Notion' }),
  ]);
  assert.deepEqual(refs(C.query(index, { q: 'notion' }, 'en')), ['a/notion', 'a/prefix', 'a/middle', 'a/description']);
  assert.deepEqual(refs(C.query(index, { q: 'a/notion' }, 'en')), ['a/notion']);
  assert.deepEqual(refs(C.query(index, { q: 'notion helper' }, 'en')), ['a/prefix']);
});

test('localized name ordering, operation ordering and ref tie breakers remain deterministic', () => {
  const entries = [
    plugin('b/same', { label: 'Zebra', i18n: { 'zh-CN': { label: '阿尔法' } }, operations: 2 }),
    plugin('a/same', { label: 'Zebra', i18n: { 'zh-CN': { label: '阿尔法' } }, operations: 2 }),
    plugin('a/other', { label: 'Alpha', i18n: { 'zh-CN': { label: '中午' } }, operations: 12 }),
  ];
  const index = C.createIndex(entries);
  assert.deepEqual(refs(C.query(index, { sort: 'name' }, 'en')), ['a/other', 'a/same', 'b/same']);
  assert.deepEqual(refs(C.query(index, { sort: 'name' }, 'zh')), ['a/same', 'b/same', 'a/other']);
  assert.deepEqual(refs(C.query(index, { sort: 'operations' }, 'zh')), ['a/other', 'a/same', 'b/same']);
  assert.deepEqual(refs(C.query(index, {}, 'en')), refs(C.query(C.createIndex(entries.slice().reverse()), {}, 'en')));
  assert.deepEqual(entries.map((p) => p.ref), ['b/same', 'a/same', 'a/other']);
});

test('URL parser validates pagination, boolean flags and enums without losing a useful query', () => {
  assert.deepEqual(C.parseState('?q=++hello++&category=custom&capability=llm%2Fchat&org=acme&events=1&deploy=true&sort=operations&view=list&page=3&size=48'), {
    q: 'hello', category: 'custom', capability: 'llm/chat', org: 'acme', events: true, deploy: true,
    sort: 'operations', view: 'list', page: 3, size: 48,
  });
  assert.deepEqual(C.parseState('?sort=unknown&view=giant&page=-3&size=2000&events=false&deploy=0'), C.DEFAULT_STATE);
  for (const page of ['NaN', 'Infinity', '1.5', '0', '9007199254740992', '2junk']) {
    assert.equal(C.parseState(`?page=${page}`).page, 1);
  }
  for (const size of ['', '0', '1', '25', '96.5']) assert.equal(C.parseState(`?size=${size}`).size, 24);
});

test('URL writes preserve registry base, platform, language and duplicate unknown parameters', () => {
  const source = new URLSearchParams('base=https%3A%2F%2Fplugins.sokel.dev%2F&platform=https%3A%2F%2Finternal.example%2F&lang=zh&campaign=a&campaign=b&q=old&page=8&events=1');
  const result = C.writeState(source, { ...C.DEFAULT_STATE, q: '中文 search', category: 'finance', view: 'list', page: 2, size: 96 });
  assert.ok(result instanceof URLSearchParams);
  for (const key of ['base', 'platform', 'lang', 'campaign']) assert.deepEqual(result.getAll(key), source.getAll(key));
  assert.equal(source.get('q'), 'old');
  assert.equal(result.has('events'), false);
  assert.equal(result.has('sort'), false);
  assert.deepEqual(C.parseState(result), { ...C.DEFAULT_STATE, q: '中文 search', category: 'finance', view: 'list', page: 2, size: 96 });
  const cleared = C.writeState(result, C.DEFAULT_STATE);
  for (const key of Object.keys(C.DEFAULT_STATE)) assert.equal(cleared.has(key), false);
  assert.deepEqual(cleared.getAll('campaign'), ['a', 'b']);
});

test('2000-plugin pagination caps every render, clamps stale pages and covers every item exactly once', () => {
  const entries = Array.from({ length: 2000 }, (_, n) => plugin(`org/plugin-${n}`, {
    label: `Plugin ${n}`, categories: [n % 2 ? 'ai' : 'data'], operations: n,
  }));
  const index = C.createIndex(entries);
  for (const size of [24, 48, 96]) {
    const seen = [];
    const pages = Math.ceil(entries.length / size);
    for (let page = 1; page <= pages; page++) {
      const result = C.query(index, { page, size }, 'en');
      assert.ok(result.items.length <= size);
      assert.equal(result.from, (page - 1) * size + 1);
      assert.equal(result.to, Math.min(page * size, 2000));
      assert.equal(result.total, 2000);
      seen.push(...refs(result));
    }
    assert.equal(seen.length, 2000);
    assert.equal(new Set(seen).size, 2000);
    const stale = C.query(index, { page: 99999, size });
    assert.equal(stale.page, pages);
    assert.equal(stale.to, 2000);
    const filtered = C.query(index, { page: 99999, size, category: 'ai' });
    assert.equal(filtered.total, 1000);
    assert.equal(filtered.page, Math.ceil(1000 / size));
  }
  assert.equal(C.query(index, { size: 2000 }).items.length, 24);
  const empty = C.query(index, { q: 'missing', page: 99999 });
  assert.deepEqual([empty.total, empty.page, empty.pages, empty.from, empty.to], [0, 1, 1, 0, 0]);
});

test('malformed optional entry fields do not break catalog browsing', () => {
  const index = C.createIndex([null, plugin('a/valid', { categories: [null, 1], capabilities: [null, '__proto__'], i18n: { en: null }, operations: NaN, events: Infinity, deploy: null })]);
  const result = C.query(index, {});
  assert.deepEqual(refs(result), ['a/valid']);
  assert.equal(C.query(index, { events: true }).total, 0);
  assert.equal(C.query(index, { deploy: true }).total, 0);
});
