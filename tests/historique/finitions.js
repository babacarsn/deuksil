// Audit et finalisation : fin de bail, statuts, fiche indisponible, adresses propres, référencement,
// retour après connexion, barre du locataire, notifications, actualisation, H1.
const {open, APP, loginAs, goto} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  // 2. Statut « loué » sans bail réparé
  t(await p.evaluate(() => { const A = new Set(DB.getData(DB.K.leases).filter(l => l.status === 'actif').map(l => l.propertyId)), U = new Set(DB.getData(DB.K.units).map(x => x.propertyId));
    return DB.getData(DB.K.properties).every(x => x.status !== 'loue' || A.has(x.id) || U.has(x.id)); }), 'Aucun bien « Loué » sans bail actif');
  // 1. Fin de bail sans confirmation → libération à confirmer
  await loginAs(p, '1900000000003'); await goto(p, '#/manage/leases'); await p.waitForTimeout(700);
  const L = await p.evaluate(() => { const u = Auth.current(); const l = DB.getData(DB.K.leases).find(x => x.ownerId === u.id && x.status === 'actif' && !x.unitId); return l && {id: l.id, pid: l.propertyId}; });
  await p.evaluate(id => document.querySelector(`[data-action="g-end-lease"][data-id="${id}"]`).click(), L.id); await p.waitForTimeout(500);
  t(await p.evaluate(() => !!document.querySelector('form[data-action="g-end-lease-ok"] [name="libere"]')), 'Fin de bail : case « logement libéré » proposée');
  await p.evaluate(() => document.querySelector('form[data-action="g-end-lease-ok"]').requestSubmit()); await p.waitForTimeout(700);
  const st = await p.evaluate(pid => ({s: DB.findItem(DB.K.properties, pid).status, rech: applySearch().some(x => x.id === pid), n: DB.getData(DB.K.notifications).some(n => /confirmez la libération/.test(n.text))}), L.pid);
  t(st.s === 'liberation' && !st.rech && st.n, 'Sans confirmation : « Libération à confirmer », absent de la recherche, propriétaire prévenu ' + JSON.stringify(st));
  await goto(p, '#/owner/properties'); await p.waitForTimeout(600);
  await p.evaluate(pid => { const s = document.querySelector(`select[data-action="set-status"][data-id="${pid}"]`); s.value = 'disponible'; s.dispatchEvent(new Event('change', {bubbles: true})); }, L.pid); await p.waitForTimeout(600);
  t(await p.evaluate(pid => DB.findItem(DB.K.properties, pid).status === 'disponible' && applySearch().some(x => x.id === pid), L.pid), 'Libération confirmée à la main → de nouveau disponible');
  // avec la case cochée
  const L2 = await p.evaluate(() => { const u = Auth.current(); const l = DB.getData(DB.K.leases).find(x => x.ownerId === u.id && x.status === 'actif' && !x.unitId); return l && {id: l.id, pid: l.propertyId}; });
  if (L2) {
    await goto(p, '#/manage/leases'); await p.waitForTimeout(600);
    await p.evaluate(id => document.querySelector(`[data-action="g-end-lease"][data-id="${id}"]`).click(), L2.id); await p.waitForTimeout(500);
    await p.evaluate(() => { const f = document.querySelector('form[data-action="g-end-lease-ok"]'); f.querySelector('[name="libere"]').checked = true; f.requestSubmit(); }); await p.waitForTimeout(700);
    t(await p.evaluate(pid => DB.findItem(DB.K.properties, pid).status === 'disponible', L2.pid), 'Case cochée : le bien redevient disponible tout de suite');
  }
  // 3. Fiche d'un bien loué
  const loue = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.status === 'loue').id);
  await loginAs(p, '1900000000006'); await goto(p, '#/property/' + loue); await p.waitForTimeout(800);
  const f = await p.evaluate(() => ({visite: !!document.querySelector('[data-action="ask-visit"]'), contact: !!document.querySelector('[data-action="contact"]'), msg: /n'est plus|est loué|vendu/.test((document.querySelector('.pd-indispo') || {}).innerText || ''), h1: document.querySelectorAll('#app h1').length, dispo: /Disponible à partir/.test(document.body.innerText)}));
  t(!f.visite && !f.contact && f.msg && !f.dispo, 'Bien loué : ni visite ni contact, message « Ce bien est loué »');
  t(f.h1 === 1, 'Fiche : un seul H1 (titre du bien)');
  // 5. Adresse propre
  const pid = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.status === 'disponible' && x.listingStatus === 'publiee').id);
  await goto(p, '#/property/' + pid); await p.waitForTimeout(700);
  const h = await p.evaluate(() => location.hash);
  t(/^#\/annonce\/[a-z0-9-]+-[a-z0-9]{7}$/.test(h) && !/property_/.test(h), 'Adresse publique propre : ' + h);
  await p.reload(); await p.waitForTimeout(1200);
  t(await p.evaluate(pid => location.hash === annonceHref(DB.findItem(DB.K.properties, pid)) && !!document.querySelector('.pd-titre'), pid), 'Actualisation de l\'annonce : la fiche se réaffiche');
  await goto(p, '#/search'); await p.waitForTimeout(600);
  t(await p.evaluate(() => [...document.querySelectorAll('#app a[href^="#/"]')].every(a => !/^#\/property\//.test(a.getAttribute('href')))), 'Liens de la recherche : plus d\'identifiant technique');
  // 6. Référencement
  await goto(p, '#/property/' + pid); await p.waitForTimeout(700);
  const seo = await p.evaluate(() => ({t: document.title, d: (document.querySelector('meta[name="description"]') || {}).content, c: (document.querySelector('link[rel="canonical"]') || {}).href, og: (document.querySelector('meta[property="og:title"]') || {}).content, r: (document.querySelector('meta[name="robots"]') || {}).content, ld: !!document.getElementById('jsonld-page') && JSON.parse(document.getElementById('jsonld-page').textContent)['@type']}));
  t(/FCFA/.test(seo.t) && seo.d && seo.d.length > 40 && /annonce/.test(seo.c) && seo.og === seo.t && seo.r === 'index,follow' && seo.ld === 'RealEstateListing', 'Annonce : titre, description, canonique, partage, JSON-LD ' + seo.t);
  await goto(p, '#/client/dashboard'); await p.waitForTimeout(500);
  t(await p.evaluate(() => /noindex/.test(document.querySelector('meta[name="robots"]').content) && /Espace/.test(document.title)), 'Espace privé : noindex');
  await p.evaluate(() => localStorage.removeItem(DB.K.session)); await goto(p, '#/'); await p.waitForTimeout(600);
  t(await p.evaluate(() => /index,follow/.test(document.querySelector('meta[name="robots"]').content) && /Sénégal/.test(document.title) && document.querySelectorAll('#app h1').length === 1), 'Accueil : indexable, titre, un H1');
  // 7. Accès direct à une page privée → connexion → retour
  await p.goto(APP + '#/owner/properties'); await p.waitForTimeout(800);
  t(await p.evaluate(() => location.hash === '#/login'), 'Page privée sans connexion → connexion');
  await p.evaluate(() => { const f = document.querySelector('form[data-action="login"]'); f.cni.value = 'mamadou.fall@gmail.com'; f.password.value = 'demo123'; f.requestSubmit(); }); await p.waitForTimeout(900);
  t(await p.evaluate(() => location.hash === '#/owner/properties'), 'Après connexion : retour sur la page demandée');
  // 8. Barre du bas du locataire
  await p.setViewportSize({width: 390, height: 844});
  await loginAs(p, '1900000000002'); await goto(p, '#/tenant/home'); await p.waitForTimeout(600);
  t(await p.evaluate(() => { const a = [...document.querySelectorAll('.tabbar a')].find(x => /Messages/.test(x.innerText)); return !!a && a.querySelector('svg').innerHTML.includes('M21 12a8 8 0 0 1-8 8H7l-4 3v-4.6'); }), 'Locataire : « Messages » dans la barre du bas, même icône');
  await p.setViewportSize({width: 1280, height: 900});
  // 9. Notifications
  await loginAs(p, '1900000000003'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(500);
  const n0 = await p.evaluate(() => +((document.querySelector('[data-action="notifications"] b') || {}).innerText || 0));
  await p.evaluate(() => document.querySelector('[data-action="notifications"]').click()); await p.waitForTimeout(400);
  const lien = await p.evaluate(() => { const b = [...document.querySelectorAll('.notif-row:not(.read)')].find(x => x.dataset.link); b.click(); return b.dataset.link; }); await p.waitForTimeout(700);
  const n1 = await p.evaluate(() => +((document.querySelector('[data-action="notifications"] b') || {}).innerText || 0));
  t(n1 === n0 - 1 && await p.evaluate(l => location.hash.startsWith(l.split('?')[0]) || location.hash.length > 2, lien), `Notification ouverte : page « ${lien} », compteur ${n0} → ${n1}`);
  // 10. Actualisation de pages
  for (const r of ['#/search', '#/owner/properties', '#/manage/rents', '#/owner/messages']) {
    await goto(p, r); await p.waitForTimeout(400); await p.reload(); await p.waitForTimeout(1100);
    t(await p.evaluate(r => location.hash === r && document.querySelector('#app').innerText.length > 100, r), 'Actualisation : ' + r);
  }
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
