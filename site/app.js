// The registry page: renders the catalog from the same index.json platforms read.
//
// It is not a separate catalog, just another front end for the same index: two separately maintained catalogs
// eventually disagree, and people look in their platform for what they saw here.
//
// No framework, no build step: a page that reads JSON and renders a list. The published tree (build-index -site)
// puts it next to what it reads:
//
//   index.json                  the catalog
//   advisories.json             security advisories (versions to avoid)
//   details/<org>/<name>.json   one plugin's full manifest with its doc (the detail view)
//
// Home, full catalog (#/plugins), advisories and plugin details have separate hash routes.

const BASE = new URL(new URLSearchParams(location.search).get('base') || './', location.href);
const at = (rel) => new URL(rel, BASE).href;
const REPO = 'https://github.com/sokel-dev/sokel-registry';

// Return target: a platform links here with ?platform=https://its-address, so one-click install goes back there;
// otherwise the visitor types it once. The address stays in this browser: a self-hosted platform's address is
// internal and must never be sent anywhere.
const PLATFORM_KEY = 'sokel.market.platform';
function platformURL() {
  const q = new URLSearchParams(location.search).get('platform');
  if (q) { try { localStorage.setItem(PLATFORM_KEY, q); } catch { /* private browsing */ } return q; }
  try { return localStorage.getItem(PLATFORM_KEY) || ''; } catch { return ''; }
}

// --- language ---------------------------------------------------------------------------------------------
// The page's own strings are keyed by their Chinese text with an English entry; plugin strings come from each
// plugin's own locale table (index i18n for cards, details locales for the detail view). Untranslated = as written.
const LANG_KEY = 'sokel.market.lang';
let LANG = (() => {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'zh' || q === 'en') return q;
  try { const s = localStorage.getItem(LANG_KEY); if (s === 'zh' || s === 'en') return s; } catch { /* ignore */ }
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
})();
const EN = {
  '首页': 'Home',
  '浏览全部插件': 'Explore all plugins',
  '查看全部': 'View all',
  '← 返回首页': '← Back to home',
  '消息、通知与日常协作，让工作流接上团队正在用的工具。': 'Connect workflows to the tools your team uses for messaging, notifications and collaboration.',
  '数据库、知识库与记忆，把已有的数据带进工作流。': 'Bring your data into workflows with databases, knowledge stores and memory.',
  '对话、嵌入、图像和语音，选择适合任务的模型服务。': 'Choose model services for chat, embeddings, images and speech.',
  '找到适合你的插件': 'Find the right plugin',
  '按用途发现插件，按能力缩小范围。安装前查看操作、凭证与部署方式。': 'Explore by use case, narrow by capability. Check operations, credentials and deployment before installing.',
  '业务分类': 'Use cases',
  '筛选': 'Filters',
  '发布者': 'Publisher',
  '第三方发布': 'Third-party publisher',
  '第三方插件': 'Third-party plugin',
  '此插件由第三方发布者维护。插件可能访问你授权的数据和凭证，请核对发布者、代码来源及所需权限，并仅授予必要的访问权限。': 'This plugin is maintained by a third-party publisher. It may access data and credentials you authorize. Verify the publisher, code source and required permissions, and grant only the access it needs.',
  '来源待确认': 'Unconfirmed source',
  '无法从目录标识确认此插件的发布者。安装前请核对发布者、代码来源及所需权限，并仅授予必要的访问权限。': 'The registry reference does not identify this plugin’s publisher. Before installing, verify the publisher, code source and required permissions, and grant only the access it needs.',
  '全部发布者': 'All publishers',
  '全部能力': 'All capabilities',
  '只看支持事件触发': 'With event triggers',
  '只看提供部署产物': 'With deployment artifacts',
  '提供部署产物': 'Deployment artifacts',
  '默认 / 相关性': 'Default / relevance',
  '名称 A–Z': 'Name A–Z',
  '操作数量': 'Operation count',
  '排序': 'Sort by',
  '卡片视图': 'Grid view',
  '列表视图': 'List view',
  '每页': 'Per page',
  '上一页': 'Previous',
  '下一页': 'Next',
  '第 {n} 页': 'Page {n}',
  '第 {from}–{to} 项，共 {total} 个插件': '{from}–{to} of {total} plugins',
  '共 {n} 个匹配插件': '{n} matching plugins',
  '移除筛选：': 'Remove filter: ',
  '目录分页': 'Catalog pages',
  '搜索操作名称、标识或说明…': 'Search operation name, ID or description…',
  '没有匹配的操作': 'No matching operations',
  '第 {from}–{to} 项，共 {total} 个操作': '{from}–{to} of {total} operations',
  '展开查看参数': 'Expand to view fields',
  '搜索': 'Search',
  '安全通告暂时不可用': 'Advisories are temporarily unavailable',
  '尚未完成安全通告检查': 'Advisory check pending',
  '未声明部署产物，接入方式请查看使用说明。': 'No deployment artifacts are declared. See the docs for connection instructions.',
  '目录视图': 'Catalog view',
  '主导航': 'Main navigation',
  '插件目录': 'Plugin Registry',
  '插件': 'Plugins',
  '安全通告': 'Advisories',
  '提交插件': 'Submit a plugin',
  'Sokel 工作流平台的插件。装之前就能看到它能做什么、要哪些凭证、要不要自己部署——共 {n} 个。': 'Plugins for the Sokel workflow platform: see what each one does, which credentials it needs and whether you run it yourself before you install. {n} in total.',
  '这个页面读的是平台读的同一份 index.json——不是另一份目录。想加插件或发新版本？在 GitHub 上提 PR。': 'This page reads the same index.json platforms read; it is not a second catalog. Adding a plugin or a new version? Open a pull request on GitHub.',
  '搜索插件': 'Search plugins',
  '全部': 'All',
  '可自部署': 'Self-hostable',
  '{n} 种语言': '{n} languages',
  '该插件没有提供说明。': 'No description.',
  '操作': 'Operations',
  '事件': 'Events',
  '安装到我的平台': 'Install to my platform',
  '没有匹配的插件': 'No matching plugins',
  '← 返回插件目录': '← All plugins',
  '读取中…': 'Loading…',
  '目录里没有这个插件': 'No such plugin in the registry',
  '插件详情读不到': 'Could not load plugin details',
  '条目在索引里，但它的详情文件拉不到。': 'The entry is in the index, but its details file could not be fetched.',
  '使用说明': 'Docs',
  '凭证': 'Credentials',
  '该插件没有提供使用说明。': 'This plugin has no docs.',
  '该插件没有可编排的操作。': 'This plugin has no operations to put on a canvas.',
  '说明': 'Description',
  '入参': 'Inputs',
  '出参': 'Outputs',
  '字段': 'Field',
  '类型': 'Type',
  '流式': 'Streaming',
  '怎么接上': 'How it runs',
  '自行部署': 'Self-host',
  '在能连通目标服务的机器上跑一个副本，用接入组的 token 连回平台。可用产物：': 'Run a replica on a machine that can reach the service and connect it to your platform with an access group token. Artifacts:',
  '它以独立进程接入平台：在能连通目标服务的机器上跑一个副本。这个条目没有声明部署产物，启动方式见「使用说明」。': 'It joins your platform as a separate process: run a replica on a machine that can reach the service. This entry declares no artifact; see Docs for how to start it.',
  '你的平台是否已内置它，要在平台的插件市场里看。': 'Whether your platform already ships it is shown in the platform’s own marketplace.',
  '插件索引读不到': 'Could not load the plugin index',
  '这不代表目录里没有插件——索引没配好或拉取失败时也会这样。': 'This does not mean there are no plugins: a misconfigured or unreachable index looks like this too.',
  '索引里一条插件都没有': 'The index has no plugins',
  '索引不可用': 'Index unavailable',
  '你的平台地址（例如 https://sokel.example.com）': 'Your platform address (e.g. https://sokel.example.com)',
  '当前版本有安全通告': 'Advisory on this version',
  '当前版本被拦截': 'This version is blocked',
  '这个版本被标记为有问题：': 'This version is flagged: ',
  '拦截级：平台会拒绝调用这个版本。': 'Block level: platforms refuse calls to this version.',
  '详情': 'Details',
  '受影响版本': 'Affected versions',
  '提醒': 'Warn',
  '拦截': 'Block',
  '标记有问题的插件版本。平台随目录读取这份文件：命中已装版本会标红，「拦截」级还会拒绝调用。要报告问题，在 GitHub 上提 PR 改 advisories.json，或开 issue。': 'Plugin versions with a known problem. Platforms read this file with the catalog: an installed version that matches is flagged, and block-level advisories also refuse its calls. To report one, open a pull request editing advisories.json, or an issue.',
  '目前没有安全通告。': 'No advisories right now.',
  '安全通告读不到': 'Could not load advisories',
  "Sokel 插件目录": "Sokel Plugin Registry",
  "把工作流接到{em}你已经在用的一切{/em}": "Connect your workflows to {em}everything you already use{/em}",
  "Sokel 工作流平台的插件。装之前就能看到它能做什么、要哪些凭证、要不要自己部署。": "Plugins for the Sokel workflow platform: see what each one does, which credentials it needs and whether you run it yourself before you install.",
  "全部插件": "All plugins",
  "清除筛选": "Clear",
  "分类": "Categories",
  "安装": "Install",
  "搜索插件、能力或服务…": "Search plugins, capabilities or services…",
  "{n} 个操作": "{n} operations",
  "可触发": "Triggers",
  "个插件": "plugins",
  "种平台能力": "capabilities",
  "个能触发工作流": "can trigger workflows",
  "个可自部署": "self-hostable",
  "模型与生成": "Models & generation",
  "数据与检索": "Data & retrieval",
  "应用与服务": "Apps & services",
  "对话、嵌入、重排、图像 / 视频 / 语音生成与识别": "Chat, embeddings, reranking, image / video / speech generation and recognition",
  "向量库、数据表、对象存储、记忆与网页搜索": "Vector stores, tables, object storage, memory and web search",
  "消息、社交、开发运维、办公与数据源": "Messaging, social, dev & ops, productivity and data sources",
  "对话模型": "Chat",
  "向量嵌入": "Embedding",
  "重排序": "Rerank",
  "图像生成": "Image generation",
  "视频生成": "Video generation",
  "语音合成": "Text to speech",
  "语音识别": "Speech to text",
  "模型目录": "Model catalog",
  "向量库": "Vector store",
  "关键词检索（n-gram）": "Keyword search (n-gram)",
  "关键词检索（BM25）": "Keyword search (BM25)",
  "数据表存储": "Table storage",
  "对象存储": "Object storage",
  "对话记忆": "Chat memory",
  "网页搜索": "Web search",
  "能力": "Capabilities",
  "部署": "Deployment",
  "暂无": "None",
  "复制": "Copy",
  "安装到你的平台": "Install to your platform",
  "这个页面不会连接你的平台：「前往安装」会打开你平台的插件市场，在那边选择空间并确认。": "This page never talks to your platform: “Continue” opens your platform’s marketplace, where you pick the workspace and confirm.",
  "平台地址": "Platform address",
  "记住这个地址（只保存在这个浏览器里）": "Remember this address (stored only in this browser)",
  "将打开": "Opens",
  "前往安装": "Continue",
  "取消": "Cancel",
  "请填写平台地址": "Enter your platform address",
  "地址格式不对，例如 https://sokel.example.com": "That is not an address, e.g. https://sokel.example.com",
  "重试": "Retry",
  "换个关键词，或清除筛选看全部插件。": "Try another search, or clear the filters to see every plugin.",
  "关闭": "Close",
  "已复制": "Copied",
  "复制失败，请手动选择": "Copy failed; select it by hand",
  "下载": "Download",
  "Manifest 读不到": "Could not load the manifest",
  "这就是平台读的那份 manifest：装进自己的平台可以用「导入 manifest」，写新插件可以拿它当模板。": "This is the manifest platforms read: install it into your own platform with “Import manifest”, or start a new plugin from it.",
};
const t = (s) => (LANG === 'en' && EN[s]) || s;

