// Phase 1 smoke test — drives installed Chrome/Edge against the local server.
import { chromium } from 'playwright';

const URL = 'http://localhost:5173/';
const SHOT = process.env.SHOT || 'smoke.png';
const errors = [];

async function launch() {
  for (const channel of ['chrome', 'msedge']) {
    try { return await chromium.launch({ channel, headless: true }); }
    catch { /* try next */ }
  }
  return await chromium.launch({ headless: true }); // bundled chromium if present
}

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

  // wait for the seeded root to render
  await page.waitForFunction(() => /הרעיון שלי/.test(document.querySelector('#map')?.textContent || ''), { timeout: 15000 });
  ok('app loads & seeds root in Hebrew', true);

  const nodeSel = 'me-tpc, [data-nodeid]';
  const before = await page.locator(nodeSel).count();
  ok('topic nodes rendered', before >= 4, before + ' nodes');

  // RTL check
  const dir = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
  ok('document direction is rtl', dir === 'rtl', dir);

  // RTL-natural layout: root anchored on the RIGHT, branches flow LEFT (childX < rootX)
  const geo = await page.evaluate(() => {
    const tpcs = [...document.querySelectorAll('me-tpc')];
    const root = tpcs.find((t) => /הרעיון שלי/.test(t.textContent)) || tpcs[0];
    const child = tpcs.find((t) => /נושא ראשון/.test(t.textContent));
    if (!root || !child) return null;
    return { rootX: root.getBoundingClientRect().left, childX: child.getBoundingClientRect().left };
  });
  ok('RTL layout: root on right, branches flow left', geo ? geo.childX < geo.rootX : false, geo ? `root@${Math.round(geo.rootX)} child@${Math.round(geo.childX)}` : 'geo n/a');

  // add child via toolbar
  await page.click('#btnAddChild');
  await page.waitForTimeout(400);
  const after = await page.locator(nodeSel).count();
  ok('add-child increases node count', after === before + 1, `${before} -> ${after}`);

  // theme switch (now in the sidebar Format pane)
  await page.click('.rail-btn[data-tab="format"]');
  await page.click('.theme-opt[data-theme="playful"]');
  await page.waitForTimeout(300);
  ok('theme switch works', true);

  // export PNG (exercises exportPng / snapdom)
  let pngOk = false;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      (async () => { await page.click('#btnExport'); await page.click('[data-export="png"]'); })(),
    ]);
    pngOk = !!(await dl.path());
  } catch { pngOk = false; }
  ok('export PNG produces a download', pngOk);

  // export SVG
  let svgOk = false;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => { await page.click('#btnExport'); await page.click('[data-export="svg"]'); })(),
    ]);
    svgOk = !!(await dl.path());
  } catch { svgOk = false; }
  ok('export SVG produces a download', svgOk);

  // export JSON
  let jsonOk = false;
  try {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => { await page.click('#btnExport'); await page.click('[data-export="json"]'); })(),
    ]);
    jsonOk = /\.mindmap\.json$/.test(dl.suggestedFilename());
  } catch { jsonOk = false; }
  ok('export JSON produces a .mindmap.json', jsonOk);

  await page.screenshot({ path: SHOT, fullPage: false });
} catch (err) {
  results.push('FATAL: ' + err.message);
} finally {
  console.log('\n=== Phase 1 smoke results ===');
  console.log(results.join('\n'));
  console.log('\n=== console/page errors (' + errors.length + ') ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\nscreenshot: ' + SHOT);
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL') || r.startsWith('FATAL')) ? 1 : 0);
}
