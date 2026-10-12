// Audit logique de l'espace propriétaire — chaque test part d'une démo neuve.
// Les actions sont déclenchées comme le ferait l'interface (formulaire soumis,
// bouton cliqué), y compris depuis un écran resté ouvert ou un identifiant forgé.
const {open, loginAs, goto} = require('./harnais');
const OWNER1 = '1900000000003', OWNER2 = '1900000000007';

const helpers = () => {
  window.AT = {
    lease(pid) { return DB.findItem(DB.K.leases, l => l.propertyId === pid && l.status === 'actif'); },
    soldProp() { return DB.findItem(DB.K.deals, d => d.ownerId === 'user_owner1' && d.stage === 'signe').propertyId; },
    openDeal() { return DB.findItem(DB.K.deals, d => d.ownerId === 'user_owner1' && d.stage !== 'signe').id; },
    host() { return document.querySelector('.main') || document.body; },
    submit(action, id, fields, submitterValue) {
      const f = document.createElement('form'); f.dataset.action = action; if (id) f.dataset.id = id;
      for (const [k, v] of Object.entries(fields || {})) { const i = document.createElement('input'); i.name = k; i.value = v; f.appendChild(i); }
      const b = document.createElement('button'); if (submitterValue) { b.name = 'go'; b.value = submitterValue; } f.appendChild(b);
      this.host().appendChild(f); f.requestSubmit(b); return f;
    },
    click(action, attrs) {
      const b = document.createElement('button'); b.dataset.action = action;
      for (const [k, v] of Object.entries(attrs || {})) b.dataset[k] = v;
      this.host().appendChild(b); b.click(); b.remove();
    },
    change(action, id, value) {
      const s = document.createElement('select'); s.dataset.action = action; s.dataset.id = id;
      const o = document.createElement('option'); o.value = value; o.selected = true; s.appendChild(o);
      this.host().appendChild(s); s.dispatchEvent(new Event('change', {bubbles: true})); s.remove();
    },
    confirm() { const b = document.querySelector('[data-action="dlg-confirm"]'); if (b) { b.click(); return true; }
      const f = document.querySelector('#modal-root form'); if (f) { f.requestSubmit(); return true; } return false; },
    snap() { const o = {}; ['properties','leases','rents','deals','fpay','docs','contracts','units'].forEach(k => o[k] = localStorage.getItem(DB.K[k])); return o; },
  };
};

const tests = [];
const t = (id, titre, fn) => tests.push({id, titre, fn});

