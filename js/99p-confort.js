/* ==========================================================================
   99p-confort.js — une utilisation simple pour tous (recette du 22 novembre).
   Chargé en dernier. Rien n'est retiré : on guide, on confirme, on explique.

   1. La page ne remonte plus en haut quand elle se met à jour sur place.
   2. Visiteur : un message adapté à chaque action ; signaler une annonce
      sans compte ; le message reste lisible sur la page de connexion.
   3. Inscription : adresse déjà utilisée signalée ; retour vers le site utilisé.
   4. Formulaires : astérisque sur les champs obligatoires ; message clair (en
      français, sous le champ) au lieu de la bulle du navigateur ; CNI
      invraisemblable refusée ; photos en trop signalées.
   5. Fiche d'un bien : adresse sans répétition, référence lisible, badges
      cohérents, partager, voir sur une carte, actions adaptées au propriétaire,
      barre d'action fixe sur téléphone, vues comptées aussi pour les visiteurs.
   6. Recherche : « Créer une alerte » visible pour tous, case « Comparer »,
      prix négatifs refusés.
   7. Espaces : bon nom affiché, raccourcis utiles, confirmations, relance
      d'impayé confirmée (une par jour), mandat pré-rempli.
   ========================================================================== */

/* --- 1. Mise à jour sur place : on garde la position ----------------------- */
render = (function (prec) {
  let dernier = null;
  return function (...a) {
    const chemin = (location.hash || '#/').split('?')[0], y = window.scrollY, meme = chemin === dernier;
    dernier = chemin;
    const r = prec.apply(this, a);
    if (meme && y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
    return r;
  };
})(render);
/* La navigation (changement d'adresse) remonte toujours en haut : l'écouteur
   d'origine appelle la fonction d'origine. */

/* --- 2. Visiteur ------------------------------------------------------------ */
const MOTIF_VISITEUR = {
  'toggle-fav': 'Connectez-vous (ou créez un compte gratuit) pour enregistrer vos favoris.',
  'ask-visit': 'Connectez-vous (ou créez un compte gratuit) pour demander une visite.',
  'contact': 'Connectez-vous (ou créez un compte gratuit) pour écrire à l\'annonceur.',
  'call-owner': 'Connectez-vous (ou créez un compte gratuit) pour voir le numéro de l\'annonceur.',
  'save-search': 'Connectez-vous (ou créez un compte gratuit) pour créer une alerte et être prévenu des nouvelles annonces.'
};
const RETOUR = 'deuksil_retour', MOTIF = 'deuksil_login_motif';
window.addEventListener('click', e => {
  if (Auth.current()) return;
  const b = e.target.closest && e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'g5-report') { e.preventDefault(); e.stopImmediatePropagation(); signalerSansCompte(b.dataset.id || ((location.hash.match(/#\/property\/([\w-]+)/) || [])[1])); return; }
  if (!MOTIF_VISITEUR[a]) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const h = location.hash || '#/';
  try { sessionStorage.setItem(RETOUR, /^#\/(login|register)/.test(h) ? '#/search' : h); sessionStorage.setItem(MOTIF, MOTIF_VISITEUR[a]); } catch (err) {}
  go('#/login');
}, true);
/* Pages privées ouvertes sans être connecté : on dit pourquoi. */
Auth.guard = (function (prec) {
  return function (role) {
    if (!this.current()) try { sessionStorage.setItem(MOTIF, 'Cet espace est réservé : connectez-vous pour y accéder.'); } catch (e) {}
    return prec.call(this, role);
  };
})(Auth.guard);
function motifConnexion() {
  const f = document.querySelector('#app form[data-action="login"]'); if (!f || f.dataset.motif) return;
  let m = null; try { m = sessionStorage.getItem(MOTIF); sessionStorage.removeItem(MOTIF); } catch (e) {}
  f.dataset.motif = '1'; if (!m) return;
  document.querySelectorAll('.toast').forEach(t => { if (/Connectez-vous|connecter/i.test(t.textContent)) t.remove(); });
  f.insertAdjacentHTML('afterbegin', `<div class="cf-motif" role="status">${icon('info', 16)}<span>${esc(m)}</span></div>`);
}
const MOTIFS_SIGNALEMENT = ['Annonce frauduleuse ou arnaque', 'Bien déjà loué ou vendu', 'Prix ou informations trompeurs', 'Photos ne correspondant pas', 'Annonceur injoignable', 'Contenu choquant', 'Autre'];
function signalerSansCompte(pid) {
  const p = pid && DB.findItem(DB.K.properties, pid);
  modal('Signaler cette annonce', `<form data-action="cf-signaler" data-id="${esc(pid || '')}"><p class="small muted">${p ? esc(p.title) + ' · ' : ''}Votre signalement est transmis à l'équipe DEUKSIL, qui vérifie l'annonce. Pas besoin de compte.</p>
    <div class="field"><label>Motif <span class="req">*</span></label><select class="input" name="motif" required>${MOTIFS_SIGNALEMENT.map(m => `<option>${m}</option>`).join('')}</select></div>
    <div class="field"><label>Précisions <span class="req">*</span></label><textarea class="input" name="detail" rows="3" maxlength="1500" required placeholder="Ce qui vous semble anormal"></textarea></div>
    <div class="field"><label>Votre adresse e-mail <span class="req">*</span></label><input class="input" type="email" name="email" required placeholder="Pour vous tenir informé"></div>
    <div class="f-zone-err"></div><button class="btn block">Envoyer le signalement</button></form>`);
}
document.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="cf-signaler"]'); if (!f) return;
  e.preventDefault(); if (f.dataset.envoi) return;
  const d = formData(f), p = DB.findItem(DB.K.properties, f.dataset.id || ''), fautes = [];
  if (String(d.detail || '').trim().length < 10) fautes.push(['detail', 'Décrivez le problème en quelques mots (10 caractères minimum).']);
  if (!RE_EMAIL.test(String(d.email || '').trim())) fautes.push(['email', 'Adresse e-mail invalide.']);
  if (fautes.length) return erreursIci(f, fautes);
  f.dataset.envoi = '1'; occupe(f, true);
  const texte = `Signalement d'annonce — ${d.motif}\nAnnonce : ${p ? p.title + ' (' + location.origin + '/#/property/' + p.id + ')' : location.href}\n\n${String(d.detail).trim()}`;
  const {data, error} = await SB.rpc('envoyer_contact', {p_nom: 'Visiteur (signalement)', p_email: String(d.email).trim(), p_tel: null, p_sujet: 'abus', p_message: texte.slice(0, 3000)});
  delete f.dataset.envoi; occupe(f, false);
  if (error || !data) return erreurIci(f, '', error ? messageErreur(error) : 'Envoi impossible pour le moment. Réessayez plus tard.');
  closeModal(); toast('Signalement envoyé. Merci : l\'équipe DEUKSIL va vérifier cette annonce.');
});

/* --- 3. Inscription ---------------------------------------------------------- */
startRegistration = async function (data) {
  const email = String(data.email || '').trim().toLowerCase();
  const retour = (/^https?:/.test(location.origin) ? location.origin + location.pathname : DEUKSIL_CONFIG.siteUrl) + '#/verifier-email';
  const {data: r, error} = await SB.auth.signUp({email, password: data.password, options: {emailRedirectTo: retour,
    data: {role: data.role, first_name: (data.firstName || '').trim(), last_name: (data.lastName || '').trim(), phone: (data.phone || '').trim(),
      cni: (data.cni || '').replace(/\s/g, ''), agency_name: (data.agencyName || '').trim(), address: (data.address || '').trim(),
      ninea: (data.ninea || '').trim(), rccm: (data.rccm || '').trim(), cgu: !!data.cgu}}});
  if (error) return {error: messageAuth(error)};
  /* Adresse déjà inscrite : Supabase répond « comme si » (pour ne pas révéler les comptes)
     mais sans identité. On le dit à la personne au lieu d'attendre un code qui ne viendra pas. */
  if (r && r.user && Array.isArray(r.user.identities) && r.user.identities.length === 0)
    return {error: 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous, ou utilisez « Mot de passe oublié » si vous ne vous en souvenez plus.'};
  try { sessionStorage.setItem('deuksil_verif_email', JSON.stringify(email)); } catch (e) {}
  if (r.session) { await DB.charger(); const u = Auth.current(); if (u) { toast('Bienvenue sur DEUKSIL : votre compte est actif.'); go(Auth.home(u)); } return {ok: true, session: true}; }
  go('#/verifier-email'); toast('Compte créé : saisissez le code envoyé à ' + email + '.');
  return {ok: true};
};

/* --- 4. Formulaires ------------------------------------------------------------ */
function asterisques(racine) {
  racine.querySelectorAll('.field:not([data-req])').forEach(fl => {
    fl.dataset.req = '1';
    const i = fl.querySelector('input[required], select[required], textarea[required]'), l = fl.querySelector('label');
    if (i && l && !/\*/.test(l.textContent) && !l.querySelector('.req') && i.type !== 'checkbox') l.insertAdjacentHTML('beforeend', ' <span class="req" aria-hidden="true">*</span>');
  });
}
/* Champ invalide : message sous le champ (et étape du formulaire affichée) au lieu de la bulle du navigateur. */
document.addEventListener('invalid', e => {
  const i = e.target, f = i.form; if (!f) return;
  e.preventDefault();
  if (f.dataset.invalideVu === String(Date.now()).slice(0, -2)) return;   // un seul message par envoi
  f.dataset.invalideVu = String(Date.now()).slice(0, -2);
  const lab = ((i.closest('.field') || {}).querySelector ? (i.closest('.field').querySelector('label') || {}).textContent || '' : '').replace(/\*/g, '').trim();
  const msg = i.validity.valueMissing ? (lab ? `« ${lab} » est obligatoire.` : 'Ce champ est obligatoire.') : i.validity.rangeUnderflow ? `La valeur doit être au moins ${i.min}.` : i.validity.rangeOverflow ? `La valeur doit être au plus ${i.max}.` : i.validity.typeMismatch && i.type === 'email' ? 'Adresse e-mail invalide.' : (i.validationMessage || 'Valeur invalide.');
  try { erreurIci(f, i.name, msg); } catch (x) { toast(msg, 'bad'); }
}, true);
/* CNI : 13 chiffres plausibles (pas 0000000000000 ni 1111111111111). */
const cniInvraisemblable = v => /^(\d)\1{12}$/.test(String(v || '').replace(/\s/g, '')) || /^0123456789|^1234567890123$/.test(String(v || ''));
window.addEventListener('submit', e => {
  const f = e.target; if (!f || !f.querySelector) return;
  const i = f.querySelector('input[name="cni"]'); if (!i || !i.value || !cniInvraisemblable(i.value)) return;
  e.preventDefault(); e.stopImmediatePropagation();
  erreurIci(f, 'cni', 'Ce numéro de CNI n\'est pas valable : saisissez les 13 chiffres inscrits sur votre carte.');
}, true);
/* Photos : au-delà du maximum, on le dit. */
window.addEventListener('change', e => {
  const i = e.target; if (!i || i.dataset.action !== 'photos-input' || typeof MAX_PHOTOS === 'undefined') return;
  const place = MAX_PHOTOS - (formPhotos || []).length, n = (i.files || []).length;
  if (n > place && place > 0) setTimeout(() => toast(`${n - place} photo${n - place > 1 ? 's' : ''} non ajoutée${n - place > 1 ? 's' : ''} : ${MAX_PHOTOS} photos au plus par annonce.`, 'warn'), 50);
}, true);
/* Prix : jamais négatifs. */
document.addEventListener('input', e => { const i = e.target; if (i && i.type === 'number' && /price|min|max|amount|rent|budget|surface/i.test(i.name || '') && +i.value < 0) i.value = ''; }, true);

/* --- 5. Fiche d'un bien ----------------------------------------------------------- */
const refAnnonce = id => 'DK-' + String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase();
const vuesComptees = new Set();
function ficheBien() {
  const m = (location.hash || '').match(/^#\/property\/([\w-]+)/); if (!m) return;
  const g = document.querySelector('#detail-grid:not([data-cf])'); if (!g) return;
  const p = DB.findItem(DB.K.properties, m[1]); if (!p) return;
  g.dataset.cf = '1';
  const u = Auth.current(), owner = DB.findItem(DB.K.users, p.ownerId) || {}, T = u && (u.member ? DB.findItem(DB.K.users, u.member.parentId) : u);
  const chezMoi = !!(T && T.id === p.ownerId);
  /* Vues : un visiteur compte aussi (une fois par session et par annonce). */
  if (!u && !vuesComptees.has(p.id)) { vuesComptees.add(p.id); try { if (!sessionStorage.getItem('vu_' + p.id)) { sessionStorage.setItem('vu_' + p.id, '1'); SB.rpc('compter', {bien: p.id, champ: 'views'}).then(() => {}, () => {}); } } catch (e) {} }
  /* Adresse sans répétition. */
  g.querySelectorAll('p.muted.small').forEach(x => { if (!x.querySelector('svg') || !/—/.test(x.textContent)) return;
    const parts = [p.quartier, p.commune, p.city, p.region].map(s => String(s || '').trim()).filter((s, i, a) => s && a.findIndex(t => t.toLowerCase() === s.toLowerCase()) === i);
    x.innerHTML = `${icon('pin', 14)} ${esc(parts.join(', '))} · <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', ') + ', Sénégal')}" target="_blank" rel="noopener">Voir sur une carte</a>`; });
  /* Caractéristiques : type avec majuscule ; pas de « 0 chambre ». */
  g.querySelectorAll('.small.muted').forEach(l => { const v = l.nextElementSibling; if (!v || v.tagName !== 'B') return;
    if (l.textContent === 'Type') v.textContent = capitaliser(v.textContent);
    if (/^(Chambres|Salles de bain)$/.test(l.textContent) && /^0?$/.test(v.textContent.trim())) l.parentElement.remove();
    if (l.textContent === 'Surface' && /^(0|null|undefined) m²$/.test(v.textContent.trim())) l.parentElement.remove(); });
  g.querySelectorAll('p.small.muted').forEach(x => { if (/Disponible à partir du —/.test(x.textContent)) x.textContent = p.status === 'disponible' ? 'Disponible dès maintenant.' : ''; });
  g.querySelectorAll('.gallery .photo').forEach(t => { t.style.cursor = 'zoom-in'; });
  /* Référence lisible. */
  g.querySelectorAll('.row-between').forEach(r => { const s = r.querySelector('span'), b = r.querySelector('b'); if (s && b && s.textContent === 'Référence') b.textContent = refAnnonce(p.id); });
  /* Badges : « Propriétaire vérifié » seulement si l'identité l'est. */
  const nonVerifie = !owner.verifLevel || owner.verifLevel === 'none';
  g.querySelectorAll('.small.muted').forEach(x => { if (x.textContent.trim() === 'Propriétaire vérifié' && nonVerifie) x.textContent = 'Particulier'; });
  /* Partager. */
  const carteAction = [...g.querySelectorAll('.card')].find(c => c.querySelector('[data-action="toggle-fav"], [data-action="ask-visit"], [data-action="contact"]')) || g.querySelector('.stack > .card');
  const lien = (/^https?:/.test(location.origin) ? location.origin + location.pathname : DEUKSIL_CONFIG.siteUrl + '/') + '#/property/' + p.id;
  const msg = `${p.title} — ${money(p.price)}${p.transaction === 'location' ? ' / mois' : ''} sur DEUKSIL : ${lien}`;
  if (carteAction && !g.querySelector('.cf-partage')) carteAction.insertAdjacentHTML('afterend', `<div class="card pad-s cf-partage"><b class="small">Partager cette annonce</b><div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap">
    <a class="btn ghost sm" href="https://wa.me/?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">${icon('message', 14)} WhatsApp</a>
    <button type="button" class="btn ghost sm" data-cf-copier="${esc(lien)}">${icon('copy' in ICONS ? 'copy' : 'file', 14)} Copier le lien</button></div></div>`);
  /* Sa propre annonce : pas de favori, de visite ni de signalement, mais « Modifier ». */
  if (chezMoi && carteAction) {
    carteAction.querySelectorAll('[data-action="toggle-fav"], [data-action="ask-visit"], [data-action="contact"], [data-action="call-owner"], a[href^="tel:"]').forEach(b => b.remove());
    if (!carteAction.querySelector('.cf-mienne')) carteAction.insertAdjacentHTML('beforeend', `<div class="cf-mienne"><p class="small muted" style="margin:12px 0 8px">C'est votre annonce : voici ce que voient les visiteurs.</p>
      <a class="btn block" href="#/owner/property/${p.id}">${icon('edit' in ICONS ? 'edit' : 'settings', 16)} Modifier l'annonce</a></div>`);
    g.querySelectorAll('[data-action="g5-report"]').forEach(b => b.remove());
  }
  /* Téléphone : les actions restent à portée de pouce. */
  if (!chezMoi && p.status !== 'loue' && p.status !== 'vendu' && !document.querySelector('.cf-barre')) {
    const visite = g.querySelector('[data-action="ask-visit"]'), contact = g.querySelector('[data-action="contact"]');
    if (visite || contact) document.querySelector('#app').insertAdjacentHTML('beforeend', `<div class="cf-barre">${contact ? `<button class="btn ghost" data-action="contact" data-id="${p.id}">${icon('message', 16)} Écrire</button>` : ''}${visite ? `<button class="btn" data-action="ask-visit" data-id="${p.id}">${icon('calendar', 16)} Visiter</button>` : ''}</div>`);
  }
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-cf-copier]'); if (!b) return;
  e.preventDefault(); const v = b.dataset.cfCopier;
  const ok = () => toast('Lien copié : collez-le dans un message.');
  try { navigator.clipboard.writeText(v).then(ok, () => toast('Copiez ce lien : ' + v, 'warn')); } catch (x) { toast('Copiez ce lien : ' + v, 'warn'); }
});

/* --- 6. Recherche ----------------------------------------------------------------- */
function rechercheConfort() {
  if (!/^#\/search/.test(location.hash)) return;
  const u = Auth.current();
  /* « Créer une alerte » pour tous (le visiteur est invité à se connecter). */
  const enr = document.querySelector('#app [data-action="save-search"]');
  if (enr && !enr.dataset.cf) { enr.dataset.cf = '1'; enr.classList.remove('ghost'); enr.classList.add('soft'); enr.innerHTML = `${icon('bell', 15)} Créer une alerte`; enr.title = 'Être prévenu des nouvelles annonces qui correspondent à cette recherche'; }
  if (!enr) {
    const tri = [...document.querySelectorAll('#app select')].find(s => [...s.options].some(o => /Plus récents/.test(o.textContent)));
    const zone = tri && (tri.closest('.row, .row-between, div') || tri.parentElement);
    if (zone && !document.querySelector('#app .cf-alerte')) zone.insertAdjacentHTML('beforeend', `<button class="btn soft sm cf-alerte" data-action="save-search" title="Être prévenu des nouvelles annonces qui correspondent à cette recherche">${icon('bell', 15)} Créer une alerte</button>`);
  }
  /* « Comparer » sur chaque carte. */
  document.querySelectorAll('#app article.carte-bien:not([data-cf])').forEach(c => {
    c.dataset.cf = '1';
    const id = (c.querySelector('[data-action="toggle-fav"][data-id]') || {dataset: {}}).dataset.id; if (!id) return;
    const corps = c.querySelector('.cb-corps') || c;
    corps.insertAdjacentHTML('beforeend', `<label class="cf-cmp small" title="Comparer jusqu'à 3 biens"><input type="checkbox" data-action="toggle-compare" data-id="${id}" ${compareIds.includes(id) ? 'checked' : ''}> Comparer</label>`);
  });
  /* Puces de filtre : pas deux fois « Dakar » (région et ville du même nom). */
  const vues = new Set();
  document.querySelectorAll('#app .chip, #app .fchip, #app [data-action^="rm-filter"], #app [data-action="chip-remove"]').forEach(x => { const t = x.textContent.trim(); if (vues.has(t) && /^[^\d]+$/.test(t)) x.remove(); else vues.add(t); });
  barreComparaison();
}
function barreComparaison() {
  let b = document.querySelector('.cf-cmp-barre');
  if (!/^#\/search/.test(location.hash) || compareIds.length === 0) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement('div'); b.className = 'cf-cmp-barre'; document.body.appendChild(b); }
  b.innerHTML = `<span>${compareIds.length} bien${compareIds.length > 1 ? 's' : ''} à comparer${compareIds.length < 2 ? ' · cochez-en un autre' : ''}</span>
    <button class="btn ghost sm" data-action="clear-compare">Vider</button>${compareIds.length >= 2 ? `<a class="btn sm" href="#/compare">Comparer</a>` : ''}`;
}
window.addEventListener('click', e => { if (e.target.closest && e.target.closest('.cf-cmp')) e.stopPropagation(); }, true);
/* Retour à la recherche depuis le menu : les filtres oubliés ne cachent plus tout. */
document.addEventListener('click', e => {
  const a = e.target.closest && e.target.closest('nav a[href="#/search"], .tabbar a[href="#/search"], .side a[href="#/search"]'); if (!a) return;
  try { const vide = {transaction: '', region: '', city: '', quartier: '', type: '', min: '', max: '', rooms: '', baths: '', surface: '', furnished: false, parking: false, sort: 'recent', page: 1}; searchState = {...vide}; } catch (x) {}
}, true);

/* --- 7. Espaces ---------------------------------------------------------------------- */
function espacesConfort() {
  const u = Auth.current(); if (!u) return;
  const T = u.member ? DB.findItem(DB.K.users, u.member.parentId) || {} : u;
  /* Le bon nom : l'agence par son nom ; un membre par le sien. */
  if (u.role === 'agency' && !u.member) document.querySelectorAll('.main > .content h1, .main > .content .hero h2').forEach(h => { if (/^Bonjour/.test(h.textContent) && T.agencyName && !h.dataset.cf) { h.dataset.cf = '1'; h.textContent = `Bonjour, ${T.agencyName}`; } });
  if (u.member) { const s = document.querySelector('.side-user:not([data-cf])'); if (s) { s.dataset.cf = '1'; const n = s.querySelector('div[style*="font-weight:600"]'), r = s.querySelector('.small.muted');
    if (n) n.textContent = `${u.firstName || ''} ${u.lastName || ''}`.trim() || n.textContent; if (r) r.textContent = `${r.textContent} · ${T.agencyName || displayName(T)}`; } }
  /* Agent : « Ajouter un bien » parmi les raccourcis. */
  if (u.member && /dashboard/.test(location.hash) && (u.perms || []).includes('biens')) {
    const z = document.querySelector('.main > .content .hero-pills, .main > .content .qa-grid');
    if (z && !z.querySelector('[href="#/owner/property/new"]')) z.insertAdjacentHTML('afterbegin', z.classList.contains('hero-pills') ? `<a href="#/owner/property/new">${icon('plus', 15)} Ajouter un bien</a>` : `<a class="qa" href="#/owner/property/new">${icon('plus', 18)}<span>Ajouter un bien</span></a>`);
  }
  /* Publication par un agent : elle passe par la validation de l'agence. */
  if (u.member && u.member.role === 'agent') document.querySelectorAll('#wiz p.small.muted').forEach(x => { if (/publication est immédiate/.test(x.textContent)) x.textContent = 'Vous verrez un récapitulatif. Votre annonce sera visible dès que l\'agence l\'aura validée.'; });
  /* Fin de bail : remettre le logement en location est le cas courant. */
  document.querySelectorAll('input[name="libere"]:not([data-cf])').forEach(i => { i.dataset.cf = '1'; i.checked = true; });
  /* Propriétaire (sans agence) : la Gestion ne montre pas les écrans d'agence. */
  if (u.role === 'owner' && !u.ownerRec && !gMine('owners', T).length) document.querySelectorAll('#app a[href="#/manage/owners"], #app a[href="#/manage/mandates"], #app a[href="#/manage/transfers"]').forEach(a => { const t = a.closest('.hub-tile, .gtile, li') || a; t.remove(); });
  /* Dépenses : catégories avec majuscule (la valeur enregistrée ne change pas). */
  document.querySelectorAll('#app select[name="cat"] option:not([data-cf])').forEach(o => { o.dataset.cf = '1'; o.textContent = capitaliser(o.textContent); });
  /* Exemples de saisie justes. */
  document.querySelectorAll('#app input[placeholder="Ex. Mamadou Diallo"]').forEach(i => { if (/agence|agency|name/i.test(i.name) && u.role === 'agency') i.placeholder = 'Ex. Teranga Immobilier'; });
  document.querySelectorAll('#app .field').forEach(fl => { const l = (fl.querySelector('label') || {}).textContent || '', i = fl.querySelector('input[type="number"]'); if (!i || i.dataset.cfPh) return; i.dataset.cfPh = '1';
    if (/mois/i.test(l) && /250 000/.test(i.placeholder)) i.placeholder = 'Ex. 1'; if (/%/.test(l) && /250 000/.test(i.placeholder)) i.placeholder = 'Ex. 10'; });
  /* Équipe : « Ajouter un membre » ouvre directement le formulaire. */
  document.querySelectorAll('#app a[href="#/manage/team"]').forEach(a => { if (/Ajouter un membre/.test(a.textContent) && !a.dataset.cf) { a.dataset.cf = '1'; a.href = '#/manage/team?s=g4-member'; } });
  if (/^#\/manage\/team/.test(location.hash) && LIEN && LIEN.p && LIEN.p.get('s') === 'g4-member' && Date.now() - LIEN.at < 3000) { const f = document.querySelector('form[data-action="g4-member"]'); if (f && !f.dataset.cfVu) { f.dataset.cfVu = '1'; f.scrollIntoView({block: 'start', behavior: 'smooth'}); const i = f.querySelector('input'); if (i) setTimeout(() => i.focus({preventScroll: true}), 400); } }
  /* Mandat : la commission se pré-remplit avec celle du propriétaire choisi. */
  const fm = document.querySelector('#app form[data-action="m-new"]:not([data-cf])');
  if (fm) { fm.dataset.cf = '1'; const s = fm.querySelector('[name="ownerId2"]'), r = fm.querySelector('[name="rate"]');
    const maj = () => { const o = s && DB.findItem(DB.K.owners, s.value); if (o && +o.rate && r) r.value = o.rate; }; if (s) { s.addEventListener('change', maj); maj(); } }
}
/* Relance d'impayé : on voit le message avant de l'envoyer ; une par jour. */
let relanceConfirmee = null;
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="relance-interne"]'); if (!b) return;
  if (relanceConfirmee === b.dataset.id) { relanceConfirmee = null; return; }
  e.preventDefault(); e.stopImmediatePropagation();
  const r = DB.findItem(DB.K.rents, b.dataset.id); if (!r) return;
  if (r.remindedAt && String(r.remindedAt).slice(0, 10) === ymd()) return toast(`Déjà relancé aujourd'hui (${r.reminders || 1} relance${(r.reminders || 1) > 1 ? 's' : ''} au total). Réessayez demain si besoin.`, 'warn');
  const l = DB.findItem(DB.K.leases, r.leaseId) || {}, loc = typeof locataireDuBail === 'function' ? locataireDuBail(l) : null;
  confirmDialog({title: 'Relancer le locataire', message: `${loc ? `${loc.firstName} recevra ce message dans son espace` : `${l.tenant || 'Ce locataire'} n'a pas encore d'espace : la relance sera seulement notée (utilisez « Message » pour WhatsApp)`} :\n« Rappel : le loyer de ${monthLabel(r.month)} (${money(rRest(r) || r.amount)}) reste à régler. »`,
    confirmLabel: loc ? 'Envoyer la relance' : 'Noter la relance', onConfirm: () => { relanceConfirmee = b.dataset.id; b.click(); }});
}, true);
/* Confirmations après les actions courantes. */
DB.updateItem = (function (prec) {
  return function (k, id, patch) {
    const avant = k === DB.K.users ? DB.findItem(k, id) : null;
    const x = prec.call(DB, k, id, patch);
    try {
      const u = Auth.current();
      if (k === DB.K.users && u && id === u.id && patch && 'avatarPhoto' in patch && avant && avant.avatarPhoto !== patch.avatarPhoto) setTimeout(() => toast(patch.avatarPhoto ? 'Photo de profil enregistrée.' : 'Photo de profil retirée.'), 30);
    } catch (e) {}
    return x;
  };
})(DB.updateItem);
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-profile"], form[data-action="ag-profil"], form[data-action="agent-profil"]'); if (!f) return;
  setTimeout(() => { if (!document.querySelector('.toast') && !document.querySelector('.modal') && !f.querySelector('.champ-err')) toast('Profil enregistré.'); }, 400);
}, true);

/* --- 8. Titre d'onglet ---------------------------------------------------------------- */
function titreOnglet() { const t = document.title; const n = t.replace(/(\s*\|\s*DEUKSIL)+$/, ' | DEUKSIL').replace(/^DEUKSIL \| DEUKSIL$/, 'DEUKSIL'); if (n !== t) document.title = n; }

/* --- 9. Retouches après chaque affichage --------------------------------------------- */
function retouchesConfort() {
  const app = document.getElementById('app'); if (!app) return;
  asterisques(app); const mo = document.querySelector('.modal'); if (mo) asterisques(mo);
  motifConnexion(); ficheBien(); rechercheConfort(); espacesConfort(); titreOnglet();
  if (!/^#\/property\//.test(location.hash)) document.querySelectorAll('.cf-barre').forEach(x => x.remove());
}
if (typeof MutationObserver === 'function' && document.body) {
  let prevu = false;
  new MutationObserver(() => { if (prevu) return; prevu = true; requestAnimationFrame(() => { prevu = false; try { retouchesConfort(); } catch (e) { console.warn('[DEUKSIL] confort', e); } }); })
    .observe(document.body, {childList: true, subtree: true});
}
addEventListener('hashchange', () => setTimeout(() => { try { barreComparaison(); titreOnglet(); } catch (e) {} }, 0));

/* --- 10. Statistiques des annonces dans le menu du propriétaire -------------------- */
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner'); if (!d || !d.get) return;
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, get() {
    const m = d.get.call(MENUS_RAW); let u = null; try { u = Auth.current(); } catch (e) {}
    if (!u || u.role !== 'owner' || u.ownerRec || !Array.isArray(m) || m.some(x => x[0] === '#/owner/statistics')) return m;
    if (u.member && !(u.perms || []).includes('biens')) return m;
    const i = m.findIndex(x => x[0] === '#/coffre' || x[0] === '#/owner/messages');
    const c = m.slice(); c.splice(i >= 0 ? i : c.length, 0, ['#/owner/statistics', 'Statistiques', 'chart']); return c;
  }});
})();
route(/^\/owner\/stats$/, () => { go('#/owner/statistics'); return false; });
