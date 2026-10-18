// Mode démo : guide de test, connexion en un clic pour chaque profil, remise à zéro.
const {open, APP} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  await p.goto(APP + '#/login'); await p.waitForTimeout(700);
  const txt = await p.evaluate(() => document.querySelector('.auth-demo').innerText);
  t(/Gestionnaire/.test(txt), 'Gestionnaire listé à la connexion');
  t(!/en clair/.test(txt), 'Plus de mention « en clair »');
  t(await p.$('.auth-demo a[href="#/guide-demo"]'), 'Lien Guide de test');
  // Le bouton Utiliser du gestionnaire connecte bien
  await p.evaluate(() => [...document.querySelectorAll('.auth-demo .row-between')].find(r => /Gestionnaire/.test(r.innerText)).querySelector('button').click());
  await p.click('form[data-action="login"] button.btn.block'); await p.waitForTimeout(700);
  t(await p.evaluate(() => Auth.current() && (Auth.current().member || {}).cni === '1900000000011'), 'Connexion gestionnaire par « Utiliser »');
  await p.evaluate(() => { localStorage.removeItem(DB.K.session); });
  await p.goto(APP + '#/guide-demo'); await p.waitForTimeout(600);
  const n = await p.$$eval('[data-action="demo-entrer"]', l => l.map(x => x.dataset.cni));
  t(n.length === 9, `9 comptes affichés (${n.length})`);
  for (const cni of n) {
    await p.goto(APP + '#/guide-demo'); await p.waitForTimeout(400);
    await p.click(`[data-action="demo-entrer"][data-cni="${cni}"]`); await p.waitForTimeout(600);
    const r = await p.evaluate(() => ({c: Auth.current() && ((Auth.current().member || {}).cni || Auth.current().cni), h: location.hash, body: document.querySelector('#app').innerText.length}));
    t(r.c === cni && !/guide-demo|login/.test(r.h) && r.body > 200, `Profil ${cni} → ${r.h}`);
  }
  // Mot de passe changé → message clair ; remise à zéro → tout revient
  await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1900000000003'); DB.updateItem(DB.K.users, u.id, {password: 'autre-mdp-9'}); localStorage.removeItem(DB.K.session); });
  await p.goto(APP + '#/guide-demo'); await p.waitForTimeout(400);
  await p.click('[data-action="demo-entrer"][data-cni="1900000000003"]'); await p.waitForTimeout(400);
  t(await p.evaluate(() => /Repartir de zéro/.test(document.body.innerText)) && await p.evaluate(() => !Auth.current()), 'Mot de passe changé : message « Repartir de zéro »');
  await p.click('button[data-action="reset-demo"]'); await p.waitForTimeout(300);
  await p.click('.modal [data-action="confirm-ok"], .modal .btn.danger').catch(() => {}); await p.waitForTimeout(900);
  t(await p.evaluate(() => verifierMotDePasse(DB.findItem(DB.K.users, x => x.cni === '1900000000003'), 'demo123')), 'Remise à zéro sans être admin : demo123 restauré');
  await p.goto(APP + '#/guide-demo'); await p.waitForTimeout(400);
  await p.click('[data-action="demo-visiteur"]'); await p.waitForTimeout(500);
  t(await p.evaluate(() => !Auth.current() && location.hash === '#/search'), 'Scénario visiteur : déconnecté, sur la recherche');
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
