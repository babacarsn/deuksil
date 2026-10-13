const {chromium} = require('playwright');
const {APP} = require('./harnais');
(async () => { const b = await chromium.launch();
 for (const [w, h, name] of [[390, 844, 'mob'], [1280, 900, 'desk']]) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1});
  await ctx.route(/^https?:/, r => r.abort()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('.hx-avis').scrollIntoView());
  const s0 = await p.evaluate(() => document.querySelector('.hx-car-avis').scrollLeft); await p.mouse.move(2, 2); await p.waitForTimeout(4600);
  const s1 = await p.evaluate(() => document.querySelector('.hx-car-avis').scrollLeft);
  await p.evaluate(() => document.querySelectorAll('.hx-q')[2].querySelector('summary').click());
  const y = await p.evaluate(() => document.querySelector('.hx-avis').getBoundingClientRect().top + scrollY - 10), y2 = await p.evaluate(() => document.querySelector('.hx-faq').getBoundingClientRect().bottom + scrollY + 10);
  await p.evaluate(() => document.querySelector('.hx-car-avis').scrollTo({left: 0, behavior: 'instant'})); await p.waitForTimeout(300);
  await p.screenshot({path: require('path').join(__dirname, `avis-${name}.png`), fullPage: true, clip: {x: 0, y, width: w, height: y2 - y}});
  const sw = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(name, 'défilement', s0, '→', Math.round(s1), 'questions', await p.evaluate(() => document.querySelectorAll('.hx-q').length), 'ouvertes', await p.evaluate(() => document.querySelectorAll('.hx-q[open]').length), 'débord', sw, errs); await ctx.close(); }
 await b.close(); })();
