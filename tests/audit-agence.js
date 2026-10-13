// Audit logique de l'espace agence : mandats, commissions, reversements, droits.
const {open, loginAs, goto} = require('./harnais');
const AGENCE = '1900000000004', AGENT = '1900000000012';

const helpers = () => {
  window.AT = {
    host() { return document.querySelector('.main') || document.body; },
    submit(action, attrs, fields) {
      const f = document.createElement('form'); f.dataset.action = action;
      for (const [k, v] of Object.entries(attrs || {})) f.dataset[k] = v;
      for (const [k, v] of Object.entries(fields || {})) { const i = document.createElement('input'); i.name = k; i.value = v; f.appendChild(i); }
      const b = document.createElement('button'); f.appendChild(b); this.host().appendChild(f); f.requestSubmit(b); return f;
    },
    click(action, attrs) { const b = document.createElement('button'); b.dataset.action = action; for (const [k, v] of Object.entries(attrs || {})) b.dataset[k] = v; this.host().appendChild(b); b.click(); b.remove(); },
    confirm() { const b = document.querySelector('[data-action="dlg-confirm"]'); if (b) { b.click(); return true; } const f = document.querySelector('#modal-root form'); if (f) { f.requestSubmit(); return true; } return false; },
    u() { return Auth.current(); },
    o(n) { return gMine('owners', Auth.current()).find(o => o.name.includes(n)); },
    solde(o) { return typeof soldeMandant === 'function' ? soldeMandant(Auth.current(), o).solde : NaN; },
  };
};
const tests = [], t = (id, titre, fn) => tests.push({id, titre, fn});