/* ---------------- P0 — biens et transactions ---------------- */
t('V1', 'Un bien ne peut pas être vendu deux fois (deux dossiers ouverts)', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/deals');
  return p.evaluate(() => {
    AT.submit('v-new', '', {propertyId: 'property_008', price: 50000000, buyer: 'Acheteur A'}, 'suivre');
    location.hash = '#/manage/deals';
    AT.submit('v-new', '', {propertyId: 'property_008', price: 50000000, buyer: 'Acheteur B'}, 'suivre');
    const n = DB.filterItems(DB.K.deals, d => d.propertyId === 'property_008').length;
    return [n === 1, `${n} dossier(s) ouverts sur le même bien`];
  });
});
t('V2', 'Un bien ne peut pas être vendu deux fois (signature depuis un écran périmé)', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/deals');
  return p.evaluate(() => {
    // Deux dossiers existent (ex. le second créé depuis un autre onglet avant la règle) : on signe les deux.
    const a = DB.addItem(DB.K.deals, {ownerId: 'user_owner1', propertyId: 'property_008', buyer: 'A', price: 1e7, offer: 1e7, mode: 'unique', plan: planDeVente('unique', 1e7, 0, 0, ymd()), stage: 'promesse'});
    const b = DB.addItem(DB.K.deals, {ownerId: 'user_owner1', propertyId: 'property_008', buyer: 'B', price: 1e7, offer: 1e7, mode: 'unique', plan: planDeVente('unique', 1e7, 0, 0, ymd()), stage: 'promesse'});
    AT.click('v-signer', {id: a.id}); AT.click('v-signer', {id: b.id});
    const n = DB.filterItems(DB.K.deals, d => d.propertyId === 'property_008' && d.stage === 'signe').length;
    return [n === 1, `${n} vente(s) signée(s) pour le même bien`];
  });
});
t('V3', 'Un bien occupé ne peut pas être vendu (bail signé entre-temps)', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/deals');
  return p.evaluate(() => {
    const d = DB.addItem(DB.K.deals, {ownerId: 'user_owner1', propertyId: 'property_016', buyer: 'A', price: 1e7, offer: 1e7, mode: 'unique', plan: planDeVente('unique', 1e7, 0, 0, ymd()), stage: 'promesse'});
    DB.addItem(DB.K.leases, {ownerId: 'user_owner1', propertyId: 'property_016', tenant: 'Occupant', phone: '770000000', rent: 100000, start: '2026-09-01', months: 12, dueDay: 5, status: 'actif'});
    AT.click('v-signer', {id: d.id});
    const s = DB.findItem(DB.K.deals, d.id).stage;
    return [s !== 'signe', `dossier à l'étape « ${s} » alors que le bien est loué`];
  });
});
t('V4', 'Statut manuel : un bien loué ne repasse pas « Disponible » tant que le bail court', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/owner/properties');
  return p.evaluate(() => {
    AT.change('set-status', 'property_001', 'disponible');
    const s = DB.findItem(DB.K.properties, 'property_001').status;
    return [s === 'loue', `statut devenu « ${s} » avec un bail actif`];
  });
});
t('V5', 'Statut manuel : un bien vendu ne repasse pas « Disponible »', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/owner/properties');
  return p.evaluate(() => {
    AT.change('set-status', AT.soldProp(), 'disponible');
    const s = DB.findItem(DB.K.properties, AT.soldProp()).status;
    return [s === 'vendu', `statut devenu « ${s} » après une vente signée`];
  });
});
t('V6', 'Supprimer un bien loué ne doit pas effacer le bail ni les impayés', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/owner/properties');
  return p.evaluate(() => {
    const lid = AT.lease('property_001').id, avant = DB.filterItems(DB.K.rents, r => r.leaseId === lid).length;
    AT.click('delete-prop', {id: 'property_001'}); AT.confirm();
    const existe = !!DB.findItem(DB.K.properties, 'property_001'), apres = DB.filterItems(DB.K.rents, r => r.leaseId === lid).length;
    return [existe && apres === avant, existe ? 'bien conservé' : `bien supprimé, loyers ${avant} → ${apres}, bail terminé`];
  });
});
t('V7', 'Pas de baux chevauchants : un nouveau bail ne peut pas commencer avant la fin du précédent', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/leases');
  return p.evaluate(() => {
    const base = {tenant: 'Locataire', phone: '770000001', rent: 150000, deposit: 0, months: 12, dueDay: 5};
    AT.submit('g-lease', '', {...base, propertyId: 'property_003', start: '2026-05-01'});
    const l1 = DB.findItem(DB.K.leases, l => l.propertyId === 'property_003' && l.status === 'actif');
    if (!l1) return [false, 'premier bail non créé (test invalide)'];
    AT.click('g-end-lease', {id: l1.id}); AT.confirm();
    AT.submit('g-lease', '', {...base, tenant: 'Autre', propertyId: 'property_003', start: '2026-06-01'});
    const ls = DB.filterItems(DB.K.leases, l => l.propertyId === 'property_003');
    const mois = DB.filterItems(DB.K.rents, r => ls.some(l => l.id === r.leaseId)).map(r => r.month);
    const doublons = mois.filter((m, i) => mois.indexOf(m) !== i).length;
    return [ls.length === 1, `${ls.length} baux, ${doublons} mois facturés deux fois`];
  });
});
t('V8', 'Opérations concurrentes : un second onglet est prévenu quand les données changent', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/leases');
  const p2 = await p.context().newPage(); await p2.goto(p.url()); await p2.waitForTimeout(600);
  await p2.evaluate(() => { window.__r = 0; const o = render; render = function () { window.__r++; return o.apply(this, arguments); }; });
  await p.evaluate(() => DB.updateItem(DB.K.properties, 'property_003', {title: 'Studio meublé à Mermoz (modifié)'}));
  await p2.waitForTimeout(400);
  const n = await p2.evaluate(() => window.__r); await p2.close();
  return [n > 0, n > 0 ? 'écran rafraîchi' : "l'autre onglet garde un écran périmé"];
});

