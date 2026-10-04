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
// Three views, chosen by the hash: '' = list, #/advisories = advisories, #/<org>/<name> = one plugin.

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
  '安装（先填平台地址）': 'Install (enter your platform address)',
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
const cardText = (p, k) => (LANG === 'en' && p.i18n && p.i18n.en && p.i18n.en[k]) || p[k];

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
let cap = '';
let kw = '';

// --- list -------------------------------------------------------------------------------------------------
function card(p) {
  const color = colorOf(p.ref);
  const title = cardText(p, 'label') || p.name;
  // deploy answers "can I run one myself", not "must I": whether it works right after install depends on how that
  // platform was built, which this page does not know.
  const deployable = (p.deploy || []).length > 0;
  const caps = (p.capabilities || []).map((c) => `<span class="pill mono">${esc(c)}</span>`).join('');
  const plat = platformURL();
  return `
  <div class="card">
    <a class="cardlink" href="#/${esc(p.ref)}" aria-label="${esc(title)}"></a>
    <div class="bar" style="background:linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 30%, transparent))"></div>
    <div class="body">
      <div class="head">
        <div class="tile" style="background:${color}">${esc(initial(title))}</div>
        <div style="flex:1;min-width:0">
          <div class="name" title="${esc(p.ref)}">${esc(title)}</div>
          <div class="tags">
            <span class="pill">${esc(p.org)}</span>
            ${deployable ? `<span class="pill">${esc(t('可自部署'))}</span>` : ''}
            ${(p.langs || []).length ? `<span class="pill">${esc(t('{n} 种语言').replace('{n}', (p.langs || []).length + 1))}</span>` : ''}
            ${advBadge(advisoryFor(p))}
          </div>
        </div>
      </div>
      <p class="desc">${esc(cardText(p, 'desc') || t('该插件没有提供说明。'))}</p>
      ${caps ? `<div class="tags" style="margin-top:10px">${caps}</div>` : ''}
      <div class="meta">
        <span>${esc(t('操作'))} <b class="${p.operations ? '' : 'zero'}">${p.operations}</b></span>
        <span>${esc(t('事件'))} <b class="${p.events ? '' : 'zero'}">${p.events}</b></span>
        ${p.version ? `<span class="ver">${esc(verLabel(p.version))}</span>` : ''}
      </div>
      <button class="install${plat ? '' : ' ghost'}" data-ref="${esc(p.ref)}">
        ${esc(t(plat ? '安装到我的平台' : '安装（先填平台地址）'))}
      </button>
    </div>
  </div>`;
}

function render() {
  const list = ALL.filter((p) =>
    (!cap || (p.capabilities || []).includes(cap)) &&
    (!kw || p.ref.toLowerCase().includes(kw) || String(cardText(p, 'label') || '').toLowerCase().includes(kw) ||
      String(cardText(p, 'desc') || '').toLowerCase().includes(kw)));
  document.getElementById('grid').innerHTML = list.length
    ? list.map(card).join('')
    : `<div class="empty">${esc(t('没有匹配的插件'))}</div>`;
}

function renderFilters() {
  const set = new Set();
  ALL.forEach((p) => (p.capabilities || []).forEach((c) => set.add(c)));
  if (!set.size) { document.getElementById('caps').innerHTML = ''; return; }
  document.getElementById('caps').innerHTML = ['', ...[...set].sort()]
    .map((c) => `<button class="seg" aria-pressed="${c === cap}" data-cap="${esc(c)}">${esc(c || t('全部'))}</button>`)
    .join('');
}

// --- detail -----------------------------------------------------------------------------------------------
// md: plugin docs are Markdown with many tables; a parser is loaded, and if it failed the doc shows as plain text.
function md(text) {
  if (window.marked) {
    try { return window.marked.parse(text); } catch { /* fall back to plain text */ }
  }
  return `<pre class="plaindoc">${esc(text)}</pre>`;
}

