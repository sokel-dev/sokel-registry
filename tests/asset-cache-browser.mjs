// Targeted regression for a new registry document receiving stale, unversioned CSS.
// PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/asset-cache-browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { basename, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const site = fileURLToPath(new URL('../site/', import.meta.url));
const output = process.env.REGISTRY_CACHE_TEST_OUTPUT || '/tmp/sokel-registry-cache-browser';
mkdirSync(output, { recursive: true });

// Fixed historical contracts, deliberately independent of HEAD: future commits must not turn the
// poisoned cache into a copy of the current stylesheet and silently stop exercising this regression.
const legacyDocument = `<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="./style.css"></head><body>
  <details class="filter-panel" open><summary id="filter-summary">Filters</summary></details>
  <div class="catalog-toolbar"><label class="searchbox"><svg viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input></label></div>
  </body></html>`;
const legacyStyle = `@import url("./tokens.css");
  :root { --legacy-stylesheet-cache: loaded; }
  body { font-family: serif; }
  .catalog-toolbar { display: block; }
  .searchbox svg { width: 300px; height: 300px; fill: black; }
  .filter-panel > summary { display: list-item; }`;
const legacyTokens = ':root { --legacy-token-cache: loaded; --font-sans: serif; }';
const assets = new Map(['index.html', 'style.css', 'tokens.css', 'brands.js', 'catalog.js', 'app.js', 'favicon.svg']
  .map(name => [name, readFileSync(join(site, name), 'utf8')]));
const contentTypes = { css: 'text/css', js: 'text/javascript', html: 'text/html', svg: 'image/svg+xml', json: 'application/json' };
const index = { version: 2, plugins: [{
  ref: 'fixture/database', org: 'fixture', name: 'database', label: '缓存回归插件', desc: '用于验证目录资源更新。',
  version: 'v1.0.0', categories: ['data'], capabilities: ['rowstore'], operations: 1, events: 0, deploy: [],
  manifest: 'plugins/fixture/database/manifest.yml',
}] };

