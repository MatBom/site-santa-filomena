import { chromium } from 'playwright';

const URL = 'http://localhost:50636/';
const VP = { width: 1440, height: 900 };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Diagnostic: what element is the scroll container? snap-align on sections?
  const diag = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const secs = [...document.querySelectorAll('section')];
    return {
      htmlScroll: { scrollHeight: html.scrollHeight, clientHeight: html.clientHeight, snap: getComputedStyle(html).scrollSnapType, overflowY: getComputedStyle(html).overflowY, height: getComputedStyle(html).height },
      bodyScroll: { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, snap: getComputedStyle(body).scrollSnapType, overflowY: getComputedStyle(body).overflowY, height: getComputedStyle(body).height },
      sections: secs.map(s => ({
        id: s.id,
        snapAlign: getComputedStyle(s).scrollSnapAlign,
        snapStop: getComputedStyle(s).scrollSnapStop,
        height: s.offsetHeight,
        top: s.getBoundingClientRect().top + window.scrollY,
      })),
      scrollingElement: document.scrollingElement === html ? 'html' : (document.scrollingElement === body ? 'body' : 'other'),
    };
  });

  // Try wheel with multiple ticks (real users send many delta events)
  const wheelTests = [];
  for (const start of [0, 900, 1800]) {
    await page.evaluate((y) => window.scrollTo(0, y), start);
    await page.waitForTimeout(400);
    await page.mouse.move(720, 450);
    // simulate user wheel: many small deltas
    for (let i = 0; i < 10; i++) {
      await page.mouse.wheel(0, 50);
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => window.scrollY);
    wheelTests.push({ from: start, after: r });
  }

  // Try keyboard PageDown (also triggers snap)
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page.keyboard.press('PageDown');
  await page.waitForTimeout(1500);
  const kbAfter = await page.evaluate(() => window.scrollY);

  console.log(JSON.stringify({ diag, wheelTests, kbAfter }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
