/* =============================================================================
   MODULE : 99g-formulaires.js — formulaires de compte prêts pour la mise en ligne
     1. Serveur : un seul point d'appel vers l'API (DEUKSIL_CONFIG, 00-config.js).
     2. Inscription : contrôles complets (e-mail, téléphone, CNI, mot de passe,
        conditions d'utilisation), champs de l'agence, pré-remplissage Google.
     3. Mot de passe oublié → code reçu → nouveau mot de passe.
     4. Vérification de l'adresse e-mail (code à 6 chiffres).
     5. Page Contact (assistance).
   Sans serveur configuré, chaque formulaire s'affiche et se contrôle
   normalement ; ce qui exige un envoi (code par e-mail ou SMS) le dit
   clairement et oriente vers l'assistance au lieu de simuler un envoi.
   ============================================================================= */

/* --- 1. Serveur ------------------------------------------------------------ */
const Serveur = {
  actif() { return !!String(DEUKSIL_CONFIG.apiBase || '').trim(); },
  async envoyer(cle, donnees) {
    const C = DEUKSIL_CONFIG, url = String(C.apiBase).trim().replace(/\/+$/, '') + ((C.routes || {})[cle] || '/' + cle);
    let r;
    try { r = await fetch(url, {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(donnees)}); }
    catch (e) { throw new Error('Le serveur DEUKSIL ne répond pas. Vérifiez votre connexion et réessayez.'); }
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error(j.message || j.error || `La demande a été refusée (erreur ${r.status}). Réessayez dans un instant.`);
    return j;
  }
};