let phase = 'legacy';
let removeVersions = false;
const requests = [];
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const name = u.pathname.endsWith('/') ? 'index.html' : basename(u.pathname);
  requests.push({ phase, path: u.pathname, search: u.search, version: u.searchParams.get('v') });
  let body;
  let cache = 'public, max-age=31536000';
  if (name === 'index.html') {
    body = phase === 'legacy' ? legacyDocument : assets.get(name)
      // Keep the optional external Markdown parser out of this deterministic, local-only check.
      // Playwright routing is intentionally not used: it disables HTTP caching for the context.
      .replace(/https:\/\/cdn\.jsdelivr\.net\/[^"']+/g, './marked-fixture.js');
    if (removeVersions && phase === 'current') body = body.replace(/\?v=[^"']+/g, '');
    res.setHeader('ETag', phase === 'legacy' ? '"legacy-document"' : '"current-document"');
  } else if (name === 'style.css' || name === 'tokens.css') {
    // Model a still-fresh intermediary cache as well as the browser cache. A soft reload may revalidate
    // its assets, so returning stale bytes for their old URL keeps this test meaningful in either case.
    // A new versioned URL reaches the updated origin assets immediately.
    body = u.searchParams.has('v') ? assets.get(name) : name === 'style.css' ? legacyStyle : legacyTokens;
  } else if (name === 'index.json') {
    body = JSON.stringify(index);
    cache = 'no-store';
  } else if (name === 'advisories.json') {
    body = JSON.stringify({ version: 1, advisories: [] });
    cache = 'no-store';
  } else if (name === 'marked-fixture.js') {
    body = '';
  } else {
    body = assets.get(name);
  }
  if (body === undefined) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, {
    'Content-Type': `${contentTypes[name.split('.').pop()] || 'text/plain'}; charset=utf-8`,
    'Cache-Control': cache,
  });
  res.end(body);
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { startedAt: new Date().toISOString(), origin, checks: [] };
let browser;
let activePage;

async function runTransition(negativeControl) {
  phase = 'legacy';
  removeVersions = negativeControl;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  activePage = page;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    // The same origin, context and URL survive the upgrade. No cache clearing or hard reload.
    // #/plugins explicitly exercises the directory when the homepage is a separate route.
    await page.goto(`${origin}/?lang=zh#/plugins`, { waitUntil: 'load' });
    await expect(page.locator('.catalog-toolbar')).toHaveCSS('display', 'block');
    await expect(page.locator('#filter-summary')).toBeVisible();
    expect((await page.locator('.searchbox svg').boundingBox()).width).toBe(300);
    const oldRequests = requests.filter(r => r.path === '/style.css').length;
    const cached = await page.evaluate(async () => (await fetch('./style.css', { cache: 'force-cache' })).text());
    expect(cached).toContain('--legacy-stylesheet-cache: loaded');
    expect(requests.filter(r => r.path === '/style.css').length).toBe(oldRequests);

    phase = 'current';
    const transitionStart = requests.length;
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#grid a.card')).toHaveCount(1);
    const legacyMarker = await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--legacy-stylesheet-cache').trim());

    if (negativeControl) {
      // Removing revisions only from the served document must reproduce the reported visual failure.
      // This proves that the positive path is protecting against poisoned assets, not just testing a
      // clean first load. The source tree is never changed by this negative control.
      expect(legacyMarker).toBe('loaded');
      expect((await page.locator('.searchbox svg').boundingBox()).width).toBe(300);
      await expect(page.locator('.catalog-toolbar')).toHaveCSS('display', 'block');
      await expect(page.locator('#filter-summary')).toBeVisible();
      report.checks.push('negative control: unversioned current document reproduces stale stylesheet layout');
      await page.screenshot({ path: join(output, 'stale-css-control.png'), fullPage: false });
      console.log('PASS negative control reproduces the cached stylesheet regression');
      return;
    }

    expect(legacyMarker).toBe('');
    await expect(page.locator('#list')).toBeVisible();
    await expect(page.locator('#home-view')).toBeHidden();
    await expect(page.locator('#masthead')).toBeHidden();
    expect(await page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--legacy-token-cache').trim())).toBe('');
    await expect(page.locator('.catalog-toolbar')).toHaveCSS('display', 'flex');
    await expect(page.locator('#filter-summary')).toBeHidden();
    await expect(page.locator('#filter-summary')).toHaveText('筛选');
    const icon = await page.locator('.searchbox svg').boundingBox();
    expect(icon.width).toBeGreaterThan(0);
    expect(icon.width).toBeLessThanOrEqual(24);
    expect(icon.height).toBeLessThanOrEqual(24);
    await expect(page.locator('.searchbox svg')).toHaveCSS('fill', 'none');
    await expect(page.locator('label[for="capability"] > span')).toHaveText('能力');
    await expect(page.locator('label[for="publisher"] > span')).toHaveText('发布者');
    await expect(page.locator('label[for="capability"]')).toHaveCSS('display', 'flex');
    await expect(page.locator('label[for="capability"]')).toHaveCSS('flex-direction', 'column');
    await expect(page.locator('#side [data-category="data"]')).toContainText('数据与知识库');
    expect(await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily)).not.toBe('serif');

    const after = requests.slice(transitionStart);
    const stylesheet = after.find(r => r.path === '/style.css');
    const tokens = after.find(r => r.path === '/tokens.css');
    assert(stylesheet?.version, 'The updated document must request a versioned stylesheet');
    assert(tokens?.version, 'The stylesheet must request versioned design tokens');
    expect(tokens.version).toBe(stylesheet.version);
    for (const name of ['brands.js', 'catalog.js', 'app.js']) {
      expect(after.find(r => r.path === `/${name}`)?.version, `${name} must use the same UI revision`).toBe(stylesheet.version);
    }
    expect(errors).toEqual([]);
    report.version = stylesheet.version;
    report.assetRequests = after.filter(r => /\.(css|js)$/.test(r.path));
    report.checks.push('normal reload replaces previously cached legacy CSS and tokens using coordinated asset revisions');
    report.checks.push('directory icon, flex toolbar, hidden desktop filter summary and translated filter labels render correctly');
    await page.screenshot({ path: join(output, 'versioned-css-reload.png'), fullPage: false });
    console.log('PASS ordinary reload uses new versioned styles, tokens and scripts over a populated legacy cache');
    console.log('PASS directory SVG size, toolbar, desktop filters, typography and labels');
  } finally {
    await context.close();
  }
}

try {
  browser = await chromium.launch({ headless: true });
  await runTransition(true);
  await runTransition(false);
  report.ok = true;
} catch (error) {
  report.ok = false;
  report.error = error.stack || String(error);
  if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: join(output, 'failure.png'), fullPage: false }).catch(() => {});
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (browser) await browser.close();
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
