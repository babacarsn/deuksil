const {chromium} = require('playwright');
const {open, loginAs, goto} = require('./harnais');
const res = [], ok = (id, c, m) => { res.push(c); console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id} → ${m}`); };
(async () => {
  let {b, p} = await open(); await loginAs(p, '1900000000003');
  // Hub Gestion : tiroirs pendant la frappe
  await goto(p, '#/manage');
  await p.type('#gs-q', 'loy', {delay: 40}); await p.waitForTimeout(300);
  let vis = await p.$$eval('.gsection:not([hidden]) .drawer:not([hidden])', a => a.map(x => x.querySelector('b').textContent));
  ok('H1', vis.length >= 1 && vis.every(v => /Loyer|bail|Locataire/i.test(v)) && vis.some(v => /Loyer/.test(v)), `« loy » → ${vis.join(', ')}`);
  await p.fill('#gs-q', ''); await p.type('#gs-q', 'facture', {delay: 30}); await p.waitForTimeout(300);
  vis = await p.$$eval('.gsection:not([hidden]) .drawer:not([hidden])', a => a.map(x => x.querySelector('b').textContent));
  ok('H2', vis.some(v => /Factur/.test(v)), `« facture » → ${vis.join(', ')}`);
  await p.fill('#gs-q', ''); await p.type('#gs-q', 'fatou', {delay: 30}); await p.waitForTimeout(300);
  const data = await p.$$eval('#gs-res a.trow', a => a.length); const foc = await p.evaluate(() => document.activeElement && document.activeElement.id);
  ok('H3', data > 0 && foc === 'gs-q', `« fatou » → ${data} résultat(s) dans les données, focus conservé : ${foc}`);
  await p.fill('#gs-q', ''); await p.type('#gs-q', 'artisan'); await p.keyboard.press('Enter'); await p.waitForTimeout(400);
  ok('H4', /providers/.test(await p.evaluate(() => location.hash)), 'Entrée ouvre ' + await p.evaluate(() => location.hash));
  await goto(p, '#/manage'); await p.fill('#gs-q', ''); await p.type('#gs-q', 'securite zzz'); await p.waitForTimeout(300);
  ok('H5', await p.$$eval('.gsection:not([hidden])', s => s.length) === 0, 'mot inconnu → aucun tiroir, message affiché : ' + (await p.textContent('#gs-res')).slice(0, 60));
  // Listes de Gestion
  await goto(p, '#/manage/rents');
  const tot = await p.$$eval('.main > .content tbody tr', r => r.length);
  await p.type('[data-gsearch]', 'aout', {delay: 30}); await p.waitForTimeout(200);
  const vis2 = await p.$$eval('.main > .content tbody tr', r => r.filter(x => x.style.display !== 'none' && x.dataset.f !== '1').length);
  ok('L1', vis2 > 0 && vis2 < tot, `loyers « aout » (sans accent) → ${vis2}/${tot} lignes, compteur : ${await p.textContent('.sbar-n')}`);
  await p.click('[data-action="rfiltre"][data-id="paye"]'); await p.waitForTimeout(200);
  const vis3 = await p.$$eval('.main > .content tbody tr', r => r.filter(x => x.style.display !== 'none').map(x => x.textContent));
  ok('L2', vis3.every(t => /août/i.test(t)), `chip « Encaissés » + « aout » → ${vis3.length} ligne(s), toutes d'août`);
  await goto(p, '#/owner/properties');
  await p.type('.tfilter input, [data-gsearch]', 'almadies'); await p.waitForTimeout(300);
  const n4 = await p.$$eval('.main > .content tbody tr', r => r.filter(x => x.style.display !== 'none').length);
  ok('L3', n4 >= 1, `biens « almadies » → ${n4} ligne(s), compteur ${await p.textContent('.bf-n')}`);
  // Recherche de biens
  await goto(p, '#/search');
  const before = await p.$$eval('.props > *', x => x.length);
  await p.type('form[data-action="page-search"] [name="q"]', 'saly', {delay: 60}); await p.waitForTimeout(600);
  const after = await p.$$eval('.props > *', x => x.length), f2 = await p.evaluate(() => document.activeElement && document.activeElement.name);
  ok('S1', after < before && after > 0 && f2 === 'q', `page Recherche « saly » → ${before} → ${after} biens, focus ${f2}`);
  await p.evaluate(() => document.getElementById('sfold')?.classList.add('open'));
  await p.fill('form[data-action="search"] [name="max"]', '200000'); await p.waitForTimeout(700);
  const st = await p.evaluate(() => searchState.max);
  ok('S2', st === '200000', `prix max saisi → filtre appliqué sans bouton (max=${st})`);
  await goto(p, '#/'); await p.evaluate(() => localStorage.removeItem(DB.K.session)); await goto(p, '#/');
  const pill = await p.$('form[data-action="home-search"] [name="q"]');
  if (pill) { await pill.type('mermoz', {delay: 40}); await p.waitForTimeout(400);
    const s = await p.$$eval('.sugg a.trow', a => a.map(x => x.querySelector('b').textContent));
    ok('S3', s.length > 0, `accueil « mermoz » → ${s.join(' · ')}`); }
  else ok('S3', false, 'barre d\'accueil introuvable');
  console.log('erreurs JS', p.errs); await b.close();
  // Mobile : rien ne déborde
  const br = await chromium.launch(); const ctx = await br.newContext({viewport: {width: 375, height: 812}, isMobile: true, hasTouch: true});
  await ctx.route(/^https?:/, r => r.abort()); const m = await ctx.newPage(); await m.goto(require('./harnais').APP); await m.waitForTimeout(600); await loginAs(m, '1900000000003');
  let over = [];
  for (const h of ['#/manage/contracts', '#/manage/leases', '#/manage/expenses', '#/coffre/contrats', '#/manage', '#/owner/properties', '#/manage/rents']) { await goto(m, h);
    over.push(...await m.evaluate(h => { const W = document.documentElement.clientWidth; return [...document.querySelectorAll('.main input, .main select, .main .card')].filter(e => e.offsetParent && e.getBoundingClientRect().right > W + 1).map(e => h + ' ' + (e.name || e.className)); }, h)); }
  const sw = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('M1', !over.length, over.length ? 'débordent : ' + over.slice(0, 5).join(', ') : 'aucun champ ne dépasse sur 375 px');
  await goto(m, '#/manage/contracts'); await m.evaluate(() => document.querySelector('input[type=date]').scrollIntoView({block: 'center'})); await m.screenshot({path: require('path').join(__dirname, 'm-dates.png')});
  await goto(m, '#/owner/properties'); await m.screenshot({path: require('path').join(__dirname, 'm-props2.png')});
  await goto(m, '#/manage'); await m.type('#gs-q', 'loyer'); await m.waitForTimeout(300); await m.screenshot({path: require('path').join(__dirname, 'm-hub.png')});
  await br.close();
  console.log(res.filter(Boolean).length + '/' + res.length);
})();
