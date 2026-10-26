/* ==========================================================================
   MODULE : securite.js — comptes et mots de passe (Supabase Auth).
   Les mots de passe ne transitent jamais par les tables : Supabase Auth les
   stocke chiffrés (bcrypt) et limite lui-même les tentatives répétées.
     S3. Admin : détection des comptes en double (CNI ou téléphone) et
         rapprochement prudent : rien n'est supprimé.
     A1. Changer son mot de passe, pour tous les profils (mot de passe actuel
         vérifié par Supabase Auth).
     A2. Comptes ouverts par un tiers (équipe, locataire, mandant) : mot de
         passe provisoire tiré au hasard par la fonction serveur « gerer-acces »,
         affiché une seule fois ; à la première connexion, la personne choisit
         le sien avant tout le reste.
     A3. Vérification foncière par l'administration.
   ========================================================================== */

/* --- Règles communes d'un nouveau mot de passe -------------------------------- */
const MDP_INTERDITS = ['demo123', 'admin123', 'password', 'motdepasse', '12345678', 'azerty123', 'deuksil123'];
const mdpTropFaible = p => String(p || '').length < 8 || !/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p);
function refusNouveauMotDePasse(nouveau, confirme) {
  if (mdpTropFaible(nouveau)) return 'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.';
  if (nouveau !== confirme) return 'Les deux mots de passe ne correspondent pas.';
  if (MDP_INTERDITS.includes(String(nouveau).toLowerCase())) return 'Ce mot de passe est trop courant : choisissez-en un autre.';
  return '';
}
/* Change le mot de passe du compte connecté. Si « ancien » est fourni, il est
   d'abord vérifié par Supabase Auth (nouvelle connexion avec ce mot de passe). */
async function changerMonMotDePasse(ancien, nouveau) {
  const email = DB.session && DB.session.user ? DB.session.user.email : '';
  if (!email) return 'Session expirée : reconnectez-vous.';
  if (ancien !== null) {
    const {error} = await SB.auth.signInWithPassword({email, password: ancien});
    if (error) return /rate|too many/i.test(error.message || '') ? messageAuth(error) : 'Le mot de passe actuel est incorrect.';
  }
  const {error} = await SB.auth.updateUser({password: nouveau});
  return error ? messageAuth(error) : '';
}

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