// tr: a plugin's own string in the reader's language, from its locale table (source text -> translation).
let LOC = {};
const tr = (s) => (LANG === 'en' && s && LOC[s]) || s;

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
    : esc(t('它以独立进程接入平台：在能连通目标服务的机器上跑一个副本。这个条目没有声明部署产物，启动方式见「使用说明」。'));
  return `<div class="panel">
    <div class="ptitle">${esc(t('怎么接上'))}</div>
    <div class="prow"><span class="plabel">${esc(t('自行部署'))}</span><span>${body}</span></div>
    <div class="pnote">${esc(t('你的平台是否已内置它，要在平台的插件市场里看。'))}</div>
  </div>`;
}

const TABS = [
  { key: 'doc', label: () => t('使用说明') },
  { key: 'ops', label: (c) => `${t('操作')} (${(c.operations || []).filter((o) => !o.internal).length})` },
  { key: 'events', label: (c) => `${t('事件')} (${(c.events || []).length})`, when: (c) => (c.events || []).length },
  { key: 'cred', label: () => t('凭证'), when: (c) => (c.credential_schema || []).length },
];
let tab = 'doc';

function tabBody(c) {
  if (tab === 'doc') {
    return c.doc ? `<div class="panel doc">${md(c.doc)}</div>`
      : `<div class="empty">${esc(t('该插件没有提供使用说明。'))}</div>`;
  }
  if (tab === 'ops') {
    const ops = (c.operations || []).filter((o) => !o.internal);
    if (!ops.length) return `<div class="empty">${esc(t('该插件没有可编排的操作。'))}</div>`;
    // Many plugins have no label or desc on any operation; a column of dashes would squeeze inputs and outputs.
    const hasDesc = ops.some((o) => o.desc || o.label);
    return `<div class="panel tablewrap"><table class="t">
      <thead><tr><th style="width:220px">${esc(t('操作'))}</th>${hasDesc ? `<th>${esc(t('说明'))}</th>` : ''}
        <th${hasDesc ? ' style="width:260px"' : ''}>${esc(t('入参'))}</th><th${hasDesc ? ' style="width:220px"' : ''}>${esc(t('出参'))}</th></tr></thead>
      <tbody>${ops.map((o) => `<tr>
        <td><code>${esc(o.id)}</code>${o.label ? `<div class="sub">${esc(tr(o.label))}</div>` : ''}
            ${o.stream ? `<span class="pill">${esc(t('流式'))}</span>` : ''}</td>
        ${hasDesc ? `<td class="sub">${esc(tr(o.desc) || '—')}</td>` : ''}
        <td>${fieldList(o.inputs)}</td>
        <td>${fieldList(o.outputs)}</td></tr>`).join('')}</tbody></table></div>`;
  }
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
  const color = colorOf(entry.ref);
  const title = tr(c.label) || cardText(entry, 'label') || entry.name;
  const plat = platformURL();
  const tabs = TABS.filter((x) => !x.when || x.when(c));
  if (!tabs.some((x) => x.key === tab)) tab = 'doc';
  document.getElementById('view').innerHTML = `
    <a class="back" href="#">${esc(t('← 返回插件目录'))}</a>
    <div class="dhead">
      <div class="tile big" style="background:${color}">${esc(initial(title))}</div>
      <div style="flex:1;min-width:0">
        <div class="dtitle">${esc(title)}</div>
        <div class="tags">
          <span class="ref mono">${esc(entry.ref)}</span>
          ${c.version ? `<span class="pill mono">${esc(verLabel(c.version))}</span>` : ''}
          ${(entry.capabilities || []).map((x) => `<span class="pill mono">${esc(x)}</span>`).join('')}
        </div>
        ${c.desc ? `<p class="ddesc">${esc(tr(c.desc))}</p>` : ''}
      </div>
      <button class="install${plat ? '' : ' ghost'}" data-ref="${esc(entry.ref)}">
        ${esc(t(plat ? '安装到我的平台' : '安装（先填平台地址）'))}
      </button>
    </div>
    ${advPanel(advisoryFor(entry))}
    ${howToRun(entry)}
    <div class="segs dtabs">${tabs.map((x) =>
      `<button class="seg" aria-pressed="${x.key === tab}" data-tab="${x.key}">${esc(x.label(c))}</button>`).join('')}</div>
    ${tabBody(c)}`;
}

