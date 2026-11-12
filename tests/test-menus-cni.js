const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync((process.argv[2] || 'js/99n-menus-cni.js'), 'utf8');

function monde() {
  const handlers = {submit: [], click: []};
  const ctx = {console, setTimeout: (f) => { f(); return 0; }, FormData: class { constructor(f) { this.f = f; } get(n) { return this.f.valeurs[n]; } }};
  ctx.U = null;
  ctx.journal = [];
  const code = `
  const MENU_PRO = [['#/owner/dashboard','Tableau de bord','grid'],['#/owner/properties','Mes biens','home'],['#/manage/leases','Locataires','users'],['#/manage/rents','Loyers','money'],['#/manage/deals','Ventes','trendUp'],['#/manage/tickets','Travaux','settings'],['#/manage/finance','Finances','chart'],['#/coffre','Documents','file'],['#/owner/messages','Messages','message'],['#/owner/profile','Paramètres','user']];
  const MENU_OWNER_MEMBRE = [['#/owner/dashboard','Tableau de bord','grid'],['#/owner/properties','Mes biens','home'],['#/manage','Gestion','briefcase'],['#/owner/messages','Messages','message'],['#/owner/profile','Paramètres','user']];
  const MENU_MANDANT = [['#/owner/dashboard','Tableau de bord','grid'],['#/owner/properties','Mes biens confiés','home'],['#/mandant/releves','Mes relevés','money'],['#/coffre','Documents','file'],['#/owner/profile','Mon profil','user']];
  const AGENCE = [['#/agency/dashboard','Tableau de bord','grid'],['#/manage/owners','Propriétaires','user'],['#/manage/mandates','Mandats','file'],['#/agency/properties','Biens','building'],['#/agency/clients','Clients','users'],['#/manage/units','Unités','layers'],['#/manage/tenants','Locataires','users'],['#/manage/rents','Loyers','money'],['#/manage/deals','Ventes','tag'],['#/manage/docs','Devis & Factures','card'],['#/manage/transfers','Reversements','trendUp'],['#/agency/commissions','Honoraires','wallet'],['#/coffre','Documents','file'],['#/agency/settings','Paramètres','settings']];
  const MENU_AGENT = [['#/agency/dashboard','Tableau de bord','grid'],['#/agency/properties','Mes biens','home'],['#/agency/visits','Mes visites','calendar'],['#/agency/clients','Mes clients','users'],['#/agency/messages','Messages','message'],['#/agent/commissions','Mes commissions','wallet'],['#/agent/profil','Mon profil','user']];
  const estAgent = u => !!(u && u.member && u.member.role === 'agent');
  const estMandant = u => !!(u && u.ownerRec);
  const MENUS_RAW = {};
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, enumerable: true, get() { const u = Auth.current(); if (estMandant(u)) return MENU_MANDANT; if (u && u.member) return MENU_OWNER_MEMBRE; return MENU_PRO; }});
  Object.defineProperty(MENUS_RAW, 'agency', {configurable: true, enumerable: true, get() { const u = Auth.current(); return estAgent(u) ? MENU_AGENT : AGENCE; }, set(v) {}});
  const BARRE_PRO = {owner: [['#/owner/dashboard','Accueil','grid'],['#/owner/properties','Mes biens','home'],['#/owner/property/new','Publier','plus','fab'],['#/manage','Gestion','briefcase'],['#/owner/messages','Messages','message']],
                     agency: [['#/agency/dashboard','Accueil','grid'],['#/agency/properties','Biens','home'],['#/owner/property/new','Publier','plus','fab'],['#/manage','Gestion','briefcase'],['#/agency/messages','Messages','message']]};
  const BARRE_AGENT = [['#/agency/dashboard','Accueil','grid'],['#/agency/properties','Mes biens','home'],['#/owner/property/new','Publier','plus','fab'],['#/agency/visits','Visites','calendar'],['#/agency/messages','Messages','message']];
  const BARRE_MANDANT = [['#/owner/dashboard','Accueil','grid'],['#/owner/properties','Biens confiés','home'],['#/mandant/releves','Relevés','money'],['#/coffre','Documents','file'],['#/owner/messages','Messages','message']];
  const PILL = {owner: [['#/owner/dashboard','#/owner/properties'],['#/owner/property/new','Publier','plus'],['#/manage','#/owner/messages']], agency: [['#/agency/dashboard','#/agency/properties'],['#/owner/property/new','Publier','plus'],['#/manage','#/agency/messages']]};
  const Auth = {current: () => U};
  const esc = s => String(s), badge = (t) => '[' + t + ']', icon = () => '', render = () => journal.push('render'), toast = (m, t) => journal.push('toast:' + m);
  const modal = (t, h) => journal.push('modal:' + t), closeModal = () => journal.push('closeModal');
  const document = {addEventListener: (t, f) => { H[t] = H[t] || []; H[t].push(f); }, getElementById: () => null};
  const H = {};
  const routes = [{re: /^\\/agency\\/settings$/, fn: () => '<div class="stack" style="gap:18px"><form class="card" data-action="save-agency-settings"></form></div>'}];
  let signalerErreur = function (e, c) { journal.push('ORIGINAL:' + c); };
  let messageErreur = e => e.message || 'erreur';
  let saveProperty = function (form, id, intent) { journal.push('saveProperty:' + intent + ':' + (cniManquantePourPublier(Auth.current()) ? 'BLOQUE' : 'OK')); };
  let cniManquantePourPublier = function () { return false; };
  const DB = {K: {users: 'users'}, erreurs: [], relu: 0, relire: async () => { DB.relu++; }, cniServeur: true, updateItem(k, id, p) { if (DB.cniServeur) U.cni = p.cni; }, attendre: async () => {}};
  ${src}
  `;
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.exp = {signaler: () => signalerErreur, MENUS_RAW, BARRE_PRO, BARRE_AGENT, BARRE_MANDANT, PILL, estAgent, estMandant, entreesBarre, H, routes, DB, saveProperty:()=>saveProperty, cni:()=>cniManquantePourPublier, journal};', ctx);
  return ctx;
}