// --- helpers ----------------------------------------------------------------------------------------------
const HUES = ['#ec4899', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6'];
function colorOf(ref) {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}
const initial = (s) => (s || '?').trim().charAt(0).toUpperCase();
// Manifests use both styles (v1.0.0 / 1.0.0); blindly adding a prefix would render vv1.0.0.
const verLabel = (v) => (String(v).startsWith('v') ? String(v) : 'v' + v);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Card strings: the index's i18n carries the translated label / desc per language.
function pluginLocale(tables) {
  if (!tables) return {};
  return LANG === 'zh' ? { ...(tables.zh || {}), ...(tables['zh-CN'] || {}) } : (tables.en || {});
}
const cardText = (p, k) => pluginLocale(p.i18n)[k] || p[k];

// --- icons -------------------------------------------------------------------------------------------------
// Brand marks come from the platform's own brand registry (brands.js, generated), inferred from the ref and names the
// same way the platform does. Plugins without a brand get a line glyph for what they do, then a letter.
const BRANDS = window.SOKEL_BRANDS || {};
const BRAND_RULES = (window.SOKEL_BRAND_RULES || []).map(([src, flags, id]) => [new RegExp(src, flags), id]);
const line = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const GLYPHS = {
  globe: line('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  database: line('<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>'),
  box: line('<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>'),
  history: line('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  search: line('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  chat: line('<path d="M21 12a8 8 0 0 1-11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12z"/>'),
  layers: line('<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
  code: line('<path d="m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"/>'),
  mail: line('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  chart: line('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  pulse: line('<path d="M3 12h4l3-8 4 16 3-8h4"/>'),
  book: line('<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/>'),
  bell: line('<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
};
// What a brandless plugin shows: by name first (a few well-known functional plugins), then by its first capability.
const NAME_GLYPHS = [[/http-probe/, 'pulse'], [/(^|\/)http$/, 'globe'], [/sandbox/, 'code'], [/registry-tools/, 'box'],
  [/submail|mail/, 'mail'], [/umeng|push/, 'bell'], [/tushare|xueqiu|stock|finance/, 'chart'], [/kbstore/, 'book']];
const CAP_GLYPHS = [[/^vectorstore/, 'database'], [/^rowstore/, 'database'], [/^objectstore/, 'box'], [/^memory/, 'history'],
  [/^websearch/, 'search'], [/^llm|^model_catalog/, 'chat'], [/^embedding|^rerank/, 'layers']];
function iconOf(p) {
  // A declared icon wins: brand:<id> draws that mark; a file (icon.svg / icon.png) is published with the entry and
  // drawn as an image (never inlined, so nothing in it can run).
  const declared = String(p.icon || '');
  if (declared.startsWith('brand:') && BRANDS[declared.slice(6)]) {
    const b = BRANDS[declared.slice(6)];
    return { svg: b.svg, color: b.color, branded: true };
  }
  if (declared && !declared.startsWith('brand:')) {
    return { img: at(`plugins/${p.ref}/${declared}`), color: colorOf(p.ref), branded: true };
  }
  const hay = `${p.ref} ${p.name} ${p.label || ''}`;
  const brand = BRAND_RULES.find(([re]) => re.test(hay));
  if (brand && BRANDS[brand[1]]) return { svg: BRANDS[brand[1]].svg, color: BRANDS[brand[1]].color, branded: true };
  const color = colorOf(p.ref);
  const byName = NAME_GLYPHS.find(([re]) => re.test(p.ref));
  if (byName) return { svg: GLYPHS[byName[1]], color };
  const cap = (p.capabilities || []).map((c) => CAP_GLYPHS.find(([re]) => re.test(c))).find(Boolean);
  if (cap) return { svg: GLYPHS[cap[1]], color };
  return { letter: initial(cardText(p, 'label') || p.name), color };
}
const iconHTML = (p, cls = '') => {
  const ic = iconOf(p);
  const inner = ic.img ? `<img src="${esc(ic.img)}" alt="" loading="lazy">` : (ic.svg || `<i>${esc(ic.letter)}</i>`);
  return `<span class="ico ${cls}" style="--c:${ic.color}">${inner}</span>`;
};

// --- versions and advisories (same rules as the platform: build-index / ADVISORIES.md) ---------------------
function splitVersion(v) {
  const s = String(v || '').trim().replace(/^v/, '');
  const [core, ...pre] = s.split('-');
  const n = core.split('.').map((x) => parseInt(x, 10) || 0);
  return [[n[0] || 0, n[1] || 0, n[2] || 0], pre.join('-')];
}
function cmpVersion(a, b) {
  const [ca, pa] = splitVersion(a);
  const [cb, pb] = splitVersion(b);
  for (let i = 0; i < 3; i++) if (ca[i] !== cb[i]) return ca[i] < cb[i] ? -1 : 1;
  if (pa === pb) return 0;
  if (!pa) return 1;
  if (!pb) return -1;
  const ia = pa.split('.'), ib = pb.split('.');
  for (let i = 0; i < Math.min(ia.length, ib.length); i++) {
    if (ia[i] === ib[i]) continue;
    const na = /^\d+$/.test(ia[i]), nb = /^\d+$/.test(ib[i]);
    if (na && nb) return Number(ia[i]) < Number(ib[i]) ? -1 : 1;
    if (na) return -1;
    if (nb) return 1;
    return ia[i] < ib[i] ? -1 : 1;
  }
  return ia.length === ib.length ? 0 : (ia.length < ib.length ? -1 : 1);
}
function versionHits(expr, v) {
  const m = String(expr).match(/^(<=|>=|<|>)(.+)$/);
  if (!m) return splitVersion(expr).join() === splitVersion(v).join();
  const c = cmpVersion(v, m[2]);
  return { '<': c < 0, '<=': c <= 0, '>': c > 0, '>=': c >= 0 }[m[1]];
}
// advisoryFor: the advisory that hits the catalog's current version (block wins over warn).
function advisoryFor(p) {
  const hits = ADV.filter((a) => a.ref === p.ref && (a.versions || []).some((x) => versionHits(x, p.version)));
  return hits.find((a) => a.severity === 'block') || hits[0] || null;
}
const advBadge = (a) => (a
  ? `<span class="adv ${a.severity === 'block' ? 'block' : 'warn'}" title="${esc(a.reason)}">${esc(t(a.severity === 'block' ? '当前版本被拦截' : '当前版本有安全通告'))}</span>`
  : '');

// --- state ------------------------------------------------------------------------------------------------
let ALL = [];
let ADV = [];
let advOK = true;
let advReady = false;
const CATALOG = window.SOKEL_CATALOG;
let STATE = CATALOG.parseState(location.search);
let INDEX = null;
let RESULT = null;
const capName = (id) => {
  const entry = CATALOG.CAP_NAMES[id];
  return entry ? (LANG === 'en' ? entry.en : entry.label) : id;
};
const categoryName = (id) => CATALOG.categoryLabel(id, LANG);
const format = (message, values) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), t(message));
const hasFilters = () => STATE.q || STATE.category || STATE.capability || STATE.org || STATE.events || STATE.deploy;

// The registry reserves the sokel namespace. Display names, translated descriptions and the
// downloaded manifest cannot turn another publisher's canonical ref into a first-party entry.
function publisherBadge(ref) {
  const source = CATALOG.publisherSource(ref);
  return source === 'official' ? '' : `<span class="pill publisher-source">${esc(t(source === 'third_party' ? '第三方发布' : '来源待确认'))}</span>`;
}
function publisherRisk(ref) {
  const source = CATALOG.publisherSource(ref);
  if (source === 'official') return '';
  const title = source === 'third_party' ? '第三方插件' : '来源待确认';
  const message = source === 'third_party'
    ? '此插件由第三方发布者维护。插件可能访问你授权的数据和凭证，请核对发布者、代码来源及所需权限，并仅授予必要的访问权限。'
    : '无法从目录标识确认此插件的发布者。安装前请核对发布者、代码来源及所需权限，并仅授予必要的访问权限。';
  return `<aside class="publisher-risk" aria-label="${esc(t(title))}"><strong>${esc(t(title))}</strong><p>${esc(t(message))}</p></aside>`;
}

function stateURL() {
  const u = new URL(location.href);
  u.search = CATALOG.writeState(u.search, STATE).toString();
  u.searchParams.set('lang', LANG);
  return u;
}
function updateState(patch, { replace = false, scroll = false } = {}) {
  STATE = { ...STATE, page: 1, ...patch };
  history[replace ? 'replaceState' : 'pushState'](null, '', stateURL());
  render();
  if (scroll) document.getElementById('catalog-main').scrollIntoView({ block: 'start' });
}
function clearFilters() {
  updateState({ q: '', category: '', capability: '', org: '', events: false, deploy: false });
}
function catalogURL(patch = {}) {
  const u = new URL(location.href);
  u.search = CATALOG.writeState(u.search, { ...CATALOG.DEFAULT_STATE, ...patch }).toString();
  u.hash = '/plugins';
  return u;
}
function openCatalog(patch = {}) {
  STATE = { ...CATALOG.DEFAULT_STATE, view: STATE.view, size: STATE.size, ...patch };
  const u = stateURL(); u.hash = '/plugins';
  history.pushState(null, '', u);
  render(); route();
}

// A card contains only catalog facts. Full contracts stay behind the detail link.
function card(p, variant = 'directory') {
  const title = cardText(p, 'label') || p.name;
  const caps = p.capabilities || [];
  const shown = caps.slice(0, 2).map((c) => `<span class="pill">${esc(capName(c))}</span>`).join('');
  const more = caps.length > 2 ? `<span class="pill more" title="${esc(caps.slice(2).map(capName).join(', '))}">+${caps.length - 2}</span>` : '';
  return `<a class="card" href="#/${esc(p.ref)}">
    <div class="chead">${iconHTML(p)}<div class="hmain">
      <div class="name" title="${esc(title)}">${esc(title)}</div>
      <div class="publisher-line"><span class="cref mono" title="${esc(p.ref)}">${esc(p.ref)}</span>${publisherBadge(p.ref)}</div>
    </div><svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></div>
    <p class="desc" title="${esc(cardText(p, 'desc') || '')}">${esc(cardText(p, 'desc') || t('该插件没有提供说明。'))}</p>
    ${variant === 'home' ? '' : `<div class="meta"><span class="category">${esc(CATALOG.categoryIds(p).map(categoryName).join(' · '))}</span>
      ${p.version ? `<span class="version mono">${esc(verLabel(p.version))}</span>` : ''}</div>`}
    <div class="cfoot"><div class="tags">${shown}${more}${p.events ? `<span class="pill ev">${esc(t('可触发'))}</span>` : ''}${advBadge(advisoryFor(p))}</div>
      <span class="ops mono${p.operations ? '' : ' zero'}">${esc(t('{n} 个操作').replace('{n}', p.operations || 0))}</span></div>
  </a>`;
}

function filterSelect(id, title, all, values, selected, label) {
  const options = values.some((v) => v.id === selected) || !selected ? values : [...values, { id: selected, count: 0 }];
  return `<label class="filter-select" for="${id}"><span>${esc(title)}</span><select id="${id}">
    <option value="">${esc(all)}</option>${options.map((v) => `<option value="${esc(v.id)}"${v.id === selected ? ' selected' : ''}>${esc(label(v.id))} (${v.count})</option>`).join('')}
  </select></label>`;
}
function renderFilters() {
  if (!RESULT) return;
  const cats = [...RESULT.facets.categories];
  if (STATE.category && !cats.some((c) => c.id === STATE.category)) cats.push({ id: STATE.category, count: 0 });
  const item = (id, label, count) => `<button type="button" class="sideitem filter-option" aria-pressed="${STATE.category === id}" data-category="${esc(id)}">
    <span>${esc(label)}</span>${count === undefined ? '' : `<span class="n mono">${count}</span>`}</button>`;
  document.getElementById('side').innerHTML = `<section class="filter-section"><h3>${esc(t('业务分类'))}</h3>
    ${item('', t('全部插件'))}${cats.map((c) => item(c.id, categoryName(c.id), c.count)).join('')}</section>
    <section class="filter-section">
    ${filterSelect('capability', t('能力'), t('全部能力'), RESULT.facets.capabilities, STATE.capability, capName)}
    ${filterSelect('publisher', t('发布者'), t('全部发布者'), RESULT.facets.orgs, STATE.org, (s) => s)}
    <label class="filter-check"><input id="events" type="checkbox"${STATE.events ? ' checked' : ''}><span>${esc(t('只看支持事件触发'))}</span></label>
    <label class="filter-check"><input id="deploy" type="checkbox"${STATE.deploy ? ' checked' : ''}><span>${esc(t('只看提供部署产物'))}</span></label>
    </section>`;
  const count = ['category', 'capability', 'org', 'events', 'deploy'].filter((k) => STATE[k]).length;
  document.getElementById('filter-summary').textContent = t('筛选') + (count ? ` (${count})` : '');
}
function renderChips() {
  const chips = [
    ['q', STATE.q && `${t('搜索')}: ${STATE.q}`], ['category', STATE.category && categoryName(STATE.category)],
    ['capability', STATE.capability && capName(STATE.capability)], ['org', STATE.org && `${t('发布者')}: ${STATE.org}`],
    ['events', STATE.events && t('可触发')], ['deploy', STATE.deploy && t('提供部署产物')],
  ].filter(([, label]) => label);
  document.getElementById('active-filters').innerHTML = chips.map(([key, label]) => `<button type="button" class="filter-chip" data-remove-filter="${key}" aria-label="${esc(t('移除筛选：') + label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('');
}
function pagination(page, pages, attr = 'page') {
  const indices = [...new Set([1, pages, page - 1, page, page + 1])].filter((n) => n > 0 && n <= pages).sort((a, b) => a - b);
  const button = (n, label, disabled, current = false) => `<button type="button" class="page-button" data-${attr}="${n}"${disabled ? ' disabled' : ''}${current ? ' aria-current="page"' : ''} aria-label="${esc(typeof label === 'number' ? format('第 {n} 页', { n }) : label)}">${esc(label)}</button>`;
  return `<div class="pagination-controls">${button(page - 1, t('上一页'), page <= 1)}${indices.map((n, i) =>
    `${i && n > indices[i - 1] + 1 ? '<span class="page-gap" aria-hidden="true">…</span>' : ''}${button(n, n, false, n === page)}`).join('')}${button(page + 1, t('下一页'), page >= pages)}</div>`;
}
function render() {
  if (!INDEX) return;
  const active = document.activeElement;
  const focusedId = active?.id;
  const focusedCategory = active?.dataset?.category;
  RESULT = CATALOG.query(INDEX, STATE, LANG);
  if (STATE.page !== RESULT.page) {
    STATE.page = RESULT.page;
    history.replaceState(null, '', stateURL());
  }
  const title = STATE.category ? categoryName(STATE.category) : t('全部插件');
  document.getElementById('q').value = STATE.q;
  document.getElementById('sort').value = STATE.sort;
  document.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === STATE.view));
  document.getElementById('resulthead').innerHTML = `<h2>${esc(title)}</h2><span class="result-summary" role="status" aria-live="polite">${esc(format('共 {n} 个匹配插件', {n: RESULT.total}))}</span>
    ${hasFilters() ? `<button type="button" class="clear" data-clear-filters>${esc(t('清除筛选'))}</button>` : ''}
    ${RESULT.pages > 1 ? `<div class="mini-pagination"><button type="button" class="page-button" data-page="${RESULT.page - 1}"${RESULT.page === 1 ? ' disabled' : ''} aria-label="${esc(t('上一页'))}">‹</button><span class="mono">${RESULT.page} / ${RESULT.pages}</span><button type="button" class="page-button" data-page="${RESULT.page + 1}"${RESULT.page === RESULT.pages ? ' disabled' : ''} aria-label="${esc(t('下一页'))}">›</button></div>` : ''}`;
  renderFilters(); renderChips();
  document.getElementById('grid').innerHTML = RESULT.total
    ? `<div class="${STATE.view === 'list' ? 'plugin-list' : 'grid'}">${RESULT.items.map(card).join('')}</div>`
    : `<div class="emptybox">${GLYPHS.search}<b>${esc(t('没有匹配的插件'))}</b><span>${esc(t('换个关键词，或清除筛选看全部插件。'))}</span>
      <button type="button" class="cbtn" data-clear-filters>${esc(t('清除筛选'))}</button></div>`;
  document.getElementById('pagination').innerHTML = `<span class="result-summary">${esc(format('第 {from}–{to} 项，共 {total} 个插件', RESULT))}</span>
    ${pagination(RESULT.page, RESULT.pages)}<label class="page-size">${esc(t('每页'))}<select id="page-size" aria-label="${esc(t('每页'))}">${[24,48,96].map((n) => `<option value="${n}"${STATE.size === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`;
  // Replacing the filter controls must not discard the keyboard user's focus.
  if (focusedId && !active.isConnected) document.getElementById(focusedId)?.focus({ preventScroll: true });
  if (focusedCategory !== undefined && !active.isConnected) [...document.querySelectorAll('[data-category]')].find((b) => b.dataset.category === focusedCategory)?.focus({ preventScroll: true });
}
function renderStats() {
  const cells = [[ALL.length, '个插件'], [new Set(ALL.flatMap((p) => p.capabilities || [])).size, '种平台能力'],
    [ALL.filter((p) => p.events).length, '个能触发工作流']];
  document.getElementById('stats').innerHTML = cells.map(([n, label]) => `<div><dt class="mono">${n}</dt><dd>${esc(t(label))}</dd></div>`).join('');
}
function renderHome() {
  if (!INDEX) return;
  const seen = new Set();
  const picks = ALL.filter((p) => {
    const ic = iconOf(p);
    if (!ic.branded) return false;
    const key = ic.svg || ic.img;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).slice(0, 20);
  document.getElementById('cloud').innerHTML = picks.map((p, i) => `<a href="#/${esc(p.ref)}" tabindex="-1" style="--i:${i}" title="${esc(cardText(p, 'label') || p.name)}">${iconHTML(p, 'lg')}</a>`).join('');
  const shelves = [
    ['ai', '模型与生成', '对话、嵌入、图像和语音，选择适合任务的模型服务。'],
    ['communication', '消息与通知', '消息、通知与日常协作，让工作流接上团队正在用的工具。'],
    ['data', '数据与知识库', '数据库、知识库与记忆，把已有的数据带进工作流。'],
  ];
  document.getElementById('home-shelves').innerHTML = shelves.map(([category, title, desc]) => {
    const found = CATALOG.query(INDEX, { ...CATALOG.DEFAULT_STATE, category }, LANG);
    if (!found.total) return '';
    const label = category === 'ai' ? t(title) : categoryName(category);
    return `<section class="shelf"><div class="shelfhead"><div><h2>${esc(label)} <span class="count mono">${found.total}</span></h2><p class="shelfdesc">${esc(t(desc))}</p></div>
      <a class="shelf-more" href="${esc(catalogURL({category}).href)}" data-open-catalog="${category}">${esc(t('查看全部'))} <span aria-hidden="true">↗</span></a></div>
      <div class="grid">${found.items.slice(0, 6).map((p) => card(p, 'home')).join('')}</div></section>`;
  }).join('') + `<div class="home-actions"><a class="install ghost" href="${esc(catalogURL().href)}" data-open-catalog="">${esc(t('浏览全部插件'))} <span aria-hidden="true">↗</span></a></div>`;
}

// --- skeletons ------------------------------------------------------------------------------------------
// Placeholders shaped like what is coming, so the page does not jump when it arrives.
const sk = (w, h = 12, extra = '') => `<span class="sk" style="width:${w};height:${h}px;${extra}"></span>`;
const skCard = () => `<div class="card skcard" aria-hidden="true"><div class="chead">${sk('38px', 38, 'border-radius:10px')}
  <div class="hmain">${sk('55%', 13)}${sk('38%', 10, 'margin-top:6px')}</div></div>
  <div>${sk('100%', 11)}${sk('80%', 11, 'margin-top:7px')}</div><div class="cfoot">${sk('64px', 18, 'border-radius:999px')}${sk('48px', 10, 'margin-inline-start:auto')}</div></div>`;
function skList() {
  document.getElementById('grid').innerHTML = `<div class="grid">${Array.from({ length: 9 }, skCard).join('')}</div>`;
  document.getElementById('side').innerHTML = Array.from({ length: 8 }, (_, i) =>
    `<div class="sideitem${i % 3 ? ' sub' : ''}" aria-hidden="true">${sk(i % 3 ? '60%' : '75%', 11)}</div>`).join('');
  document.getElementById('stats').innerHTML = Array.from({ length: 4 }, () =>
    `<div aria-hidden="true">${sk('44px', 24)}${sk('64px', 10, 'margin-top:8px')}</div>`).join('');
}
const skDetail = () => `<div aria-busy="true"><div class="dhead">${sk('64px', 64, 'border-radius:18px;flex:0 0 64px')}
  <div style="flex:1;min-width:0">${sk('38%', 26)}${sk('24%', 11, 'margin-top:10px')}${sk('70%', 12, 'margin-top:18px')}${sk('55%', 12, 'margin-top:8px')}</div>
  ${sk('150px', 42, 'border-radius:999px')}</div>
  <div class="panel">${sk('90px', 12)}${sk('80%', 12, 'margin-top:12px')}</div>
  <div class="dtabs">${sk('320px', 36, 'border-radius:999px')}</div>
  <div class="panel">${Array.from({ length: 6 }, (_, i) => sk(`${[92, 76, 84, 60, 88, 40][i]}%`, 12, i ? 'margin-top:12px' : '')).join('')}</div></div>`;
const skCode = () => `<div class="code" aria-busy="true"><div class="codebar">${sk('90px', 11)}<span class="codeacts">${sk('58px', 26, 'border-radius:999px')}${sk('58px', 26, 'border-radius:999px')}</span></div>
  <div style="padding:16px 20px">${Array.from({ length: 12 }, (_, i) => sk(`${[30, 46, 62, 40, 52, 34, 58, 44, 28, 50, 38, 24][i]}%`, 11, `margin:0 0 10px ${[0, 1, 2, 2, 2, 2, 1, 2, 2, 0, 1, 2][i] * 18}px`)).join('')}</div></div>`;

// --- detail -----------------------------------------------------------------------------------------------
// md: plugin docs are Markdown with many tables; a parser is loaded, and if it failed the doc shows as plain text.
function md(text) {
  if (window.marked) {
    try { return window.marked.parse(text); } catch { /* fall back to plain text */ }
  }
  return `<pre class="plaindoc">${esc(text)}</pre>`;
}

// tr: a plugin's own string in the reader's language, from its locale table (source text -> translation).
const tr = (s) => (s && pluginLocale(CUR && CUR.c.locales)[s]) || s;

function fieldList(fields) {
  if (!fields || !fields.length) return '<span class="dash">—</span>';
  return fields.map((f) => `
    <div class="field">
      <code>${esc(f.name)}</code>
      ${f.type ? `<span class="ftype">${esc(f.type)}</span>` : ''}
      ${f.required ? '<span class="req">*</span>' : ''}
      ${f.desc || f.label ? `<div class="fdesc">${esc(tr(f.desc || f.label))}</div>` : ''}
    </div>`).join('');
}

function howToRun(entry) {
  const targets = entry.deploy || [];
  const body = targets.length
    ? `${esc(t('在能连通目标服务的机器上跑一个副本，用接入组的 token 连回平台。可用产物：'))}
       ${targets.map((k) => `<span class="pill mono">${esc(k)}</span>`).join(' ')}`
    : esc(t('未声明部署产物，接入方式请查看使用说明。'));
  return `<div class="panel">
    <div class="ptitle">${esc(t('怎么接上'))}</div>
    <div class="prow">${targets.length ? `<span class="plabel">${esc(t('自行部署'))}</span>` : ''}<span>${body}</span></div>
    <div class="pnote">${esc(t('你的平台是否已内置它，要在平台的插件市场里看。'))}</div>
  </div>`;
}

const TABS = [
  { key: 'doc', label: () => t('使用说明') },
  { key: 'ops', label: (c) => `${t('操作')} (${(c.operations || []).filter((o) => !o.internal).length})` },
  { key: 'events', label: (c) => `${t('事件')} (${(c.events || []).length})`, when: (c) => (c.events || []).length },
  { key: 'cred', label: () => t('凭证'), when: (c) => (c.credential_schema || []).length },
  { key: 'manifest', label: () => 'Manifest' },
];

// --- manifest ---------------------------------------------------------------------------------------------
// The entry's manifest as published (the file platforms read), fetched when the tab opens: read, copy, download.
const MANIFESTS = {}; // ref -> { text } | { error }
async function loadManifest(entry) {
  if (MANIFESTS[entry.ref]) return;
  try {
    const res = await fetch(at(entry.manifest));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    MANIFESTS[entry.ref] = { text: await res.text() };
  } catch (e) {
    MANIFESTS[entry.ref] = { error: e.message };
  }
  if (CUR && CUR.entry.ref === entry.ref && tab === 'manifest') renderDetail(CUR.entry, CUR.c);
}
// yamlLines: a light YAML colouring (keys, comments, list dashes) over escaped text, one numbered line each.
function yamlLines(text) {
  return text.replace(/\n$/, '').split('\n').map((raw) => {
    let h = esc(raw);
    const hash = h.search(/(^|\s)#/);
    let comment = '';
    if (hash >= 0) { comment = `<span class="yc">${h.slice(hash)}</span>`; h = h.slice(0, hash); }
    h = h.replace(/^(\s*)(- )?([\w.\-"']+)(:)(?=\s|$)/, (_, sp, dash, key, colon) =>
      `${sp}${dash ? '<span class="yd">- </span>' : ''}<span class="yk">${key}</span>${colon}`);
    h = h.replace(/^(\s*)- /, '$1<span class="yd">- </span>');
    return `<span class="ln">${h}${comment}</span>`;
  }).join(''); // each line is its own block: joining with a newline would double the spacing
}
function manifestBody(entry) {
  const m = MANIFESTS[entry.ref];
  if (!m) { void loadManifest(entry); return skCode(); }
  if (m.error) return `<div class="err"><b>${esc(t('Manifest 读不到'))}</b>：${esc(m.error)}</div>`;
  const file = `${entry.name}-${String(entry.version || '').replace(/^v/, '') || 'manifest'}.yml`;
  return `<p class="mnote">${esc(t('这就是平台读的那份 manifest：装进自己的平台可以用「导入 manifest」，写新插件可以拿它当模板。'))}</p>
    <div class="code">
      <div class="codebar">
        <span class="mono">${esc(entry.manifest.split('/').pop())}</span>
        <span class="codeacts">
          <button class="cbtn" data-copy="${esc(entry.ref)}">${esc(t('复制'))}</button>
          <a class="cbtn" href="${esc(at(entry.manifest))}" download="${esc(file)}">${esc(t('下载'))}</a>
        </span>
      </div>
      <pre class="yaml"><code>${yamlLines(m.text)}</code></pre>
    </div>`;
}
let tab = 'doc';

let OP_QUERY = '';
let OP_PAGE = 1;
const OP_SIZE = 20;
function operationResults(c) {
  const terms = OP_QUERY.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const ops = (c.operations || []).map((op, index) => ({op, index})).filter(({op}) => {
    if (op.internal) return false;
    const translations = Object.values(c.locales || {}).flatMap((locale) => [locale?.[op.label], locale?.[op.desc]]);
    const hay = [op.id, op.label, op.desc, ...translations, ...(Array.isArray(op.aliases) ? op.aliases : [])]
      .join(' ').normalize('NFKC').toLowerCase();
    return terms.every((word) => hay.includes(word));
  });
  const pages = Math.max(1, Math.ceil(ops.length / OP_SIZE));
  OP_PAGE = Math.max(1, Math.min(OP_PAGE, pages));
  const start = (OP_PAGE - 1) * OP_SIZE;
  const visible = ops.slice(start, start + OP_SIZE);
  return `<p class="result-summary" role="status">${esc(format('第 {from}–{to} 项，共 {total} 个操作', {from: ops.length ? start + 1 : 0, to: start + visible.length, total: ops.length}))}</p>
    <div class="operation-list">${visible.length ? visible.map(({op, index}) => `<details class="operation" data-operation-index="${index}">
      <summary title="${esc(t('展开查看参数'))}"><span class="operation-title"><strong>${esc(tr(op.label) || op.id)}</strong><code>${esc(op.id)}</code>
        ${op.stream ? `<span class="pill">${esc(t('流式'))}</span>` : ''}</span>
        ${op.desc ? `<span class="operation-desc">${esc(tr(op.desc))}</span>` : ''}</summary>
      <div class="operation-fields"></div></details>`).join('') : `<div class="emptybox"><b>${esc(t('没有匹配的操作'))}</b></div>`}</div>
    ${pages > 1 ? pagination(OP_PAGE, pages, 'operation-page') : ''}`;
}
function operationsBody(c) {
  if (!(c.operations || []).some((op) => !op.internal)) return `<div class="empty">${esc(t('该插件没有可编排的操作。'))}</div>`;
  return `<label class="detail-search" for="operation-q">${GLYPHS.search}<input id="operation-q" type="search" autocomplete="off" value="${esc(OP_QUERY)}" placeholder="${esc(t('搜索操作名称、标识或说明…'))}" aria-label="${esc(t('搜索操作名称、标识或说明…'))}"></label>
    <div id="operation-results">${operationResults(c)}</div>`;
}
function renderOperations() {
  if (CUR && tab === 'ops') document.getElementById('operation-results').innerHTML = operationResults(CUR.c);
}

function tabBody(c) {
  if (tab === 'manifest') return manifestBody(CUR.entry);
  if (tab === 'doc') {
    return c.doc ? `<div class="panel doc">${md(tr(c.doc))}</div>`
      : `<div class="empty">${esc(t('该插件没有提供使用说明。'))}</div>`;
  }
  if (tab === 'ops') return operationsBody(c);
  if (tab === 'events') {
    const evs = c.events || [];
    const evDesc = evs.some((e) => e.desc || e.label);
    return `<div class="panel tablewrap"><table class="t">
      <thead><tr><th style="width:220px">${esc(t('事件'))}</th>${evDesc ? `<th>${esc(t('说明'))}</th>` : ''}<th>${esc(t('字段'))}</th></tr></thead>
      <tbody>${evs.map((e) => `<tr>
        <td><code>${esc(e.id)}</code>${e.label ? `<div class="sub">${esc(tr(e.label))}</div>` : ''}</td>
        ${evDesc ? `<td class="sub">${esc(tr(e.desc) || '—')}</td>` : ''}
        <td>${fieldList(e.fields)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="panel tablewrap"><table class="t">
    <thead><tr><th style="width:200px">${esc(t('字段'))}</th><th style="width:110px">${esc(t('类型'))}</th><th>${esc(t('说明'))}</th></tr></thead>
    <tbody>${(c.credential_schema || []).map((f) => `<tr>
      <td><code>${esc(f.name)}</code>${f.required ? '<span class="req">*</span>' : ''}
          ${f.label ? `<div class="sub">${esc(tr(f.label))}</div>` : ''}</td>
      <td><span class="pill">${esc(f.type || 'text')}</span></td>
      <td class="sub">${f.desc ? esc(tr(f.desc)) : ''}${f.help ? `<div class="dash">${esc(tr(f.help))}</div>` : ''}
          ${!f.desc && !f.help ? '—' : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

function advPanel(a) {
  if (!a) return '';
  const cls = a.severity === 'block' ? 'block' : 'warn';
  return `<div class="advpanel ${cls}">${esc(t('这个版本被标记为有问题：'))}${esc(a.reason)}
    ${a.severity === 'block' ? ` ${esc(t('拦截级：平台会拒绝调用这个版本。'))}` : ''}
    ${a.url ? ` <a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(t('详情'))}</a>` : ''}</div>`;
}

function renderDetail(entry, c) {
  const title = tr(c.label) || cardText(entry, 'label') || entry.name;
  const tabs = TABS.filter((x) => !x.when || x.when(c));
  if (!tabs.some((x) => x.key === tab)) tab = 'doc';
  document.getElementById('view').innerHTML = `
    ${backLink()}
    <div class="dhead">
      ${iconHTML(entry, 'xl')}
      <div style="flex:1;min-width:0">
        <div class="dtitle">${esc(title)}</div>
        <div class="idline mono">
          <span>${esc(entry.ref)}</span>
          ${c.version ? `<span class="sep" aria-hidden="true">·</span><span>${esc(verLabel(c.version))}</span>` : ''}
        </div>
        ${(entry.capabilities || []).length ? `<div class="tags dcaps">${(entry.capabilities || [])
          .map((x) => `<span class="pill">${esc(capName(x))}</span>`).join('')}</div>` : ''}
        ${c.desc ? `<p class="ddesc">${esc(tr(c.desc))}</p>` : ''}
      </div>
      <button class="install" data-ref="${esc(entry.ref)}">${esc(t('安装到我的平台'))}</button>
    </div>
    ${publisherRisk(entry.ref)}
    <div id="detail-advisory">${advPanel(advisoryFor(entry))}</div>
    ${howToRun(entry)}
    <div class="segs dtabs">${tabs.map((x) =>
      `<button class="seg" aria-pressed="${x.key === tab}" data-tab="${x.key}">${esc(x.label(c))}</button>`).join('')}</div>
    ${tabBody(c)}`;
}

// The list only downloads the index; one plugin's full manifest is fetched when it is opened (some have hundreds
// of operations).
let CUR = null;
let LIST_Y = 0;
let LIST_FOCUS_REF = '';
let DETAIL_REQUEST = 0;
let DETAIL_ABORT = null;
const DETAILS = new Map();
async function showDetail(ref) {
  const request = ++DETAIL_REQUEST;
  DETAIL_ABORT?.abort();
  DETAIL_ABORT = new AbortController();
  const view = document.getElementById('view');
  const back = backLink();
  const entry = ALL.find((p) => p.ref === ref);
  if (!entry) {
    view.innerHTML = `${back}<div class="err"><b>${esc(t('目录里没有这个插件'))}</b>：${esc(ref)}</div>`;
    return;
  }
  view.innerHTML = `${back}${skDetail()}`;
  try {
    let c = DETAILS.get(ref);
    if (!c) {
      const res = await fetch(at(`details/${ref}.json`), { signal: DETAIL_ABORT.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      c = await res.json();
    }
    if (request !== DETAIL_REQUEST) return;
    DETAILS.delete(ref);
    DETAILS.set(ref, c);
    if (DETAILS.size > 12) DETAILS.delete(DETAILS.keys().next().value);
    CUR = { entry, c };
    document.title = `${tr(c.label) || cardText(entry, 'label') || entry.name} · ${t('插件目录')}`;
    renderDetail(entry, c);
  } catch (e) {
    if (request !== DETAIL_REQUEST || e.name === 'AbortError') return;
    CUR = null;
    view.innerHTML = `${back}<div class="err"><b>${esc(t('插件详情读不到'))}</b>：${esc(e.message)}
       <div style="margin-top:6px;color:var(--text-3)">${esc(t('条目在索引里，但它的详情文件拉不到。'))}</div>
       <button class="cbtn retry" data-retry="detail">${esc(t('重试'))}</button></div>`;
  }
}

// --- advisories -------------------------------------------------------------------------------------------
function showAdvisories() {
  const view = document.getElementById('view');
  const intro = `<div class="advhero"><h1>${esc(t('安全通告'))}</h1><p class="lede">${esc(t('标记有问题的插件版本。平台随目录读取这份文件：命中已装版本会标红，「拦截」级还会拒绝调用。要报告问题，在 GitHub 上提 PR 改 advisories.json，或开 issue。'))}</p></div>`;
  if (!advReady) { view.innerHTML = `${intro}<p role="status">${esc(t('读取中…'))}</p>`; return; }
  if (!advOK) {
    view.innerHTML = `${intro}<div class="err"><b>${esc(t('安全通告读不到'))}</b></div>`;
    return;
  }
  const rows = [...ADV].sort((a, b) => String(b.published).localeCompare(String(a.published)));
  view.innerHTML = intro + (rows.length ? `<div class="advlist">${rows.map((a) => {
    const p = ALL.find((x) => x.ref === a.ref);
    const name = p ? (cardText(p, 'label') || p.name) : a.ref;
    return `<div class="advrow">
      <div class="who">${p ? iconHTML(p) : ''}<div><a href="#/${esc(a.ref)}"><b>${esc(name)}</b></a><div class="ref mono">${esc(a.ref)}</div>
        <span class="adv ${a.severity === 'block' ? 'block' : 'warn'}">${esc(t(a.severity === 'block' ? '拦截' : '提醒'))}</span></div></div>
      <div>${esc(a.reason)}${a.url ? ` <a href="${esc(a.url)}" target="_blank" rel="noopener" style="text-decoration:underline">${esc(t('详情'))}</a>` : ''}
        <div class="vers">${esc(t('受影响版本'))}: ${esc((a.versions || []).join(', '))}</div></div>
      <div class="when">${esc(a.published || '—')}</div></div>`;
  }).join('')}</div>` : `<div class="empty">${esc(t('目前没有安全通告。'))}</div>`);
}

// --- routing and chrome -----------------------------------------------------------------------------------
// The hash is the only source of state, so back / forward / refresh / a shared link all work.
let CURRENT_VIEW = null;
let HOME_Y = 0;
let DETAIL_FROM = 'list';
const backLink = () => `<a class="back" href="${DETAIL_FROM === 'home' ? '#/home' : '#/plugins'}">${esc(t(DETAIL_FROM === 'home' ? '← 返回首页' : '← 返回插件目录'))}</a>`;
function route() {
  let h = location.hash.replace(/^#\/?/, '');
  try { h = decodeURIComponent(h); } catch { /* Invalid shared hashes are shown as an unknown plugin. */ }
  const where = h === 'advisories' ? 'advisories' : h === 'plugins' ? 'list' : h.includes('/') ? 'detail'
    : h === 'home' ? 'home' : hasFilters() || STATE.page > 1 ? 'list' : 'home';
  const previous = CURRENT_VIEW;
  if (previous === 'list' && where !== 'list') { LIST_Y = window.scrollY; LIST_FOCUS_REF = where === 'detail' ? h : ''; }
  if (previous === 'home' && where !== 'home') HOME_Y = window.scrollY;
  if (where === 'detail' && (previous === 'home' || previous === 'list')) DETAIL_FROM = previous;
  CURRENT_VIEW = where;
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === (where === 'detail' ? DETAIL_FROM : where)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.getElementById('list').hidden = where !== 'list';
  document.getElementById('catalog-heading').hidden = where !== 'list';
  document.getElementById('masthead').hidden = where !== 'home';
  document.getElementById('home-view').hidden = where !== 'home';
  document.getElementById('view').hidden = where === 'list' || where === 'home';
  ++DETAIL_REQUEST; DETAIL_ABORT?.abort(); CUR = null;
  if (where === 'detail') {
    tab = 'doc'; OP_QUERY = ''; OP_PAGE = 1;
    if (INDEX) void showDetail(h);
    else document.getElementById('view').innerHTML = skDetail();
  }
  if (where === 'advisories') showAdvisories();
  if (where !== 'detail') document.title = LANG === 'zh' ? 'Sokel 插件目录' : 'Sokel Plugin Registry';
  if (previous !== where) window.scrollTo(0, where === 'list' && previous === 'detail' ? LIST_Y : where === 'home' && previous === 'detail' ? HOME_Y : 0);
  if (where === 'list' && previous === 'detail' && LIST_FOCUS_REF) {
    [...document.querySelectorAll('#grid a.card')].find((a) => a.getAttribute('href') === `#/${LIST_FOCUS_REF}`)?.focus({ preventScroll: true });
  }
}

function chrome() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = LANG === 'zh' ? 'Sokel 插件目录' : 'Sokel Plugin Registry';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.getElementById('contribute').href = `${REPO}/blob/main/${LANG === 'zh' ? 'CONTRIBUTING.zh-CN.md' : 'CONTRIBUTING.md'}`;
  document.getElementById('q').placeholder = t('搜索插件、能力或服务…');
  document.getElementById('q').setAttribute('aria-label', t('搜索插件'));
  document.getElementById('home-q').placeholder = t('搜索插件、能力或服务…');
  document.getElementById('home-q').setAttribute('aria-label', t('搜索插件'));
  document.querySelector('.home-search-submit').setAttribute('aria-label', t('搜索'));
  document.getElementById('headline').innerHTML = esc(t('把工作流接到{em}你已经在用的一切{/em}')).replace('{em}', '<em>').replace('{/em}', '</em>');
  document.getElementById('lede').textContent = t('Sokel 工作流平台的插件。装之前就能看到它能做什么、要哪些凭证、要不要自己部署。');
  document.getElementById('sort').setAttribute('aria-label', t('排序'));
  document.querySelectorAll('#sort option').forEach((o) => { o.textContent = t({relevance: '默认 / 相关性', name: '名称 A–Z', operations: '操作数量'}[o.value]); });
  document.querySelectorAll('[data-view]').forEach((b) => {
    const label = t(b.dataset.view === 'list' ? '列表视图' : '卡片视图');
    b.setAttribute('aria-label', label); b.title = label;
  });
  document.getElementById('pagination').setAttribute('aria-label', t('目录分页'));
  document.getElementById('view-toggle').setAttribute('aria-label', t('目录视图'));
  document.querySelector('.nav').setAttribute('aria-label', t('主导航'));
  document.getElementById('side').setAttribute('aria-label', t('分类'));
  document.getElementById('lang').textContent = LANG === 'zh' ? 'EN' : '中';
  document.getElementById('note').textContent = t('这个页面读的是平台读的同一份 index.json——不是另一份目录。想加插件或发新版本？在 GitHub 上提 PR。');
}

// One-click install: send the visitor to their platform's marketplace with the ref; whether and where to install is
// decided over there. This page never talks to the platform; the address is kept only in this browser (if asked to).
let DLG_RETURN = null; // the element that had focus before the dialog, to give it back
function normalizePlatform(raw) {
  let v = String(raw || '').trim();
  if (!v) return { error: t('请填写平台地址') };
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    if (!/^https?:$/.test(u.protocol) || !u.hostname || (!u.hostname.includes('.') && u.hostname !== 'localhost')) throw new Error();
    return { url: (u.origin + u.pathname).replace(/\/+$/, '') };
  } catch {
    return { error: t('地址格式不对，例如 https://sokel.example.com') };
  }
}
const installTarget = (base, ref) => `${base}/plugins/market?install=${encodeURIComponent(ref)}`;
function install(ref) {
  const p = ALL.find((x) => x.ref === ref);
  const dlg = document.getElementById('dlg');
  DLG_RETURN = document.activeElement;
  dlg.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlgtitle">
    <button class="dlgx" data-dlg="close" aria-label="${esc(t('关闭'))}">${line('<path d="M6 6l12 12M18 6 6 18"/>')}</button>
    <div class="dlghead">${p ? iconHTML(p) : ''}<div><h2 id="dlgtitle">${esc(t('安装到你的平台'))}</h2>
      <div class="dlgsub">${esc(p ? (cardText(p, 'label') || p.name) : ref)} <span class="mono">${esc(ref)}</span></div></div></div>
    <p class="dlgtext">${esc(t('这个页面不会连接你的平台：「前往安装」会打开你平台的插件市场，在那边选择空间并确认。'))}</p>
    ${publisherRisk(ref)}
    <form id="dlgform" novalidate>
      <label class="dlglabel" for="dlgurl">${esc(t('平台地址'))}</label>
      <input id="dlgurl" class="dlginput" type="url" inputmode="url" autocomplete="url" spellcheck="false"
        placeholder="https://sokel.example.com" value="${esc(platformURL())}">
      <div class="dlgerr" id="dlgerr" role="alert"></div>
      <div class="dlgpreview mono" id="dlgpreview"></div>
      <label class="dlgcheck"><input type="checkbox" id="dlgremember" checked> ${esc(t('记住这个地址（只保存在这个浏览器里）'))}</label>
      <div class="dlgacts"><button type="button" class="cbtn" data-dlg="close">${esc(t('取消'))}</button>
        <button type="submit" class="install">${esc(t('前往安装'))}</button></div>
    </form></div>`;
  dlg.hidden = false;
  document.body.classList.add('modal');
  const input = document.getElementById('dlgurl');
  const preview = () => {
    const n = normalizePlatform(input.value);
    document.getElementById('dlgpreview').innerHTML = n.url ? `${esc(t('将打开'))} <span>${esc(installTarget(n.url, ref))}</span>` : '';
  };
  input.addEventListener('input', () => { document.getElementById('dlgerr').textContent = ''; input.removeAttribute('aria-invalid'); preview(); });
  document.getElementById('dlgform').addEventListener('submit', (e) => {
    e.preventDefault();
    const n = normalizePlatform(input.value);
    if (n.error) { document.getElementById('dlgerr').textContent = n.error; input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
    try {
      if (document.getElementById('dlgremember').checked) localStorage.setItem(PLATFORM_KEY, n.url);
      else localStorage.removeItem(PLATFORM_KEY);
    } catch { /* private browsing */ }
    location.href = installTarget(n.url, ref);
  });
  preview();
  requestAnimationFrame(() => { input.focus(); input.select(); });
}
function closeDialog() {
  const dlg = document.getElementById('dlg');
  if (dlg.hidden) return;
  dlg.hidden = true; dlg.innerHTML = '';
  document.body.classList.remove('modal');
  if (DLG_RETURN && DLG_RETURN.focus) DLG_RETURN.focus();
}

async function loadAdvisories() {
  try {
    const res = await fetch(at('advisories.json'), { signal: globalThis.AbortSignal?.timeout?.(12000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const f = await res.json();
    advOK = true;
    ADV = Array.isArray(f.advisories) ? f.advisories : [];
  } catch {
    advOK = false; ADV = [];
  }
  advReady = true;
}
function renderAdvisoryStatus() {
  const message = !advReady ? '尚未完成安全通告检查' : !advOK ? '安全通告暂时不可用' : '';
  document.getElementById('err').innerHTML = message ? `<div class="err" role="status">${esc(t(message))}</div>` : '';
}

async function boot() {
  chrome();
  skList();
  route();
  history.replaceState(null, '', stateURL());
  void loadAdvisories().then(() => {
    if (!INDEX) return;
    renderAdvisoryStatus();
    render();
    renderHome();
    if (CUR) document.getElementById('detail-advisory').innerHTML = advPanel(advisoryFor(CUR.entry));
    if (location.hash === '#/advisories') showAdvisories();
  });
  try {
    const res = await fetch(at('index.json'), { signal: globalThis.AbortSignal?.timeout?.(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const idx = await res.json();
    // The check is "entries parse", not HTTP 200: a broken mirror often answers 200 with an error page, which would
    // render an empty registry indistinguishable from one that really has no plugins.
    if (!idx || !Array.isArray(idx.plugins) || idx.plugins.length === 0) throw new Error(t('索引里一条插件都没有'));
    ALL = idx.plugins;
    INDEX = CATALOG.createIndex(ALL);
    chrome();
    renderStats();
    renderHome();
    render();
    renderAdvisoryStatus();
    route();
  } catch (e) {
    document.getElementById('err').innerHTML =
      `<div class="err"><b>${esc(t('插件索引读不到'))}</b>：${esc(e.message)}
       <div style="margin-top:6px;color:var(--text-3)">${esc(t('这不代表目录里没有插件——索引没配好或拉取失败时也会这样。'))}</div></div>`;
    document.getElementById('grid').innerHTML = `<div class="emptybox"><b>${esc(t('索引不可用'))}</b>
      <button class="cbtn" data-retry="index">${esc(t('重试'))}</button></div>`;
    document.getElementById('side').innerHTML = '';
    document.getElementById('stats').innerHTML = '';
    document.getElementById('home-shelves').innerHTML = `<div class="emptybox"><b>${esc(t('索引不可用'))}</b><button class="cbtn" data-retry="index">${esc(t('重试'))}</button></div>`;
  }
}

window.addEventListener('hashchange', route);
window.addEventListener('popstate', () => {
  const lang = new URLSearchParams(location.search).get('lang');
  if ((lang === 'en' || lang === 'zh') && LANG !== lang) {
    LANG = lang;
    try { localStorage.setItem(LANG_KEY, LANG); } catch { /* ignore */ }
    chrome(); renderStats(); renderHome();
    if (INDEX) renderAdvisoryStatus();
    if (CUR) renderDetail(CUR.entry, CUR.c);
  }
  STATE = CATALOG.parseState(location.search);
  render();
});
window.addEventListener('scroll', () => document.querySelector('.nav').classList.toggle('scrolled', window.scrollY > 8), { passive: true });
// The filters remain fully available on narrow screens, behind a native disclosure.
const narrowScreen = window.matchMedia?.('(max-width: 900px)');
const syncFilterPanel = () => { document.getElementById('filter-panel').open = !narrowScreen?.matches; };
syncFilterPanel();
narrowScreen?.addEventListener('change', syncFilterPanel);
document.querySelector('script[src*="marked"]')?.addEventListener?.('load', () => {
  if (CUR && tab === 'doc') renderDetail(CUR.entry, CUR.c);
});
document.addEventListener('toggle', (e) => {
  const details = e.target;
  if (!details.matches?.('details.operation') || !details.open || !CUR || details.dataset.loaded) return;
  const op = CUR.c.operations?.[Number(details.dataset.operationIndex)];
  if (!op) return;
  details.querySelector('.operation-fields').innerHTML = `<section class="inputs"><h3>${esc(t('入参'))}</h3>${fieldList(op.inputs)}</section>
    <section class="outputs"><h3>${esc(t('出参'))}</h3>${fieldList(op.outputs)}</section>`;
  details.dataset.loaded = 'true';
}, true);
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-dlg="close"]') || e.target.id === 'dlg') { closeDialog(); return; }
  const rt = e.target.closest('[data-retry]');
  if (rt) { if (rt.dataset.retry === 'index') location.reload(); else route(); return; }
  const explore = e.target.closest('[data-open-catalog]');
  if (explore && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && e.button === 0) {
    e.preventDefault(); openCatalog({category: explore.dataset.openCatalog}); return;
  }
  if (e.target.closest('#lang')) {
    LANG = LANG === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, LANG); } catch { /* ignore */ }
    const url = stateURL();
    url.searchParams.set('lang', LANG);
    history.replaceState(null, '', url);
    chrome(); renderStats(); renderHome(); render();
    if (INDEX) renderAdvisoryStatus();
    if (CUR) renderDetail(CUR.entry, CUR.c); else if (!document.getElementById('view').hidden) route();
    return;
  }
  const cp = e.target.closest('[data-copy]');
  if (cp) {
    const m = MANIFESTS[cp.dataset.copy];
    const done = (ok) => { cp.textContent = t(ok ? '已复制' : '复制失败，请手动选择'); setTimeout(() => { cp.textContent = t('复制'); }, 1600); };
    if (m && m.text && navigator.clipboard) navigator.clipboard.writeText(m.text).then(() => done(true), () => done(false));
    else done(false);
    return;
  }
  const tb = e.target.closest('[data-tab]');
  if (tb && CUR) { tab = tb.dataset.tab; renderDetail(CUR.entry, CUR.c); return; }
  const opPage = e.target.closest('[data-operation-page]');
  if (opPage && !opPage.disabled) { OP_PAGE = Number(opPage.dataset.operationPage); renderOperations(); document.getElementById('operation-q')?.focus({preventScroll: true}); return; }
  const category = e.target.closest('[data-category]');
  if (category) { updateState({ category: category.dataset.category }); return; }
  if (e.target.closest('[data-clear-filters]')) { clearFilters(); document.getElementById('q').focus(); return; }
  const chip = e.target.closest('[data-remove-filter]');
  if (chip) { const k = chip.dataset.removeFilter; updateState({ [k]: ['events', 'deploy'].includes(k) ? false : '' }); document.getElementById('q').focus(); return; }
  const mode = e.target.closest('[data-view]');
  if (mode) { updateState({ view: mode.dataset.view, page: STATE.page }); return; }
  const page = e.target.closest('[data-page]');
  if (page && !page.disabled) {
    const fromTop = !!page.closest('.mini-pagination');
    updateState({ page: Number(page.dataset.page) }, { scroll: true });
    document.querySelector(fromTop ? '.mini-pagination .page-button:not(:disabled)' : '#pagination [aria-current="page"]')?.focus({ preventScroll: true });
    return;
  }
  // Only the plugin's own install buttons (the dialog's submit button shares the look, not the job).
  const btn = e.target.closest('.install[data-ref]');
  if (btn) install(btn.dataset.ref);
});
document.addEventListener('keydown', (e) => {
  if (!document.getElementById('dlg').hidden) {
    if (e.key === 'Escape') { e.preventDefault(); closeDialog(); return; }
    // Keep Tab inside the dialog.
    if (e.key === 'Tab') {
      const f = [...document.querySelectorAll('#dlg button, #dlg input')].filter((x) => !x.disabled);
      if (f.length) {
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    }
    return;
  }
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') && !document.activeElement?.isContentEditable && ['home', 'list'].includes(CURRENT_VIEW)) {
    e.preventDefault(); document.getElementById(CURRENT_VIEW === 'home' ? 'home-q' : 'q').focus();
  }
});
document.addEventListener('submit', (e) => {
  if (e.target.id !== 'home-search') return;
  e.preventDefault();
  openCatalog({q: document.getElementById('home-q').value.trim()});
  document.getElementById('q').focus();
});
document.addEventListener('input', (e) => {
  if (e.isComposing) return;
  if (e.target.id === 'q') updateState({ q: e.target.value }, { replace: true });
  if (e.target.id === 'operation-q') { OP_QUERY = e.target.value; OP_PAGE = 1; renderOperations(); }
});
document.addEventListener('compositionend', (e) => {
  if (e.target.id === 'q') updateState({ q: e.target.value }, { replace: true });
  if (e.target.id === 'operation-q') { OP_QUERY = e.target.value; OP_PAGE = 1; renderOperations(); }
});
document.addEventListener('change', (e) => {
  const mapping = {sort: 'sort', capability: 'capability', publisher: 'org'};
  if (mapping[e.target.id]) updateState({ [mapping[e.target.id]]: e.target.value });
  if (e.target.id === 'events' || e.target.id === 'deploy') updateState({ [e.target.id]: e.target.checked });
  if (e.target.id === 'page-size') updateState({ size: Number(e.target.value) });
});
boot();
