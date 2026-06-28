// Presentation mode test — enter, step/reveal, keyboard, caption/counter, exit restores.
import { chromium } from 'playwright';

const URL = process.env.TEST_URL || 'http://localhost:5173/';
const SHOT = process.env.SHOT || 'present.png';
const errors = [], results = [];
const ok = (n, c, x = '') => results.push(`${c ? 'PASS' : 'FAIL'}  ${n}${x ? '  — ' + x : ''}`);

async function launch() {
  for (const channel of ['chrome', 'msedge']) { try { return await chromium.launch({ channel, headless: true }); } catch {} }
  return await chromium.launch({ headless: true });
}
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => /הרעיון שלי|נושא/.test(document.querySelector('#map')?.textContent || ''), { timeout: 15000 });
  await page.waitForTimeout(500);

  // enter presentation
  await page.click('#btnPresent');
  await page.waitForTimeout(600);
  const presenting = await page.evaluate(() => document.body.classList.contains('presenting'));
  const toolbarHidden = await page.evaluate(() => getComputedStyle(document.querySelector('.toolbar')).display === 'none');
  ok('enters presentation (chrome hidden)', presenting && toolbarHidden);
  ok('presenter bar visible', await page.locator('#presenterBar').isVisible());
  const count0 = await page.textContent('#presCount');
  const cap0 = await page.textContent('#presCaption');
  ok('step 1 shows counter + caption', /1 \/ \d+/.test(count0) && /הרעיון/.test(cap0 || ''), `${count0} | ${cap0}`);

  // next (button)
  await page.click('#presNext');
  await page.waitForTimeout(500);
  const count1 = await page.textContent('#presCount');
  const cap1 = await page.textContent('#presCaption');
  ok('next advances counter + caption', /2 \/ /.test(count1) && cap1 !== cap0, `${count1} | ${cap1}`);
  await page.waitForSelector('me-tpc.present-current', { timeout: 2000 }).catch(() => {});
  ok('current node is highlighted', (await page.locator('me-tpc.present-current').count()) === 1);

  // next (keyboard ArrowRight)
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  const count2 = await page.textContent('#presCount');
  ok('ArrowRight advances', /3 \/ /.test(count2), count2);

  // prev (keyboard)
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(300);
  ok('ArrowLeft goes back', /2 \/ /.test(await page.textContent('#presCount')));

  await page.screenshot({ path: SHOT });

  // exit (Escape) restores chrome
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  const exited = await page.evaluate(() => !document.body.classList.contains('presenting'));
  ok('Escape exits and restores chrome', exited && await page.locator('.toolbar').isVisible());
  ok('presenter bar hidden after exit', !(await page.locator('#presenterBar').isVisible()));
  ok('map still has its nodes after exit', (await page.locator('me-tpc').count()) >= 4);
} catch (err) {
  results.push('FATAL: ' + err.message);
} finally {
  console.log('\n=== Presentation results ===');
  console.log(results.join('\n'));
  console.log('\n=== console/page errors (' + errors.length + ') ===');
  console.log(errors.length ? errors.join('\n') : '(none)');
  console.log('\nscreenshot: ' + SHOT);
  await browser.close();
  process.exit(results.some((r) => r.startsWith('FAIL') || r.startsWith('FATAL')) ? 1 : 0);
}
