// Run against `site/` served locally. No browser dependency is added to this repo:
// PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/catalog-browser.mjs
// REGISTRY_BROWSER_MODE=fixture|live|all (default all); REGISTRY_URL defaults to :5180.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const origin = process.env.REGISTRY_URL || 'http://127.0.0.1:5180/';
const market = process.env.REGISTRY_INDEX_BASE || 'https://plugins.sokel.dev/';
const mode = process.env.REGISTRY_BROWSER_MODE || 'all';
const output = process.env.REGISTRY_BROWSER_OUTPUT || '/tmp/sokel-registry-browser';
const liveSnapshot = process.env.REGISTRY_LIVE_INDEX || '/tmp/sokel-live-market-index.json';
mkdirSync(output, { recursive: true });

function url(extra = {}, hash = '/plugins') {
  const u = new URL(origin);
  u.search = new URLSearchParams({ base: market, lang: 'zh', ...extra }).toString();
  u.hash = hash;
  return u.href;
}

// Six independently distinguishable results exercise every filter in combination.
const sentinels = [
  { org: 'alpha', name: 'atlas-mail', label: '星云邮件', categories: ['communication'], capabilities: ['llm/chat'], events: 1, deploy: ['container'] },
  { org: 'beta', name: 'beacon-team', label: '星云协作', categories: ['communication'], capabilities: ['llm/chat'], events: 1, deploy: ['container'] },
  { org: 'alpha', name: 'beacon-data', label: '星云数据', categories: ['data'], capabilities: ['llm/chat'], events: 1, deploy: ['container'] },
  { org: 'alpha', name: 'beacon-search', label: '星云搜索', categories: ['communication'], capabilities: ['websearch'], events: 1, deploy: ['container'] },
  { org: 'alpha', name: 'beacon-manual', label: '星云手动', categories: ['communication'], capabilities: ['llm/chat'], events: 0, deploy: ['container'] },
  { org: 'alpha', name: 'beacon-remote', label: '星云远程', categories: ['communication'], capabilities: ['llm/chat'], events: 1, deploy: [] },
];
const plugins = Array.from({ length: 2000 }, (_, i) => {
  const n = String(i).padStart(4, '0');
  const p = sentinels[i] || {
    org: i % 3 ? 'beta' : 'alpha', name: `connector-${n}`, label: `连接器 ${n}`,
    categories: [i % 2 ? 'data' : 'ai'], capabilities: [i % 2 ? 'websearch' : 'llm/chat'],
    events: i % 5 === 0 ? 1 : 0, deploy: i % 3 === 0 ? ['container'] : [],
  };
  return {
    ...p, ref: `${p.org}/${p.name}`, version: 'v1.0.0', operations: i === 0 ? 125 : i % 301 + 1,
    desc: i < sentinels.length ? '用于跨境发票和邮件协作的连接器。' : `工作流连接器 ${n}。`,
    langs: ['en'], manifest: `plugins/${p.org}/${p.name}/manifest.yml`,
    i18n: { en: { label: i === 0 ? 'Atlas Mail' : `Connector ${n}`, desc: i < sentinels.length ? 'Invoice beacon integration.' : `Workflow connector ${n}.` } },
  };
});
const fixture = { version: 2, plugins };
const byRef = new Map(plugins.map(p => [p.ref, p]));

function detail(ref) {
  const entry = byRef.get(ref);
  const operations = Array.from({ length: entry.operations }, (_, i) => {
    const n = String(i).padStart(3, '0');
    return {
      id: `operation_${n}`, label: `Read operation ${n}`, desc: `Read record number ${n}.`, aliases: [`record_${n}`],
      inputs: [{ name: `customer_${n}`, type: 'string', desc: 'Customer identifier', required: true }],
      outputs: [{ name: `response_${n}`, type: 'object', desc: 'Response payload' }],
    };
  });
  return {
    name: entry.name, label: entry.label, version: entry.version, desc: entry.desc,
    doc: `# ${entry.label}\n\nBrowser regression fixture for ${ref}.`,
    operations: [...operations, { id: 'internal_operation', internal: true }],
    locales: { 'zh-CN': Object.fromEntries(operations.flatMap((o, i) => [
      [o.label, `读取记录 ${String(i).padStart(3, '0')}`],
      [o.desc, `读取第 ${String(i).padStart(3, '0')} 条记录。`],
    ])) },
  };
}

