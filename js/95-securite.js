/* ==========================================================================
   MODULE : securite.js — partie 4 : ce qui peut être renforcé sans serveur.
     S1. Mots de passe : jamais stockés en clair (empreinte salée et
         répétée), comptes existants convertis au chargement.
     S2. Connexion : un seul message d'erreur (on ne révèle pas si un compte
         existe) et pause de 5 min après 5 essais manqués.
     S3. Admin : détection des comptes en double (CNI ou téléphone) et
         rapprochement prudent : rien n'est supprimé.
     S4. Comptes de démonstration marqués « Démo » dans l'administration.
   Limite : tout reste dans le navigateur. Un vrai serveur devra reprendre
   ces règles (voir AUDIT.md §4 et §7).
   ========================================================================== */

/* --- SHA-256 (synchrone, sans dépendance) ---------------------------------- */
function sha256(texte) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const octets = new TextEncoder().encode(texte), l = octets.length;
  const n = (((l + 9) >> 6) + 1) << 4, w = new Uint32Array(n);
  for (let i = 0; i < l; i++) w[i >> 2] |= octets[i] << (24 - (i % 4) * 8);
  w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[n - 1] = l * 8;
  let [a0, b0, c0, d0, e0, f0, g0, h0] = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
  const r = (x, k) => (x >>> k) | (x << (32 - k)), m = new Uint32Array(64);
  for (let i = 0; i < n; i += 16) {
    for (let t = 0; t < 64; t++) m[t] = t < 16 ? w[i + t] : (r(m[t - 2], 17) ^ r(m[t - 2], 19) ^ (m[t - 2] >>> 10)) + m[t - 7] + (r(m[t - 15], 7) ^ r(m[t - 15], 18) ^ (m[t - 15] >>> 3)) + m[t - 16];
    let [a, b, c, d, e, f, g, h] = [a0, b0, c0, d0, e0, f0, g0, h0];
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + m[t]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0; e0 = (e0 + e) | 0; f0 = (f0 + f) | 0; g0 = (g0 + g) | 0; h0 = (h0 + h) | 0;
  }
  return [a0, b0, c0, d0, e0, f0, g0, h0].map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* --- S1. Empreinte salée et répétée ---------------------------------------- */
const PW_TOURS = 1500;
function empreinte(mdp, sel) { let h = sel + ':' + String(mdp); for (let i = 0; i < PW_TOURS; i++) h = sha256(sel + h); return 'v1$' + sel + '$' + h; }
function nouveauSel() { const a = new Uint8Array(12); (crypto || window.msCrypto).getRandomValues(a); return [...a].map(x => x.toString(16).padStart(2, '0')).join(''); }
function verifierMotDePasse(u, mdp) {
  if (!u) return false;
  if (u.pwHash) { const [, sel] = u.pwHash.split('$'); return empreinte(mdp, sel) === u.pwHash; }
  return typeof u.password === 'string' && u.password === mdp;   // compte pas encore converti
}
const MDP_DEMO = ['demo123', 'admin123'];
function proteger(u) {
  if (!u || typeof u.password !== 'string') return u;
  const {password, ...reste} = u;
  return {...reste, pwHash: empreinte(password, nouveauSel()), ...(MDP_DEMO.includes(password) && !('demo' in u) ? {demo: true} : {})};
}
/* Toute écriture d'un mot de passe passe par l'empreinte. */
const _addItemMdp = DB.addItem;
DB.addItem = function (k, item) { return _addItemMdp.call(DB, k, k === DB.K.users ? proteger(item) : item); };
const _updateMdp = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  if (k === DB.K.users && patch && typeof patch.password === 'string') {
    const {password, ...reste} = patch;
    patch = {...reste, pwHash: empreinte(password, nouveauSel()), pwChangeLe: now()};
    const r = _updateMdp.call(DB, k, id, patch);
    /* L'ancien champ en clair disparaît aussi de la fiche enregistrée. */
    const l = DB.getData(k), i = l.findIndex(x => x.id === id); if (i >= 0 && 'password' in l[i]) { delete l[i].password; DB.setData(k, l); }
    return r;
  }
  return _updateMdp.call(DB, k, id, patch);
};
/* Les comptes déjà enregistrés (jeu de démonstration, anciens comptes). */
function convertirMotsDePasse() {
  const l = DB.getData(DB.K.users); let n = 0;
  const out = l.map(u => { if (typeof u.password === 'string') { n++; return proteger(u); } return u; });
  if (n) DB.setData(DB.K.users, out);
  return n;
}
convertirMotsDePasse();
[300, 1500, 4000, 8000].forEach(t => setTimeout(() => { try { convertirMotsDePasse(); } catch (e) {} }, t));

