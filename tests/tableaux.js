const {chromium} = require('playwright');
const {goto, APP} = require('./harnais');
const login = async (p, key) => { await p.evaluate(k => { const u = DB.findItem(DB.K.users, x => x.cni === k || x.email === k); localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()})); location.hash = '#/'; }, key); await p.waitForTimeout(200); };
(async () => { const b = await chromium.launch();
 const cas = [['1900000000005', '#/client/dashboard', 'client'], ['1900000000002', '#/tenant/home', 'tenant'], ['1900000000001', '#/admin/dashboard', 'admin'], ['o.diallo@mail.sn', '#/owner/dashboard', 'mandant'],
   ['1900000000003', '#/owner/dashboard', 'owner'], ['1900000000004', '#/agency/dashboard', 'agency']];
 for (const [w, h, name] of [[390, 844, 'mob'], [1280, 900, 'desk']]) {
  const ctx = await b.newContext({viewport: {width: w, height: h}, isMobile: w < 500, hasTouch: w < 500, deviceScaleFactor: w < 500 ? 2 : 1});
  await ctx.route(/^https?:/, r => r.abort()); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(600);
  await login(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(500);   // crée les accès mandants
  for (const [k, hash, nom] of cas) {
    await login(p, k); await goto(p, hash); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelectorAll('#toasts > *').forEach(t => t.remove()));
    const info = await p.evaluate(() => ({pd: !!document.querySelector('.pd'), cartes: document.querySelectorAll('.pd-card').length, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth, h: location.hash}));
    console.log(name, nom, JSON.stringify(info));
    await p.evaluate(() => { const x = document.querySelector('.pd'); if (x) x.scrollIntoView(); }); await p.waitForTimeout(150);
    await p.screenshot({path: require('path').join(__dirname, `r-${nom}-${name}.png`), fullPage: name === 'desk'});
  }
  console.log('erreurs', errs); await ctx.close(); }
 await b.close(); })();
