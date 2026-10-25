// Sonde : chaque profil, chaque page de menu ; erreurs JS et requêtes refusées.
const {open, loginAs, logout, goto, enregistre} = require('./harnais.js');
const PROFILS = {visiteur: null, admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012', client: '1900000000006', locataire: '1900000000002', mandant: '1900000000031'};
(async () => {
  const {b, p} = await open(); console.log('démarrage', p.errs, p.refus);
  for (const [nom, cni] of Object.entries(PROFILS).filter(([n]) => !process.env.PROFIL || process.env.PROFIL.split(',').includes(n))) {
    const e0 = p.errs.length, r0 = p.refus.length;
    try { if (cni) await loginAs(p, cni); else await logout(p); } catch (e) { console.log(nom, 'CONNEXION', e.message); continue; }
    const home = cni ? await p.evaluate(() => Auth.home(Auth.current())) : '#/';
    await goto(p, home); await p.waitForTimeout(500);
    const pages = await p.evaluate(h => [...new Set([h, ...[...document.querySelectorAll('.sidebar a[href^="#/"], .side a[href^="#/"], .tabbar a[href^="#/"]')].map(a => a.getAttribute('href'))])].filter(x => !/logout|#\/#|#\/$/.test(x)), home);
    const pbs = [];
    for (const pg of pages) {
      const a = p.errs.length, rr = p.refus.length; await goto(p, pg); await p.waitForTimeout(400); await enregistre(p);
      const vide = await p.evaluate(() => (document.querySelector('#app').innerText || '').trim().length < 40);
      if (p.errs.length > a || p.refus.length > rr || vide) pbs.push(`${pg}${vide ? ' VIDE' : ''} ${p.errs.slice(a).join(' | ')} ${p.refus.slice(rr).join(' | ')}`);
    }
    console.log(`\n### ${nom} (${pages.length} pages) ${pbs.length ? '' : 'OK'}`); pbs.forEach(x => console.log('  - ' + x));
  }
  await b.close();
})();
