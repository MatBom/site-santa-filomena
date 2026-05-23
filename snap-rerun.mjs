import { chromium } from 'playwright';

const URL = 'http://localhost:50636/';
const VP = { width: 1440, height: 900 };

function nearest(target, points, tol = 100) {
  for (const p of points) if (Math.abs(target - p) <= tol) return p;
  return null;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: VP });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // 1. CSS computed
  const css = await page.evaluate(() => {
    const h = getComputedStyle(document.documentElement);
    const b = getComputedStyle(document.body);
    return {
      htmlSnap: h.scrollSnapType,
      htmlOverflowY: h.overflowY,
      htmlOverflowX: h.overflowX,
      bodyOverflowX: b.overflowX,
    };
  });

  // 2. Section offsets
  const offsets = await page.evaluate(() => {
    const ids = ['hero', 'manifesto', 'categorias', 'visite'];
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id) ||
                 document.querySelector(`section[data-section="${id}"]`) ||
                 document.querySelector(`.${id}`);
      if (el) out[id] = el.getBoundingClientRect().top + window.scrollY;
    }
    // fallback: list all sections
    if (Object.keys(out).length === 0) {
      const secs = [...document.querySelectorAll('section')];
      secs.forEach((s, i) => {
        out[s.id || s.className || `sec${i}`] = s.getBoundingClientRect().top + window.scrollY;
      });
    }
    return out;
  });

  const snapPoints = Object.values(offsets).sort((a, b) => a - b);

  // 3. Programmatic scrollTo tests
  const targets = [400, 1200, 2300, 3200];
  const progResults = [];
  for (const t of targets) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), t);
    await page.waitForTimeout(800);
    const data = await page.evaluate(() => ({
      sy: window.scrollY,
      ct: document.querySelector('video') ? document.querySelector('video').currentTime : null,
    }));
    const snapped = nearest(data.sy, snapPoints, 100);
    progResults.push({ target: t, scrollY: data.sy, snappedTo: snapped, currentTime: data.ct, pass: snapped !== null });
  }

  // 4. Wheel test starting from y=0
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(500);
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(800);
  const wheelData = await page.evaluate(() => ({
    sy: window.scrollY,
    ct: document.querySelector('video') ? document.querySelector('video').currentTime : null,
  }));
  const wheelSnap = nearest(wheelData.sy, snapPoints, 100);
  const wheelResult = { scrollY: wheelData.sy, snappedTo: wheelSnap, currentTime: wheelData.ct, pass: wheelSnap !== null };

  // 5. Video monotonic check
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(600);
  const ctSeq = [];
  for (const t of [0, 900, 1800, 2700]) {
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), t);
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => ({
      sy: window.scrollY,
      ct: document.querySelector('video') ? document.querySelector('video').currentTime : null,
    }));
    ctSeq.push({ target: t, ...r });
  }
  let monotonic = true;
  for (let i = 1; i < ctSeq.length; i++) {
    if (ctSeq[i].ct === null || ctSeq[i].ct < ctSeq[i - 1].ct) { monotonic = false; break; }
  }

  console.log(JSON.stringify({
    css,
    offsets,
    snapPoints,
    programmatic: progResults,
    wheel: wheelResult,
    monotonic,
    ctSeq,
  }, null, 2));

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
