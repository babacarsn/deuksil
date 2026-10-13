const {chromium} = require('playwright');
const {APP} = require('./harnais');
(async () => { const b = await chromium.launch();
 for (const [w, h, name] of [[390, 844, 'mob'], [1280, 900, 'desk']]) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1});
  await ctx.route(/^https?:/, r => r.abort()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('.hx-car').scrollIntoView({block: 'center'}));
  const s0 = await p.evaluate(() => [document.querySelectorAll('.hx-car .hx-card').length, document.querySelector('.hx-car').scrollLeft]);
  await p.mouse.move(5, 5); await p.waitForTimeout(4600);
  const s1 = await p.evaluate(() => document.querySelector('.hx-car').scrollLeft);
  await p.evaluate(() => document.querySelector('[data-car="next"]').click()); await p.waitForTimeout(700);
  const s2 = await p.evaluate(() => document.querySelector('.hx-car').scrollLeft);
  const vis = await p.evaluate(() => { const c = document.querySelector('.hx-car'), r = c.getBoundingClientRect(); return [...c.querySelectorAll('.hx-card')].filter(x => { const q = x.getBoundingClientRect(); return q.left >= r.left - 2 && q.right <= r.right + 2; }).length; });
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await p.screenshot({path: require('path').join(__dirname, `car-${name}.png`)});
  console.log(name, 'cartes', s0[0], 'défilement auto', s0[1], '→', Math.round(s1), 'flèche →', Math.round(s2), 'visibles', vis, 'débordement', sw, errs); await ctx.close(); }
 await b.close(); })();
