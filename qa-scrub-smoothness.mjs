import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:50636', { waitUntil: 'load' });

await page.waitForFunction(() => {
  const v = document.getElementById('bgVideo');
  return v && v.readyState >= 2;
}, { timeout: 15000 });
await page.waitForTimeout(500);

// Layout dims: bgVideo (sharp) vs bgVideoBlur (cover)
const dims = await page.evaluate(() => {
  const sharp = document.getElementById('bgVideo');
  const blur = document.getElementById('bgVideoBlur');
  const sr = sharp?.getBoundingClientRect();
  const br = blur?.getBoundingClientRect();
  const cs = sharp ? getComputedStyle(sharp) : null;
  const cb = blur ? getComputedStyle(blur) : null;
  return {
    sharp: sr ? { w: Math.round(sr.width), h: Math.round(sr.height), objectFit: cs.objectFit, filter: cs.filter, opacity: cs.opacity } : null,
    blur:  br ? { w: Math.round(br.width), h: Math.round(br.height), objectFit: cb.objectFit, filter: cb.filter, opacity: cb.opacity } : null,
    viewport: { w: window.innerWidth, h: window.innerHeight }
  };
});
console.log('LAYOUT:', JSON.stringify(dims, null, 2));

// Scrub smoothness: seek 0->8s in 0.1s increments, measure seeking->seeked latency.
const result = await page.evaluate(async () => {
  const v = document.getElementById('bgVideo');
  v.pause();
  const samples = [];
  for (let t = 0; t <= 8; t = +(t + 0.1).toFixed(2)) {
    const start = performance.now();
    await new Promise(res => {
      const onSeeked = () => { v.removeEventListener('seeked', onSeeked); res(); };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = t;
    });
    samples.push(performance.now() - start);
  }
  const avg = samples.reduce((a,b)=>a+b,0)/samples.length;
  const max = Math.max(...samples);
  const min = Math.min(...samples);
  const p95 = samples.slice().sort((a,b)=>a-b)[Math.floor(samples.length*0.95)];
  return { count: samples.length, avgMs: +avg.toFixed(2), minMs: +min.toFixed(2), maxMs: +max.toFixed(2), p95Ms: +p95.toFixed(2) };
});
console.log('SCRUB:', JSON.stringify(result, null, 2));

await browser.close();
