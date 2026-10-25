// Recette partie 2 : P6 (visite à venir non « terminée ») et P10 (le propriétaire demande une agence).
const {open, loginAs, goto} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  await loginAs(p, '1900000000003');
  // P6
  const vid = await p.evaluate(() => { const u = Auth.current(), pr = myProps(u).find(x => x.status === 'disponible');
    const d = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    return DB.addItem(DB.K.visits, {clientId: '', clientName: 'Test futur', clientPhone: '770001122', ownerId: u.id, propertyId: pr.id, date: d, time: '10:00', status: 'acceptee'}).id; });
  await goto(p, '#/owner/visits'); await p.waitForTimeout(800);
  t(await p.evaluate(id => !document.querySelector(`[data-action="visit-status"][data-s="terminee"][data-id="${id}"]`), vid), 'Visite à venir : pas de bouton « Marquer terminée »');
  await p.evaluate(id => { const b = document.createElement('button'); b.dataset.action = 'visit-status'; b.dataset.s = 'terminee'; b.dataset.id = id; b.id = 'forcer'; document.body.appendChild(b); }, vid);
  await p.evaluate(() => document.getElementById('forcer').click()); await p.waitForTimeout(400);
  t(await p.evaluate(id => DB.findItem(DB.K.visits, id).status === 'acceptee', vid), 'Même forcé, la visite à venir reste « acceptée »');
  const vp = await p.evaluate(() => { const u = Auth.current(), pr = myProps(u)[0]; const d = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10);
    return DB.addItem(DB.K.visits, {clientId: '', clientName: 'Test passé', clientPhone: '770001133', ownerId: u.id, propertyId: pr.id, date: d, time: '10:00', status: 'acceptee'}).id; });
  await goto(p, '#/owner/dashboard'); await goto(p, '#/owner/visits'); await p.waitForTimeout(800);
  t(await p.evaluate(id => !!document.querySelector(`[data-action="visit-status"][data-s="terminee"][data-id="${id}"]`), vp), 'Visite passée : « Marquer terminée » reste disponible');
  // P10
  await goto(p, '#/owner/properties'); await p.waitForTimeout(700);
  t(await p.evaluate(() => !!document.querySelector('a[href^="#/owner/profile"][href*="confier"]')), '« Mes biens » : bouton « Confier à une agence »');
  await goto(p, '#/owner/profile'); await p.waitForTimeout(900);
  t(await p.evaluate(() => !!document.querySelector('#confier-agence form[data-action="lienp-envoyer"]')), 'Profil : carte « Confier la gestion à une agence »');
  const ag = await p.evaluate(() => { const s = document.getElementById('lienp-agence'); const o = [...s.options].find(x => /Teranga/.test(x.textContent)) || s.options[0]; s.value = o.value; document.getElementById('lienp-msg').value = 'Deux appartements à Mermoz'; document.querySelector('form[data-action="lienp-envoyer"]').requestSubmit(); return o.value; });
  await p.waitForTimeout(700);
  t(await p.evaluate(a => DB.getData(DB.K.demandesLien).some(d => d.agenceId === a && d.statut === 'attente') && DB.getData(DB.K.notifications).some(n => n.userId === a && /souhaite vous confier/.test(n.text)) && /en attente de réponse/.test(document.querySelector('#confier-agence').innerText), ag), 'Demande envoyée, agence prévenue, « en attente » affiché');
  // Côté agence
  const agCni = await p.evaluate(a => DB.findItem(DB.K.users, a).cni, ag);
  await loginAs(p, agCni); await goto(p, '#/manage/owners'); await p.waitForTimeout(900);
  t(await p.evaluate(() => /Mamadou Fall/.test((document.getElementById('demandes-proprietaires') || {}).innerText || '') && /Mermoz/.test(document.getElementById('demandes-proprietaires').innerText)), 'Agence : la demande et le message apparaissent dans Propriétaires');
  await p.evaluate(() => { const f = document.querySelector('form[data-action="lienp-repondre"]'); f.querySelector('[name="rate"]').value = '9'; f.querySelector('button[value="ok"]').click(); }); await p.waitForTimeout(800);
  const r = await p.evaluate(a => { const o = DB.getData(DB.K.owners).find(x => x.ownerId === a && x.lien === 'accepte' && /Mamadou/.test(x.name)); const own = DB.findItem(DB.K.users, x => x.cni === '1900000000003');
    return {fiche: !!o && o.rate === 9 && o.compteId === own.id, notif: DB.getData(DB.K.notifications).some(n => n.userId === own.id && /a accepté de gérer vos biens/.test(n.text)), seule: DB.getData(DB.K.users).filter(u => u.cni === '1900000000003').length === 1}; }, ag);
  t(r.fiche && r.notif && r.seule, 'Accepté : fiche mandant (9 %), propriétaire prévenu, aucun second compte ' + JSON.stringify(r));
  await loginAs(p, '1900000000003'); await goto(p, '#/owner/profile'); await p.waitForTimeout(900);
  t(await p.evaluate(() => /Rattachement accepté/.test((document.getElementById('confier-agence') || {}).innerText || '')), 'Profil du propriétaire : rattachement accepté affiché');
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
