// Phase 2 AI end-to-end — drives the browser UI against the local proxy (:5055).
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://localhost:5173/';
const SHOT = process.env.SHOT || 'ai.png';
const errors = [];
const results = [];
const ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);

async function launch() {
  for (const channel of ['chrome', 'msedge']) { try { return await chromium.launch({ channel, headless: true }); } catch {} }
  return await chromium.launch({ headless: true });
}
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const nodeSel = 'me-tpc, [data-nodeid]';
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => /הרעיון שלי|פוטוסינתזה/.test(document.querySelector('#map')?.textContent || ''), { timeout: 15000 });

  // open the AI sidebar pane, generate from a Hebrew prompt
  await page.click('.rail-btn[data-tab="ai"]');
  await page.waitForSelector('.side-pane[data-pane="ai"]:not([hidden])', { timeout: 5000 });
  await page.fill('#aiInput', 'פוטוסינתזה לכיתה ז');
  await page.click('#aiGo');

  // wait for the generated map to render (Gemini round-trip)
  await page.waitForFunction(
    () => /פוטוסינתז|כלורופי|חמצן|פחמן/.test(document.querySelector('#map')?.textContent || ''),
    { timeout: 40000 }
  );
  const genCount = await page.locator(nodeSel).count();
  ok('AI generate renders an on-topic Hebrew map', genCount >= 5, genCount + ' nodes');

  // select the root, then expand it with AI
  await page.locator('me-tpc').filter({ hasText: 'פוטוסינתז' }).first().click();
  await page.waitForTimeout(300);
  const before = await page.locator(nodeSel).count();
  await page.click('#btnExpand');
  await page.waitForFunction(
    (b) => document.querySelectorAll('me-tpc, [data-nodeid]').length > b,
    before, { timeout: 40000 }
  );
  const after = await page.locator(nodeSel).count();
  ok('AI expand adds children to the selected node', after > before, `${before} -> ${after}`);

  await page.screenshot({ path: SHOT });
} catch (err) {
  results.push('FATAL: ' + err.message);
} finally {
  console.log('\n=== Phase 2 AI results ===');
  console.log(results.join('\n'));
  console.log('\n=== console/page errors (' + errors.length + ') ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\nscreenshot: ' + SHOT);
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL') || r.startsWith('FATAL')) ? 1 : 0);
}
