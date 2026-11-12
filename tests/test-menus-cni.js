/* Banc d'essai de js/99n-menus-cni.js (menus alignés sur la barre du bas, CNI).
   Simule l'application autour du module : menus, barres, minuteries, mémoire des
   biens et des comptes, réponses du serveur, récapitulatif de publication qui ferme
   les fenêtres (js/63-publication.js). Usage : node tests/test-menus-cni.js */
const vm = require('vm'), fs = require('fs');
const src = fs.readFileSync(process.argv[2] || 'js/99n-menus-cni.js', 'utf8');

function monde(u, opts = {}) {
  const ctx = {console, U: u, journal: [], FormData: class { constructor(f) { this.f = f; } get(n) { return this.f.valeurs[n]; } }};
  const code = `
  const minuteries = [];
  const setTimeout = (f) => { minuteries.push(f); return minuteries.length; };
  async function flush() { for (let i = 0; i < 50 && minuteries.length; i++) { const f = minuteries.shift(); await f(); } }
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
  const esc = s => String(s), badge = t => '[' + t + ']', icon = () => '';
  const render = () => journal.push('render'), toast = (m, t) => journal.push('toast:' + m);
  let modaleOuverte = null;
  const modal = (t) => { modaleOuverte = t; journal.push('modal:' + t); }, closeModal = () => { modaleOuverte = null; journal.push('closeModal'); };
  const H = {};
  const document = {addEventListener: (t, f) => { (H[t] = H[t] || []).push(f); }, getElementById: () => null};
  const routes = [{re: /^\\/agency\\/settings$/, fn: () => '<div class="stack" style="gap:18px"><form class="card" data-action="save-agency-settings"></form></div>'}];
  let signalerErreur = function (e, c) { DB.erreurs.push({t: Date.now(), contexte: c, code: e && e.code, message: e && e.message}); journal.push('ORIGINAL:' + c + ':' + (e && e.message)); };   /* comme js/03-storage.js */
  let messageErreur = e => e.message || 'erreur';
  const notify = (id, t) => journal.push('notify:' + id);
  const ownsProperty = (id, u) => !!DB.biens[id];
  /* Serveur simulé : cniServeur = la CNI est-elle acceptée ? publication = refusée si pas de CNI côté serveur. */
  const DB = {K: {users: 'users', properties: 'properties'}, erreurs: [], relu: 0, biens: {p1: {id: 'p1', title: 'Villa', listingStatus: 'brouillon'}},
    serveurCni: ${JSON.stringify(opts.serveurCni === undefined ? null : opts.serveurCni)}, cniAccepte: ${opts.cniAccepte === false ? 'false' : 'true'}, codeRefus: ${JSON.stringify(opts.codeRefus || '23505')},
    file: [],
    updateItem(k, id, p) {
      if (k === 'users') { const avant = U.cni; U.cni = p.cni; this.file.push(() => { if (!this.cniAccepte) { U.cni = avant; signalerErreur({code: this.codeRefus, message: 'duplicate key value'}, 'profiles update'); } else this.serveurCni = p.cni; }); }
      if (k === 'properties') { const b = this.biens[id], avant = b.listingStatus; Object.assign(b, p); this.file.push(() => { if (p.listingStatus === 'publiee' && !this.serveurCni) { b.listingStatus = avant; signalerErreur({code: '42501', message: 'CNI manquante : renseignez votre numéro de CNI (13 chiffres) dans Paramètres avant de publier une annonce.'}, 'properties update'); } }); }
    },
    findItem(k, id) { return this.biens[id]; },
    async attendre() { while (this.file.length) this.file.shift()(); },
    async relire(k) { this.relu++; if (k === 'users') U.cni = this.serveurCni || undefined; }};
  /* Chaîne de publication réelle : 27 (vérifie la CNI) <- 63 (récapitulatif, puis ferme les fenêtres). */
  let cniManquantePourPublier = function () { return false; };
  let saveProperty = function (form, id, intent) { journal.push('saveProperty27:' + intent + ':' + (cniManquantePourPublier(Auth.current()) ? 'BLOQUE' : 'OK')); };
  (() => { const _27 = saveProperty; saveProperty = function (form, id, intent) {
    if (intent !== 'publish') return _27(form, id, intent);
    modal('Publier cette annonce ?'); journal.push('recap');
    if (${opts.confirmerRecap === false ? 'false' : 'true'}) { _27(form, id, 'publish'); closeModal(); }
  }; })();
  ${src}
  this.exp = {MENUS_RAW, entreesBarre, H, routes, DB, flush, journal, modale: () => modaleOuverte,
    saveProperty: () => saveProperty, cni: () => cniManquantePourPublier, signaler: () => signalerErreur};
  `;
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx.exp;
}