/* --- Outils communs -------------------------------------------------------- */
const RE_EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;
function telSenegal(v) {
  const d = String(v || '').replace(/[\s.\-()]/g, '').replace(/^(\+|00)221/, '');
  return /^[37]\d{8}$/.test(d) ? d : '';
}
const motDePasseFaible = p => String(p || '').length < 8 || !/[a-zA-ZÀ-ÿ]/.test(p) || !/\d/.test(p);
const memoire = {
  lire(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
  ecrire(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  oublier(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
};
const CLE_REINIT = 'deuksil_reinit', CLE_VERIF = 'deuksil_verif_email', CLE_GOOGLE = 'deuksil_inscription_google';

/* Message sous le champ concerné (même rendu que js/94-finalisation.js). */
function erreurIci(f, nom, msg) {
  try { effacerErreursChamps(f); } catch (e) {}
  const i = nom ? f.querySelector(`[name="${nom}"]`) : null;
  const bloc = document.createElement('div');
  bloc.className = 'champ-err'; bloc.setAttribute('role', 'alert'); bloc.textContent = msg;
  if (i) {
    i.classList.add('champ-ko'); i.setAttribute('aria-invalid', 'true');
    (i.closest('.field') || i.parentElement).appendChild(bloc);
    const etape = i.closest('.wstep');
    if (etape && !etape.classList.contains('on') && typeof wizGo === 'function') try { wizGo(f, +etape.dataset.step); } catch (e) {}
    setTimeout(() => { try { i.focus({preventScroll: true}); i.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch (e) {} }, 60);
  } else {
    bloc.classList.add('champ-err-form');
    const zone = f.querySelector('#reg-err, .f-zone-err');
    if (zone) { zone.innerHTML = ''; zone.appendChild(bloc); } else f.prepend(bloc);
  }
  return false;
}
function occupe(f, oui, texte = 'Envoi en cours…') {
  const b = f.querySelector('button:not([type="button"])'); if (!b) return;
  if (oui) { b.dataset.texte = b.innerHTML; b.disabled = true; b.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span> ${texte}`; }
  else { b.disabled = false; if (b.dataset.texte) b.innerHTML = b.dataset.texte; }
}
/* Encadré d'état sous un formulaire : info (pas encore activé), ok, erreur. */
function etatForm(f, ton, titre, texte, actions = '') {
  let z = f.parentElement.querySelector(':scope > .f-etat');
  if (!z) { z = document.createElement('div'); f.insertAdjacentElement('afterend', z); }
  z.className = `f-etat ${ton}`; z.setAttribute('role', ton === 'bad' ? 'alert' : 'status');
  z.innerHTML = `<span class="f-etat-ic">${icon(ton === 'ok' ? 'checkCircle' : ton === 'bad' ? 'alert' : 'clock', 18)}</span>
    <div><b>${titre}</b><p>${texte}</p>${actions ? `<div class="f-etat-act">${actions}</div>` : ''}</div>`;
  z.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  return z;
}
const pasEncoreActif = (f, quoi) => etatForm(f, 'info', `${quoi} n'est pas encore activé`,
  'DEUKSIL n\'envoie pas encore de codes par e-mail ou SMS. Pour retrouver l\'accès à votre compte dès maintenant, écrivez à l\'assistance : nous vous répondrons rapidement.',
  `<a class="btn sm" href="#/contact?sujet=acces">${icon('message', 15)} Contacter l'assistance</a>`);

document.head.insertAdjacentHTML('beforeend', `<style>
.f-etat{display:flex;gap:12px;align-items:flex-start;margin:16px 0 0;padding:14px 16px;border-radius:14px;border:1px solid var(--line);background:var(--surface-2);color:var(--ink)}
.f-etat.info{background:var(--info-soft);border-color:color-mix(in srgb,var(--info) 22%,transparent)}
.f-etat.ok{background:var(--ok-soft);border-color:color-mix(in srgb,var(--ok) 25%,transparent)}
.f-etat.bad{background:var(--bad-soft);border-color:color-mix(in srgb,var(--bad) 25%,transparent)}
.f-etat-ic{flex:none;display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--surface)}
.f-etat.info .f-etat-ic{color:var(--info)}.f-etat.ok .f-etat-ic{color:var(--ok)}.f-etat.bad .f-etat-ic{color:var(--bad)}
.f-etat b{display:block;font-size:.95rem}.f-etat p{margin:3px 0 0;font-size:.86rem;line-height:1.5;color:var(--ink-2)}
.f-etat-act{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.f-liens{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:16px;font-size:.86rem}
.f-liens a{color:var(--brand);font-weight:600;text-decoration:none}.f-liens a:hover{text-decoration:underline}
.input.f-code{font-size:1.35rem!important;letter-spacing:.5em;text-align:center;font-variant-numeric:tabular-nums;padding-left:.5em!important}
.f-google{display:flex;gap:10px;align-items:center;margin:0 0 14px;padding:10px 12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--line);font-size:.86rem}
.ct-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:18px;align-items:start}
.ct-info{display:flex;flex-direction:column;gap:14px}
.ct-l{display:flex;gap:12px;align-items:flex-start}.ct-l b{display:block}.ct-l span.small{color:var(--muted)}
@media (max-width:860px){.ct-grid{grid-template-columns:1fr}}
</style>`);

/* Écran à deux panneaux, identique à la connexion (js/46-connexion.js). */
function pageCompte({badge, titre, lede, corps, retour = ['#/login', 'Retour à la connexion']}) {
  return `<div class="auth">
  <aside class="auth-side">
    <img class="bg" src="${PHOTOS.cover}" alt="" loading="eager">
    <a class="logo" href="#/"><img src="${LOGO_LIGHT}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
    <div><h1>Votre immobilier,<span>simplement maîtrisé.</span></h1>
      <p>Recherchez, gérez et développez vos biens depuis un espace unique.</p></div>
    <p class="small" style="margin:0;color:#8FA6BC">DEUKSIL © ${new Date().getFullYear()} · Sénégal</p>
  </aside>
  <main class="auth-main">
    <div class="auth-top"><a class="small muted" href="${retour[0]}" style="display:flex;align-items:center;gap:7px;text-decoration:none">${icon('arrowLeft', 16)} ${retour[1]}</a></div>
    <div class="auth-box">
      <a class="logo" href="#/"><img src="${LOGO_DARK}" alt="DEUKSIL" class="mark"><span>EUKSIL</span></a>
      <span class="auth-badge">${icon('lock', 14)} ${badge}</span>
      <h2>${titre}</h2><p class="lede">${lede}</p>
      ${corps}
    </div>
  </main></div>`;
}
const champ = (id, lab, input, aide = '') => `<div class="field"><label for="${id}">${lab}</label>${input}${aide ? `<p class="small fhint" style="margin:6px 0 0">${aide}</p>` : ''}</div>`;
const champMdp = (id, nom, lab, auto = 'new-password') => champ(id, lab, `<div class="pw-wrap"><input class="input" type="password" id="${id}" name="${nom}" minlength="8" autocomplete="${auto}" placeholder="${nom === 'confirme' ? 'Retapez le mot de passe' : '8 caractères minimum'}" required><button type="button" class="pw-toggle" data-action="toggle-pw" aria-label="Afficher le mot de passe">${icon('eye', 17)}</button></div>`);

/* --- 2. Inscription -------------------------------------------------------- */
function controleInscription(f, etape) {
  const d = formData(f), t = k => String(d[k] || '').trim(), U = DB.getData(DB.K.users);
  const fautes = [], si = (cond, nom, msg) => { if (!cond) fautes.push([nom, msg]); };
  if (!etape || etape === 1) si(['client', 'owner', 'agency'].includes(d.role), 'role', 'Choisissez le type de compte.');
  if (!etape || etape === 2) {
    if (d.role === 'agency') {
      si(t('agencyName').length >= 2, 'agencyName', 'Indiquez le nom de l\'agence.');
      si(t('address').length >= 3, 'address', 'Indiquez l\'adresse de l\'agence.');
    }
    si(t('firstName').length >= 2, 'firstName', 'Indiquez votre prénom.');
    si(t('lastName').length >= 2, 'lastName', 'Indiquez votre nom.');
    const em = t('email').toLowerCase();
    if (!RE_EMAIL.test(em)) si(false, 'email', 'Adresse e-mail invalide. Exemple : vous@exemple.com');
    else si(!U.some(u => String(u.email || '').toLowerCase() === em), 'email', 'Un compte existe déjà avec cette adresse e-mail. Connectez-vous, ou utilisez « Mot de passe oublié ».');
    si(telSenegal(d.phone), 'phone', 'Numéro de téléphone invalide : 9 chiffres, par exemple 77 123 45 67.');
    const cni = t('cni').replace(/\s/g, '');
    if (!/^\d{13}$/.test(cni)) si(false, 'cni', 'Le numéro de CNI comporte 13 chiffres.');
    else si(!U.some(u => u.cni === cni), 'cni', 'Un compte existe déjà avec ce numéro de CNI. Connectez-vous ou contactez l\'assistance.');
  }
  if (!etape || etape === 3) {
    si(!motDePasseFaible(d.password), 'password', 'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.');
    si(!(typeof MDP_DEMO !== 'undefined' && MDP_DEMO.includes(d.password)), 'password', 'Ce mot de passe est trop connu : choisissez-en un autre.');
    si(d.password === d.password2, 'password2', 'Les deux mots de passe ne correspondent pas.');
    si(!!d.cgu, 'cgu', 'Acceptez les conditions d\'utilisation pour créer votre compte.');
  }
  return fautes[0] || null;
}
/* Champs de l'agence : actifs et obligatoires seulement pour une agence. */
function appliquerRole(f) {
  if (!f) return;
  const ag = (f.querySelector('input[name="role"]:checked') || {}).value === 'agency', z = f.querySelector('#agency-fields'); if (!z) return;
  z.classList.toggle('hidden', !ag);
  z.querySelectorAll('input').forEach(i => { i.disabled = !ag; if (['agencyName', 'address'].includes(i.name)) i.required = ag; });
}
document.addEventListener('change', e => { if (e.target.name === 'role' && e.target.closest('#wiz')) appliquerRole(e.target.form); });
/* « Suivant » : contrôle de l'étape avant de passer à la suivante. */
window.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="wiz-next"]'), f = b && b.closest('form[data-action="register"]'); if (!f) return;
  appliquerRole(f);
  const faute = controleInscription(f, +(f.dataset.cur || 1));
  if (faute) { e.preventDefault(); e.stopImmediatePropagation(); erreurIci(f, faute[0], faute[1]); }
  else try { effacerErreursChamps(f); } catch (err) {}
}, true);
/* Envoi : tout est contrôlé ; avec un serveur, le compte y est créé d'abord. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="register"]'); if (!f) return;
  appliquerRole(f);                                   // profil changé sans événement (saisie automatique)
  const faute = controleInscription(f, 0);
  if (faute) { e.preventDefault(); e.stopImmediatePropagation(); erreurIci(f, faute[0], faute[1]); return; }
  memoire.oublier(CLE_GOOGLE);
  if (!Serveur.actif()) return;                       // mode local : js/27-actions.js crée le compte
  e.preventDefault(); e.stopImmediatePropagation();
  inscrireSurServeur(f);
}, true);
async function inscrireSurServeur(f) {
  const d = formData(f), t = k => String(d[k] || '').trim();
  occupe(f, true, 'Création du compte…');
  try {
    await Serveur.envoyer('inscription', {role: d.role, firstName: t('firstName'), lastName: t('lastName'), email: t('email').toLowerCase(), phone: t('phone'),
      cni: t('cni'), password: d.password, agencyName: t('agencyName'), address: t('address'), ninea: t('ninea'), rccm: t('rccm'), cgu: true});
  } catch (err) { occupe(f, false); return erreurIci(f, '', err.message); }
  occupe(f, false);
  memoire.ecrire(CLE_VERIF, t('email').toLowerCase());
  startRegistration(d);                               // copie locale : l'application lit encore ses données dans le navigateur
  setTimeout(() => { if (Auth.current()) go('#/verifier-email'); }, 400);
}
/* Arrivée depuis Google sans compte : nom et adresse déjà remplis. */
function preRemplirInscription() {
  if (location.hash.split('?')[0] !== '#/register') return;
  const f = document.querySelector('form[data-action="register"]'); if (!f) return;
  appliquerRole(f);
  const g = memoire.lire(CLE_GOOGLE); if (!g || Date.now() - g.t > 30 * 60000 || f.dataset.google) return;
  f.dataset.google = '1';
  [['email', g.email], ['firstName', g.firstName], ['lastName', g.lastName]].forEach(([n, v]) => { const i = f.querySelector(`[name="${n}"]`); if (i && v && !i.value) i.value = v; });
  const carte = f.querySelector('.wstep[data-step="1"] .wiz-card');
  if (carte) carte.insertAdjacentHTML('afterbegin', `<div class="f-google">${typeof gLogo === 'function' ? gLogo(18) : ''}<span>Compte Google : <b>${esc(g.email)}</b>. Choisissez votre profil, puis complétez vos informations.</span></div>`);
}

/* --- 3. Mot de passe oublié ------------------------------------------------ */
route(/^\/mot-de-passe-oublie$/, () => {
  const mem = memoire.lire(CLE_REINIT) || {};
  return pageCompte({badge: 'Récupération du compte', titre: 'Mot de passe oublié', lede: 'Indiquez l\'adresse e-mail ou le téléphone de votre compte : nous vous enverrons un code pour choisir un nouveau mot de passe.',
    corps: `<form data-action="mdp-oubli" novalidate>
      ${champ('mo-id', 'Adresse e-mail ou téléphone', `<input class="input" data-ds="1" data-ic="user" id="mo-id" name="identifiant" autocomplete="username" placeholder="vous@exemple.com ou 77 123 45 67" value="${esc(mem.identifiant || '')}" required>`)}
      <div class="f-zone-err"></div>
      <button class="btn block">Recevoir un code ${icon('arrowRight', 17)}</button>
    </form>
    <div class="f-liens"><a href="#/reinitialiser-mot-de-passe">J'ai déjà un code</a><a href="#/login">Je me souviens de mon mot de passe</a></div>`});
});
const identifiantValide = v => { v = String(v || '').trim(); return RE_EMAIL.test(v) ? v.toLowerCase() : telSenegal(v) ? v : ''; };
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-oubli"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const id = identifiantValide(formData(f).identifiant);
  if (!id) return erreurIci(f, 'identifiant', 'Saisissez une adresse e-mail valide ou un numéro à 9 chiffres (ex. 77 123 45 67).');
  try { effacerErreursChamps(f); } catch (err) {}
  memoire.ecrire(CLE_REINIT, {identifiant: id, t: Date.now()});
  if (!Serveur.actif()) return pasEncoreActif(f, 'L\'envoi du code');
  occupe(f, true);
  try { await Serveur.envoyer('motDePasseOublie', {identifiant: id}); }
  catch (err) { occupe(f, false); return etatForm(f, 'bad', 'Envoi impossible', esc(err.message)); }
  occupe(f, false);
  etatForm(f, 'ok', 'Code envoyé', `Si un compte correspond à <b>${esc(id)}</b>, vous allez recevoir un code à 6 chiffres par ${RE_EMAIL.test(id) ? 'e-mail' : 'SMS'}. Il est valable 15 minutes. Pensez à regarder vos courriers indésirables.`,
    `<a class="btn sm" href="#/reinitialiser-mot-de-passe">Saisir le code</a>`);
}, true);

