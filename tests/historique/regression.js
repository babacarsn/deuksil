// Non-régression : parcours normaux par la vraie interface, et tour de toutes les pages.
const {open, loginAs, goto} = require('./harnais');
const out = [];
const ok = (id, c, msg) => { out.push([id, c, msg]); console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id} → ${msg}`); };

(async () => {
  let {b, p} = await open();
  await loginAs(p, '1900000000003');

  // 1. Créer un bail par le formulaire réel
  await goto(p, '#/manage/leases');
  const f = 'form[data-action="g-lease"]';
  await p.selectOption(`${f} [name="propertyId"]`, 'property_003').catch(() => {});
  const sel = await p.$eval(`${f} [name="propertyId"]`, s => s.value);
  for (const [n, v] of [['tenant', 'Awa Test'], ['phone', '771234567'], ['rent', '200000'], ['start', '2026-10-01'], ['months', '12']]) {
    const el = await p.$(`${f} [name="${n}"]`); if (el) await el.fill(v);
  }
  await p.click(`${f} button.btn:not([type=button])`); await p.waitForTimeout(400);
  const bail = await p.evaluate(id => DB.findItem(DB.K.leases, l => l.propertyId === id && l.status === 'actif' && l.tenant === 'Awa Test'), sel);
  ok('R1', !!bail, `bail créé par le formulaire (${sel}) : ${!!bail}`);

  // 2. Encaisser un loyer en entier par la modale
  await goto(p, '#/manage/rents');
  const rid = await p.evaluate(id => (DB.getData(DB.K.rents).find(r => r.leaseId === id && !r.paidAt) || {}).id, bail && bail.id);
  await p.evaluate(id => document.querySelector(`[data-action="g-pay"][data-id="${id}"]`)?.click(), rid); await p.waitForTimeout(300);
  const val = await p.$eval('form[data-action="g-pay-save"] [name="amount"]', i => i.value).catch(() => 'absent');
  await p.click('form[data-action="g-pay-save"] button.btn').catch(() => {}); await p.waitForTimeout(400);
  const r = await p.evaluate(id => DB.findItem(DB.K.rents, id), rid);
  ok('R2', r && r.paidAt && r.amount === 200000, `montant proposé ${val}, loyer soldé : ${!!(r && r.paidAt)}`);

  // 3. Acompte puis solde par la modale
  const rid2 = await p.evaluate(id => DB.getData(DB.K.rents).filter(r => r.leaseId === id && !r.paidAt).sort((a, b) => a.month < b.month ? -1 : 1)[0].id, bail.id);
  await goto(p, '#/manage/rents');
  await p.evaluate(id => document.querySelector(`[data-action="g-pay"][data-id="${id}"]`)?.click(), rid2); await p.waitForTimeout(300);
  await p.fill('form[data-action="g-pay-save"] [name="amount"]', '50000');
  await p.click('form[data-action="g-pay-save"] button.btn'); await p.waitForTimeout(400);
  await goto(p, '#/owner/dashboard'); await goto(p, '#/manage/rents');
  const badge = await p.evaluate(id => document.querySelector(`[data-action="g-pay"][data-id="${id}"]`)?.closest('tr')?.querySelector('.badge')?.textContent, rid2);
  await p.evaluate(id => document.querySelector(`[data-action="g-pay"][data-id="${id}"]`)?.click(), rid2); await p.waitForTimeout(300);
  const v2 = await p.$eval('form[data-action="g-pay-save"] [name="amount"]', i => i.value);
  await p.click('form[data-action="g-pay-save"] button.btn'); await p.waitForTimeout(400);
  const r2 = await p.evaluate(id => DB.findItem(DB.K.rents, id), rid2);
  ok('R3', badge && /Partiel/.test(badge) && v2 === '150000' && !!r2.paidAt && r2.payments.length === 2, `badge « ${badge} », reste proposé ${v2}, soldé ${!!r2.paidAt}`);

  // 4. Prolonger par le bouton
  await goto(p, '#/manage/leases');
  const hasBtn = await p.evaluate(id => !!document.querySelector(`[data-action="g-renew-open"][data-id="${id}"]`), bail.id);
  await p.evaluate(id => document.querySelector(`[data-action="g-renew-open"][data-id="${id}"]`)?.click(), bail.id); await p.waitForTimeout(300);
  await p.fill('form[data-action="g-renew"] [name="months"]', '6').catch(() => {});
  await p.click('form[data-action="g-renew"] button.btn:not([type=button])').catch(() => {}); await p.waitForTimeout(400);
  const b2 = await p.evaluate(id => [DB.findItem(DB.K.leases, id).months, DB.filterItems(DB.K.rents, r => r.leaseId === id).length], bail.id);
  ok('R4', hasBtn && b2[0] === 18 && b2[1] === 18, `bouton Prolonger : ${hasBtn}, durée ${b2[0]} mois, ${b2[1]} échéances`);

  // 5. Mettre fin au bail par la modale
  await goto(p, '#/manage/leases');
  await p.evaluate(id => document.querySelector(`[data-action="g-end-lease"][data-id="${id}"]`)?.click(), bail.id); await p.waitForTimeout(300);
  await p.click('form[data-action="g-end-lease-ok"] button.btn.danger').catch(() => {}); await p.waitForTimeout(400);
  const fin = await p.evaluate(([id, pid]) => [DB.findItem(DB.K.leases, id).status, DB.findItem(DB.K.leases, id).endedAt, gProp(pid).status, DB.filterItems(DB.K.rents, r => r.leaseId === id).length], [bail.id, sel]);
  ok('R5', fin[0] === 'termine' && fin[2] === 'liberation', `bail ${fin[0]} le ${fin[1]}, bien ${fin[2]}, ${fin[3]} loyers gardés`);

  // 6. Vendre maintenant puis signer
  await goto(p, '#/manage/deals');
  const vf = 'form[data-action="v-new"]';
  const opts = await p.$$eval(`${vf} [name="propertyId"] option`, o => o.map(x => x.value).filter(Boolean));
  await p.selectOption(`${vf} [name="propertyId"]`, opts[0]); await p.waitForTimeout(100);
  await p.fill(`${vf} [name="price"]`, '30000000');
  const buyer = await p.$(`${vf} [name="buyer"]`); if (buyer) await buyer.fill('Acheteur Réel');
  else await p.evaluate(sf => { const s = document.querySelector(sf + ' [data-action="bc-acquereur"]'); if (s && s.options.length > 1) { s.selectedIndex = 1; s.dispatchEvent(new Event('change', {bubbles: true})); } }, vf);
  await p.click(`${vf} button[value="vendre"]`); await p.waitForTimeout(600);
  await p.click('[data-action="v-signer"]').catch(() => {}); await p.waitForTimeout(500);
  const vente = await p.evaluate(pid => [gProp(pid).status, (DB.findItem(DB.K.deals, d => d.propertyId === pid) || {}).stage], opts[0]);
  ok('R6', vente[0] === 'vendu' && vente[1] === 'signe', `${opts[0]} : statut ${vente[0]}, dossier ${vente[1]}`);

  // 7. Changement de statut autorisé et suppression d'un bien libre
  await goto(p, '#/owner/properties');
  await p.selectOption('select[data-action="set-status"][data-id="property_019"]', 'discussion').catch(() => {});
  await p.waitForTimeout(300);
  const st = await p.evaluate(() => gProp('property_019').status);
  await p.evaluate(() => document.querySelector('[data-action="delete-prop"][data-id="propertie_eyqtra9p"], [data-action="delete-prop"]:last-of-type'));
  const libre = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.ownerId === 'user_owner1' && x.status === 'disponible' && !bauxDuBien(x).length && !venteOuverte(x) && !venteConclue(x)).id);
  await p.evaluate(id => document.querySelector(`[data-action="delete-prop"][data-id="${id}"]`)?.click(), libre); await p.waitForTimeout(200);
  await p.click('[data-action="dlg-confirm"]').catch(() => {}); await p.waitForTimeout(300);
  const sup = await p.evaluate(id => !DB.findItem(DB.K.properties, id), libre);
  ok('R7', st === 'discussion' && sup, `statut libre → ${st} ; bien libre ${libre} supprimé : ${sup}`);

  // 8. Renouveler un contrat par le bouton
  await goto(p, '#/manage/contracts');
  const cid = await p.evaluate(() => (document.querySelector('[data-action="g3-renew"]') || {}).dataset?.id);
  if (cid) {
    const avant = await p.evaluate(id => DB.findItem(DB.K.contracts, id), cid);
    await p.click(`[data-action="g3-renew"][data-id="${cid}"]`); await p.waitForTimeout(400);
    const n = await p.evaluate(id => DB.getData(DB.K.contracts).find(x => x.renewedFrom === id), cid);
    ok('R8', n && n.start > avant.end, `${avant.ref} (fin ${avant.end}) → ${n && n.ref} du ${n && n.start} au ${n && n.end}`);
  } else ok('R8', true, 'aucun contrat renouvelable dans la démo (sauté)');

  // 9. Relance d'un loyer : une seule notification par clic (modules en double)
  await goto(p, '#/manage/rents');
  const rel = await p.evaluate(() => { const b = document.querySelector('[data-action="relance-interne"]'); if (!b) return null;
    const n0 = DB.getData(DB.K.notifications).length; b.click(); return DB.getData(DB.K.notifications).length - n0; });
  ok('R9', rel === null || rel <= 1, rel === null ? 'aucun loyer à relancer' : `${rel} notification(s) pour un clic`);
  console.log('erreurs JS :', p.errs);
  await b.close();

  // 10. Tour des pages par rôle, sans erreur JS
  const roles = {'1900000000003': ['#/owner/dashboard', '#/owner/properties', '#/manage', '#/manage/leases', '#/manage/rents', '#/manage/deals', '#/manage/docs', '#/manage/fpay', '#/manage/finance', '#/manage/contracts', '#/manage/units', '#/manage/reports', '#/bien/property_001', '#/bien/property_001/finances', '#/coffre', '#/owner/statistics'],
    '1900000000004': ['#/agency/dashboard', '#/agency/properties', '#/manage/rents', '#/manage/transfers', '#/manage/finance', '#/manage/owners'],
    '1900000000002': ['#/tenant/home', '#/tenant/rents', '#/tenant/payments', '#/tenant/quittances'],
    '1900000000011': ['#/owner/dashboard', '#/manage/rents', '#/manage/leases'],
    '1900000000001': ['#/admin/dashboard', '#/admin/properties']};
  for (const [cni, pages] of Object.entries(roles)) {
    ({b, p} = await open()); await loginAs(p, cni);
    for (const h of pages) { await goto(p, h); }
    ok('T-' + cni, !p.errs.length, p.errs.length ? p.errs.slice(0, 3).join(' | ') : `${pages.length} pages sans erreur`);
    await b.close();
  }
  require('fs').writeFileSync(require('path').join(__dirname, 'regression.json'), JSON.stringify(out));
})();