let echecs = 0;
function verifier(nom, role, u) {
  const c = monde(); c.U = u; const x = c.exp;
  const menu = x.MENUS_RAW[role], hrefs = menu.map(m => m[0]);
  const barre = x.entreesBarre(u).map(b => b[0]);
  const manque = barre.filter(h => !hrefs.includes(h));
  const ok = manque.length === 0;
  if (!ok) echecs++;
  console.log((ok ? 'OK  ' : 'ECHEC') + ' ' + nom + '\n     barre   : ' + barre.join('  ') + '\n     menu    : ' + menu.map(m => m[1]).join(' | ') + (ok ? '' : '\n     MANQUE  : ' + manque.join(', ')));
  const doublons = hrefs.filter((h, i) => hrefs.indexOf(h) !== i); if (doublons.length) { echecs++; console.log('     DOUBLONS', doublons); }
}
verifier('Propriétaire (titulaire)', 'owner', {role: 'owner'});
verifier('Propriétaire (gestionnaire membre)', 'owner', {role: 'owner', member: {role: 'manager'}});
verifier('Propriétaire sous mandat (mandant)', 'owner', {role: 'owner', ownerRec: 'r1'});
verifier('Agence (titulaire)', 'agency', {role: 'agency'});
verifier('Agent de l\'agence', 'agency', {role: 'agency', member: {role: 'agent'}});