route(/^\/reinitialiser-mot-de-passe$/, () => {
  const mem = memoire.lire(CLE_REINIT) || {};
  return pageCompte({badge: 'Récupération du compte', titre: 'Nouveau mot de passe', lede: 'Saisissez le code reçu, puis choisissez votre nouveau mot de passe.', retour: ['#/mot-de-passe-oublie', 'Recevoir un autre code'],
    corps: `<form data-action="mdp-reinit" novalidate>
      ${champ('mr-id', 'Adresse e-mail ou téléphone', `<input class="input" data-ds="1" data-ic="user" id="mr-id" name="identifiant" autocomplete="username" value="${esc(mem.identifiant || '')}" required>`)}
      ${champ('mr-code', 'Code à 6 chiffres', '<input class="input f-code" id="mr-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required>')}
      ${champMdp('mr-mdp', 'nouveau', 'Nouveau mot de passe')}
      ${champMdp('mr-mdp2', 'confirme', 'Confirmer le mot de passe')}
      <p class="small fhint" style="margin:-4px 0 14px">8 caractères minimum, avec au moins une lettre et un chiffre.</p>
      <div class="f-zone-err"></div>
      <button class="btn block">Enregistrer le mot de passe</button>
    </form>
    <div class="f-liens"><a href="#/mot-de-passe-oublie">Je n'ai pas reçu de code</a><a href="#/contact?sujet=acces">Contacter l'assistance</a></div>`});
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="mdp-reinit"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const d = formData(f), id = identifiantValide(d.identifiant), code = String(d.code || '').replace(/\D/g, '');
  if (!id) return erreurIci(f, 'identifiant', 'Saisissez l\'adresse e-mail ou le téléphone de votre compte.');
  if (code.length !== 6) return erreurIci(f, 'code', 'Le code comporte 6 chiffres.');
  if (motDePasseFaible(d.nouveau)) return erreurIci(f, 'nouveau', 'Mot de passe trop faible : 8 caractères minimum, avec au moins une lettre et un chiffre.');
  if (d.nouveau !== d.confirme) return erreurIci(f, 'confirme', 'Les deux mots de passe ne correspondent pas.');
  try { effacerErreursChamps(f); } catch (err) {}
  if (!Serveur.actif()) return pasEncoreActif(f, 'La vérification du code');
  occupe(f, true, 'Enregistrement…');
  try { await Serveur.envoyer('reinitialisation', {identifiant: id, code, password: d.nouveau}); }
  catch (err) { occupe(f, false); return etatForm(f, 'bad', 'Code refusé', esc(err.message)); }
  occupe(f, false); memoire.oublier(CLE_REINIT); f.reset();
  etatForm(f, 'ok', 'Mot de passe modifié', 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.', `<a class="btn sm" href="#/login">Se connecter</a>`);
}, true);

/* --- 4. Vérification de l'adresse e-mail ----------------------------------- */
route(/^\/verifier-email$/, () => {
  const u = Auth.current(), email = (u && !u.member && u.email) || memoire.lire(CLE_VERIF) || '';
  const fait = u && !u.member && u.emailVerifie;
  return pageCompte({badge: 'Sécurité du compte', titre: 'Vérifiez votre adresse e-mail', retour: u ? [Auth.home(u), 'Retour à mon espace'] : ['#/login', 'Retour à la connexion'],
    lede: fait ? 'Votre adresse e-mail est déjà vérifiée.' : 'Saisissez le code à 6 chiffres envoyé à votre adresse e-mail.',
    corps: fait ? `<a class="btn block" href="${Auth.home(u)}">Aller à mon espace</a>` : `<form data-action="email-verif" novalidate>
      ${champ('ve-email', 'Adresse e-mail', `<input class="input" id="ve-email" name="email" type="email" autocomplete="email" value="${esc(email)}" required>`)}
      ${champ('ve-code', 'Code à 6 chiffres', '<input class="input f-code" id="ve-code" name="code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="••••••" required>')}
      <div class="f-zone-err"></div>
      <button class="btn block">Vérifier mon adresse</button>
    </form>
    <div class="f-liens"><a href="#/verifier-email" data-action="email-renvoi">Renvoyer le code</a>${u ? `<a href="${Auth.home(u)}">Plus tard</a>` : ''}</div>`});
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="email-verif"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const d = formData(f), email = String(d.email || '').trim().toLowerCase(), code = String(d.code || '').replace(/\D/g, '');
  if (!RE_EMAIL.test(email)) return erreurIci(f, 'email', 'Adresse e-mail invalide.');
  if (code.length !== 6) return erreurIci(f, 'code', 'Le code comporte 6 chiffres.');
  try { effacerErreursChamps(f); } catch (err) {}
  if (!Serveur.actif()) return etatForm(f, 'info', 'La vérification par code n\'est pas encore activée', 'DEUKSIL n\'envoie pas encore de codes par e-mail. Votre compte fonctionne normalement en attendant.');
  occupe(f, true, 'Vérification…');
  try { await Serveur.envoyer('verifierEmail', {email, code}); }
  catch (err) { occupe(f, false); return etatForm(f, 'bad', 'Code refusé', esc(err.message)); }
  occupe(f, false); memoire.oublier(CLE_VERIF);
  const u = DB.findItem(DB.K.users, x => String(x.email || '').toLowerCase() === email);
  if (u) DB.updateItem(DB.K.users, u.id, {emailVerifie: true, emailVerifieLe: now()});
  const moi = Auth.current();
  etatForm(f, 'ok', 'Adresse vérifiée', 'Merci : votre adresse e-mail est confirmée.', moi ? `<a class="btn sm" href="${Auth.home(moi)}">Aller à mon espace</a>` : '<a class="btn sm" href="#/login">Se connecter</a>');
}, true);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="email-renvoi"]'); if (!b) return;
  e.preventDefault();
  const f = document.querySelector('form[data-action="email-verif"]'); if (!f) return;
  const email = String(formData(f).email || '').trim().toLowerCase();
  if (!RE_EMAIL.test(email)) return erreurIci(f, 'email', 'Indiquez l\'adresse e-mail à vérifier.');
  if (!Serveur.actif()) return etatForm(f, 'info', 'L\'envoi du code n\'est pas encore activé', 'DEUKSIL n\'envoie pas encore de codes par e-mail. Votre compte fonctionne normalement en attendant.');
  try { await Serveur.envoyer('renvoyerCode', {email}); etatForm(f, 'ok', 'Nouveau code envoyé', `Un nouveau code a été envoyé à <b>${esc(email)}</b>.`); }
  catch (err) { etatForm(f, 'bad', 'Envoi impossible', esc(err.message)); }
});

