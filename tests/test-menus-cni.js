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
  const location = {hash: '#/owner/dashboard'};
  const permFor = h => /property|properties/.test(h) ? 'biens' : /manage/.test(h) ? 'gestion' : /messages/.test(h) ? 'messages' : null;
  const memberCan = (u, p) => !p || (u.member.perms || []).includes(p);
  const MENUS = new Proxy(MENUS_RAW, {get(t, k) { const m = t[k]; const u = Auth.current(); return u && u.member && Array.isArray(m) ? m.filter(([h]) => memberCan(u, permFor(h.slice(1)))) : m; }});
  /* Barre du bas : même aiguillage que l'application (91-agent, 94 mandant, 75 BARRE_PRO, 38 PILL). */
  function tabBarHtml(u) {
    const lien = ([h, l, ic, fab]) => fab ? '<a class="tab-fab" href="' + h + '"><i>svg</i><span>' + l + '</span></a>' : '<a href="' + h + '" class="tab-item">svg<span>' + l + '</span></a>';
    if (estAgent(u)) return '<nav class="tabbar">' + BARRE_AGENT.filter(([h]) => memberCan(u, permFor(h.slice(1)))).map(lien).join('') + '</nav>';
    if (estMandant(u)) return '<nav class="tabbar">' + BARRE_MANDANT.map(lien).join('') + '</nav>';
    if (!u.member && BARRE_PRO[u.role]) return '<nav class="tabbar">' + BARRE_PRO[u.role].map(lien).join('') + '</nav>';
    const menu = MENUS[u.role], cfg = PILL[u.role], has = h => menu.find(m => m[0] === h);
    const item = h => { const m = has(h); return m ? lien([h, m[1], m[2]]) : ''; };
    return '<nav class="tabbar">' + cfg[0].map(item).join('') + lien([cfg[1][0], cfg[1][1], cfg[1][2], 'fab']) + cfg[2].map(item).join('') + '</nav>';
  }
  let shellApp = function (u, content) {
    return '<div class="app"><aside class="side" id="sidebar"><a class="logo"></a><nav>' + MENUS[u.role].map(([h, l, i]) => '<a href="' + h + '" class=""><span class="ico">' + i + '</span>' + l + '</a>').join('') + '</nav><div class="side-user"></div></aside><div class="main">' + content + '</div></div>';
  };
  const esc = s => String(s), badge = t => '[' + t + ']', icon = (n) => '<svg data-i="' + n + '"></svg>';
  const render = () => journal.push('render'), toast = (m, t) => journal.push('toast:' + m);
  let modaleOuverte = null;
  let dernierHtml = '';
  const modal = (t, h) => { modaleOuverte = t; dernierHtml = h || ''; journal.push('modal:' + t); }, closeModal = () => { modaleOuverte = null; journal.push('closeModal'); };
  const DEUKSIL_CONFIG = {siteUrl: 'https://deuksil.vercel.app'};
  let fonction = async function (nom) { const e = ${JSON.stringify(opts.erreurFonction || '')}; if (e) throw new Error(e); return {ok: 1}; };
  let compteMandant = async function () { return {id: 'mandant1'}; };
  const H = {};
  const document = {addEventListener: (t, f) => { (H[t] = H[t] || []).push(f); }, getElementById: () => null, querySelector: () => null, querySelectorAll: () => []};
  const routes = [{re: /^\\/agency\\/settings$/, fn: () => '<div class="stack" style="gap:18px"><form class="card" data-action="save-agency-settings"></form></div>'}];
  let signalerErreur = function (e, c) { DB.erreurs.push({t: Date.now(), contexte: c, code: e && e.code, message: e && e.message}); journal.push('ORIGINAL:' + c + ':' + (e && e.message)); };   /* comme js/03-storage.js */
  let messageErreur = e => e.message || 'erreur';
  const notify = (id, t) => journal.push('notify:' + id);
  const ownsProperty = (id, u) => !!DB.biens[id];
  /* Serveur simulé : cniServeur = la CNI est-elle acceptée ? publication = refusée si pas de CNI côté serveur. */
  const DB = {K: {users: 'users', properties: 'properties', owners: 'owners'}, erreurs: [], relu: 0, biens: {p1: {id: 'p1', title: 'Villa', listingStatus: 'brouillon'}},
    serveurCni: ${JSON.stringify(opts.serveurCni === undefined ? null : opts.serveurCni)}, cniAccepte: ${opts.cniAccepte === false ? 'false' : 'true'}, codeRefus: ${JSON.stringify(opts.codeRefus || '23505')},
    file: [],
    updateItem(k, id, p) {
      if (k === 'users') { const avant = U.cni; U.cni = p.cni; this.file.push(() => { if (!this.cniAccepte) { U.cni = avant; signalerErreur({code: this.codeRefus, message: 'duplicate key value'}, 'profiles update'); } else this.serveurCni = p.cni; }); }
      if (k === 'properties') { const b = this.biens[id], avant = b.listingStatus; Object.assign(b, p); this.file.push(() => { if (p.listingStatus === 'publiee' && !this.serveurCni) { b.listingStatus = avant; signalerErreur({code: '42501', message: 'CNI manquante : renseignez votre numéro de CNI (13 chiffres) dans Paramètres avant de publier une annonce.'}, 'properties update'); } }); }
    },
    findItem(k, id) { return this.biens[id]; },
    async attendre() { while (this.file.length) this.file.shift()(); },
    async relire(k) { this.relu++; this.relus = (this.relus || []).concat(k); if (k === 'users') U.cni = this.serveurCni || undefined; }};
  /* Chaîne de publication réelle : 27 (vérifie la CNI) <- 63 (récapitulatif, puis ferme les fenêtres). */
  let cniManquantePourPublier = function () { return false; };
  let saveProperty = function (form, id, intent) { journal.push('saveProperty27:' + intent + ':' + (cniManquantePourPublier(Auth.current()) ? 'BLOQUE' : 'OK')); };
  (() => { const _27 = saveProperty; saveProperty = function (form, id, intent) {
    if (intent !== 'publish') return _27(form, id, intent);
    modal('Publier cette annonce ?'); journal.push('recap');
    if (${opts.confirmerRecap === false ? 'false' : 'true'}) { _27(form, id, 'publish'); closeModal(); }
  }; })();
  ${src}
  this.exp = {montrer: () => montrerMotDePasseProvisoire, fonction: () => fonction, compteMandant: () => compteMandant, html: () => dernierHtml, MENUS_RAW, MENUS, shellApp: () => shellApp, tabBarHtml, entreesBarre, H, routes, DB, flush, journal, modale: () => modaleOuverte,
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
  /* ---------- 1. Menus : sur ordinateur, le menu latéral contient toute la barre du bas ; le téléphone ne change pas ---------- */
  const COMPTES = [['Propriétaire (titulaire)', 'owner', {role: 'owner'}], ['Propriétaire (gestionnaire, droits biens+messages)', 'owner', {role: 'owner', member: {role: 'manager', perms: ['biens', 'messages']}}],
    ['Propriétaire (gestionnaire, sans droit biens)', 'owner', {role: 'owner', member: {role: 'manager', perms: ['messages']}}],
    ['Propriétaire sous mandat', 'owner', {role: 'owner', ownerRec: 'r1'}], ['Agence (titulaire)', 'agency', {role: 'agency'}], ['Agent', 'agency', {role: 'agency', member: {role: 'agent', perms: ['biens', 'visites', 'messages']}}]];
  const AVANT = {owner: ['#/owner/dashboard','#/owner/properties','#/manage/leases','#/manage/rents','#/manage/deals','#/manage/tickets','#/manage/finance','#/coffre','#/owner/messages','#/owner/profile']};
  for (const [nom, role, u] of COMPTES) {
    const x = monde(u);
    const html = x.shellApp()(u, 'contenu'), nav = html.slice(html.indexOf('<nav>'), html.indexOf('</nav>'));
    const lateral = [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const barre = [...x.tabBarHtml(u).matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const manque = barre.filter(h => !lateral.includes(h) && !(u.member && !(u.member.perms || []).includes('biens') && /property/.test(h)));
    const doublons = lateral.filter((h, i) => lateral.indexOf(h) !== i);
    ok(!manque.length && !doublons.length, 'Ordinateur - ' + nom + ' : la barre du bas est dans le menu latéral', 'manque : ' + manque + ' | doublons : ' + doublons + ' | menu : ' + lateral.join(' '));
    /* Téléphone : la liste du tiroir (MENUS) ne reçoit pas les entrées de la barre. */
    const tiroir = x.MENUS[role].map(m => m[0]);
    ok(!tiroir.includes('#/owner/property/new') && (role !== 'owner' || u.member || u.ownerRec || JSON.stringify(tiroir) === JSON.stringify(AVANT.owner)), 'Téléphone - ' + nom + ' : tiroir inchangé (pas de doublon de la barre)', tiroir.join(' '));
  }
  { const u = {role: 'owner', member: {role: 'manager', perms: ['messages']}}, x = monde(u), html = x.shellApp()(u, '');
    ok(!/href="#\/owner\/property\/new"[^>]*data-barre/.test(html), 'Ordinateur - gestionnaire sans droit « biens » : pas de « Publier un bien » ajouté'); }
  { const u = {role: 'owner'}, x = monde(u), html = x.shellApp()(u, ''), nav = html.slice(html.indexOf('<nav>'), html.indexOf('</nav>'));
    const ordre = [...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    ok(ordre.indexOf('#/owner/property/new') === ordre.indexOf('#/owner/properties') + 1 && ordre.indexOf('#/manage') === ordre.indexOf('#/owner/profile') - 1 && /Publier un bien/.test(nav) && /data-i="plus"/.test(nav), 'Ordinateur - « Publier un bien » après Mes biens, « Gestion » avant Paramètres, avec icônes', ordre.join(' ')); }
  { const u = {role: 'agency'}, x = monde(u), html = x.shellApp()(u, ''), nav = html.slice(html.indexOf('<nav>'), html.indexOf('</nav>'));
    const libs = [...nav.matchAll(/<\/span>([^<]+)<\/a>/g)].map(m => m[1]).join(' | ');
    ok(/Biens \| Publier un bien \| Clients \| Visites \| Équipe/.test(libs) && /Documents \| Gestion \| Messages \| Paramètres$/.test(libs), 'Ordinateur - agence : ordre du menu (Publier après Biens ; Gestion puis Messages avant Paramètres, comme la barre)', libs); }
  { const x = monde({role: 'agency'}), m = x.MENUS.agency.map(e => e[1]);
    ok(m.includes('Équipe') && m.includes('Visites') && !m.includes('Publier un bien'), 'Agence : Équipe et Visites dans le menu (ordinateur et téléphone), sans doublon de la barre'); }

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

  /* ---------- 6. Comptes ouverts par un tiers ---------- */
  { const x = monde({role: 'agency'});
    x.montrer()({firstName: 'Moussa', lastName: 'Ndiaye', email: 'moussa@agence.sn', phone: '77 123 45 67', role: 'agent'}, 'Abcd-Efgh-Ij7');
    const h = x.html();
    ok(x.modale() === 'Accès créé : identifiants à transmettre' && h.includes('moussa@agence.sn') && h.includes('Abcd-Efgh-Ij7') && h.includes('https://deuksil.vercel.app/#/login')
      && h.includes('https://wa.me/221771234567?text=') && h.includes('mailto:moussa%40agence.sn') && h.includes('(agent)'), 'Agent créé : fiche d\'identifiants (adresse, identifiant, mot de passe, WhatsApp, e-mail)', h.slice(0, 300)); }
  { const x = monde({role: 'agency'});
    x.montrer()({firstName: 'Awa', email: 'awa@mail.sn', phone: '', ownerRec: 'f1', mandantOf: 'a1', role: 'owner'}, 'Zz12-Yy34-Xx7');
    ok(x.html().includes('(propriétaire)') && x.html().includes('https://wa.me/?text='), 'Mandant créé : rôle « propriétaire », WhatsApp sans numéro'); }
  { const x = monde({role: 'owner'}); x.montrer()({firstName: 'Fall', email: 'fall@mail.sn', role: 'tenant', phone: '221781112233'}, 'Pp99-Qq88-Rr7');
    ok(x.html().includes('(locataire)') && x.html().includes('wa.me/221781112233'), 'Locataire créé : rôle « locataire », numéro déjà au format 221'); }
  for (const [nom, err, motif] of [['non déployée', 'Requested function was not found', /n'est pas déployée.*supabase functions deploy gerer-acces/], ['injoignable', 'Failed to send a request to the Edge Function', /injoignable.*DEUKSIL_ORIGINES/]]) {
    const x = monde({role: 'agency'}, {erreurFonction: err}); let m = '';
    try { await x.fonction()('gerer-acces', {}); } catch (e) { m = e.message + '|' + e.code; }
    ok(motif.test(m) && /\|P0001$/.test(m), 'Fonction serveur ' + nom + ' : message clair', m);
  }
  { const x = monde({role: 'agency'}, {erreurFonction: 'Un compte existe déjà avec cette adresse e-mail.'}); let m = '';
    try { await x.fonction()('gerer-acces', {}); } catch (e) { m = e.message; }
    ok(m === 'Un compte existe déjà avec cette adresse e-mail.', 'Refus métier de la fonction (e-mail déjà utilisé) : message d\'origine conservé', m); }
  { const x = monde({role: 'agency'}); const r = await x.compteMandant()({id: 'f1'}, 'a@b.sn');
    ok(r && JSON.stringify(x.DB.relus) === '["owners"]' && x.journal.includes('render'), 'Mandant : fiche relue et écran actualisé après l\'ouverture de l\'accès', JSON.stringify(x.DB.relus)); }

  console.log(echecs ? `\n${echecs} ÉCHEC(S)` : '\nTOUS LES TESTS PASSENT');
  process.exit(echecs ? 1 : 0);
})();