new MutationObserver(() => requestAnimationFrame(() => { try { carteDoublons(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* ==========================================================================
   A1. Changer son mot de passe, pour tous les profils.
   ========================================================================== */
const PAGES_MDP = /^#\/(client\/profile|owner\/profile|agency\/settings|admin\/settings)$/;
function carteMotDePasse() {
  if (!PAGES_MDP.test(location.hash)) return;
  const u = Auth.current(); if (!u || u.member) return;
  const c = document.querySelector('#app .content'); if (!c || c.querySelector('form[data-action="mdp-change"]')) return;
  c.insertAdjacentHTML('beforeend', `<form class="card" data-action="mdp-change" id="changer-mot-de-passe" style="max-width:640px;margin-top:18px" data-sub="8 caractères minimum">
    <h4>Changer mon mot de passe</h4>
    <div class="form-grid"><div class="field"><label for="mdp-ancien">Mot de passe actuel</label><input class="input" id="mdp-ancien" type="password" name="ancien" required autocomplete="current-password"></div>
      <div class="field"><label for="mdp-nouveau">Nouveau mot de passe</label><input class="input" id="mdp-nouveau" type="password" name="nouveau" minlength="8" required autocomplete="new-password" placeholder="8 caractères minimum"></div>
      <div class="field"><label for="mdp-confirme">Confirmer le nouveau</label><input class="input" id="mdp-confirme" type="password" name="confirme" minlength="8" required autocomplete="new-password" placeholder="Retapez le mot de passe"></div></div>
    <button class="btn">Changer le mot de passe</button></form>`);
}
new MutationObserver(() => requestAnimationFrame(() => { try { carteMotDePasse(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-change"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u || u.member) return;
  const d = formData(f);
  if (d.nouveau === d.ancien) return toast('Choisissez un mot de passe différent de l\'actuel.', 'bad');
  const refus = refusNouveauMotDePasse(d.nouveau, d.confirme); if (refus) return toast(refus, 'bad');
  const b = f.querySelector('button'); b.disabled = true;
  const err = await changerMonMotDePasse(d.ancien, d.nouveau); b.disabled = false;
  if (err) return toast(err, 'bad');
  logActivity(`${displayName(u)} a changé son mot de passe`);
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

/* ==========================================================================
   A2. Mot de passe provisoire d'un compte ouvert par un tiers.
   ========================================================================== */
/* Appelée par js/03-storage.js quand la fonction serveur a créé le compte. */
function montrerMotDePasseProvisoire(compte, mdp) {
  const nom = `${compte.firstName || ''} ${compte.lastName || ''}`.trim() || 'Cette personne';
  const afficher = () => {
    if (document.querySelector('.modal')) return setTimeout(afficher, 600);
    modal('Accès créé', `<p style="margin-top:0">${esc(nom)} peut se connecter avec :</p>
      <div class="fin-l"><span>Identifiant</span><b>${esc(compte.email || '')}</b></div>
      <div class="fin-l"><span>Mot de passe provisoire</span><b class="mdp-prov" style="font-family:monospace;font-size:1.1rem">${esc(mdp)}</b></div>
      <p class="small muted" style="margin:12px 0 0">Transmettez-le à ${esc(nom.split(' ')[0])} (en main propre, SMS ou WhatsApp). Il ne sera plus affiché : DEUKSIL ne le conserve pas. À sa première connexion, elle choisira son propre mot de passe.</p>
      <div class="row" style="gap:10px;margin-top:14px"><button class="btn" data-action="close-modal">J'ai noté le mot de passe</button></div>`);
  };
  afficher();
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
route(/^\/mot-de-passe$/, () => {
  const u = Auth.current(), c = compteConnecte(u);
  if (!c) { go('#/login'); return false; }
  if (!c.mdpProvisoire) { go(Auth.home(u)); return false; }
  return shellPublic(`<section class="wrap" style="max-width:520px;padding:40px 0 60px">
    <form class="card" data-action="mdp-premier" data-sub="Votre mot de passe personnel">
      <h2 style="margin-top:0">Bienvenue ${esc(c.firstName || '')}</h2>
      <p class="small muted">Votre compte a été ouvert par ${esc(c.parentId ? nomAgence(c.parentId) : c.mandantOf ? nomAgence(c.mandantOf) : c.ownerRef ? nomAgence(c.ownerRef) : 'un tiers')} avec un mot de passe provisoire. Choisissez le vôtre pour continuer : vous seul le connaîtrez.</p>
      <div class="field"><label for="mdp1-nouveau">Nouveau mot de passe</label><input class="input" id="mdp1-nouveau" type="password" name="nouveau" minlength="8" required autocomplete="new-password" placeholder="8 caractères minimum"></div>
      <div class="field"><label for="mdp1-confirme">Confirmer</label><input class="input" id="mdp1-confirme" type="password" name="confirme" minlength="8" required autocomplete="new-password" placeholder="Retapez le mot de passe"></div>
      <button class="btn block">Enregistrer et continuer</button>
      <p class="small" style="margin:14px 0 0;text-align:center"><a href="#/" data-action="logout">Se déconnecter</a></p></form></section>`);
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-premier"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(), c = compteConnecte(u); if (!c) return;
  const d = formData(f), refus = refusNouveauMotDePasse(d.nouveau, d.confirme); if (refus) return toast(refus, 'bad');
  const b = f.querySelector('button'); b.disabled = true;
  const err = await changerMonMotDePasse(null, d.nouveau); b.disabled = false;
  if (err) return toast(err, 'bad');
  DB.updateItem(DB.K.users, c.id, {mdpProvisoire: false});
  await DB.attendre();
  logActivity(`${displayName(c)} a choisi son mot de passe personnel`);
  const moi = Auth.current(); toast('Mot de passe enregistré. Bienvenue sur DEUKSIL.'); go(moi ? Auth.home(moi) : '#/');
}, true);
/* Mot de passe provisoire perdu (fenêtre fermée trop vite) : celui qui a
   créé le compte en obtient un nouveau, tant que la personne n'a pas choisi
   le sien. Après, seul le titulaire connaît son mot de passe. */
const createurDe = (c, u) => !!c && !!u && [c.mandantOf, c.ownerRef, c.parentId].includes(u.id);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="mdp-regenerer"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(), c = DB.findItem(DB.K.users, b.dataset.id);
  if (!u || u.member || !createurDe(c, u)) return toast('Action non autorisée.', 'bad');
  if (!c.mdpProvisoire) return toast(`${c.firstName} a déjà choisi son mot de passe : lui seul peut le changer.`, 'bad');
  b.disabled = true;
  try {
    const r = await appelerFonction('gerer-acces', {action: 'mot-de-passe', id: c.id});
    audit('Mot de passe provisoire régénéré', displayName(c));
    montrerMotDePasseProvisoire(c, r.motDePasse);
  } catch (err) { toast(err.message || 'Action impossible.', 'bad'); }
  b.disabled = false;
});
function boutonsRegenerer() {
  const u = Auth.current(); if (!u || u.member || !['owner', 'agency'].includes(u.role)) return;
  if (/^#\/manage\/owners/.test(location.hash)) document.querySelectorAll('#app [data-action="g9-ofiche"][data-id]:not([data-regen])').forEach(b => {
    b.dataset.regen = '1';
    const c = DB.findItem(DB.K.users, x => x.ownerRec === b.dataset.id && x.mdpProvisoire);
    if (c && createurDe(c, u)) b.insertAdjacentHTML('afterend', `<button class="btn ghost sm" data-action="mdp-regenerer" data-id="${c.id}" title="Nouveau mot de passe provisoire">${icon('key', 14)} Accès</button>`);
  });
  document.querySelectorAll('#app .acces-loc:not([data-regen])').forEach(z => {
    z.dataset.regen = '1';
    const mail = (z.textContent.match(/[\w.+-]+@[\w.-]+/) || [])[0]; if (!mail) return;
    const c = DB.findItem(DB.K.users, x => x.email === mail && x.mdpProvisoire);
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
