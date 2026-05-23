import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport:{width:1440,height:900} });
await page.goto('http://localhost:50636');
await page.waitForFunction(() => document.getElementById('bgVideo')?.readyState >= 2, { timeout:15000 });
const dim = await page.evaluate(() => {
  const v = document.getElementById('bgVideo');
  return { videoWidth:v.videoWidth, videoHeight:v.videoHeight, duration:v.duration };
});
console.log(JSON.stringify(dim,null,2));
await browser.close();