/* --- CNI --- */
function cni(nom, u, valeurs, serveurAccepte, attendu) {
  const c = monde(); c.U = u; const x = c.exp; x.DB.cniServeur = serveurAccepte;
  const blocage = x.cni()(u);
  const form = {valeurs, dataset: {action: 'cni-form'}, closest: s => s.includes('modal') ? {} : form, querySelector: s => s === '.err' ? (form.err = form.err || {textContent: ''}) : (form.btn = form.btn || {disabled: false})};
  const ev = {target: {closest: s => s.includes('cni-form') ? form : null}, preventDefault() {}, stopImmediatePropagation() {}};
  const h = x.H.submit; return Promise.all(h.map(f => f(ev))).then(() => {
    const j = x.journal.join(' / ');
    const sortie = `blocage=${blocage} cni=${u.cni || '-'} erreur="${(form.err && form.err.textContent) || ''}" journal=[${j}]`;
    const ok = attendu(u, form, j); if (!ok) echecs++;
    console.log((ok ? 'OK  ' : 'ECHEC') + ' CNI : ' + nom + '\n     ' + sortie);
  });
}
(async () => {
  await cni('12 chiffres refusés', {role: 'agency'}, {cni: '123456789012'}, true, (u, f) => !u.cni && /13 chiffres/.test(f.err.textContent));
  await cni('lettres refusées', {role: 'agency'}, {cni: '12345678901ab'}, true, (u, f) => !u.cni && /13 chiffres/.test(f.err.textContent));
  await cni('13 chiffres avec espaces acceptés', {role: 'agency'}, {cni: '1 234 567 890 123'}, true, (u, f, j) => u.cni === '1234567890123' && /closeModal/.test(j) && /toast:CNI enregistrée/.test(j));
  await cni('refus du serveur (déjà utilisée)', {role: 'agency'}, {cni: '1234567890123'}, false, (u, f, j) => !u.cni && /pas pu être enregistré/.test(f.err.textContent) && f.btn.disabled === false);
  // ouverture du formulaire à la publication
  const c = monde(); c.U = {role: 'agency'}; const x = c.exp;
  const r1 = x.cni()(c.U), r2 = x.cni()({role: 'agency', cni: '1234567890123'}), r3 = x.cni()({role: 'agency', member: {role: 'agent'}}), r4 = x.cni()({role: 'admin'});
  console.log((r1 && !r2 && r3 && !r4 && /modal:Renseignez votre CNI/.test(x.journal.join('|')) && /modal:CNI du titulaire/.test(x.journal.join('|')) ? 'OK  ' : 'ECHEC') + ' CNI : formulaire (titulaire) / message (agent) / aucun blocage (CNI présente, admin)\n     ' + x.journal.join(' | '));
  if (!(r1 && !r2 && r3 && !r4)) echecs++;
  // reprise de la publication
  const c2 = monde(); const u2 = {role: 'agency'}; c2.U = u2; const x2 = c2.exp;
  const form = {isConnected: true, valeurs: {}, dataset: {}};
  x2.saveProperty()(form, 'p1', 'publish');   // bloqué : modale ouverte
  const f2 = {valeurs: {cni: '1234567890123'}, closest: s => s.includes('modal') ? {} : f2, querySelector: s => s === '.err' ? {textContent: ''} : {disabled: false}};
  await Promise.all(x2.H.submit.map(f => f({target: {closest: s => s.includes('cni-form') ? f2 : null}, preventDefault() {}, stopImmediatePropagation() {}})));
  const j2 = x2.journal.join(' / ');
  const reprise = /saveProperty:publish:BLOQUE.*saveProperty:publish:OK/.test(j2);
  if (!reprise) echecs++;
  console.log((reprise ? 'OK  ' : 'ECHEC') + ' CNI : la publication reprend toute seule après enregistrement\n     ' + j2);
  // page Paramètres de l'agence
  const c3 = monde(); c3.U = {role: 'agency'}; const html = c3.exp.routes[0].fn();
  const okP = html.includes('data-action="cni-form"') && html.includes('#/manage/identity') && !html.includes('Plus tard') && html.indexOf('cni-form') < html.indexOf('save-agency-settings');
  const c4 = monde(); c4.U = {role: 'agency', cni: '1234567890123'}; const html4 = c4.exp.routes[0].fn();
  const okQ = html4.includes('Renseignée') && html4.includes('0123') && !html4.includes('cni-form');
  if (!okP || !okQ) echecs++;
  console.log((okP ? 'OK  ' : 'ECHEC') + ' Paramètres agence sans CNI : formulaire + lien identité\n' + (okQ ? 'OK  ' : 'ECHEC') + ' Paramètres agence avec CNI : « Renseignée » masquée (4 derniers chiffres)');

  // refus serveur avec doublon (23505) : message explicite
  const c5 = monde(); const u5 = {role: 'agency'}; c5.U = u5; const x5 = c5.exp; x5.DB.cniServeur = false;
  x5.cni()(u5); x5.DB.erreurs.push({t: Date.now(), contexte: 'profiles update', code: '23505', message: 'duplicate key'});
  const f5 = {valeurs: {cni: '1234567890123'}, closest: s => s.includes('modal') ? {} : f5, querySelector: s => s === '.err' ? (f5.err = f5.err || {textContent: ''}) : {disabled: false}};
  await Promise.all(x5.H.submit.map(f => f({target: {closest: s => s.includes('cni-form') ? f5 : null}, preventDefault() {}, stopImmediatePropagation() {}})));
  const ok5 = /déjà utilisé par un autre compte/.test(f5.err.textContent); if (!ok5) echecs++;
  console.log((ok5 ? 'OK  ' : 'ECHEC') + ' CNI : refus 23505 -> "' + f5.err.textContent + '"');
  // refus serveur d'une autre nature : la raison est affichée
  const c6 = monde(); const u6 = {role: 'agency'}; c6.U = u6; const x6 = c6.exp; x6.DB.cniServeur = false;
  x6.cni()(u6); x6.DB.erreurs.push({t: Date.now(), contexte: 'profiles update', code: '42501', message: 'Champs non modifiables : perms'});
  const f6 = {valeurs: {cni: '1234567890123'}, closest: s => s.includes('modal') ? {} : f6, querySelector: s => s === '.err' ? (f6.err = f6.err || {textContent: ''}) : {disabled: false}};
  await Promise.all(x6.H.submit.map(f => f({target: {closest: s => s.includes('cni-form') ? f6 : null}, preventDefault() {}, stopImmediatePropagation() {}})));
  const ok6 = /Champs non modifiables/.test(f6.err.textContent); if (!ok6) echecs++;
  console.log((ok6 ? 'OK  ' : 'ECHEC') + ' CNI : autre refus -> "' + f6.err.textContent + '"');
  // auto-correction : le site croit la CNI présente, la base refuse la publication
  const c7 = monde(); c7.U = {role: 'owner', cni: '1234567890123'}; const x7 = c7.exp;
  x7.signaler()({code: '42501', message: 'Renseignez un numéro de CNI dans « Mon profil » avant de publier une annonce.'}, 'properties insert');
  await new Promise(r => setImmediate(r));
  const j7 = x7.journal.join(' | ');
  const ok7 = x7.DB.relu === 1 && /toast:Votre CNI n'était pas enregistrée/.test(j7) && !/ORIGINAL/.test(j7);
  if (!ok7) echecs++;
  console.log((ok7 ? 'OK  ' : 'ECHEC') + ' CNI : affichée mais absente du serveur -> resynchronisation (relire=' + x7.DB.relu + ')\n     ' + j7);
  // autres erreurs : inchangées
  const c8 = monde(); c8.U = {role: 'owner', cni: '1234567890123'}; const x8 = c8.exp;
  x8.signaler()({code: '23505', message: 'doublon'}, 'properties insert'); x8.signaler()({code: '42501', message: 'Renseignez un numéro de CNI'}, 'visits insert');
  const ok8 = x8.DB.relu === 0 && (x8.journal.join('|').match(/ORIGINAL/g) || []).length === 2; if (!ok8) echecs++;
  console.log((ok8 ? 'OK  ' : 'ECHEC') + ' Erreurs non liées à la CNI : traitement habituel conservé');
  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTOUS LES TESTS PASSENT');
  process.exit(echecs ? 1 : 0);
})();
