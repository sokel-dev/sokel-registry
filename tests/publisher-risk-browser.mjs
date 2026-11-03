// PLAYWRIGHT_MODULE=/path/to/node_modules/@playwright/test node tests/publisher-risk-browser.mjs
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const origin = process.env.REGISTRY_URL || 'http://127.0.0.1:5180/';
const market = 'https://registry-risk.example/';
const output = process.env.REGISTRY_RISK_OUTPUT || '/tmp/sokel-registry-publisher-risk';
mkdirSync(output, { recursive: true });
const riskZh = '此插件由第三方发布者维护。插件可能访问你授权的数据和凭证，请核对发布者、代码来源及所需权限，并仅授予必要的访问权限。';
const riskEn = 'This plugin is maintained by a third-party publisher. It may access data and credentials you authorize. Verify the publisher, code source and required permissions, and grant only the access it needs.';
const plugins = [
  { ref: 'community/mail', org: 'community', name: 'mail', label: '团队邮件', desc: '在工作流中接收和发送团队邮件。', categories: ['communication'], i18n: { en: { label: 'Team Mail', desc: 'Receive and send team email in workflows.' } } },
  { ref: 'community/spoof', org: 'sokel', name: 'spoof', label: 'Sokel 官方插件', categories: ['ai'] },
  { ref: 'sokel/openai', org: 'sokel', name: 'openai', label: 'OpenAI', categories: ['ai'] },
  { ref: 'sokel/xueqiu', org: 'sokel', name: 'xueqiu', label: '雪球（非官方）', desc: '非官方接口', categories: ['finance'] },
].map(p => ({ version: '1.0.0', operations: 2, events: 0, capabilities: [], ...p }));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const report = { checks: [], errors: [] };
page.on('pageerror', error => report.errors.push(error.message));
await page.route(new URL('index.json', market).href, route => route.fulfill({ json: { version: 2, plugins } }));
await page.route(new URL('advisories.json', market).href, route => route.fulfill({ json: { version: 1, advisories: [
  { ref: 'community/spoof', versions: ['1.0.0'], severity: 'block', reason: 'Fixture: known vulnerable version', published: '2026-11-04' },
] } }));
await page.route('https://cdn.jsdelivr.net/**', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
await page.route(new URL('details/**', market).href, route => {
  const ref = decodeURIComponent(new URL(route.request().url()).pathname.slice('/details/'.length, -'.json'.length));
  const p = plugins.find(plugin => plugin.ref === ref);
  return route.fulfill({ json: { ...p, ref: 'sokel/claimed-manifest-name', org: 'sokel', doc: 'Plugin documentation.', operations: [], credentials: [] } });
});
const url = (hash = '/plugins', lang = 'zh') => `${origin}?${new URLSearchParams({ base: market, lang })}#${hash}`;
const card = ref => page.locator(`#grid .card[href="#/${ref}"]`);
async function check(name, run) {
  await run();
  report.checks.push(name);
  console.log(`PASS ${name}`);
}
async function goto(ref, lang = 'zh') {
  await page.goto(url(`/${ref}`, lang), { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.dhead .install')).toBeVisible();
}
async function screenshot(name) {
  await page.screenshot({ path: join(output, name), fullPage: !await page.getByRole('dialog').isVisible() });
}
async function noOverflow() {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal overflow');
}
try {
  await page.goto(url(), { waitUntil: 'domcontentloaded' });
  await check('catalogue identifies third-party publishers from canonical refs', async () => {
    await expect(card('community/mail').getByText('第三方发布', { exact: true })).toBeVisible();
    await expect(card('community/spoof').getByText('第三方发布', { exact: true })).toBeVisible();
    await expect(card('sokel/openai').locator('.publisher-source')).toHaveCount(0);
    await expect(card('sokel/xueqiu').locator('.publisher-source')).toHaveCount(0);
    const colors = await card('community/mail').locator('.publisher-source').evaluate(el => ({ color: getComputedStyle(el).color, background: getComputedStyle(el).backgroundColor }));
    assert.notEqual(colors.background, 'rgba(0, 0, 0, 0)');
    await screenshot('catalog-desktop-zh.png');
  });
  await check('list and homepage retain the publisher marker', async () => {
    await page.locator('[data-view="list"]').click();
    await expect(card('community/mail').getByText('第三方发布', { exact: true })).toBeVisible();
    await noOverflow();
    await screenshot('catalog-list-zh.png');
    await page.goto(url('/home'), { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#home-shelves .card[href="#/community/mail"]').getByText('第三方发布', { exact: true })).toBeVisible();
    await expect(page.locator('#headline')).toBeVisible();
    await screenshot('home-zh.png');
  });
  await check('detail and installation dialog show a nonblocking risk notice', async () => {
    await goto('community/mail');
    await expect(page.locator('#view .publisher-risk')).toHaveText(`第三方插件${riskZh}`);
    await screenshot('detail-desktop-zh.png');
    await page.locator('.dhead .install').click();
    await expect(page.getByRole('dialog').locator('.publisher-risk')).toHaveText(`第三方插件${riskZh}`);
    await expect(page.getByRole('dialog').getByRole('button', { name: '前往安装', exact: true })).toBeEnabled();
    await expect(page.getByRole('dialog').getByRole('checkbox')).toHaveCount(1);
    await page.locator('#dlgurl').fill('https://workspace.example.com');
    await expect(page.locator('#dlgpreview')).toContainText('/plugins/market?install=community%2Fmail');
    await screenshot('install-desktop-zh.png');
    await page.keyboard.press('Escape');
  });
  await check('known security advisories remain separate from publisher notices', async () => {
    await goto('community/spoof');
    await expect(page.locator('#view .publisher-risk')).toBeVisible();
    await expect(page.locator('#detail-advisory')).toContainText('Fixture: known vulnerable version');
    await expect(page.locator('#detail-advisory')).toContainText('拦截级');
  });
  await check('Sokel publishers receive no third-party warning, including unofficial API integrations', async () => {
    for (const ref of ['sokel/openai', 'sokel/xueqiu']) {
      await goto(ref);
      await expect(page.locator('#view .publisher-risk')).toHaveCount(0);
      await page.locator('.dhead .install').click();
      await expect(page.getByRole('dialog').locator('.publisher-risk')).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
  });
  await check('English notice is localized and canonical ref survives a conflicting manifest', async () => {
    await goto('community/mail', 'en');
    await expect(page.locator('#view .publisher-risk')).toHaveText(`Third-party plugin${riskEn}`);
    await expect(page.locator('.idline')).toContainText('community/mail');
    await page.locator('.dhead .install').click();
    await expect(page.getByRole('dialog').locator('.publisher-risk')).toHaveText(`Third-party plugin${riskEn}`);
    await screenshot('install-desktop-en.png');
    await page.keyboard.press('Escape');
  });
  await check('mobile notices wrap and the installation action remains reachable', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await goto('community/mail');
    await expect(page.locator('#view .publisher-risk')).toBeVisible();
    await noOverflow();
    await screenshot('detail-mobile-zh.png');
    await page.locator('.dhead .install').click();
    await expect(page.getByRole('dialog').locator('.publisher-risk')).toBeVisible();
    await noOverflow();
    const box = await page.getByRole('dialog').boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 668, 'dialog fits mobile viewport');
    await page.getByRole('dialog').getByRole('button', { name: '前往安装', exact: true }).scrollIntoViewIfNeeded();
    await screenshot('install-mobile-zh.png');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 320, height: 568 });
    await goto('community/mail', 'en');
    await page.locator('.dhead .install').click();
    await noOverflow();
    const small = await page.getByRole('dialog').boundingBox();
    assert.ok(small.y >= 0 && small.y + small.height <= 569, 'English dialog fits a small viewport');
    await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).scrollIntoViewIfNeeded();
    await screenshot('install-mobile-en.png');
  });
  await check('the existing Continue action still opens the selected platform with the canonical ref', async () => {
    await page.route('https://workspace.example.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Fixture platform</p>' }));
    await page.locator('#dlgurl').fill('https://workspace.example.com');
    await page.getByRole('dialog').getByRole('button', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL('https://workspace.example.com/plugins/market?install=community%2Fmail');
  });
  assert.deepEqual(report.errors, []);
} catch (error) {
  report.failure = error.stack;
  await screenshot('failure.png');
  throw error;
} finally {
  writeFileSync(join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