// The list only downloads the index; one plugin's full manifest is fetched when it is opened (some have hundreds
// of operations).
let CUR = null;
async function showDetail(ref) {
  const view = document.getElementById('view');
  const back = `<a class="back" href="#">${esc(t('← 返回插件目录'))}</a>`;
  const entry = ALL.find((p) => p.ref === ref);
  if (!entry) {
    view.innerHTML = `${back}<div class="err"><b>${esc(t('目录里没有这个插件'))}</b>：${esc(ref)}</div>`;
    return;
  }
  view.innerHTML = `${back}<div class="empty">${esc(t('读取中…'))}</div>`;
  try {
    const res = await fetch(at(`details/${ref}.json`));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const c = await res.json();
    LOC = (c.locales && c.locales.en) || {};
    CUR = { entry, c };
    renderDetail(entry, c);
  } catch (e) {
    CUR = null;
    view.innerHTML = `${back}<div class="err"><b>${esc(t('插件详情读不到'))}</b>：${esc(e.message)}
       <div style="margin-top:6px;color:var(--text-3)">${esc(t('条目在索引里，但它的详情文件拉不到。'))}</div></div>`;
  }
}

// --- advisories -------------------------------------------------------------------------------------------
function showAdvisories() {
  const view = document.getElementById('view');
  const intro = `<h1>${esc(t('安全通告'))}</h1><p class="lede">${esc(t('标记有问题的插件版本。平台随目录读取这份文件：命中已装版本会标红，「拦截」级还会拒绝调用。要报告问题，在 GitHub 上提 PR 改 advisories.json，或开 issue。'))}</p>`;
  if (!advOK) {
    view.innerHTML = `${intro}<div class="err"><b>${esc(t('安全通告读不到'))}</b></div>`;
    return;
  }
  const rows = [...ADV].sort((a, b) => String(b.published).localeCompare(String(a.published)));
  view.innerHTML = intro + (rows.length ? `<div class="advlist">${rows.map((a) => {
    const p = ALL.find((x) => x.ref === a.ref);
    const name = p ? (cardText(p, 'label') || p.name) : a.ref;
    return `<div class="advrow">
      <div><a href="#/${esc(a.ref)}"><b>${esc(name)}</b></a><div class="ref mono">${esc(a.ref)}</div>
        <span class="adv ${a.severity === 'block' ? 'block' : 'warn'}">${esc(t(a.severity === 'block' ? '拦截' : '提醒'))}</span></div>
      <div>${esc(a.reason)}${a.url ? ` <a href="${esc(a.url)}" target="_blank" rel="noopener" style="text-decoration:underline">${esc(t('详情'))}</a>` : ''}
        <div class="vers">${esc(t('受影响版本'))}: ${esc((a.versions || []).join(', '))}</div></div>
      <div class="when">${esc(a.published || '—')}</div></div>`;
  }).join('')}</div>` : `<div class="empty">${esc(t('目前没有安全通告。'))}</div>`);
}

// --- routing and chrome -----------------------------------------------------------------------------------
// The hash is the only source of state, so back / forward / refresh / a shared link all work.
function route() {
  const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const list = document.getElementById('list');
  const view = document.getElementById('view');
  const mast = document.getElementById('masthead');
  const where = h === 'advisories' ? 'advisories' : (h.includes('/') ? 'detail' : 'list');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === (where === 'detail' ? 'list' : where)) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  list.hidden = where !== 'list';
  mast.hidden = where !== 'list';
  view.hidden = where === 'list';
  CUR = null;
  if (where === 'detail') { tab = 'doc'; void showDetail(h); }
  if (where === 'advisories') showAdvisories();
  window.scrollTo(0, 0);
}