t('A1', 'Un reversement qui règle plusieurs mois d\'un coup n\'est pas redemandé', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const u = AT.u(), o = AT.o('Ousmane');
    // Juillet et août (1 104 000 chacun) sont réglés en un seul virement de 2 208 000, saisi depuis la ligne de juillet.
    AT.submit('t-save', {o: o.id, m: '2026-07'}, {amount: 2208000, method: 'Virement', ref: 'VIR-JUIL-AOUT'});
    const verse = gMine('transfers', u).filter(t => t.ownerId2 === o.id).reduce((s, t) => s + t.amount, 0);
    const du = ['2026-05', '2026-06', '2026-07', '2026-08'].reduce((s, m) => s + 1104000, 0);
    const reste = typeof soldeMandant === 'function' ? soldeMandant(u, o).solde
      : monthsBack(4).filter(m => !gMine('transfers', u).find(t => t.ownerId2 === o.id && t.month === m)).reduce((s, m) => s + Math.max(0, ownerBalance(u, o, m).net), 0);
    return [reste === du - verse, `dû 4 416 000, déjà reversé ${verse} → l'écran demande encore ${reste} (attendu ${du - verse})`];
  });
});
t('A2', 'Un reversement ne peut pas dépasser le solde dû au propriétaire', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const o = AT.o('Ousmane'), n0 = gMine('transfers', AT.u()).length;
    AT.submit('t-save', {o: o.id, m: '2026-07'}, {amount: 50000000, method: 'Virement', ref: 'X'});
    const n = gMine('transfers', AT.u()).length - n0;
    return [n === 0, n ? `reversement de 50 000 000 accepté` : 'refusé'];
  });
});
t('A3', 'Un reversement nul n\'est pas enregistré', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const o = AT.o('SCI'), n0 = gMine('transfers', AT.u()).length;
    AT.submit('t-save', {o: o.id, m: '2026-05'}, {amount: 0, method: 'Virement', ref: ''});
    const n = gMine('transfers', AT.u()).length - n0;
    return [n === 0, n ? 'reversement de 0 FCFA enregistré, le mois passe « reversé »' : 'refusé'];
  });
});
t('A4', 'Une dépense saisie après un reversement réapparaît dans le solde', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const u = AT.u(), o = AT.o('Ousmane');
    // On solde d'abord tout ce qui reste, puis on ajoute une dépense datée d'un mois déjà réglé.
    const avant = typeof soldeMandant === 'function' ? soldeMandant(u, o).solde : 0;
    if (avant > 0) AT.submit('t-save', {o: o.id, m: curMonth()}, {amount: avant, method: 'Virement', ref: 'S'});
    DB.addItem(DB.K.expenses, {ownerId: u.id, ref: 'DEP-T', propertyId: 'property_002', supplier: 'Plombier', cat: 'réparation', amount: 100000, method: 'Espèces', date: '2026-08-20'});
    const s = typeof soldeMandant === 'function' ? soldeMandant(u, o).solde : null;
    return [s === -100000, s === null ? 'aucun solde suivi : la dépense d\'août, mois déjà reversé, n\'est imputée nulle part' : `solde après la dépense : ${s} (attendu −100 000, à retenir sur le prochain reversement)`];
  });
});
t('A5', 'Un bien ne peut pas être confié par deux propriétaires à la fois', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/mandates');
  return p.evaluate(() => {
    const a = AT.o('Ousmane'), b = AT.o('SCI');
    AT.submit('m-new', {}, {ownerId2: a.id, rate: 8, start: '2026-01-01', end: '2026-12-31', p_property_002: 'on', s_0: 'on'});
    AT.submit('m-new', {}, {ownerId2: b.id, rate: 10, start: '2026-01-01', end: '2026-12-31', p_property_002: 'on', s_0: 'on'});
    const owner = gProp('property_002').clientOwnerId, n = gMine('mandates', AT.u()).filter(m => m.status === 'actif' && m.properties.includes('property_002')).length;
    return [n === 1 && owner === a.id, `${n} mandat(s) actif(s) sur le même bien ; il appartient maintenant à ${owner === a.id ? 'Ousmane Diallo' : 'SCI Teranga'}`];
  });
});
t('A6', 'Pas deux mandats actifs qui se chevauchent pour le même propriétaire', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/mandates');
  return p.evaluate(() => {
    const a = AT.o('Ousmane');
    AT.submit('m-new', {}, {ownerId2: a.id, rate: 8, start: '2026-01-01', end: '2026-12-31', p_property_002: 'on'});
    AT.submit('m-new', {}, {ownerId2: a.id, rate: 12, start: '2026-06-01', end: '2027-05-31', p_property_005: 'on'});
    const n = gMine('mandates', AT.u()).filter(m => m.ownerId2 === a.id && m.status === 'actif').length;
    return [n === 1, `${n} mandats actifs simultanés pour Ousmane Diallo (8 % et 12 %)`];
  });
});
t('A7', 'La commission d\'un mois suit le mandat en vigueur ce mois-là', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const u = AT.u(), a = AT.o('Ousmane');
    DB.addItem(DB.K.mandates, {ownerId: u.id, ownerId2: a.id, ref: 'MDT-A', rate: 10, start: '2026-01-01', end: '2026-07-31', properties: ['property_002'], services: [], status: 'expiré'});
    DB.addItem(DB.K.mandates, {ownerId: u.id, ownerId2: a.id, ref: 'MDT-B', rate: 5, start: '2026-08-01', end: '2027-07-31', properties: ['property_002'], services: [], status: 'actif'});
    const jul = ownerBalance(u, a, '2026-07').rate, aug = ownerBalance(u, a, '2026-08').rate;
    return [jul === 10 && aug === 5, `taux appliqué : juillet ${jul} % (mandat A : 10 %), août ${aug} % (mandat B : 5 %)`];
  });
});
t('A8', 'Un agent sans droit « finances » ne peut pas reverser', async p => {
  await loginAs(p, AGENT); await goto(p, '#/agency/dashboard');
  return p.evaluate(() => {
    const o = gMine('owners', AT.u())[0], n0 = DB.getData(DB.K.transfers).length;
    AT.submit('t-save', {o: o.id, m: '2026-07'}, {amount: 1000, method: 'Wave', ref: ''});
    AT.submit('m-new', {}, {ownerId2: o.id, rate: 1, start: '2026-01-01', end: '2026-12-31'});
    const n = DB.getData(DB.K.transfers).length - n0, m = DB.getData(DB.K.mandates).filter(x => x.rate === 1).length;
    return [!n && !m, `agent (droits : ${AT.u().perms.join(', ')}) → ${n} reversement(s), ${m} mandat(s) créés`];
  });
});
t('A9', 'Supprimer un propriétaire qui a un mandat ou un solde est refusé', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/owners');
  return p.evaluate(() => {
    const u = AT.u(), a = AT.o('Ousmane');
    DB.addItem(DB.K.mandates, {ownerId: u.id, ownerId2: a.id, ref: 'MDT-Z', rate: 8, start: '2026-01-01', end: '2027-01-01', properties: ['property_002'], services: [], status: 'actif'});
    AT.click('g9-odel', {id: a.id}); AT.confirm();
    const existe = !!DB.findItem(DB.K.owners, a.id);
    return [existe, existe ? 'suppression refusée' : 'propriétaire supprimé : mandat actif et reversements orphelins'];
  });
});
t('A10', 'La page Commissions montre les commissions réellement prélevées', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/agency/commissions');
  return p.evaluate(() => {
    const u = AT.u(), txt = document.querySelector('.main').innerText;
    const reel = gMine('owners', u).reduce((s, o) => s + monthsBack(12).reduce((x, m) => x + ownerBalance(u, o, m).com, 0), 0);
    const affiche = txt.includes(money(reel).replace(/\s/g, ' ')) || txt.replace(/\s/g, '').includes(money(reel).replace(/\s/g, ''));
    return [affiche && !/Simulation/i.test(txt), `commission de gestion réelle sur 12 mois : ${money(reel)} ; affichée : ${affiche ? 'oui' : 'non'}${/Simulation/i.test(txt) ? ' (page « Simulation » : 1 mois de loyer par bien loué)' : ''}`];
  });
});
t('A11', 'Identifiants forgés : reverser ou mandater pour le compte d\'une autre agence', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/manage/transfers');
  return p.evaluate(() => {
    const autre = DB.addItem(DB.K.owners, {ownerId: 'user_agency2', name: 'Mandant d\'une autre agence', rate: 5});
    const n0 = DB.getData(DB.K.transfers).length, m0 = DB.getData(DB.K.mandates).length;
    AT.submit('t-save', {o: autre.id, m: '2026-07'}, {amount: 1000, method: 'Wave', ref: ''});
    AT.submit('m-new', {}, {ownerId2: autre.id, rate: 5, start: '2026-01-01', end: '2026-12-31'});
    AT.submit('m-new', {}, {ownerId2: AT.o('SCI').id, rate: 5, start: '2028-01-01', end: '2028-12-31', p_property_001: 'on'});
    const n = DB.getData(DB.K.transfers).length - n0, m = DB.getData(DB.K.mandates).filter(x => x.properties && x.properties.includes('property_001')).length;
    return [!n && !m && gProp('property_001').clientOwnerId !== AT.o('SCI').id, `reversements forgés : ${n}, mandat sur le bien d'un autre compte : ${m}`];
  });
});