/* ---------------- P0 — paiements et documents ---------------- */
const loyerOuvert = `(() => DB.getData(DB.K.rents).filter(r => r.leaseId === AT.lease('property_001').id && !r.paidAt).sort((a,b) => a.month < b.month ? -1 : 1)[0])()`;
t('P1', 'Un paiement partiel de loyer ne vaut pas paiement intégral', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(src => {
    const r = eval(src), du = r.amount;
    AT.submit('g-pay-save', r.id, {amount: Math.round(du / 2), date: ymd(), method: 'Wave', ref: 'W-PART-1'});
    const x = DB.findItem(DB.K.rents, r.id);
    return [!x.paidAt && x.amount === du, `après ${Math.round(du / 2)} sur ${du} : ${x.paidAt ? 'marqué PAYÉ' : 'non soldé'}, montant dû devenu ${x.amount}`];
  }, loyerOuvert);
});
t('P2', 'Le reste dû d\'un loyer = dû − paiements, et le solde le rend payé', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(src => {
    const r = eval(src), du = r.amount;
    AT.submit('g-pay-save', r.id, {amount: 40000, date: ymd(), method: 'Wave', ref: 'A1'});
    const reste = typeof rRest === 'function' ? rRest(DB.findItem(DB.K.rents, r.id)) : NaN;
    AT.submit('g-pay-save', r.id, {amount: du - 40000, date: ymd(), method: 'Espèces', ref: 'A2'});
    const x = DB.findItem(DB.K.rents, r.id);
    return [reste === du - 40000 && !!x.paidAt && x.amount === du, `reste après acompte : ${reste} (attendu ${du - 40000}), soldé : ${!!x.paidAt}`];
  }, loyerOuvert);
});
t('P3', 'Un loyer ne peut pas être encaissé au-delà du montant dû', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(src => {
    const r = eval(src), du = r.amount;
    AT.submit('g-pay-save', r.id, {amount: du * 3, date: ymd(), method: 'Wave', ref: ''});
    const x = DB.findItem(DB.K.rents, r.id);
    return [!x.paidAt, `encaissé ${du * 3} pour ${du} dus : ${x.paidAt ? 'accepté (loyer devenu ' + x.amount + ')' : 'refusé'}`];
  }, loyerOuvert);
});
t('P4', 'Une facture créée n\'est pas encaissée', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/docs');
  return p.evaluate(() => {
    AT.submit('g2-save-doc', 'FAC', {client: 'Client Test', l0: 'Prestation', q0: 1, p0: 100000, days: 30});
    const f = DB.getData(DB.K.docs).filter(d => d.type === 'FAC' && d.client === 'Client Test').pop();
    return [dPaid(f) === 0 && dRest(f) === 100000 && dState(f)[0] === 'Émise', `état « ${dState(f)[0]} », payé ${dPaid(f)}, reste ${dRest(f)}`];
  });
});
t('P5', 'Facture : paiement partiel, reste dû exact, pas de dépassement', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/docs');
  return p.evaluate(() => {
    AT.submit('g2-save-doc', 'FAC', {client: 'Client Test', l0: 'Prestation', q0: 1, p0: 100000, days: 30});
    const f = DB.getData(DB.K.docs).filter(d => d.type === 'FAC' && d.client === 'Client Test').pop();
    AT.submit('g2-save-pay', f.id, {amount: 30000, method: 'Wave'});
    const e1 = dState(f)[0], r1 = dRest(f);
    AT.submit('g2-save-pay', f.id, {amount: 90000, method: 'Wave'});
    return [e1 === 'Partiellement payée' && r1 === 70000 && dPaid(f) === 30000, `après 30 000 : « ${e1} », reste ${r1} ; tentative de 90 000 → payé ${dPaid(f)}`];
  });
});
t('P6', 'Un même paiement n\'est pas comptabilisé deux fois (double validation du formulaire)', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/docs');
  return p.evaluate(() => {
    AT.submit('g2-save-doc', 'FAC', {client: 'Client Test', l0: 'Prestation', q0: 1, p0: 100000, days: 30});
    const f = DB.getData(DB.K.docs).filter(d => d.type === 'FAC' && d.client === 'Client Test').pop();
    const form = AT.submit('g2-save-pay', f.id, {amount: 20000, method: 'Wave'});
    form.requestSubmit();                       // double clic
    const n = DB.filterItems(DB.K.fpay, x => x.docId === f.id).length;
    return [n === 1, `${n} paiement(s) enregistrés pour une seule validation`];
  });
});
t('P7', 'Loyer : la même référence de transaction n\'est pas enregistrée deux fois', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(src => {
    const r = eval(src);
    AT.submit('g-pay-save', r.id, {amount: 10000, date: ymd(), method: 'Wave', ref: 'WAVE-777'});
    AT.submit('g-pay-save', r.id, {amount: 10000, date: ymd(), method: 'Wave', ref: 'WAVE-777'});
    const x = DB.findItem(DB.K.rents, r.id), n = (x.payments || []).length || (x.paidAt ? 1 : 0);
    return [n === 1, `${n} encaissement(s) portant la référence WAVE-777`];
  }, loyerOuvert);
});
t('P8', 'Les impayés comptent le reste dû, et l\'encaissé compte les acomptes', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(() => {
    const r = DB.addItem(DB.K.rents, {ownerId: 'user_owner1', leaseId: AT.lease('property_001').id, month: '2026-01', amount: 200000, paidAt: null});
    AT.submit('g-pay-save', r.id, {amount: 50000, date: ymd(), method: 'Wave', ref: 'X9'});
    const impaye = typeof rRest === 'function' ? rRest(DB.findItem(DB.K.rents, r.id)) : DB.findItem(DB.K.rents, r.id).paidAt ? 0 : 200000;
    const enc = typeof rPaid === 'function' ? rPaid(DB.findItem(DB.K.rents, r.id)) : (DB.findItem(DB.K.rents, r.id).paidAt ? DB.findItem(DB.K.rents, r.id).amount : 0);
    return [impaye === 150000 && enc === 50000, `impayé ${impaye} (attendu 150 000), encaissé ${enc} (attendu 50 000)`];
  });
});