function chrome() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  document.title = LANG === 'zh' ? 'Sokel 插件目录' : 'Sokel Plugin Registry';
  document.querySelectorAll('[data-t]').forEach((el) => { el.textContent = t(el.dataset.t); });
  document.getElementById('lang').textContent = LANG === 'zh' ? 'English' : '中文';
  document.getElementById('contribute').href = `${REPO}/blob/main/${LANG === 'zh' ? 'CONTRIBUTING.zh-CN.md' : 'CONTRIBUTING.md'}`;
  document.getElementById('q').placeholder = t('搜索插件');
  document.getElementById('lede').textContent = t('Sokel 工作流平台的插件。装之前就能看到它能做什么、要哪些凭证、要不要自己部署——共 {n} 个。').replace('{n}', ALL.length || '…');
  document.getElementById('note').textContent = t('这个页面读的是平台读的同一份 index.json——不是另一份目录。想加插件或发新版本？在 GitHub 上提 PR。');
}

// One-click install: send the visitor to their platform's marketplace with the ref; whether and where to install is
// decided over there. This page never talks to the platform.
function install(ref) {
  let base = platformURL();
  if (!base) {
    base = (prompt(t('你的平台地址（例如 https://sokel.example.com）')) || '').trim();
    if (!base) return;
    try { localStorage.setItem(PLATFORM_KEY, base); } catch { /* private browsing */ }
  }
  location.href = base.replace(/\/+$/, '') + '/plugins/market?install=' + encodeURIComponent(ref);
}

async function loadAdvisories() {
  try {
    const res = await fetch(at('advisories.json'));
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const f = await res.json();
    ADV = Array.isArray(f.advisories) ? f.advisories : [];
  } catch {
    advOK = false; ADV = [];
  }
}

async function boot() {
  chrome();
  try {
    const [res] = await Promise.all([fetch(at('index.json')), loadAdvisories()]);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const idx = await res.json();
    // The check is "entries parse", not HTTP 200: a broken mirror often answers 200 with an error page, which would
    // render an empty registry indistinguishable from one that really has no plugins.
    if (!idx || !Array.isArray(idx.plugins) || idx.plugins.length === 0) throw new Error(t('索引里一条插件都没有'));
    ALL = idx.plugins;
    chrome();
    renderFilters();
    render();
    route();
  } catch (e) {
    document.getElementById('err').innerHTML =
      `<div class="err"><b>${esc(t('插件索引读不到'))}</b>：${esc(e.message)}
       <div style="margin-top:6px;color:var(--text-3)">${esc(t('这不代表目录里没有插件——索引没配好或拉取失败时也会这样。'))}</div></div>`;
    document.getElementById('grid').innerHTML = `<div class="empty">${esc(t('索引不可用'))}</div>`;
  }
}

window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  if (e.target.closest('#lang')) {
    LANG = LANG === 'zh' ? 'en' : 'zh';
    try { localStorage.setItem(LANG_KEY, LANG); } catch { /* ignore */ }
    chrome(); renderFilters(); render();
    if (CUR) renderDetail(CUR.entry, CUR.c); else if (!document.getElementById('view').hidden) route();
    return;
  }
  const tb = e.target.closest('[data-tab]');
  if (tb && CUR) { tab = tb.dataset.tab; renderDetail(CUR.entry, CUR.c); return; }
  const seg = e.target.closest('[data-cap]');
  if (seg) { cap = seg.dataset.cap; renderFilters(); render(); return; }
  const btn = e.target.closest('.install');
  if (btn) install(btn.dataset.ref);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'q') { kw = e.target.value.trim().toLowerCase(); render(); }
});
boot();