/* --- S2. Connexion : un seul message, essais limités ----------------------- */
const ESSAIS_MAX = 5, PAUSE_MIN = 5, CLE_ESSAIS = 'deuksil_essais';
const essais = () => { try { return JSON.parse(localStorage.getItem(CLE_ESSAIS)) || {}; } catch (e) { return {}; } };
const noterEssais = o => { try { localStorage.setItem(CLE_ESSAIS, JSON.stringify(o)); } catch (e) {} };
Auth.login = function (identifiant, mdp) {
  const v = String(identifiant || '').trim().toLowerCase(), E = essais(), e = E[v] || {n: 0, jusqua: 0};
  if (e.jusqua > Date.now()) return {error: `Trop d'essais manqués. Réessayez dans ${Math.ceil((e.jusqua - Date.now()) / 60000)} min.`};
  const u = DB.findItem(DB.K.users, x => x.cni === v || String(x.email || '').toLowerCase() === v);
  if (!u || !verifierMotDePasse(u, mdp)) {
    e.n = (e.n || 0) + 1;
    if (e.n >= ESSAIS_MAX) { e.jusqua = Date.now() + PAUSE_MIN * 60000; e.n = 0; }
    E[v] = e; noterEssais(E);
    return {error: e.jusqua > Date.now() ? `Trop d'essais manqués. Réessayez dans ${PAUSE_MIN} min.` : 'Identifiant ou mot de passe incorrect.'};
  }
  delete E[v]; noterEssais(E);
  if (u.status === 'suspendu') return {error: 'Compte suspendu. Contactez le support DEUKSIL.'};
  if (typeof u.password === 'string') DB.updateItem(DB.K.users, u.id, {password: u.password});   // conversion au passage
  try { resetSessionUiState(); } catch (err) {}
  localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()}));
  return {user: DB.findItem(DB.K.users, u.id)};
};

/* --- S3. Doublons : repérer, vérifier, rapprocher sans rien supprimer ------
   Une même CNI sur deux comptes est une correspondance fiable ; un même
   téléphone est un indice, à vérifier. Rapprocher = choisir le compte à
   garder ; l'autre est suspendu et relié au premier (doublonDe), ses données
   restent intactes et la décision est journalisée. */