let echecs = 0;
const ok = (cond, nom, detail) => { if (!cond) echecs++; console.log((cond ? 'OK   ' : 'ECHEC') + ' ' + nom + (detail && !cond ? '\n      ' + detail : '')); };
const formCni = (valeurs) => { const f = {valeurs, err: {textContent: ''}, btn: {disabled: false}}; f.closest = s => (s.includes('modal') ? {} : (s.includes('cni-form') ? f : null)); f.querySelector = s => (s === '.err' ? f.err : f.btn); return f; };
async function soumettre(x, f) { for (const h of x.H.submit) await h({target: {closest: s => f.closest(s)}, preventDefault() {}, stopImmediatePropagation() {}}); }
function cliquerPublier(x, id) { let stop = false; const ev = {target: {closest: s => (s.includes('publish') ? {dataset: {id}} : null)}, preventDefault() {}, stopImmediatePropagation() { stop = true; }}; for (const h of x.H.click) { h(ev); if (stop) break; } return stop; }

(async () => {
  /* ---------- 1. Menus : la barre du bas figure dans le menu latéral ---------- */
  for (const [nom, role, u] of [['Propriétaire (titulaire)', 'owner', {role: 'owner'}], ['Propriétaire (gestionnaire membre)', 'owner', {role: 'owner', member: {role: 'manager'}}],
    ['Propriétaire sous mandat', 'owner', {role: 'owner', ownerRec: 'r1'}], ['Agence (titulaire)', 'agency', {role: 'agency'}], ['Agent', 'agency', {role: 'agency', member: {role: 'agent'}}]]) {
    const x = monde(u), menu = x.MENUS_RAW[role].map(m => m[0]), barre = x.entreesBarre(u).map(b => b[0]);
    const manque = barre.filter(h => !menu.includes(h)), doublons = menu.filter((h, i) => menu.indexOf(h) !== i);
    ok(!manque.length && !doublons.length, 'Menu ' + nom + ' contient toute la barre du bas', 'manque : ' + manque + ' doublons : ' + doublons);
  }
  { const x = monde({role: 'agency'}), m = x.MENUS_RAW.agency.map(e => e[1]);
    ok(m.includes('Équipe') && m.includes('Visites') && m.includes('Publier un bien'), 'Agence : Équipe, Visites et Publier un bien dans le menu'); }

  /* ---------- 2. Formulaire du bien : la CNI est demandée AVANT le récapitulatif ---------- */
  { const x = monde({role: 'owner'}), form = {isConnected: true};
    x.saveProperty()(form, null, 'publish'); await x.flush();
    ok(x.modale() === 'Renseignez votre CNI pour publier' && !x.journal.includes('recap'), 'Publier sans CNI : formulaire CNI ouvert, pas de récapitulatif', x.journal.join(' | '));
    await soumettre(x, formCni({cni: '1234567890123'})); await x.flush();
    const j = x.journal.join(' | ');
    ok(/toast:CNI enregistrée.*recap.*saveProperty27:publish:OK/.test(j) && !/BLOQUE/.test(j), 'Après la CNI : récapitulatif puis publication', j); }
  { /* Garde-fou : si la vérification arrive tout de même dans 27 (appel direct), la fenêtre survit au closeModal du récapitulatif. */
    const x = monde({role: 'owner'});
    x.cni()(x.journal && {role: 'owner'}); x.journal.push('closeModal-par-63'); await x.flush();
    ok(x.modale() === 'Renseignez votre CNI pour publier', 'La fenêtre CNI n\'est pas refermée par un appelant qui ferme les fenêtres'); }
  { const x = monde({role: 'owner', cni: '1234567890123'}, {serveurCni: '1234567890123'});
    x.saveProperty()({isConnected: true}, null, 'publish'); await x.flush();
    ok(/recap.*saveProperty27:publish:OK/.test(x.journal.join('|')) && !x.journal.some(l => l.startsWith('modal:Renseignez')), 'Avec CNI : publication directe (récapitulatif seulement)'); }
  { const x = monde({role: 'agency', member: {role: 'agent'}});
    x.saveProperty()({isConnected: true}, null, 'publish'); await x.flush();
    ok(x.modale() === 'CNI du titulaire à renseigner' && !x.journal.includes('recap'), 'Agent, agence sans CNI : message pour le titulaire'); }
  { const x = monde({role: 'admin'}); ok(x.cni()({role: 'admin'}) === false, 'Administrateur : jamais bloqué'); }

  /* ---------- 3. Saisie de la CNI : contrôles et refus du serveur ---------- */
  for (const [nom, val, cond] of [['12 chiffres refusés', '123456789012', f => /13 chiffres/.test(f.err.textContent)], ['Lettres refusées', '12345678901ab', f => /13 chiffres/.test(f.err.textContent)]]) {
    const x = monde({role: 'agency'}), f = formCni({cni: val}); await soumettre(x, f); ok(cond(f) && !x.DB.serveurCni, 'CNI : ' + nom, f.err.textContent);
  }
  { const x = monde({role: 'agency'}), f = formCni({cni: '1 234 567 890 123'}); await soumettre(x, f); await x.flush();
    ok(x.DB.serveurCni === '1234567890123' && x.journal.includes('toast:CNI enregistrée.'), 'CNI : 13 chiffres avec espaces acceptés'); }
  { const x = monde({role: 'agency'}, {cniAccepte: false, codeRefus: '23505'}), f = formCni({cni: '1234567890123'}); await soumettre(x, f);
    ok(/déjà utilisé par un autre compte/.test(f.err.textContent) && f.btn.disabled === false && !x.journal.includes('toast:CNI enregistrée.'), 'CNI déjà utilisée : message clair, bouton réactivé', f.err.textContent); }
  { const x = monde({role: 'agency'}, {cniAccepte: false, codeRefus: '42501'}), f = formCni({cni: '1234567890123'}); await soumettre(x, f);
    ok(/pas pu être enregistré/.test(f.err.textContent), 'Autre refus du serveur : raison affichée', f.err.textContent); }

  /* ---------- 4. Bouton « Publier » d'une carte : succès annoncé après le serveur ---------- */
  { const x = monde({role: 'owner'}); const stop = cliquerPublier(x, 'p1'); await x.flush();
    ok(stop && x.DB.biens.p1.listingStatus === 'brouillon' && x.modale() === 'Renseignez votre CNI pour publier', 'Carte, sans CNI : formulaire, rien n\'est envoyé'); }
  { const x = monde({role: 'owner', cni: '1234567890123'}, {serveurCni: '1234567890123'}); cliquerPublier(x, 'p1'); await x.flush();
    ok(x.DB.biens.p1.listingStatus === 'publiee' && x.journal.includes('toast:Annonce publiée : elle est visible dans la recherche.') && x.journal.includes('notify:user_admin'), 'Carte, avec CNI acceptée : publiée, puis succès annoncé'); }
  { const x = monde({role: 'owner', cni: '1234567890123'}, {serveurCni: null}); cliquerPublier(x, 'p1'); await x.flush();
    const j = x.journal.join(' | ');
    ok(x.DB.biens.p1.listingStatus === 'brouillon' && !/Annonce publiée/.test(j) && x.DB.relu === 1 && /n'était pas enregistrée sur le serveur/.test(j), 'Carte, CNI affichée mais absente du serveur : aucun faux succès, resynchronisation', j); }
  { const x = monde({role: 'owner'}); cliquerPublier(x, 'p1'); await x.flush();
    x.DB.serveurCni = null; await soumettre(x, formCni({cni: '1234567890123'})); await x.flush();
    ok(x.DB.biens.p1.listingStatus === 'publiee', 'Carte : la publication reprend après la saisie de la CNI', x.journal.join(' | ')); }

  /* ---------- 5. Erreurs et Paramètres ---------- */
  { const x = monde({role: 'owner'}); x.signaler()({code: '23505', message: 'duplicate key'}, 'profiles update');
    ok(/ORIGINAL:profiles update:Ce numéro de CNI est déjà utilisé/.test(x.journal.join('|')), 'Doublon sur le profil : message clair (même sans migration)'); }
  { const x = monde({role: 'owner'}); x.signaler()({code: '23505', message: 'doublon'}, 'properties insert'); x.signaler()({code: '42501', message: 'CNI manquante'}, 'visits insert');
    ok(x.DB.relu === 0 && (x.journal.join('|').match(/ORIGINAL/g) || []).length === 2, 'Erreurs sans rapport : traitement habituel conservé'); }
  { const x = monde({role: 'agency'}), h = x.routes[0].fn();
    ok(h.includes('data-action="cni-form"') && h.includes('#/manage/identity') && !h.includes('Plus tard'), 'Paramètres agence sans CNI : formulaire et lien « Mes informations »'); }
  { const x = monde({role: 'agency', cni: '1234567890123'}), h = x.routes[0].fn();
    ok(h.includes('Renseignée') && h.includes('0123') && !h.includes('cni-form') && !h.includes('1234567890123'), 'Paramètres agence avec CNI : masquée (4 derniers chiffres)'); }
  { /* « Mon profil » : CNI refusée par le serveur -> fenêtre d'explication. */
    const x = monde({role: 'owner'}, {cniAccepte: false});
    const champ = {value: '1234567890123'}, f = {closest: s => (s.includes('save-profile') ? f : null), querySelector: () => champ};
    x.DB.updateItem('users', 'moi', {cni: '1234567890123'});
    for (const h of x.H.submit) await h({target: {closest: s => f.closest(s)}, preventDefault() {}, stopImmediatePropagation() {}});
    await x.flush();
    ok(x.modale() === 'CNI non enregistrée' && /déjà utilisé/.test(x.journal.join('|')), 'Mon profil : CNI refusée -> fenêtre « CNI non enregistrée »', x.journal.join(' | ')); }
  { const x = monde({role: 'owner'}, {cniAccepte: true});
    const champ = {value: '1234567890123'}, f = {closest: s => (s.includes('save-profile') ? f : null), querySelector: () => champ};
    x.DB.updateItem('users', 'moi', {cni: '1234567890123'});
    for (const h of x.H.submit) await h({target: {closest: s => f.closest(s)}, preventDefault() {}, stopImmediatePropagation() {}});
    await x.flush();
    ok(x.modale() === null, 'Mon profil : CNI acceptée -> aucune fenêtre'); }

  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTOUS LES TESTS PASSENT');
  process.exit(echecs ? 1 : 0);
})();
