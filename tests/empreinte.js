// Empreinte des tableaux de bord : sections, tuiles, actions rapides et leurs
// destinations, menu, barre du bas — par profil. BASE=1 enregistre la
// référence ; sinon, compare à la référence et signale toute différence.
const {open, loginAs, goto} = require('./harnais.js');
const fs = require('fs');
const FICHIER = __dirname + '/empreinte-reference.json';
const PROFILS = {admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012',
  client: '1900000000005', locataire: '1900000000002', mandant: '1900000000031'};
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  const E = {};
  for (const [nom, cni] of Object.entries(PROFILS)) {
    await loginAs(p, cni); const home = await p.evaluate(() => Auth.home(Auth.current()));
    await goto(p, home); await p.waitForTimeout(1200);
    E[nom] = await p.evaluate(() => {
      const t = el => (el.innerText || '').replace(/\s+/g, ' ').replace(/[\d\s ]+(FCFA)?/g, '#').trim().slice(0, 40);
      const lien = a => (a.getAttribute('href') || a.dataset.action || '').split('?')[0];
      return {
        page: location.hash,
        sections: [...document.querySelectorAll('#app .content h1, #app .content h2, #app .content h3, #app .content .pd-h')].map(t),
        actionsRapides: [...document.querySelectorAll('#app .qa-grid a, #app .qa-grid button, #app .pd-qa, #app .quick-actions a')].map(a => t(a) + ' → ' + lien(a)),
        tuiles: document.querySelectorAll('#app .pd-mini, #app .kpi, #app .pd-card').length,
        menu: [...document.querySelectorAll('.side nav a[href], .sidebar a[href]')].map(a => t(a) + ' → ' + lien(a)),
        barre: [...document.querySelectorAll('.tabbar a')].map(a => t(a) + ' → ' + lien(a)),
        animations: !!document.querySelector('#app .rv, #app .anim-page') || document.getElementById('app').classList.contains('anim-page')
      };
    });
  }
  if (process.env.BASE) { fs.writeFileSync(FICHIER, JSON.stringify(E, null, 1)); console.log('référence enregistrée', Object.keys(E).length, 'profils'); await b.close(); return; }
  const R = JSON.parse(fs.readFileSync(FICHIER, 'utf8'));
  let ok = 0, ko = 0;
  for (const nom of Object.keys(R)) for (const k of Object.keys(R[nom])) {
    const a = JSON.stringify(R[nom][k]), n = JSON.stringify(E[nom][k]);
    if (a === n) ok++; else { ko++; console.log(`DIFFÉRENCE ${nom}.${k}\n  avant : ${a}\n  après : ${n}`); }
  }
  console.log(`\n${ok}/${ok + ko} éléments identiques`, 'erreurs JS', p.errs); await b.close();
})();
