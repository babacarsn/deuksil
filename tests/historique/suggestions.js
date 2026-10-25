const {chromium} = require('playwright');
const {loginAs, goto, APP} = require('./harnais');
(async () => { const b = await chromium.launch(); const tag = process.argv[2] || 'avant';
 for (const [w, h, name] of [[390, 844, 'mob'], [1280, 900, 'desk']]) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1});
  await ctx.route(/^https?:/, r => r.abort()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700);
  await p.evaluate(() => document.querySelector('form[data-action="home-search"]').scrollIntoView({block: 'start'}));
  await p.type('form[data-action="home-search"] [name="q"]', 'da', {delay: 60}); await p.waitForTimeout(500);
  const vis = await p.evaluate(() => { const s = document.querySelector('.sugg'); if (!s) return 'pas de suggestions'; const r = s.getBoundingClientRect(); const pts = [40, r.height / 2, r.height - 20].map(y => document.elementFromPoint(r.left + 40, Math.min(r.top + y, innerHeight - 5))); const bad = pts.filter(el => !(el && s.contains(el))); return bad.length ? 'cachées en partie sous : ' + bad.map(x => x && x.className).join(' | ') : 'visibles en entier'; });
  await p.screenshot({path: require('path').join(__dirname, `sug-${tag}-${name}.png`)});
  console.log(name, vis, errs); await ctx.close(); }
 await b.close(); })();
