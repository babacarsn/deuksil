// Carte d'un bien dans la recherche : disposition, clic sur la carte, cœur, en-tête des résultats.
const {open, APP, loginAs, goto} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  await loginAs(p, '1900000000002'); await goto(p, '#/search'); await p.waitForTimeout(900);
  const c = await p.evaluate(() => { const a = document.querySelector('.carte-bien'); return a && {op: !!a.querySelector('.cb-op'), fav: !!a.querySelector('.cb-fav'), nb: /1\/\d+/.test(a.querySelector('.cb-nb').innerText),
    lieu: !!a.querySelector('.cb-lieu').innerText.trim(), prix: /FCFA/.test(a.querySelector('.cb-prix').innerText), carac: a.querySelectorAll('.cb-carac span').length >= 1, puce: !!a.querySelector('.cb-ligne .cb-puce'), etat: !!a.querySelector('.cb-etat .badge')}; });
  t(c && Object.values(c).every(Boolean), 'Carte : opération, cœur, 1/N photos, lieu, prix, caractéristiques, disponibilité ' + JSON.stringify(c));
  t(await p.evaluate(() => /Trier par/.test(document.querySelector('#app').innerText) && /\d+ biens disponibles/.test(document.querySelector('.cb-total').innerText)), 'En-tête « N biens disponibles · Trier par »');
  t(await p.evaluate(() => [...document.querySelectorAll('.carte-bien')].every(a => { const o = a.querySelector('.cb-op'); const loc = /\/ mois/.test(a.querySelector('.cb-prix').innerText); return o && (loc ? o.innerText === 'À louer' : o.innerText === 'À vendre'); })), 'À louer avec « / mois », sinon À vendre (terrains compris)');
  // Le cœur ne navigue pas
  const h0 = await p.evaluate(() => location.hash);
  const n0 = await p.evaluate(() => DB.getData(DB.K.favorites).length);
  await p.click('.carte-bien .cb-fav'); await p.waitForTimeout(500);
  t(await p.evaluate(h0 => location.hash === h0, h0) && await p.evaluate(n0 => DB.getData(DB.K.favorites).length !== n0, n0), 'Le cœur ajoute/retire un favori sans ouvrir la fiche');
  // Toute la carte ouvre la fiche
  const id = await p.evaluate(() => document.querySelector('.carte-bien .cb-titre a').getAttribute('href'));
  const box = await p.evaluate(() => { document.querySelector('.carte-bien .cb-carac').scrollIntoView({block: 'center'}); const r = document.querySelector('.carte-bien .cb-carac').getBoundingClientRect(); return {x: r.x + 4, y: r.y + r.height / 2}; });
  await p.mouse.click(box.x, box.y); await p.waitForTimeout(700);
  t(await p.evaluate(id => location.hash === id && /^#\/annonce\//.test(id), id), 'Un clic sur la carte ouvre la fiche ' + id);
  // Filtre type → libellé
  await goto(p, '#/search'); await p.waitForTimeout(500);
  await p.evaluate(() => { searchState.type = 'appartement'; render(); }); await p.waitForTimeout(500);
  t(await p.evaluate(() => /appartements? disponibles?/.test((document.querySelector('.cb-total') || {}).innerText || '') || /Aucun bien/.test(document.body.innerText)), 'Avec le type Appartement : « N appartements disponibles »');
  await p.evaluate(() => { searchState.type = ''; render(); });
  // Mobile : pas de débordement
  await p.setViewportSize({width: 390, height: 844}); await goto(p, '#/search'); await p.waitForTimeout(700);
  t(await p.evaluate(() => document.documentElement.scrollWidth <= 391), 'Téléphone : pas de défilement horizontal');
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