const tel9s = x => String(x || '').replace(/\D/g, '').slice(-9);
function groupesDoublons() {
  const U = DB.getData(DB.K.users).filter(u => u.role !== 'admin' && !u.doublonDe && !u.parentId);
  const par = (cle, sorte) => Object.values(U.reduce((a, u) => { const k = cle(u); if (k) (a[k] = a[k] || []).push(u); return a; }, {})).filter(g => g.length > 1).map(g => ({sorte, comptes: g}));
  const cni = par(u => /^\d{13}$/.test(u.cni || '') ? u.cni : '', 'cni');
  const vus = new Set(cni.flatMap(g => g.comptes.map(u => u.id)));
  const tel = par(u => tel9s(u.phone).length === 9 && !vus.has(u.id) ? tel9s(u.phone) : '', 'tel');
  return [...cni, ...tel];
}
function poidsCompte(u) {
  const n = k => DB.filterItems(DB.K[k] || 'x', x => x.ownerId === u.id).length;
  return `${n('properties')} bien(s) · ${n('leases')} bail(aux)${u.ownerRec ? ' · accès mandant' : ''}`;
}
function carteDoublons() {
  if (location.hash.split('?')[0] !== '#/admin/users') return;
  const u = Auth.current(); if (!u || u.role !== 'admin') return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('#doublons')) return;
  const G = groupesDoublons(); if (!G.length) return;
  const html = `<section class="card" id="doublons" style="margin:0 0 16px"><h4 style="margin-top:0">${icon('users', 17)} ${pluriel(G.length, 'doublon possible', 'doublons possibles')}</h4>
    <p class="small muted" style="margin:0 0 10px">Choisissez le compte à garder : l'autre est suspendu et relié à lui. Aucune donnée n'est supprimée ; vous pourrez le réactiver.</p>
    ${G.map((g, i) => `<div class="av-row"><div class="small" style="margin-bottom:6px">${g.sorte === 'cni' ? badge('Même CNI · correspondance fiable', 'warn') : badge('Même téléphone · à vérifier', '')}</div>
      ${g.comptes.map(x => `<div class="av-t" style="margin:6px 0"><span class="itile sm">${icon('user', 16)}</span><div style="min-width:0;flex:1"><b>${esc(displayName(x))}</b> <span class="small muted">· ${esc(x.role)} · CNI ${esc(x.cni || '—')} · ${esc(x.phone || '')}</span>
        <div class="small muted">Créé le ${dateFr(x.createdAt)} · ${poidsCompte(x)}</div></div>
        <button class="btn ghost sm" data-action="doublon-garder" data-id="${x.id}" data-groupe="${g.comptes.map(y => y.id).join(',')}">Garder celui-ci</button></div>`).join('')}</div>`).join('')}</section>`;
  const t = c.querySelector('.table-wrap, .tfilter, .empty'); if (t) t.insertAdjacentHTML('beforebegin', html); else c.insertAdjacentHTML('beforeend', html);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="doublon-garder"]'); if (!b) return;
  const u = Auth.current(); if (!u || u.role !== 'admin') return;
  const garde = DB.findItem(DB.K.users, b.dataset.id), autres = b.dataset.groupe.split(',').filter(id => id !== garde.id).map(id => DB.findItem(DB.K.users, id)).filter(Boolean);
  confirmDialog({title: 'Rapprocher les comptes', message: `Garder ${displayName(garde)} (${garde.role}). ${autres.map(x => displayName(x) + ' (' + x.role + ')').join(', ')} sera suspendu et relié à ce compte ; ses données sont conservées.`, confirmLabel: 'Rapprocher',
    onConfirm: () => {
      autres.forEach(x => DB.updateItem(DB.K.users, x.id, {status: 'suspendu', doublonDe: garde.id, rapprocheLe: now()}));
      logActivity(`Admin ${displayName(u)} : doublon rapproché — gardé ${displayName(garde)} (${garde.id}), suspendu ${autres.map(x => x.id).join(', ')}`);
      toast('Comptes rapprochés. Rien n\'a été supprimé.'); render();
    }});
});

