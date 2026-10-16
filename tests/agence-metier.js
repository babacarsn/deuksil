// Logique métier de l'agence, gestes d'un utilisateur : règles, mandat de vente,
// honoraires, caution, suivi du bail, pénalité, équipe, demandes clients.
const {open, loginAs, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 390, height: 844});
  let ok = 0, ko = 0;
  const T = (id, cond, msg) => { cond ? ok++ : ko++; console.log(`${cond ? 'OK  ' : 'ÉCHEC'} ${id}  ${msg}`); };
  const val = (sel, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); }, [sel, v]);
  const envoyer = sel => p.evaluate(s => document.querySelector(s).requestSubmit(), sel);
  const cni = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.role === 'agency' && !u.member).cni);
  await loginAs(p, cni); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(2500);
  const agId = await p.evaluate(() => Auth.current().id);

  // 1. Règles
  await goto(p, '#/agency/settings'); await p.waitForTimeout(600);
  await val('#regles-agence [name="penalitePct"]', '5'); await val('#regles-agence [name="penaliteJours"]', '3'); await val('#regles-agence [name="revisionPct"]', '4');
  await envoyer('#regles-agence'); await p.waitForTimeout(400);
  const R = await p.evaluate(id => DB.findItem(DB.K.users, id).regles, agId);
  T('R1', R && R.penalitePct === 5 && R.honoLocMois === 1 && R.tvaPct === 18, `règles enregistrées : ${JSON.stringify(R)}`);

  // 2. Mandat de vente (même formulaire, choix « Vente »)
  await goto(p, '#/manage/mandates'); await p.waitForTimeout(700);
  await p.click('form[data-action="m-new"] [data-action="ag-mtype"][data-v="vente"]'); await p.waitForTimeout(200);
  const visible = await p.evaluate(() => getComputedStyle(document.getElementById('form-mv')).display !== 'none' && getComputedStyle(document.querySelector('form[data-action="m-new"]')).display === 'none');
  T('V1', visible, 'le choix « Vente » affiche le formulaire de vente à la place de celui de gestion');
  const propV = await p.evaluate(() => document.querySelector('#form-mv [name="propertyId"] option:not([disabled])').value);
  await p.evaluate(v => { const s = document.querySelector('#form-mv [name="propertyId"]'); s.value = v; }, propV);
  await val('#form-mv [name="price"]', '95000000'); await envoyer('#form-mv'); await p.waitForTimeout(500);
  const mv = await p.evaluate(id => DB.getData(DB.K.mventes).find(m => m.propertyId === id), propV);
  T('V2', mv && mv.price === 95000000 && mv.status === 'actif', `mandat de vente ${mv && mv.ref} créé (${mv && mv.rate} %)`);
  await goto(p, '#/manage/x'); await goto(p, '#/manage/mandates'); await p.waitForTimeout(500);
  T('V3', await p.evaluate(id => ![...document.querySelectorAll('#form-mv [name="propertyId"] option')].some(o => o.value === id), propV), 'un bien déjà sous mandat de vente ne peut plus être choisi');

  // 3. Nouveau bail → frais de location + caution chez l'agence
  await goto(p, '#/manage/leases'); await p.waitForTimeout(700);
  await val('form[data-action="g-lease"] [name="tenant"]', 'Client Honoraires'); await val('form[data-action="g-lease"] [name="phone"]', '771119900');
  await val('form[data-action="g-lease"] [name="rent"]', '200000');
  await p.evaluate(() => { const f = document.querySelector('form[data-action="g-lease"]'); const d = f.querySelector('[name="deposit"]'); if (d) d.value = '400000'; const s = f.querySelector('[name="start"]'); if (s && !s.value) s.value = new Date().toISOString().slice(0, 10); });
  await envoyer('form[data-action="g-lease"]'); await p.waitForTimeout(700);
  const bail = await p.evaluate(() => DB.getData(DB.K.leases).find(l => l.tenant === 'Client Honoraires'));
  const fee2 = await p.evaluate(id => DB.getData(DB.K.fees).find(f => f.leaseId === id), bail && bail.id);
  T('H1', fee2 && fee2.ht === 200000 && fee2.tva === 36000 && fee2.ttc === 236000 && fee2.status === 'du', `frais de location : ${fee2 && fee2.ttc} TTC (dont TVA ${fee2 && fee2.tva})`);
  T('C1', bail && bail.cautionChez === 'agence' && bail.cautionStatut === 'detenue', `caution ${bail && bail.deposit} gardée par l'agence`);
  const seedFees = await p.evaluate(() => DB.getData(DB.K.fees).filter(f => !f.leaseId || !DB.findItem(DB.K.leases, f.leaseId) || DB.findItem(DB.K.leases, f.leaseId).tenant !== 'Client Honoraires').length);
  T('H2', seedFees === 0, 'aucun honoraire inventé pour les baux déjà présents');

  // 4. Encaisser les honoraires
  await goto(p, '#/agency/commissions'); await p.waitForTimeout(700);
  await p.click(`[data-action="ag-fee-pay"][data-id="${fee2.id}"]`); await p.waitForTimeout(300);
  await envoyer('form[data-action="ag-fee-pay-ok"]'); await p.waitForTimeout(400);
  T('H3', await p.evaluate(id => DB.findItem(DB.K.fees, id).status, fee2.id) === 'paye', 'honoraires encaissés depuis « Honoraires & cautions »');

  // 5. Équipe : attribution d'un bien à un agent, commission
  await goto(p, '#/agency/agents'); await p.waitForTimeout(700);
  const membre = await p.evaluate(() => { const u = Auth.current(); return DB.getData(DB.K.users).find(x => x.parentId === u.id && x.role === 'agent' && x.status === 'actif').id; });
  await p.click(`[data-action="ag-attribuer"][data-id="${membre}"]`); await p.waitForTimeout(300);
  const pid = bail.propertyId;
  await p.evaluate(id => { document.querySelector(`form[data-action="ag-attribuer-ok"] [name="p_${id}"]`).checked = true; }, pid);
  await envoyer('form[data-action="ag-attribuer-ok"]'); await p.waitForTimeout(400);
  T('E1', await p.evaluate(([id, m]) => DB.findItem(DB.K.properties, id).agentId === m, [pid, membre]), 'bien attribué à l\'agent');
  // nouvelle vente signée sur un bien attribué → part de l'agent
  const venteFee = await p.evaluate(m => {
    const u = Auth.current(); const mvx = DB.getData(DB.K.mventes).find(x => x.ownerId === u.id && x.status === 'actif');
    const d = DB.addItem(DB.K.deals, {ownerId: u.id, propertyId: mvx.propertyId, buyer: 'Acheteur Test', price: mvx.price, stage: 'offre'});
    DB.updateItem(DB.K.properties, d.propertyId, {agentId: m});
    franchirEtape(DB.findItem(DB.K.deals, d.id), 'signe');
    return DB.getData(DB.K.fees).find(f => f.dealId === d.id) || 'aucun';
  }, membre);
  T('H4', venteFee && venteFee.kind === 'vente' && venteFee.ht > 0 && venteFee.agentPart === Math.round(venteFee.ht * 0.2), `honoraires de vente ${venteFee && venteFee.ref} : ${venteFee && venteFee.ht} HT, part agent ${venteFee && venteFee.agentPart}`);
  const nbVente = await p.evaluate(id => { const d = DB.getData(DB.K.fees).find(f => f.id === id); franchirEtape(DB.findItem(DB.K.deals, d.dealId), 'signe'); return DB.getData(DB.K.fees).filter(f => f.dealId === d.dealId).length; }, venteFee.id);
  T('V4', await p.evaluate(() => DB.getData(DB.K.mventes).some(m => m.status === 'vendu')), 'le mandat de vente passe à « vendu » à la signature');
  T('H5', nbVente === 1, 'pas de second honoraire si la vente est « re-signée »');

  // 6. Suivi du bail : état des lieux, préavis, révision, caution
  await goto(p, '#/manage/leases'); await p.waitForTimeout(700);
  await p.evaluate(id => document.querySelector(`[data-action="ag-suivi"][data-id="${id}"]`).click(), bail.id); await p.waitForTimeout(300);
  T('S1', await p.evaluate(() => document.querySelectorAll('.suivi .suivi-l').length) === 5, 'la fenêtre « Suivi du bail » regroupe les 5 actions');
  await p.click('[data-action="ag-edl"][data-k="entree"]'); await p.waitForTimeout(200); await envoyer('form[data-action="ag-edl-ok"]'); await p.waitForTimeout(300);
  await p.click('[data-action="ag-preavis"]'); await p.waitForTimeout(200); await envoyer('form[data-action="ag-preavis-ok"]'); await p.waitForTimeout(300);
  await p.click('[data-action="ag-revision"]'); await p.waitForTimeout(200);
  const prop = await p.evaluate(() => document.querySelector('form[data-action="ag-revision-ok"] [name="rent"]').value);
  await envoyer('form[data-action="ag-revision-ok"]'); await p.waitForTimeout(300);
  const apres = await p.evaluate(id => ({l: DB.findItem(DB.K.leases, id), rents: DB.getData(DB.K.rents).filter(r => r.leaseId === id).map(r => [r.month, r.amount, !!r.paidAt])}), bail.id);
  T('S2', !!apres.l.preavis && (apres.l.revisions || []).length === 1, `préavis (départ ${apres.l.preavis && apres.l.preavis.depart}) et révision enregistrés`);
  T('S3', +prop === 208000 && apres.l.rent === 208000 && apres.rents.filter(r => r[1] === 208000).length >= 1, `révision proposée à +4 % : ${prop} ; échéances à venir mises à jour`);
  // sortie dégradée puis restitution avec retenue
  await p.click('[data-action="ag-edl"][data-k="sortie"]'); await p.waitForTimeout(200);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="ag-edl-ok"]'); f.querySelector('[name="etat_2"]').value = 'mauvais'; f.querySelector('[name="rq_2"]').value = 'Évier fendu'; });
  await envoyer('form[data-action="ag-edl-ok"]'); await p.waitForTimeout(300);
  await p.click('[data-action="ag-caution"]'); await p.waitForTimeout(200);
  const motif = await p.evaluate(() => document.querySelector('form[data-action="ag-caution-ok"] [name="motif"]').value);
  T('C2', /Cuisine/.test(motif), `la dégradation relevée à la sortie est proposée comme motif : « ${motif} »`);
  await val('form[data-action="ag-caution-ok"] [name="r_degats"]', '999999'); await envoyer('form[data-action="ag-caution-ok"]'); await p.waitForTimeout(300);
  T('C3', await p.evaluate(id => DB.findItem(DB.K.leases, id).cautionStatut, bail.id) === 'detenue', 'retenue supérieure à la caution refusée');
  await val('form[data-action="ag-caution-ok"] [name="r_degats"]', '50000'); await envoyer('form[data-action="ag-caution-ok"]'); await p.waitForTimeout(400);
  const lc = await p.evaluate(id => DB.findItem(DB.K.leases, id), bail.id);
  T('C4', lc.cautionStatut === 'restituee' && lc.cautionRendue === 350000, `caution restituée : ${lc.cautionRendue} rendus après 50 000 de retenue`);

  // 7. Pénalité de retard
  await goto(p, '#/manage/rents'); await p.waitForTimeout(700);
  const pen = await p.$('[data-action="ag-penalite"]');
  T('P1', !!pen, 'bouton « Pénalité » sur un loyer en retard (règle à 5 %)');
  if (pen) { const rid = await pen.getAttribute('data-id'); const avant = await p.evaluate(id => DB.findItem(DB.K.rents, id).amount, rid);
    await pen.click(); await p.waitForTimeout(300); await p.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /Appliquer/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(300);
    const r = await p.evaluate(id => DB.findItem(DB.K.rents, id), rid);
    T('P2', r.penalite === Math.round(avant * 0.05) && r.amount === avant + r.penalite, `pénalité ${r.penalite} ajoutée (${avant} → ${r.amount})`);
    await goto(p, '#/manage/x'); await goto(p, '#/manage/rents'); await p.waitForTimeout(500);
    T('P3', !(await p.$(`[data-action="ag-penalite"][data-id="${rid}"]`)), 'pas de seconde pénalité sur le même loyer'); }

  // 8. Demandes clients
  await goto(p, '#/agency/clients'); await p.waitForTimeout(700);
  await val('form[data-action="ag-demande"] [name="name"]', 'Awa Test'); await val('form[data-action="ag-demande"] [name="phone"]', '770001122');
  await val('form[data-action="ag-demande"] [name="transaction"]', 'location'); await val('form[data-action="ag-demande"] [name="budget"]', '2000000');
  await envoyer('form[data-action="ag-demande"]'); await p.waitForTimeout(500);
  const dm = await p.evaluate(() => { const u = Auth.current(); const d = DB.getData(DB.K.demandes).find(x => x.name === 'Awa Test'); return d && {n: biensPour(u, d).length}; });
  T('D1', dm && dm.n > 0, `demande enregistrée, ${dm && dm.n} bien(s) correspondent`);
  T('D2', await p.evaluate(() => !!document.querySelector('a[href^="https://wa.me/"][href*="text="]')), 'bouton « Envoyer » par WhatsApp avec la sélection');
  await val('form[data-action="ag-demande"] [name="name"]', 'Awa Test'); await val('form[data-action="ag-demande"] [name="phone"]', '770001122'); await envoyer('form[data-action="ag-demande"]'); await p.waitForTimeout(300);
  T('D3', await p.evaluate(() => DB.getData(DB.K.demandes).filter(x => x.name === 'Awa Test').length) === 1, 'pas de demande en double pour le même client');

  // 9. Un agent (membre) ne voit pas l'équipe et ne peut pas encaisser
  const ag = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.cni === '1900000000012').cni);
  await loginAs(p, ag); await goto(p, '#/agency/agents'); await p.waitForTimeout(500);
  T('A1', await p.evaluate(() => location.hash) !== '#/agency/agents', 'un agent n\'accède pas à la page Équipe');
  const r2 = await p.evaluate(() => { const f = DB.getData(DB.K.fees).find(x => x.status === 'du'); if (!f) return 'aucun'; const b = document.createElement('button'); b.dataset.action = 'ag-fee-pay'; b.dataset.id = f.id; document.body.appendChild(b); b.click(); return !!document.querySelector('form[data-action="ag-fee-pay-ok"]'); });
  T('A2', r2 !== true, 'un agent sans droit « finances » ne peut pas encaisser d\'honoraires');

  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