/* --- 5. Contact ------------------------------------------------------------ */
DB.K.contacts = DB.K.contacts || 'deuksil_contacts';
const SUJETS = [['question', 'Question sur DEUKSIL'], ['acces', 'Accès à mon compte'], ['annonce', 'Une annonce'], ['technique', 'Problème technique'],
  ['agence', 'Partenariat agence'], ['abus', 'Signaler un abus'], ['autre', 'Autre']];
route(/^\/contact$/, () => {
  const u = Auth.current(), moi = u ? (u.member || u) : {};
  const sujet = (typeof LIEN !== 'undefined' && LIEN && LIEN.path === '#/contact' && LIEN.p.get('sujet')) || 'question';
  const C = typeof DEUKSIL_CONTACT !== 'undefined' ? DEUKSIL_CONTACT : {};
  const ligne = (ic, titre, val) => val ? `<div class="ct-l"><span class="itile sm">${icon(ic, 17)}</span><div><b>${titre}</b><span class="small">${esc(val)}</span></div></div>` : '';
  return shellPublic(`<section class="wrap" style="max-width:1040px;padding:34px 0 60px">${crumbHtml('#/', 'Accueil', 'Contact')}
    <div class="page-head"><div><h1>Contacter DEUKSIL</h1><p class="muted">Une question, un souci d'accès, une annonce à signaler : écrivez-nous, nous vous répondons par e-mail.</p></div></div>
    <div class="ct-grid">
      <div><form class="card" data-action="contact-form" novalidate>
        <div class="form-grid">${champ('ct-nom', 'Nom complet <span class="req">*</span>', `<input class="input" id="ct-nom" name="name" autocomplete="name" value="${esc([moi.firstName, moi.lastName].filter(Boolean).join(' '))}" required>`)}
          ${champ('ct-email', 'Adresse e-mail <span class="req">*</span>', `<input class="input" id="ct-email" name="email" type="email" autocomplete="email" value="${esc(moi.email || u && u.email || '')}" required>`)}</div>
        <div class="form-grid">${champ('ct-tel', 'Téléphone', `<input class="input" id="ct-tel" name="phone" type="tel" autocomplete="tel" placeholder="77 123 45 67" value="${esc(moi.phone || '')}">`)}
          ${champ('ct-sujet', 'Sujet <span class="req">*</span>', `<select class="input" id="ct-sujet" name="subject" required>${SUJETS.map(([k, l]) => `<option value="${k}" ${k === sujet ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}</div>
        ${champ('ct-msg', 'Message <span class="req">*</span>', '<textarea class="input" id="ct-msg" name="message" rows="6" maxlength="3000" placeholder="Décrivez votre demande. Pour une annonce, indiquez son titre ou son adresse." required></textarea>')}
        <div class="f-zone-err"></div>
        <button class="btn">${icon('message', 16)} Envoyer le message</button>
      </form></div>
      <aside class="card ct-info"><h4 style="margin:0">Autres moyens de nous joindre</h4>
        ${ligne('mail', 'E-mail', C.email)}${ligne('phone', 'Téléphone', C.telephone)}${ligne('message', 'WhatsApp', C.whatsapp ? '+' + C.whatsapp : '')}${ligne('pin', 'Adresse', C.adresse)}
        ${ligne('clock', 'Délai de réponse', 'Sous 48 h ouvrées')}
        <p class="small muted" style="margin:0">Vous avez oublié votre mot de passe ? <a href="#/mot-de-passe-oublie">Recevoir un code</a>.</p></aside>
    </div></section>`);
});
window.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="contact-form"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const d = formData(f), t = k => String(d[k] || '').trim();
  if (t('name').length < 2) return erreurIci(f, 'name', 'Indiquez votre nom.');
  if (!RE_EMAIL.test(t('email'))) return erreurIci(f, 'email', 'Adresse e-mail invalide : nous en avons besoin pour vous répondre.');
  if (t('phone') && !telSenegal(t('phone')) && !/^\+\d{8,15}$/.test(t('phone').replace(/\s/g, ''))) return erreurIci(f, 'phone', 'Numéro de téléphone invalide.');
  if (t('message').length < 10) return erreurIci(f, 'message', 'Votre message est trop court (10 caractères minimum).');
  try { effacerErreursChamps(f); } catch (err) {}
  const msg = {name: t('name'), email: t('email').toLowerCase(), phone: t('phone'), subject: t('subject'), message: t('message').slice(0, 3000)};
  const libelle = (SUJETS.find(s => s[0] === msg.subject) || [, 'Message'])[1];
  if (Serveur.actif()) {
    occupe(f, true);
    try { await Serveur.envoyer('contact', msg); } catch (err) { occupe(f, false); return etatForm(f, 'bad', 'Envoi impossible', esc(err.message)); }
    occupe(f, false);
  } else {
    const u = Auth.current();
    DB.addItem(DB.K.contacts, {...msg, userId: u ? u.id : '', statut: 'nouveau'});
    if (!DB.lastWriteOk) return;
    notify('user_admin', `Contact · ${libelle} — ${msg.name} (${msg.email}${msg.phone ? ', ' + msg.phone : ''}) : ${msg.message.slice(0, 280)}`, '#/admin/dashboard');
    try { logActivity(`Message de contact reçu : ${libelle} (${msg.name})`); } catch (err) {}
  }
  f.reset();
  etatForm(f, 'ok', 'Message envoyé', `Merci ${esc(msg.name.split(' ')[0])}. Nous vous répondrons à <b>${esc(msg.email)}</b> sous 48 h ouvrées.`);
}, true);

/* --- Titres d'onglet et pré-remplissage après chaque affichage ------------- */
const TITRES_FORMULAIRES = {'#/mot-de-passe-oublie': 'Mot de passe oublié | DEUKSIL', '#/reinitialiser-mot-de-passe': 'Nouveau mot de passe | DEUKSIL',
  '#/verifier-email': 'Vérifier mon adresse e-mail | DEUKSIL', '#/contact': 'Contacter DEUKSIL | DEUKSIL'};
const _afterRenderFormulaires = afterRender;
afterRender = function () {
  const r = _afterRenderFormulaires.apply(this, arguments);
  try { const t = TITRES_FORMULAIRES[location.hash.split('?')[0]]; if (t) document.title = t; preRemplirInscription(); } catch (e) {}
  return r;
};