/* --- S4. Comptes de démonstration marqués --------------------------------- */
function badgesDemo() {
  if (location.hash.split('?')[0] !== '#/admin/users') return;
  document.querySelectorAll('#app table tbody tr:not([data-demo])').forEach(tr => {
    tr.dataset.demo = '1';
    const b = tr.querySelector('[data-action="user-toggle"], [data-action="user-del"]'); const x = b && DB.findItem(DB.K.users, b.dataset.id);
    if (!x) return;
    const td = tr.querySelector('td');
    if (x.demo && td) td.insertAdjacentHTML('beforeend', ` ${badge('Démo', 'info')}`);
    if (x.doublonDe && td) td.insertAdjacentHTML('beforeend', ` ${badge('Doublon rapproché', '')}`);
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { carteDoublons(); badgesDemo(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* ==========================================================================
   GROUPE A
   A1. Changer son mot de passe, pour tous les profils.
   ========================================================================== */
/* Seuls les agents avaient cet écran. Le propriétaire, le client, le
   locataire, l'agence et l'admin reçoivent la même carte sur leur page de
   profil ou de paramètres. Les membres d'équipe gardent « Mon profil ». */
const PAGES_MDP = /^#\/(client\/profile|owner\/profile|agency\/settings|admin\/settings)$/;
function carteMotDePasse() {
  if (!PAGES_MDP.test(location.hash)) return;
  const u = Auth.current(); if (!u || u.member) return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('form[data-action="mdp-change"]')) return;
  c.insertAdjacentHTML('beforeend', `<form class="card" data-action="mdp-change" id="changer-mot-de-passe" style="max-width:640px;margin-top:18px" data-sub="6 caractères minimum">
    <h4>Changer mon mot de passe</h4>
    <div class="form-grid"><div class="field"><label>Mot de passe actuel</label><input class="input" type="password" name="ancien" required autocomplete="current-password"></div>
      <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="nouveau" minlength="6" required autocomplete="new-password"></div>
      <div class="field"><label>Confirmer le nouveau</label><input class="input" type="password" name="confirme" minlength="6" required autocomplete="new-password"></div></div>
    <button class="btn">Changer le mot de passe</button></form>`);
}
new MutationObserver(() => requestAnimationFrame(() => { try { carteMotDePasse(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
/* Règles communes (aussi pour le choix d'un mot de passe provisoire, A2). */
function refusNouveauMotDePasse(compte, ancien, nouveau, confirme, verifierAncien = true) {
  if (verifierAncien && !verifierMotDePasse(compte, ancien)) return 'Le mot de passe actuel est incorrect.';
  if ((nouveau || '').length < 6) return 'Le nouveau mot de passe doit faire 6 caractères minimum.';
  if (nouveau !== confirme) return 'Les deux mots de passe ne correspondent pas.';
  if (verifierMotDePasse(compte, nouveau)) return 'Choisissez un mot de passe différent de l\'actuel.';
  if (MDP_DEMO.includes(nouveau)) return 'Ce mot de passe est celui des comptes de démonstration : choisissez-en un autre.';
  return '';
}
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-change"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.member) return;
  const compte = DB.findItem(DB.K.users, u.id), d = formData(f);
  const refus = refusNouveauMotDePasse(compte, d.ancien, d.nouveau, d.confirme); if (refus) return toast(refus, 'bad');
  DB.updateItem(DB.K.users, compte.id, {password: d.nouveau, mdpProvisoire: false});
  logActivity(`${displayName(compte)} a changé son mot de passe`);
  f.reset(); toast('Mot de passe changé.');
}, true);
/* Le gestionnaire (membre d'un propriétaire) n'avait aucun accès à sa page
   « Mon profil » (téléphone, mot de passe), qui existe pour tous les membres. */
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner'); if (!d || !d.get) return;
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, enumerable: true, set: d.set, get() {
    const m = d.get.call(MENUS_RAW); let u = null; try { u = Auth.current(); } catch (e) {}
    return u && u.member && Array.isArray(m) && !m.some(x => x[0] === '#/agent/profil') ? m.concat([['#/agent/profil', 'Mon profil', 'user']]) : m;
  }});
})();

/* --- A2. Mot de passe provisoire pour un compte créé par quelqu'un d'autre --
   Les comptes ouverts par une agence ou un propriétaire (mandant, locataire,
   membre d'équipe) recevaient tous « demo123 », connu de tous. Désormais :
   - créé par un compte réel : mot de passe aléatoire, montré une seule fois
     à celui qui crée le compte (il le transmet), jamais enregistré en clair ;
     un mot de passe choisi par le créateur (membre d'équipe) est lui aussi
     provisoire ;
   - à la première connexion, la personne choisit son propre mot de passe
     avant d'accéder à quoi que ce soit ;
   - créé par un compte de démonstration : rien ne change (demo123), pour
     que la démonstration reste utilisable. */
function mdpAleatoire() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', a = new Uint32Array(10); crypto.getRandomValues(a);
  const s = [...a].map(x => A[x % A.length]).join(''); return s.slice(0, 5) + '-' + s.slice(5);
}
let provisoireMontre = null;
const _addItemProvisoire = DB.addItem;
DB.addItem = function (k, item) {
  if (k === DB.K.users && item && typeof item.password === 'string') {
    let createur = null; try { createur = Auth.current(); } catch (e) {}
    if (createur && !createur.demo && !(createur.member && createur.member.demo)) {
      if (MDP_DEMO.includes(item.password)) {
        const mdp = mdpAleatoire();
        item = {...item, password: mdp, demo: false, mdpProvisoire: true};
        provisoireMontre = {nom: `${item.firstName || ''} ${item.lastName || ''}`.trim(), identifiant: item.email || item.cni || '', mdp, t: Date.now()};
        setTimeout(montrerProvisoire, 350);
      } else item = {...item, demo: false, mdpProvisoire: true};
    }
  }
  return _addItemProvisoire.call(DB, k, item);
};
function montrerProvisoire() {
  const P = provisoireMontre; if (!P || Date.now() - P.t > 5000) return;
  if (document.querySelector('.modal')) return setTimeout(montrerProvisoire, 600);
  provisoireMontre = null;
  modal('Accès créé', `<p style="margin-top:0">${esc(P.nom)} peut se connecter avec :</p>
    <div class="fin-l"><span>Identifiant</span><b>${esc(P.identifiant)}</b></div>
    <div class="fin-l"><span>Mot de passe provisoire</span><b class="mdp-prov" style="font-family:monospace;font-size:1.1rem">${esc(P.mdp)}</b></div>
    <p class="small muted" style="margin:12px 0 0">Transmettez-le à ${esc(P.nom.split(' ')[0] || 'la personne')} (en main propre, SMS ou WhatsApp). Il ne sera plus affiché : DEUKSIL ne le conserve pas en clair. À sa première connexion, elle choisira son propre mot de passe.</p>
    <div class="row" style="gap:10px;margin-top:14px"><button class="btn" data-action="close-modal">J'ai noté le mot de passe</button></div>`);
}
/* Les messages et la fiche qui annonçaient « mot de passe : demo123 ». */
const _toastProvisoire = toast;
toast = function (m, ton) {
  if (typeof m === 'string' && /mot de passe : demo123/.test(m) && (provisoireMontre || document.querySelector('.mdp-prov'))) m = m.replace(/\s*\(mot de passe : demo123\)/, ' (mot de passe provisoire affiché à l\'écran)');
  return _toastProvisoire.call(this, m, ton);
};
if (typeof accesLocataire === 'function') {
  const _accesProv = accesLocataire;
  accesLocataire = function (bail) {
    const h = _accesProv(bail), u = locataireDuBail(bail);
    return u && !u.demo ? h.replace('mot de passe : demo123', u.mdpProvisoire ? 'mot de passe provisoire, à changer à la 1re connexion' : 'mot de passe personnel') : h;
  };
}
/* Première connexion : choisir son mot de passe avant tout le reste. */
const compteConnecte = u => u ? DB.findItem(DB.K.users, (u.member || u).id) : null;
function exigerNouveauMdp() {
  let u = null; try { u = Auth.current(); } catch (e) {}
  const c = compteConnecte(u);
  if (c && c.mdpProvisoire && location.hash !== '#/mot-de-passe') { go('#/mot-de-passe'); return true; }
  return false;
}
addEventListener('hashchange', () => { try { exigerNouveauMdp(); } catch (e) {} });
[200, 1200].forEach(t => setTimeout(() => { try { exigerNouveauMdp(); } catch (e) {} }, t));
route(/^\/mot-de-passe$/, () => {
  const u = Auth.current(), c = compteConnecte(u);
  if (!c) { go('#/login'); return false; }
  if (!c.mdpProvisoire) { go(Auth.home(u)); return false; }
  return shellPublic(`<section class="wrap" style="max-width:520px;padding:40px 0 60px">
    <form class="card" data-action="mdp-premier" data-sub="Votre mot de passe personnel">
      <h2 style="margin-top:0">Bienvenue ${esc(c.firstName || '')}</h2>
      <p class="small muted">Votre compte a été ouvert par ${esc(c.parentId ? nomAgence(c.parentId) : c.mandantOf ? nomAgence(c.mandantOf) : c.ownerRef ? nomAgence(c.ownerRef) : 'un tiers')} avec un mot de passe provisoire. Choisissez le vôtre pour continuer : vous seul le connaîtrez.</p>
      <div class="field"><label>Nouveau mot de passe</label><input class="input" type="password" name="nouveau" minlength="6" required autocomplete="new-password"></div>
      <div class="field"><label>Confirmer</label><input class="input" type="password" name="confirme" minlength="6" required autocomplete="new-password"></div>
      <button class="btn block">Enregistrer et continuer</button>
      <p class="small" style="margin:14px 0 0;text-align:center"><a href="#/" data-action="logout">Se déconnecter</a></p></form></section>`);
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-premier"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(), c = compteConnecte(u); if (!c) return;
  const d = formData(f), refus = refusNouveauMotDePasse(c, '', d.nouveau, d.confirme, false); if (refus) return toast(refus, 'bad');
  DB.updateItem(DB.K.users, c.id, {password: d.nouveau, mdpProvisoire: false});
  logActivity(`${displayName(c)} a choisi son mot de passe personnel`);
  toast('Mot de passe enregistré. Bienvenue sur DEUKSIL.'); go(Auth.home(Auth.current()));
}, true);
/* Mot de passe provisoire perdu (fenêtre fermée trop vite) : celui qui a
   créé le compte peut en générer un nouveau, tant que la personne n'a pas
   choisi le sien. Après, seul le titulaire connaît son mot de passe. */
const createurDe = (c, u) => !!c && !!u && [c.mandantOf, c.ownerRef, c.parentId].includes(u.id);
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="mdp-regenerer"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(), c = DB.findItem(DB.K.users, b.dataset.id);
  if (!u || u.member || !createurDe(c, u)) return toast('Action non autorisée.', 'bad');
  if (!c.mdpProvisoire) return toast(`${c.firstName} a déjà choisi son mot de passe : lui seul peut le changer.`, 'bad');
  const mdp = mdpAleatoire();
  DB.updateItem(DB.K.users, c.id, {password: mdp, mdpProvisoire: true});
  audit('Mot de passe provisoire régénéré', displayName(c));
  provisoireMontre = {nom: displayName(c), identifiant: c.email || c.cni, mdp, t: Date.now()}; montrerProvisoire();
});
function boutonsRegenerer() {
  const u = Auth.current(); if (!u || u.member || !['owner', 'agency'].includes(u.role)) return;
  if (/^#\/manage\/owners/.test(location.hash)) document.querySelectorAll('#app [data-action="g9-ofiche"][data-id]:not([data-regen])').forEach(b => {
    b.dataset.regen = '1';
    const c = DB.findItem(DB.K.users, x => x.ownerRec === b.dataset.id && x.mdpProvisoire && !x.demo);
    if (c && createurDe(c, u)) b.insertAdjacentHTML('afterend', `<button class="btn ghost sm" data-action="mdp-regenerer" data-id="${c.id}" title="Nouveau mot de passe provisoire">${icon('key', 14)} Accès</button>`);
  });
  document.querySelectorAll('#app .acces-loc:not([data-regen])').forEach(z => {
    z.dataset.regen = '1';
    const mail = (z.textContent.match(/[\w.+-]+@[\w.-]+/) || [])[0]; if (!mail) return;
    const c = DB.findItem(DB.K.users, x => x.email === mail && x.mdpProvisoire && !x.demo);
    if (c && createurDe(c, u)) z.insertAdjacentHTML('beforeend', `<button class="btn ghost sm" data-action="mdp-regenerer" data-id="${c.id}" style="margin-left:auto">${icon('key', 14)} Nouveau mot de passe provisoire</button>`);
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { boutonsRegenerer(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* --- A3. Vérification foncière par l'admin ---------------------------------
   Les informations foncières d'un terrain sont déclarées par l'annonceur
   (« non vérifié par DEUKSIL »). L'admin dispose d'une liste des terrains à
   vérifier dans « Vérifications » : il contrôle les pièces et marque le
   terrain vérifié (confirmation des contrôles exigée) ou refuse avec un
   motif. L'annonceur est prévenu, la décision est journalisée. Une
   vérification tombe si l'annonceur change ensuite les données foncières. */
const estTerrain = p => p && (p.type === 'terrain' || p.transaction === 'terrain');
const etatFoncier = p => ((p.foncier || {}).verification) || 'declaratif';
function sectionTerrains() {
  if (location.hash !== '#/admin/verifications') return;
  const u = Auth.current(); if (!u || u.role !== 'admin') return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('#terrains-a-verifier')) return;
  const T = DB.filterItems(DB.K.properties, estTerrain).filter(p => p.listingStatus !== 'archivee' && p.status !== 'archive');
  const ordre = {declaratif: 0, refuse: 1, verifie: 2};
  T.sort((a, b) => ordre[etatFoncier(a)] - ordre[etatFoncier(b)]);
  const att = T.filter(p => etatFoncier(p) === 'declaratif').length;
  c.insertAdjacentHTML('afterbegin', `<section class="card" id="terrains-a-verifier" style="margin:0 0 18px"><h4 style="margin-top:0">${icon('land', 17)} Terrains : vérification foncière ${att ? badge(att + ' à vérifier', 'warn') : badge('À jour', 'ok')}</h4>
    <p class="small muted" style="margin:0 0 10px">Contrôlez les pièces (titre ou acte, plan ou bornage, identité du vendeur) avant de marquer un terrain « vérifié ». Cette mention est visible des acheteurs.</p>
    ${T.length ? T.map(p => { const fo = p.foncier || {}, o = DB.findItem(DB.K.users, p.ownerId) || {}, e = etatFoncier(p);
      return `<div class="av-row"><div class="av-t"><span class="itile sm ${e === 'declaratif' ? 'gold' : ''}">${icon('land', 16)}</span><div style="min-width:0"><b>${esc(p.title)}</b>
        <div class="small muted">${esc(displayName(o))} · ${esc(fo.statut || 'statut foncier non renseigné')}${fo.reference ? ' · ' + esc(fo.reference) : ''} · documents : ${esc((fo.documents || []).join(', ') || 'aucun')}</div>
        <div style="margin-top:4px">${e === 'verifie' ? badge('Vérifié le ' + dateFr(fo.verifieLe), 'ok') : e === 'refuse' ? badge('Refusé : ' + (fo.motif || ''), 'bad') : badge('Déclaratif · à vérifier', 'warn')}</div></div></div>
        <div class="av-b"><a class="btn ghost sm" href="#/property/${p.id}">Voir l'annonce</a>
          ${e !== 'verifie' ? `<button class="btn sm" data-action="foncier-verifier" data-id="${p.id}" ${fo.statut ? '' : 'disabled title="Statut foncier non renseigné"'}>Marquer vérifié</button>` : ''}
          ${e !== 'refuse' ? `<button class="btn ghost sm" data-action="foncier-refuser" data-id="${p.id}">${e === 'verifie' ? 'Retirer la vérification' : 'Refuser'}</button>` : ''}</div></div>`; }).join('')
      : '<p class="small muted">Aucun terrain en ligne.</p>'}</section>`);
}
new MutationObserver(() => requestAnimationFrame(() => { try { sectionTerrains(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="foncier-verifier"], [data-action="foncier-refuser"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(); if (!u || u.role !== 'admin') return toast('Réservé à l\'administration.', 'bad');
  const p = gProp(b.dataset.id); if (!estTerrain(p)) return;
  if (b.dataset.action === 'foncier-verifier') return modal('Marquer le terrain vérifié', `<form data-action="foncier-verifier-ok" data-id="${p.id}"><p class="small" style="margin-top:0"><b>${esc(p.title)}</b> · ${esc((p.foncier || {}).statut || '')}</p>
    <p class="small muted">Cochez chaque contrôle effectué :</p>
    ${['Titre ou acte de propriété examiné et conforme', 'Plan cadastral ou bornage cohérent avec l\'annonce', 'Identité du vendeur conforme au titre'].map((l, i) => `<label class="check" style="display:flex;margin:6px 0"><input type="checkbox" name="c${i}" required> ${esc(l)}</label>`).join('')}
    <div class="field" style="margin-top:10px"><label>Note interne (facultatif)</label><input class="input" name="note" placeholder="Pièces reçues le…, référence du dossier…"></div>
    <div class="row" style="gap:10px"><button class="btn">Marquer vérifié</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
  modal('Refuser la vérification', `<form data-action="foncier-refuser-ok" data-id="${p.id}"><p class="small" style="margin-top:0"><b>${esc(p.title)}</b></p>
    <div class="field"><label>Motif communiqué à l'annonceur</label><textarea class="input" name="motif" required placeholder="Titre illisible, référence introuvable, plan manquant…"></textarea></div>
    <div class="row" style="gap:10px"><button class="btn">Confirmer</button><button type="button" class="btn ghost" data-action="close-modal">Annuler</button></div></form>`);
});
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="foncier-verifier-ok"], form[data-action="foncier-refuser-ok"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.role !== 'admin') return;
  const p = gProp(f.dataset.id), d = formData(f), fo = {...(p.foncier || {})};
  if (f.dataset.action === 'foncier-verifier-ok') {
    if (![0, 1, 2].every(i => d['c' + i])) return toast('Cochez les trois contrôles avant de marquer le terrain vérifié.', 'bad');
    Object.assign(fo, {verification: 'verifie', verifieLe: now(), verifiePar: u.id, note: (d.note || '').trim(), motif: ''});
    notify(p.ownerId, `Votre terrain « ${p.title} » est vérifié par DEUKSIL : la mention est visible des acheteurs.`, '#/property/' + p.id);
    logActivity(`Admin ${displayName(u)} : terrain « ${p.title} » vérifié`);
  } else {
    const motif = String(d.motif || '').trim(); if (!motif) return toast('Indiquez le motif.', 'bad');
    Object.assign(fo, {verification: 'refuse', motif, verifieLe: '', refuseLe: now(), verifiePar: u.id});
    notify(p.ownerId, `Vérification de « ${p.title} » non accordée : ${motif}`, '#/owner/property/' + p.id);
    logActivity(`Admin ${displayName(u)} : vérification refusée pour « ${p.title} » (${motif})`);
  }
  DB.updateItem(DB.K.properties, p.id, {foncier: fo});
  closeModal(); toast(fo.verification === 'verifie' ? 'Terrain marqué vérifié.' : 'Refus enregistré, l\'annonceur est prévenu.'); render();
}, true);
/* Modifier les données foncières après vérification fait tomber la mention. */
const _updateFoncier = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  if (k === DB.K.properties && patch && patch.foncier && patch.foncier.verification === 'declaratif') {
    const avant = (DB.findItem(DB.K.properties, id) || {}).foncier;
    if (avant && avant.verification === 'verifie') {
      const memes = ['statut', 'reference'].every(c => (avant[c] || '') === (patch.foncier[c] || '')) && JSON.stringify(avant.documents || []) === JSON.stringify(patch.foncier.documents || []);
      patch = {...patch, foncier: memes ? {...avant, ...patch.foncier, verification: 'verifie', verifieLe: avant.verifieLe, verifiePar: avant.verifiePar} : {...patch.foncier, verification: 'declaratif'}};
    }
  }
  return _updateFoncier.call(DB, k, id, patch);
};
/* La comparaison se fait là où les données foncières sont préparées
   (preparerExtras, 94-finalisation.js), avant toute écriture. */
if (typeof preparerExtras === 'function') {
  const _preparerFoncier = preparerExtras;
  preparerExtras = function (f) {
    const r = _preparerFoncier.apply(this, arguments);
    try {
      const p = f && f.dataset.id && gProp(f.dataset.id), avant = p && p.foncier, nv = extrasBien && extrasBien.foncier;
      if (avant && nv && avant.verification === 'verifie' && ['statut', 'reference'].every(c => (avant[c] || '') === (nv[c] || '')) && JSON.stringify(avant.documents || []) === JSON.stringify(nv.documents || []))
        extrasBien.foncier = {...nv, verification: 'verifie', verifieLe: avant.verifieLe, verifiePar: avant.verifiePar, note: avant.note || ''};
    } catch (e) {}
    return r;
  };
}
