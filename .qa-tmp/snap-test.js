// QA validation for 3rd snap fix
const { chromium } = require('playwright');

const URL = 'http://localhost:50636/';
const SETTLE = 1300;

async function settle(page, ms = SETTLE) { await page.waitForTimeout(ms); }

(async () => {
  const results = {};
  const browser = await chromium.launch({ headless: true });

  // --- Main desktop context 1440x900 ---
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('PAGE ERR:', m.text()); });
  await page.goto(URL, { waitUntil: 'load' });
  await settle(page, 1500); // let assets/video load

  // Pre-checks
  const pre = await page.evaluate(() => {
    const h = document.documentElement;
    const b = document.body;
    const hs = getComputedStyle(h);
    const bs = getComputedStyle(b);
    return {
      htmlHeight: hs.height,
      htmlHeightPx: parseFloat(hs.height),
      scrollHeight: h.scrollHeight,
      htmlOverflowY: hs.overflowY,
      htmlScrollSnapType: hs.scrollSnapType,
      bodyOverflowX: bs.overflowX,
      bodyOverflowY: bs.overflowY,
      bodyHeight: bs.height,
      docClientH: h.clientHeight,
      windowInnerH: window.innerHeight,
    };
  });
  results.pre = pre;

  // Criterion 1: html height ~= scrollHeight (tall html)
  // accept if htmlHeightPx within 10% of scrollHeight OR very close (>3000)
  results.c1 = {
    htmlHeightPx: pre.htmlHeightPx,
    scrollHeight: pre.scrollHeight,
    pass: pre.htmlHeightPx >= pre.scrollHeight * 0.9 && pre.htmlHeightPx <= pre.scrollHeight * 1.1
  };

  // Criterion 2: scrollHeight ~4100
  results.c2 = { scrollHeight: pre.scrollHeight, pass: pre.scrollHeight >= 3800 && pre.scrollHeight <= 4400 };

  // Criterion 3: html overflowY != scroll
  results.c3 = { value: pre.htmlOverflowY, pass: pre.htmlOverflowY !== 'scroll' };

  // Criterion 4: body overflowX is clip or hidden
  results.c4 = { value: pre.bodyOverflowX, pass: pre.bodyOverflowX === 'clip' || pre.bodyOverflowX === 'hidden' };

  const SNAP_POINTS = [0, 900, 1800, 2700, 3600];
  const nearAny = (y, tol = 100) => SNAP_POINTS.some(p => Math.abs(y - p) <= tol);

  // Criterion 5: wheel test
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 400);
  // move mouse to center for wheel target
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 600);
  await settle(page);
  const y5 = await page.evaluate(() => window.scrollY);
  results.c5 = { scrollY: y5, target: 'nearest snap', pass: nearAny(y5) };

  // Criterion 6: PageDown
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 400);
  await page.locator('body').click({ position: { x: 10, y: 10 } }).catch(() => {});
  await page.keyboard.press('PageDown');
  await settle(page);
  const y6 = await page.evaluate(() => window.scrollY);
  results.c6 = { scrollY: y6, target: 'nearest snap', pass: nearAny(y6) };

  // Criterion 7: End key
  await page.keyboard.press('End');
  await settle(page);
  const y7 = await page.evaluate(() => window.scrollY);
  results.c7 = { scrollY: y7, pass: y7 > 2500 };

  // Criterion 8: video.currentTime grows with scroll
  await page.evaluate(() => window.scrollTo(0, 0));
  await settle(page, 600);
  const v0 = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.currentTime : null;
  });
  await page.evaluate(() => window.scrollTo(0, 1800));
  await settle(page, 800);
  const v1 = await page.evaluate(() => {
    const v = document.querySelector('video');
    return v ? v.currentTime : null;
  });
  results.c8 = { t0: v0, t1: v1, pass: v1 !== null && v0 !== null && v1 > v0 + 0.1 };

  await ctx.close();

  // --- Mobile 390x844 for criterion 9 ---
  const mctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await mpage.goto(URL, { waitUntil: 'load' });
  await settle(mpage, 1500);
  const mob = await mpage.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  results.c9 = { ...mob, pass: mob.scrollWidth === mob.clientWidth };
  await mctx.close();

  // --- Reduced motion for criterion 10 ---
  const rctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const rpage = await rctx.newPage();
  await rpage.goto(URL, { waitUntil: 'load' });
  await settle(rpage, 1200);
  const rm = await rpage.evaluate(() => {
    const h = document.documentElement;
    const hs = getComputedStyle(h);
    return {
      htmlScrollSnapType: hs.scrollSnapType,
      mediaMatches: matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  });
  // disable snap = "none" or absent
  results.c10 = { ...rm, pass: rm.mediaMatches && (rm.htmlScrollSnapType === 'none' || !rm.htmlScrollSnapType) };
  await rctx.close();

  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(e => { console.error('FATAL', e); process.exit(1); });
