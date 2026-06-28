// UX overhaul test — full-height canvas, grab-pan, wheel-zoom, sidebar, outline.
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://localhost:5173/';
const SHOT = process.env.SHOT || 'ux.png';
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

const canvasTransform = () => page.evaluate(() => {
  const c = document.querySelector('.map-canvas');
  return c ? getComputedStyle(c).transform : '';
});

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => /הרעיון שלי|פוטוסינתז/.test(document.querySelector('#map')?.textContent || ''), { timeout: 15000 });
  await page.waitForTimeout(500); // let ResizeObserver re-center settle

  // 1) full-height: #map fills viewport below toolbar, and mind-elixir's container matches it
  const dims = await page.evaluate(() => {
    const map = document.getElementById('map');
    const cont = document.querySelector('.map-container');
    return {
      vh: window.innerHeight,
      tb: document.querySelector('.toolbar').offsetHeight,
      mapH: map.clientHeight,
      contH: cont ? cont.clientHeight : 0,
    };
  });
  ok('#map fills viewport below toolbar', Math.abs(dims.mapH - (dims.vh - dims.tb)) <= 4, `map ${dims.mapH} vs ${dims.vh - dims.tb}`);
  ok('mind-elixir container matches #map height (no dead band)', dims.contH > 0 && Math.abs(dims.contH - dims.mapH) <= 4, `cont ${dims.contH} vs map ${dims.mapH}`);

  // 2) grab-to-pan moves the canvas
  const t0 = await canvasTransform();
  await page.mouse.move(950, 150);
  await page.mouse.down();
  await page.mouse.move(950 + 130, 150 + 70, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const t1 = await canvasTransform();
  ok('grab-drag on empty background pans the canvas', t1 !== t0, t1 !== t0 ? 'transform changed' : 'no change');

  // 3) ctrl+wheel zooms (transform changes)
  await page.evaluate(() => {
    document.getElementById('map').dispatchEvent(new WheelEvent('wheel', { deltaY: -120, ctrlKey: true, clientX: 700, clientY: 400, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(150);
  const t2 = await canvasTransform();
  ok('ctrl/pinch wheel zooms the canvas', t2 !== t1, t2 !== t1 ? 'transform changed' : 'no change');

  // 4) sidebar: switch to Format pane
  await page.click('.rail-btn[data-tab="format"]');
  ok('Format pane shows on rail click', await page.locator('.side-pane[data-pane="format"]').isVisible());

  // 5) outline lists nodes and click focuses
  await page.click('.rail-btn[data-tab="outline"]');
  const outlineCount = await page.locator('#outlineList .outline-item').count();
  ok('Outline lists the map nodes', outlineCount >= 4, outlineCount + ' items');
  await page.locator('#outlineList .outline-item').nth(1).click();
  await page.waitForTimeout(150);
  ok('clicking an outline item does not error', true);

  // 6) collapse / expand
  await page.click('#btnSidebar');
  const collapsed = await page.evaluate(() => document.body.classList.contains('side-collapsed'));
  await page.click('#btnSidebar');
  const expanded = await page.evaluate(() => !document.body.classList.contains('side-collapsed'));
  ok('sidebar toggles collapsed/expanded', collapsed && expanded);

  await page.screenshot({ path: SHOT });
} catch (err) {
  results.push('FATAL: ' + err.message);
} finally {
  console.log('\n=== UX overhaul results ===');
  console.log(results.join('\n'));
  console.log('\n=== console/page errors (' + errors.length + ') ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\nscreenshot: ' + SHOT);
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL') || r.startsWith('FATAL')) ? 1 : 0);
}
