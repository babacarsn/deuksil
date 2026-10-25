const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open(); const seen = new Set(), out = [];
  for (const r of ['owner', 'agency', 'admin', 'client', 'tenant']) {
    const cni = await p.evaluate(r => (DB.getData(DB.K.users).find(u => u.role === r && !u.member) || {}).cni, r); if (!cni) continue;
    await loginAs(p, cni); await goto(p, '#/'); await p.waitForTimeout(300);
    const liens = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#/"]')].map(a => a.getAttribute('href')))].slice(0, 40));
    for (const h of [...liens, '#/manage/rents', '#/manage/finance', '#/manage/fpay', '#/manage/expenses', '#/manage/reports', '#/manage/docs']) {
      await goto(p, h); await p.waitForTimeout(350);
      const r2 = await p.evaluate(() => [...document.querySelectorAll('.kpis .kpi')].map(k => (k.querySelector('.l') || {}).textContent + '→' + (k.querySelector('.kpi-icon') ? 'icône' : 'SANS')));
      r2.forEach(x => { if (!seen.has(x)) { seen.add(x); out.push(h + ' ' + x); } }); } }
  console.log(out.join('\n')); console.log('sans icône :', out.filter(x => /SANS/.test(x)).length, p.errs); await b.close(); })();