/* ---------------- P1 — contrats et échéances ---------------- */
t('C1', 'Un bail expiré ne libère pas automatiquement le bien', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/leases');
  return p.evaluate(() => {
    DB.addItem(DB.K.leases, {ownerId: 'user_owner1', propertyId: 'property_019', tenant: 'Ancien', phone: '770000002', rent: 90000, start: '2025-06-01', months: 12, dueDay: 5, status: 'actif'});
    DB.updateItem(DB.K.properties, 'property_019', {status: 'loue'});
    location.hash = '#/owner/dashboard'; location.hash = '#/manage/leases';
    const s = DB.findItem(DB.K.properties, 'property_019').status, libre = disponiblePour(gProp('property_019'), 'location');
    return [s === 'loue' && !libre, `statut ${s}, louable à un autre : ${libre}`];
  });
});
t('C2', 'Un bail échu peut être prolongé sans chevauchement ni mois en double', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/leases');
  return p.evaluate(() => {
    const l = DB.addItem(DB.K.leases, {ownerId: 'user_owner1', propertyId: 'property_019', tenant: 'Ancien', phone: '770000002', rent: 90000, start: '2025-06-01', months: 12, dueDay: 5, status: 'actif'});
    for (let i = 0; i < 12; i++) { const m = new Date(2025, 5 + i, 1); DB.addItem(DB.K.rents, {ownerId: 'user_owner1', leaseId: l.id, month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, amount: 90000, paidAt: '2025-12-01T00:00:00Z'}); }
    AT.submit('g-renew', l.id, {months: 12, rent: 95000});
    const x = DB.findItem(DB.K.leases, l.id), mois = DB.filterItems(DB.K.rents, r => r.leaseId === l.id).map(r => r.month);
    const doublons = mois.filter((m, i) => mois.indexOf(m) !== i).length;
    return [x.months === 24 && mois.length === 24 && !doublons && mois.includes('2026-06') && mois.includes('2027-05'), `durée ${x.months} mois, ${mois.length} échéances, ${doublons} doublon(s)`];
  });
});
t('C3', 'Renouvellement de contrat : le nouveau commence le lendemain de la fin', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/contracts');
  return p.evaluate(() => {
    const c = DB.addItem(DB.K.contracts, {ownerId: 'user_owner1', ref: 'CTR-T', type: 'location', party: 'X', propertyId: 'property_021', start: '2026-01-01', end: '2026-12-31', amount: 100000, status: 'actif'});
    AT.click('g3-renew', {id: c.id});
    const n = DB.getData(DB.K.contracts).filter(x => x.propertyId === 'property_021' && x.id !== c.id).pop();
    return [n && n.start === '2027-01-01', n ? `nouveau contrat du ${n.start} au ${n.end}` : 'pas de renouvellement'];
  });
});
t('C4', 'Fin de bail : les loyers déjà échus et impayés restent dus', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/leases');
  return p.evaluate(() => {
    const l = DB.addItem(DB.K.leases, {ownerId: 'user_owner1', propertyId: 'property_021', tenant: 'Débiteur', phone: '770000003', rent: 100000, start: '2026-06-01', months: 12, dueDay: 5, status: 'actif'});
    ['2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12'].forEach(m => DB.addItem(DB.K.rents, {ownerId: 'user_owner1', leaseId: l.id, month: m, amount: 100000, paidAt: null}));
    AT.click('g-end-lease', {id: l.id}); AT.confirm();
    const restants = DB.filterItems(DB.K.rents, r => r.leaseId === l.id && !r.paidAt).map(r => r.month);
    return [restants.includes('2026-06') && restants.includes('2026-09') && !restants.includes('2026-12'), `impayés conservés : ${restants.join(', ') || 'aucun'}`];
  });
});
t('C5', 'Retard calculé sur le jour d\'échéance du bail (pas toujours le 5)', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/manage/rents');
  return p.evaluate(() => {
    const l = DB.addItem(DB.K.leases, {ownerId: 'user_owner1', propertyId: 'property_021', tenant: 'Z', phone: '1', rent: 1, start: '2026-10-01', months: 1, dueDay: 25, status: 'actif'});
    const r = DB.addItem(DB.K.rents, {ownerId: 'user_owner1', leaseId: l.id, month: '2026-10', amount: 1, paidAt: null});
    const e = rentState(r)[0];
    return [e !== 'En retard', `échéance le 25, on est le 12 : « ${e} »`];
  });
});

