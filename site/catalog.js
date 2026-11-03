// Catalog discovery without a build step. The index is prepared once; filtering never mutates its entries.
(function (root, factory) {
  const catalog = factory();
  if (typeof module === 'object' && module.exports) module.exports = catalog;
  if (root) root.SOKEL_CATALOG = catalog;
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  const CATEGORIES = Object.freeze([
    { id: 'ai', label: 'AI 与模型', en: 'AI & models' },
    { id: 'search', label: '搜索与检索', en: 'Search & retrieval' },
    { id: 'communication', label: '消息与通知', en: 'Messaging & notifications' },
    { id: 'productivity', label: '办公与协作', en: 'Productivity & collaboration' },
    { id: 'development', label: '开发与运维', en: 'Development & operations' },
    { id: 'data', label: '数据与知识库', en: 'Data & knowledge' },
    { id: 'storage', label: '文件与存储', en: 'Files & storage' },
    { id: 'social', label: '内容与社交', en: 'Content & social' },
    { id: 'finance', label: '金融与行情', en: 'Finance & markets' },
    { id: 'utilities', label: '通用工具', en: 'Utilities' },
    { id: 'uncategorized', label: '未分类', en: 'Uncategorized' },
  ].map(Object.freeze));
  const CATEGORY_MAP = new Map(CATEGORIES.map((c) => [c.id, c]));

  // Older index versions predate categories. These exact refs are a compatibility table, never an
  // inference from capabilities or a plugin name: other publishers' same-named plugins stay uncategorized.
  // Explicit categories in a newer index always take precedence, including previously unknown IDs.
  const LEGACY_CATEGORIES = {
    'sokel/aliyun': ['development'],
    'sokel/anthropic': ['ai'],
    'sokel/bluesky': ['social'],
    'sokel/claude-code': ['development', 'ai'],
    'sokel/content-text': ['data'],
    'sokel/deepseek': ['ai'],
    'sokel/discord': ['communication'],
    'sokel/elasticsearch': ['data', 'search'],
    'sokel/feed': ['social'],
    'sokel/feishu': ['communication', 'productivity'],
    'sokel/feishu-webhook': ['communication'],
    'sokel/fireworks': ['ai'],
    'sokel/gemini': ['ai'],
    'sokel/github': ['development'],
    'sokel/gitlab': ['development'],
    'sokel/glm': ['ai'],
    'sokel/gmail': ['communication'],
    'sokel/groq': ['ai'],
    'sokel/hackernews': ['social'],
    'sokel/http': ['utilities'],
    'sokel/http-probe': ['utilities'],
    'sokel/kbstore': ['data', 'search'],
    'sokel/kbstore-es': ['data', 'search'],
    'sokel/kbstore-pgvector': ['data', 'search'],
    'sokel/kimi': ['ai'],
    'sokel/kubernetes': ['development'],
    'sokel/linkedin': ['social'],
    'sokel/litellm-catalog': ['ai'],
    'sokel/mastodon': ['social'],
    'sokel/memory': ['data'],
    'sokel/mysql': ['data'],
    'sokel/notion': ['productivity'],
    'sokel/ollama': ['ai'],
    'sokel/openai': ['ai'],
    'sokel/openai_compatible': ['ai'],
    'sokel/postgres': ['data'],
    'sokel/producthunt': ['social'],
    'sokel/qiniu': ['development', 'storage'],
    'sokel/qiniu-object': ['storage'],
    'sokel/qwen': ['ai'],
    'sokel/reddit': ['social'],
    'sokel/redis': ['data'],
    'sokel/registry-tools': ['development'],
    'sokel/s3': ['storage'],
    'sokel/sandbox': ['development'],
    'sokel/search-brave': ['search'],
    'sokel/search-duckduckgo': ['search'],
    'sokel/search-google': ['search'],
    'sokel/search-serper': ['search'],
    'sokel/search-tavily': ['search'],
    'sokel/submail': ['communication'],
    'sokel/synology': ['storage'],
    'sokel/synology-upload': ['storage'],
    'sokel/tei': ['ai'],
    'sokel/telegram-bot': ['communication'],
    'sokel/threads': ['social'],
    'sokel/tushare': ['finance'],
    'sokel/umeng': ['communication'],
    'sokel/vertex': ['ai'],
    'sokel/wechat-claw': ['communication'],
    'sokel/wechat-mp': ['social'],
    'sokel/wecom': ['communication', 'productivity'],
    'sokel/x': ['social'],
    'sokel/x-free': ['social'],
    'sokel/xai': ['ai'],
    'sokel/xiaomi': ['ai'],
    'sokel/xueqiu': ['social', 'finance'],
    'sokel/youtube': ['social'],
    'sokel/youtube-transcript': ['social'],
  };

  const CAP_NAMES = Object.freeze({
    'llm/chat': { label: '对话模型', en: 'Chat model' },
    embedding: { label: '向量嵌入', en: 'Embedding' },
    rerank: { label: '重排序', en: 'Rerank' },
    image_generation: { label: '图像生成', en: 'Image generation' },
    video_generation: { label: '视频生成', en: 'Video generation' },
    speech: { label: '语音合成', en: 'Text to speech' },
    transcription: { label: '语音识别', en: 'Speech to text' },
    model_catalog: { label: '模型目录', en: 'Model catalog' },
    vectorstore: { label: '向量库', en: 'Vector store' },
    'vectorstore/keyword_ngram': { label: '关键词检索（n-gram）', en: 'Keyword search (n-gram)' },
    'vectorstore/keyword_bm25': { label: '关键词检索（BM25）', en: 'Keyword search (BM25)' },
    rowstore: { label: '数据表存储', en: 'Table storage' },
    objectstore: { label: '对象存储', en: 'Object storage' },
    memory: { label: '对话记忆', en: 'Chat memory' },
    websearch: { label: '网页搜索', en: 'Web search' },
    'content/process': { label: '内容处理', en: 'Content processing' },
    sandbox: { label: '代码沙箱', en: 'Code sandbox' },
  });

  const DEFAULT_STATE = Object.freeze({
    q: '', category: '', capability: '', org: '', events: false, deploy: false,
    sort: 'relevance', view: 'grid', page: 1, size: 24,
  });
  const SORTS = new Set(['relevance', 'name', 'operations']);
  const SIZES = new Set([24, 48, 96]);
  const text = (value) => typeof value === 'string' ? value.trim() : '';
  const normalize = (value) => text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ');
  const strings = (value) => Array.isArray(value) ? [...new Set(value.map(text).filter(Boolean))] : [];
  const count = (value) => Number.isFinite(value) && value > 0 ? value : 0;

  function publisherSource(ref) {
    if (typeof ref !== 'string') return 'unknown';
    const parts = ref.split('/');
    if (parts.length !== 2 || parts.some((part) => !part.trim() || part !== part.trim())) return 'unknown';
    return parts[0] === 'sokel' ? 'official' : 'third_party';
  }

  function categoryIds(plugin) {
    const declared = strings(plugin && plugin.categories);
    if (declared.length) return declared;
    const ref = plugin && plugin.ref;
    return Object.hasOwn(LEGACY_CATEGORIES, ref) ? LEGACY_CATEGORIES[ref].slice() : ['uncategorized'];
  }

  function categoryLabel(id, lang) {
    const category = CATEGORY_MAP.get(id);
    return category ? (lang === 'en' ? category.en : category.label) : id;
  }

  function normalizedState(input) {
    const state = input || {};
    const page = Number(state.page);
    const size = Number(state.size);
    return {
      q: text(state.q), category: text(state.category), capability: text(state.capability), org: text(state.org),
      events: state.events === true || state.events === '1' || state.events === 'true',
      deploy: state.deploy === true || state.deploy === '1' || state.deploy === 'true',
      sort: SORTS.has(state.sort) ? state.sort : DEFAULT_STATE.sort,
      view: state.view === 'list' ? 'list' : 'grid',
      page: Number.isSafeInteger(page) && page > 0 ? page : DEFAULT_STATE.page,
      size: SIZES.has(size) ? size : DEFAULT_STATE.size,
    };
  }

  function parseState(search) {
    const params = new URLSearchParams(search);
    return normalizedState(Object.fromEntries(Object.keys(DEFAULT_STATE).map((key) => [key, params.get(key)])));
  }

  // Only own our discovery keys. Connection settings and future/third-party parameters survive each edit.
  function writeState(search, input) {
    const params = new URLSearchParams(search);
    const state = normalizedState(input);
    for (const key of Object.keys(DEFAULT_STATE)) {
      params.delete(key);
      if (state[key] !== DEFAULT_STATE[key]) params.set(key, state[key] === true ? '1' : String(state[key]));
    }
    return params;
  }

  function localizedLabel(plugin, lang) {
    const tables = plugin.i18n || {};
    const locale = lang === 'en' ? tables.en : { ...tables.zh, ...tables['zh-CN'] };
    return text(locale && locale.label) || text(plugin.label) || text(plugin.name) || text(plugin.ref);
  }

  function createIndex(entries) {
    const all = Array.isArray(entries) ? entries.filter((p) => p && typeof p === 'object') : [];
    const categorySet = new Set();
    const capabilitySet = new Set();
    const orgSet = new Set();
    const records = all.map((plugin, position) => {
      const categories = categoryIds(plugin);
      const capabilities = strings(plugin.capabilities);
      const org = text(plugin.org) || text(plugin.ref).split('/').slice(0, -1).join('/');
      const names = strings([plugin.name, plugin.label, ...Object.values(plugin.i18n || {}).map((v) => v && v.label)]).map(normalize);
      const descriptions = strings([plugin.desc, ...Object.values(plugin.i18n || {}).map((v) => v && v.desc)]).map(normalize);
      const capabilityText = capabilities.flatMap((id) => {
        const names = Object.hasOwn(CAP_NAMES, id) ? CAP_NAMES[id] : null;
        return [id, ...(names ? [names.label, names.en] : [])].map(normalize);
      });
      categories.forEach((id) => categorySet.add(id));
      capabilities.forEach((id) => capabilitySet.add(id));
      if (org) orgSet.add(org);
      return {
        plugin, position, categories, capabilities, org, names, descriptions, capabilityText,
        ref: normalize(plugin.ref), labels: { zh: localizedLabel(plugin, 'zh'), en: localizedLabel(plugin, 'en') },
        operations: count(plugin.operations), events: count(plugin.events) > 0,
        deploy: strings(plugin.deploy).length > 0,
      };
    });
    const knownCategories = CATEGORIES.filter((c) => categorySet.has(c.id)).map((c) => c.id);
    const unknownCategories = [...categorySet].filter((id) => !CATEGORY_MAP.has(id)).sort();
    return {
      entries: all, records,
      categories: [...knownCategories, ...unknownCategories],
      capabilities: [...capabilitySet].sort(), orgs: [...orgSet].sort(),
    };
  }

  function fieldScore(fields, token, exact, prefix, contains) {
    let score = 0;
    for (const field of fields) {
      if (field === token) score = Math.max(score, exact);
      else if (field.startsWith(token)) score = Math.max(score, prefix);
      else if (field.includes(token)) score = Math.max(score, contains);
    }
    return score;
  }

  function searchScore(record, tokens, phrase) {
    if (!tokens.length) return 0;
    let score = 0;
    for (const token of tokens) {
      const match = Math.max(
        fieldScore([record.ref], token, 160, 110, 65),
        fieldScore(record.names, token, 150, 110, 65),
        fieldScore(record.capabilityText, token, 45, 35, 25),
        fieldScore(record.descriptions, token, 8, 8, 8),
      );
      if (!match) return -1;
      score += match;
    }
    // Full-name/ref matches stay ahead of descriptive matches even for a multi-word search.
    if (record.ref === phrase || record.names.includes(phrase)) score += 1000;
    else if (record.ref.startsWith(phrase) || record.names.some((name) => name.startsWith(phrase))) score += 300;
    return score;
  }

  const collators = {
    zh: new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' }),
    en: new Intl.Collator('en', { numeric: true, sensitivity: 'base' }),
  };

  function query(index, input, lang) {
    const state = normalizedState(input);
    const language = lang === 'en' ? 'en' : 'zh';
    const phrase = normalize(state.q);
    const tokens = phrase ? [...new Set(phrase.split(' '))] : [];
    const categories = new Map(index.categories.map((id) => [id, 0]));
    const capabilities = new Map(index.capabilities.map((id) => [id, 0]));
    const orgs = new Map(index.orgs.map((id) => [id, 0]));
    const matches = [];
    const increment = (map, ids) => ids.forEach((id) => { if (map.has(id)) map.set(id, map.get(id) + 1); });
    for (const record of index.records) {
      if ((state.events && !record.events) || (state.deploy && !record.deploy)) continue;
      const score = searchScore(record, tokens, phrase);
      if (score < 0) continue;
      const categoryOK = !state.category || record.categories.includes(state.category);
      const capabilityOK = !state.capability || record.capabilities.includes(state.capability);
      const orgOK = !state.org || record.org === state.org;
      // A facet ignores only itself: alternatives remain visible with counts for the other active filters.
      if (capabilityOK && orgOK) increment(categories, record.categories);
      if (categoryOK && orgOK) increment(capabilities, record.capabilities);
      if (categoryOK && capabilityOK) increment(orgs, [record.org]);
      if (categoryOK && capabilityOK && orgOK) matches.push({ record, score });
    }
    matches.sort((a, b) => {
      if (state.sort === 'operations' && a.record.operations !== b.record.operations) return b.record.operations - a.record.operations;
      if (state.sort === 'relevance' && a.score !== b.score) return b.score - a.score;
      const labelOrder = collators[language].compare(a.record.labels[language], b.record.labels[language]);
      if (labelOrder) return labelOrder;
      if (a.record.ref !== b.record.ref) return a.record.ref < b.record.ref ? -1 : 1;
      return a.record.position - b.record.position;
    });
    const total = matches.length;
    const pages = Math.max(1, Math.ceil(total / state.size));
    const page = Math.min(state.page, pages);
    const start = (page - 1) * state.size;
    const facets = (map) => [...map].map(([id, value]) => ({ id, count: value }));
    return {
      items: matches.slice(start, start + state.size).map((m) => m.record.plugin),
      total, page, pages, from: total ? start + 1 : 0, to: Math.min(start + state.size, total),
      facets: { categories: facets(categories), capabilities: facets(capabilities), orgs: facets(orgs) },
    };
  }

  return { CATEGORIES, CAP_NAMES, DEFAULT_STATE, categoryIds, categoryLabel, createIndex, query, parseState, writeState, publisherSource };
});