t('A12', 'Le relevé du mandant affiche le même solde que l\'agence', async p => {
  await loginAs(p, AGENCE); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(500);
  const ag = await p.evaluate(() => { const u = Auth.current(), o = gMine('owners', u).find(x => x.name.includes('Ousmane'));
    return typeof soldeMandant === 'function' ? soldeMandant(u, o).solde : monthsBack(4).filter(m => !gMine('transfers', u).find(t => t.ownerId2 === o.id && t.month === m)).reduce((s, m) => s + Math.max(0, ownerBalance(u, o, m).net), 0); });
  await p.evaluate(() => { const m = DB.findItem(DB.K.users, x => x.email === 'o.diallo@mail.sn'); localStorage.setItem(DB.K.session, JSON.stringify({id: m.id, at: now()})); });
  await goto(p, '#/mandant/releves');
  const txt = await p.evaluate(() => (document.querySelector('.main .kpis') || {}).innerText || '');
  const vu = txt.replace(/\s/g, '').includes(String(ag.toLocaleString('fr-FR')).replace(/\s/g, '') + 'FCFAReste');
  return [vu, `solde côté agence : ${ag} ; relevé du mandant : ${txt.replace(/\s+/g, ' ').slice(0, 160)}`];
});

(async () => {
  const only = process.argv[2] ? process.argv[2].split(',') : null, out = [];
  for (const x of tests) {
    if (only && !only.includes(x.id)) continue;
    const {b, p} = await open(); await p.evaluate(helpers);
    let ok, msg; try { [ok, msg] = await x.fn(p); } catch (e) { ok = false; msg = 'ERREUR ' + e.message.split('\n')[0]; }
    if (p.errs.length) msg += '  [erreurs JS : ' + p.errs.slice(0, 2).join(' | ') + ']';
    out.push({id: x.id, ok, titre: x.titre, msg}); console.log(`${ok ? 'OK  ' : 'ÉCHEC'} ${x.id}  ${x.titre}\n        → ${msg}`);
    await b.close();
  }
  require('fs').writeFileSync(process.env.OUT || require('path').join(__dirname, 'resultats-agence.json'), JSON.stringify(out, null, 1));
})();