const report = { startedAt: new Date().toISOString(), origin, market, fixtureEntries: plugins.length, checks: [] };
const browser = await chromium.launch({ headless: true });
let activePage;
async function check(name, fn) {
  await fn();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
const cards = page => page.locator('#grid a.card');
const searchParams = page => new URL(page.url()).searchParams;
async function search(page, text, count) {
  await page.locator('#q').fill(text);
  await expect(cards(page)).toHaveCount(count);
  await expect.poll(() => searchParams(page).get('q') || '').toBe(text);
}
async function noHorizontalOverflow(page) {
  expect(await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth })))
    .toEqual(expect.objectContaining({ viewport: 375 }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

async function fixtureChecks() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = page;
  const errors = [];
  const detailsRequested = [];
  let blockedRef = '';
  let releaseBlocked;
  let blockedRequestStarted;
  let blockedResponseCompleted;
  let unblockResponse;
  let markRequestStarted;
  let markResponseCompleted;
  page.on('pageerror', error => errors.push(error.message));
  await page.route(new URL('index.json', market).href, route => route.fulfill({ json: fixture }));
  await page.route(new URL('advisories.json', market).href, route => route.fulfill({ json: { version: 1, advisories: [] } }));
  // The optional Markdown CDN is irrelevant to catalogue behavior and must not make fixture checks depend on a network.
  await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.route(new URL('details/**', market).href, async route => {
    const ref = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^.*\/details\//, '').replace(/\.json$/, ''));
    detailsRequested.push(ref);
    if (ref === blockedRef) {
      markRequestStarted();
      await unblockResponse;
      try { await route.fulfill({ json: detail(ref) }); }
      catch { /* An aborted obsolete request is also a valid race guard. */ }
      finally { markResponseCompleted(); }
      return;
    }
    await route.fulfill({ json: detail(ref) });
  });

  await page.goto(url(), { waitUntil: 'domcontentloaded' });
  await check('2,000 entries render only the first 24 cards and fetch no plugin details', async () => {
    await expect(cards(page)).toHaveCount(24);
    await expect(page.locator('#stats dt').first()).toHaveText('2000');
    expect(detailsRequested).toEqual([]);
    await page.screenshot({ path: join(output, 'fixture-desktop.png'), fullPage: true });
  });

  await check('browser back restores the language from the previous catalogue URL', async () => {
    await page.locator('#side button[data-category="communication"]').click();
    await expect(cards(page)).toHaveCount(5);
    await page.locator('#lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(searchParams(page).get('lang')).toBe('en');
    await page.goBack();
    await expect(cards(page)).toHaveCount(24);
    expect(searchParams(page).get('lang')).toBe('zh');
    expect(searchParams(page).get('category')).toBeNull();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await expect(page.locator('#catalog-title')).toHaveText('全部插件');
    await expect(page.locator('#lang')).toHaveText('EN');
  });

  await check('pagination, page size, list view and operation-count sorting', async () => {
    const first = await cards(page).first().getAttribute('href');
    await page.locator('[data-page="2"]').first().click();
    await expect.poll(() => searchParams(page).get('page')).toBe('2');
    await expect(cards(page)).toHaveCount(24);
    expect(await cards(page).first().getAttribute('href')).not.toBe(first);
    await page.locator('#page-size').selectOption('48');
    await expect(cards(page)).toHaveCount(48);
    expect(searchParams(page).get('size')).toBe('48');
    expect(searchParams(page).get('page') || '1').toBe('1');
    await page.locator('[data-view="list"]').click();
    await expect(page.locator('[data-view="list"]')).toHaveAttribute('aria-pressed', 'true');
    expect(searchParams(page).get('view')).toBe('list');
    await page.locator('#sort').selectOption('operations');
    const counts = (await cards(page).locator('.ops').allTextContents()).map(text => Number(text.match(/\d+/)?.[0]));
    expect(counts[0]).toBe(301);
    expect(counts).toEqual([...counts].sort((a, b) => b - a));
    await page.screenshot({ path: join(output, 'fixture-list.png'), fullPage: true });
  });

  await page.goto(url(), { waitUntil: 'domcontentloaded' });
  await expect(cards(page)).toHaveCount(24);
  await check('Chinese and English metadata search plus independent combined filters', async () => {
    await search(page, '星云邮件', 1);
    await expect(cards(page).first()).toHaveAttribute('href', '#/alpha/atlas-mail');
    await search(page, 'beacon', 6);
    await page.locator('#side button[data-category="communication"]').click();
    await expect(cards(page)).toHaveCount(5);
    await page.locator('#capability').selectOption('llm/chat');
    await expect(cards(page)).toHaveCount(4);
    await page.locator('#publisher').selectOption('alpha');
    await expect(cards(page)).toHaveCount(3);
    await page.locator('#events').check();
    await expect(cards(page)).toHaveCount(2);
    await page.locator('#deploy').check();
    await expect(cards(page)).toHaveCount(1);
    expect(searchParams(page).get('category')).toBe('communication');
    expect(searchParams(page).get('capability')).toBe('llm/chat');
    expect(searchParams(page).get('org')).toBe('alpha');
    expect(searchParams(page).get('events')).toBeTruthy();
    expect(searchParams(page).get('deploy')).toBeTruthy();
    await expect(page.locator('#active-filters')).toBeVisible();
  });

  await check('refresh and detail/back/browser-history navigation preserve the full catalogue query', async () => {
    const query = new URL(page.url()).search;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator('#q')).toHaveValue('beacon');
    await expect(page.locator('#capability')).toHaveValue('llm/chat');
    await expect(page.locator('#publisher')).toHaveValue('alpha');
    await expect(page.locator('#events')).toBeChecked();
    await expect(page.locator('#deploy')).toBeChecked();
    await cards(page).first().click();
    await expect(page.locator('#view .dtitle')).toHaveText('星云邮件');
    expect(new URL(page.url()).search).toBe(query);
    await page.locator('#view a.back').click();
    await expect(page.locator('#list')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#/plugins');
    await expect(cards(page)).toHaveCount(1);
    expect(new URL(page.url()).search).toBe(query);
    await page.goBack();
    await expect(page.locator('#view .dtitle')).toHaveText('星云邮件');
    await page.goBack();
    await expect(page.locator('#list')).toBeVisible();
    await expect(cards(page)).toHaveCount(1);
    expect(new URL(page.url()).search).toBe(query);
  });

  await check('empty results provide a working clear-all action', async () => {
    await search(page, 'nonexistent-plugin-xyz', 0);
    await expect(page.locator('#grid')).toContainText('没有匹配的插件');
    await page.locator('[data-clear-filters]:visible').last().click();
    await expect(cards(page)).toHaveCount(24);
    await expect(page.locator('#q')).toHaveValue('');
    await expect(page.locator('#events')).not.toBeChecked();
    await expect(page.locator('#deploy')).not.toBeChecked();
    expect(searchParams(page).get('base')).toBe(market);
    expect(searchParams(page).get('lang')).toBe('zh');
  });

  await check('375px layout keeps filters accessible without horizontal page overflow', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.evaluate(() => scrollTo(0, 0));
    await noHorizontalOverflow(page);
    const panel = page.locator('#filter-panel');
    expect(await panel.evaluate(el => el.tagName)).toBe('DETAILS');
    await expect(panel.locator('summary')).toBeVisible();
    if (!(await panel.evaluate(el => el.open))) await panel.locator('summary').click();
    await expect(page.locator('#capability')).toBeVisible();
    await expect(page.locator('#publisher')).toBeVisible();
    await page.locator('#capability').selectOption('websearch');
    expect(searchParams(page).get('capability')).toBe('websearch');
    await noHorizontalOverflow(page);
    await page.screenshot({ path: join(output, 'fixture-mobile.png'), fullPage: true });
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(url({}, '/alpha/atlas-mail'), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#view .dtitle')).toHaveText('星云邮件');
  await check('large operation lists paginate, defer schemas and search operation metadata in both languages', async () => {
    await page.locator('[data-tab="ops"]').click();
    const operations = page.locator('#operation-results details.operation');
    await expect(operations).toHaveCount(20);
    await expect(page.locator('[data-tab="ops"]')).toContainText('125');
    await expect(operations.locator('.field')).toHaveCount(0);
    await operations.first().locator('summary').click();
    await expect(operations.first()).toContainText('customer_000');
    await expect(operations.first()).toContainText('response_000');
    await page.locator('button[data-operation-page="2"]').first().click();
    await expect(operations).toHaveCount(20);
    await expect(operations.first()).toContainText('operation_020');
    await page.locator('#operation-q').fill('operation_099');
    await expect(operations).toHaveCount(1);
    await expect(operations.first()).toContainText('operation_099');
    await page.locator('#operation-q').fill('读取记录 099');
    await expect(operations).toHaveCount(1);
    await page.locator('#operation-q').fill('Read operation 099');
    await expect(operations).toHaveCount(1);
    await page.locator('#lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('#operation-q').fill('读取记录 099');
    await expect(operations).toHaveCount(1);
    await expect(operations.first()).toContainText('Read operation 099');
    await page.locator('#lang').click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
    await page.locator('#operation-q').fill('record_099');
    await expect(operations).toHaveCount(1);
    await page.locator('#operation-q').fill('internal_operation');
    await expect(operations).toHaveCount(0);
    await page.locator('#operation-q').fill('');
    await expect(operations).toHaveCount(20);
    await page.screenshot({ path: join(output, 'fixture-operations.png'), fullPage: false });
  });

  await check('operation search has a compact icon and fits a 375px detail viewport', async () => {
    const searchBox = page.locator('.detail-search');
    await expect(searchBox).toBeVisible();
    expect((await searchBox.boundingBox()).height).toBeLessThanOrEqual(48);
    expect((await searchBox.locator('svg').boundingBox()).width).toBeLessThanOrEqual(24);
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('#operation-q')).toBeVisible();
    expect((await searchBox.boundingBox()).height).toBeLessThanOrEqual(48);
    expect((await searchBox.locator('svg').boundingBox()).width).toBeLessThanOrEqual(24);
    await page.locator('#operation-results details.operation').first().locator('summary').click();
    await expect(page.locator('#operation-results details.operation').first()).toContainText('customer_000');
    await noHorizontalOverflow(page);
    await page.locator('#operation-q').scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(output, 'fixture-operations-mobile.png'), fullPage: false });
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('missing deployment metadata does not claim that the plugin requires a separate process', async () => {
    await page.evaluate(() => { location.hash = '#/alpha/beacon-remote'; });
    await expect(page.locator('#view .dtitle')).toHaveText('星云远程');
    await expect(page.locator('#view .prow')).toContainText('未声明');
    await expect(page.locator('#view .prow')).not.toContainText('独立进程');
    await expect(page.locator('#view .prow')).not.toContainText('自行部署');
  });

  await check('a delayed obsolete detail response cannot overwrite the current plugin', async () => {
    blockedRef = sentinels[1].org + '/' + sentinels[1].name;
    unblockResponse = new Promise(resolve => { releaseBlocked = resolve; });
    blockedRequestStarted = new Promise(resolve => { markRequestStarted = resolve; });
    blockedResponseCompleted = new Promise(resolve => { markResponseCompleted = resolve; });
    await page.evaluate(ref => { location.hash = '#/' + ref; }, blockedRef);
    await blockedRequestStarted;
    await page.evaluate(() => { location.hash = '#/alpha/beacon-data'; });
    await expect(page.locator('#view .dtitle')).toHaveText('星云数据');
    releaseBlocked();
    await blockedResponseCompleted;
    await page.waitForTimeout(150);
    await expect(page.locator('#view .dtitle')).toHaveText('星云数据');
    expect(new URL(page.url()).hash).toBe('#/alpha/beacon-data');
    expect(await page.title()).toContain('星云数据');
  });

  await check('root homepage has bounded shelves and submits searches to the separate catalogue', async () => {
    await page.goto(url({}, ''), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#masthead')).toBeVisible();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#list')).toBeHidden();
    const homeCards = page.locator('#home-view a.card');
    await expect(homeCards.first()).toBeVisible();
    expect(await homeCards.count()).toBeGreaterThan(0);
    expect(await homeCards.count()).toBeLessThanOrEqual(18);
    await page.screenshot({ path: join(output, 'fixture-home.png'), fullPage: false });
    await page.locator('#home-q').fill('beacon');
    await page.locator('#home-q').press('Enter');
    await expect(page.locator('#list')).toBeVisible();
    await expect(page.locator('#masthead')).toBeHidden();
    await expect(page.locator('#home-view')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('#/plugins');
    expect(searchParams(page).get('q')).toBe('beacon');
    await expect(page.locator('#q')).toHaveValue('beacon');
    await expect(cards(page)).toHaveCount(6);
  });

  await check('homepage shelf links select their category and details return to their original view', async () => {
    await page.locator('[data-nav="home"]').click();
    await expect(page.locator('#home-view')).toBeVisible();
    await page.locator('#home-view .shelf-more[data-open-catalog="communication"]').click();
    await expect(page.locator('#list')).toBeVisible();
    expect(new URL(page.url()).hash).toBe('#/plugins');
    expect(searchParams(page).get('category')).toBe('communication');
    expect(searchParams(page).get('q')).toBeNull();
    await expect(cards(page)).toHaveCount(5);

    const catalogueQuery = new URL(page.url()).search;
    await page.locator('[data-nav="home"]').click();
    const homeCard = page.locator('#home-view a.card').first();
    const ref = (await homeCard.getAttribute('href')).replace(/^#\//, '');
    await homeCard.click();
    await expect(page.locator('#view .dtitle')).toHaveText(byRef.get(ref).label);
    await expect(page.locator('#view a.back')).toHaveAttribute('href', '#/home');
    await page.locator('#view a.back').click();
    await expect(page.locator('#home-view')).toBeVisible();
    await expect(page.locator('#masthead')).toBeVisible();
    await expect(page.locator('#list')).toBeHidden();
    expect(new URL(page.url()).search).toBe(catalogueQuery);

    await page.locator('[data-nav="list"]').click();
    await expect(cards(page)).toHaveCount(5);
    await cards(page).first().click();
    await expect(page.locator('#view .dtitle')).toBeVisible();
    await expect(page.locator('#view a.back')).toHaveAttribute('href', '#/plugins');
    await page.locator('#view a.back').click();
    await expect(page.locator('#list')).toBeVisible();
    await expect(page.locator('#home-view')).toBeHidden();
    await expect(cards(page)).toHaveCount(5);
    expect(new URL(page.url()).search).toBe(catalogueQuery);
  });

  await check('375px navigation between homepage and catalogue keeps both layouts within the viewport', async () => {
    await page.setViewportSize({ width: 375, height: 812 });
    // The compact navigation uses the brand link as its visible homepage entry.
    await page.locator('.nav .brand').click();
    await expect(page.locator('#home-view')).toBeVisible();
    await noHorizontalOverflow(page);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: join(output, 'fixture-home-mobile.png'), fullPage: false });
    await page.locator('[data-nav="list"]').click();
    await expect(page.locator('#list')).toBeVisible();
    await expect(page.locator('#home-view')).toBeHidden();
    await noHorizontalOverflow(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
  });

  await check('fixture navigation produces no uncaught browser errors', async () => expect(errors).toEqual([]));
  await page.close();
}

async function independentLoadingChecks() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = page;
  const errors = [];
  let releaseAdvisories;
  let releaseMarkdown;
  let advisoriesStarted = false;
  let markdownStarted = false;
  const advisoryGate = new Promise(resolve => { releaseAdvisories = resolve; });
  const markdownGate = new Promise(resolve => { releaseMarkdown = resolve; });
  page.on('pageerror', error => errors.push(error.message));
  await page.route(new URL('index.json', market).href, route => route.fulfill({ json: fixture }));
  await page.route(new URL('advisories.json', market).href, async route => {
    advisoriesStarted = true;
    await advisoryGate;
    await route.fulfill({ json: { version: 1, advisories: [{
      ref: 'alpha/atlas-mail', versions: ['1.0.0'], severity: 'warn',
      reason: 'Fixture advisory received after catalogue', published: '2026-11-04',
    }] } });
  });
  await page.route('https://cdn.jsdelivr.net/**', async route => {
    markdownStarted = true;
    await markdownGate;
    await route.fulfill({ contentType: 'text/javascript', body: '' });
  });
  try {
    await page.goto(url(), { waitUntil: 'domcontentloaded' });
    await check('pending advisories and Markdown CDN do not block catalogue rendering or search', async () => {
      await expect(cards(page)).toHaveCount(24);
      expect(advisoriesStarted).toBe(true);
      expect(markdownStarted).toBe(true);
      await search(page, 'beacon', 6);
      await page.locator('[data-nav="advisories"]').click();
      await expect(page.locator('#view')).toContainText('读取中');
      await expect(page.locator('#view')).not.toContainText('目前没有安全通告');
      await expect(page.locator('#view .advrow')).toHaveCount(0);
    });
    await check('late advisory responses update the current view and catalogue warning badges', async () => {
      releaseAdvisories();
      await expect(page.locator('#view .advrow')).toHaveCount(1);
      await expect(page.locator('#view')).toContainText('Fixture advisory received after catalogue');
      await page.locator('[data-nav="list"]').click();
      await expect(cards(page)).toHaveCount(6);
      await expect(page.locator('#grid a.card[href="#/alpha/atlas-mail"] .adv')).toHaveCount(1);
      expect(errors).toEqual([]);
    });
  } finally {
    releaseAdvisories();
    releaseMarkdown();
    await page.unrouteAll({ behavior: 'wait' });
    await page.close();
  }
}

async function liveChecks() {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  activePage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const indexResponse = page.waitForResponse(response => response.url() === new URL('index.json', market).href && response.ok());
  await page.goto(url(), { waitUntil: 'domcontentloaded' });
  const live = await (await indexResponse).json();
  await check('unmocked official online index loads with bounded catalogue DOM', async () => {
    assert(Array.isArray(live.plugins) && live.plugins.length > 0, 'Online index must contain plugins');
    report.liveEntries = live.plugins.length;
    await expect(cards(page)).toHaveCount(Math.min(24, live.plugins.length));
    await expect(page.locator('#stats dt').first()).toHaveText(String(live.plugins.length));
    if (existsSync(liveSnapshot)) {
      const saved = JSON.parse(readFileSync(liveSnapshot, 'utf8'));
      expect(live.plugins.map(p => p.ref).sort()).toEqual(saved.plugins.map(p => p.ref).sort());
      report.liveSnapshot = liveSnapshot;
    }
    await page.screenshot({ path: join(output, 'live-desktop.png'), fullPage: true });
  });
  await check('unmocked online plugin details load and return to the catalogue', async () => {
    const ref = (await cards(page).first().getAttribute('href')).replace(/^#\//, '');
    const detailResponse = page.waitForResponse(response => response.url() === new URL(`details/${ref}.json`, market).href && response.ok());
    await cards(page).first().click();
    await detailResponse;
    await expect(page.locator('#view .dtitle')).toBeVisible();
    await expect(page.locator('#view .idline')).toContainText(ref);
    await page.locator('#view a.back').click();
    await expect(page.locator('#list')).toBeVisible();
    await expect(cards(page)).toHaveCount(Math.min(24, live.plugins.length));
    await page.setViewportSize({ width: 375, height: 812 });
    await noHorizontalOverflow(page);
    await page.screenshot({ path: join(output, 'live-mobile.png'), fullPage: true });
    expect(errors).toEqual([]);
  });
  await page.close();
}

try {
  assert(['fixture', 'live', 'all'].includes(mode), 'REGISTRY_BROWSER_MODE must be fixture, live or all');
  if (mode !== 'live') {
    await fixtureChecks();
    await independentLoadingChecks();
  }
  if (mode !== 'fixture') await liveChecks();
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack || String(error);
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: join(output, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
}