/* ---------------- P0 — isolation des données ---------------- */
t('S1', 'Identifiant forgé : modifier le bien d\'un autre propriétaire', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/owner/property/new');
  return p.evaluate(() => {
    const avant = DB.findItem(DB.K.properties, 'property_004').title;
    const f = document.querySelector('form[data-action="save-property"]');
    if (!f) return [false, 'formulaire introuvable'];
    f.dataset.id = 'property_004';
    f.querySelector('[name="title"]').value = 'Piraté par un autre compte'; f.querySelector('[name="price"]').value = 1; f.querySelector('[name="surface"]').value = 1;
    const b = f.querySelector('button:not([type=button])'); f.requestSubmit(b || undefined);
    const apres = DB.findItem(DB.K.properties, 'property_004');
    return [apres.title === avant && apres.ownerId === 'user_owner2', `titre : « ${apres.title} »`];
  });
});
t('S2', 'Identifiants forgés : actions sur les données d\'autres comptes', async p => {
  await loginAs(p, OWNER1); await goto(p, '#/owner/properties');
  return p.evaluate(() => {
    const before = AT.snap(), changed = [];
    const autreBail = AT.lease('property_002').id, autreLoyer = DB.getData(DB.K.rents).find(r => r.leaseId === autreBail && !r.paidAt);
    const essais = [
      () => AT.change('set-status', 'property_004', 'vendu'),
      () => { AT.click('delete-prop', {id: 'property_004'}); AT.confirm(); },
      () => AT.click('archive', {id: 'property_004'}),
      () => AT.click('pause', {id: 'property_004'}),
      () => { AT.click('g-end-lease', {id: autreBail}); AT.confirm(); },
      () => AT.submit('g-pay-save', autreLoyer.id, {amount: 1, date: ymd(), method: 'Wave'}),
      () => AT.submit('g-lease', '', {propertyId: 'property_005', tenant: 'X', phone: '1', rent: 1, months: 1, start: '2026-11-01', dueDay: 5}),
      () => AT.submit('v-new', '', {propertyId: 'property_009', price: 1, buyer: 'X'}, 'vendre'),
      () => AT.submit('g-renew', autreBail, {months: 12, rent: 1}),
    ];
    essais.forEach(f => { try { f(); } catch (e) {} document.querySelector('#modal-root').innerHTML = ''; });
    const after = AT.snap();
    Object.keys(before).forEach(k => { if (before[k] !== after[k]) changed.push(k); });
    return [!changed.length, changed.length ? 'collections modifiées : ' + changed.join(', ') : 'aucune donnée d\'autrui modifiée'];
  });
});
t('S3', 'URL forgée : fiche, édition et dossier de vente d\'un autre compte', async p => {
  await loginAs(p, OWNER2);
  const res = [];
  const deal = await p.evaluate(() => AT.openDeal());
  for (const h of ['#/bien/property_001', '#/owner/property/property_001', '#/vente/' + deal, '#/bien/property_001/finances']) {
    await goto(p, h); const txt = await p.evaluate(() => document.querySelector('#app').innerText);
    if (/Almadies|Mermoz/.test(txt.slice(0, 4000)) && (await p.evaluate(() => location.hash)) === h) res.push(h);
  }
  return [!res.length, res.length ? 'accessible : ' + res.join(' ') : 'toutes refusées'];
});
t('S4', 'Contrôle côté serveur', async p => [false, 'aucun serveur : toutes les données de tous les comptes sont dans le localStorage du navigateur, lisibles et modifiables par la console']);

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const out = [];
  for (const x of tests) {
    if (only && !only.includes(x.id)) continue;
    const {b, p} = await open(); await p.evaluate(helpers);
    let ok, msg;
    try { [ok, msg] = await x.fn(p); } catch (e) { ok = false; msg = 'ERREUR ' + e.message.split('\n')[0]; }
    if (p.errs.length) msg += '  [erreurs JS : ' + p.errs.slice(0, 2).join(' | ') + ']';
    out.push({id: x.id, ok, titre: x.titre, msg}); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${x.id}  ${x.titre}\n        → ${msg}`);
    await b.close();
  }
  require('fs').writeFileSync(process.env.OUT || require('path').join(__dirname, 'resultats.json'), JSON.stringify(out, null, 1));
})();
