/* ==========================================================================
   MODULE : menus-cni.js — correctifs issus de la recette (UAT Agence)

   1. Parité barre du bas / menu latéral : sur ORDINATEUR, le menu latéral
      reprend tout ce que la barre du bas du téléphone affiche (Publier,
      Gestion, Messages…), lu dans la barre elle-même. Le téléphone (barre du
      bas et tiroir) reste tel quel.
   2. Agence : « Visites » et « Équipe » reviennent dans le menu latéral
      (l'agence ne trouvait pas où créer ses agents).
   3. CNI : au moment de publier, si la CNI du compte manque, un formulaire
      s'ouvre (au lieu d'un message renvoyant vers une page absente du menu
      de l'agence) ; la CNI se renseigne aussi dans Paramètres de l'agence.
      La règle côté base (migration 20261028000100) est inchangée.
   Ce module se charge en dernier : il complète, il ne remplace rien.
   ========================================================================== */

/* --- 1. Parité barre du bas / menu latéral (ORDINATEUR SEULEMENT) ----------
   Sur ordinateur, le menu latéral reprend tout ce que la barre du bas du téléphone
   affiche (Publier, Gestion, Messages…). La liste des entrées est LUE dans la barre
   elle-même (tabBarHtml) : si une barre change, le menu suit tout seul.
   Le téléphone n'est pas touché : MENUS (qui alimente aussi le tiroir du téléphone)
   n'est pas modifié ; on complète seulement le HTML du menu latéral, que la feuille
   de style cache sous 760 px. */
const ENTREES_BARRE = {
  '#/owner/property/new': ['Publier un bien', 'plus'],
  '#/manage': ['Gestion', 'briefcase']
};
const ENTREE_PARAMETRES = /\/(owner\/profile|agent\/profil|agency\/settings|client\/profile|admin\/settings)$/;

/* Icônes connues des barres (BARRE_PRO, BARRE_AGENT, BARRE_MANDANT, PILL). */
function entreesBarre(u) {
  if (!u) return [];
  if (typeof estAgent === 'function' && estAgent(u)) return BARRE_AGENT;
  if (typeof estMandant === 'function' && estMandant(u)) return BARRE_MANDANT;
  if (!u.member && typeof BARRE_PRO !== 'undefined' && BARRE_PRO[u.role]) return BARRE_PRO[u.role];
  const c = typeof PILL !== 'undefined' && PILL[u.role];
  return c && c[1] ? [c[1]] : [];
}
/* Ce que la barre du bas affiche réellement pour ce compte : [{h, lib, ic}]. */
function entreesAfficheesBarre(u, path) {
  let html = '';
  try { html = tabBarHtml(u, path) || ''; } catch (e) { return []; }
  const connues = {}; entreesBarre(u).forEach(([h, l, ic]) => { connues[h] = ic; });
  const out = [], vus = new Set();
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const h = m[1]; if (vus.has(h) || !h.startsWith('#/')) continue; vus.add(h);
    const span = (m[2].match(/<span>([\s\S]*?)<\/span>/) || [])[1] || '';
    const [lib, ic] = ENTREES_BARRE[h] || [span.replace(/<[^>]+>/g, '').trim(), connues[h] || 'grid'];
    if (lib) out.push({h, lib, ic: ic || 'grid'});
  }
  return out;
}
function completerMenuLateral(html, u) {
  const a = html.indexOf('<aside class="side"'); if (a < 0) return html;
  const n0 = html.indexOf('<nav>', a), n1 = n0 < 0 ? -1 : html.indexOf('</nav>', n0);
  if (n0 < 0 || n1 < 0) return html;
  let nav = html.slice(n0 + 5, n1);
  const presents = new Set([...nav.matchAll(/href="([^"]+)"/g)].map(m => m[1]));
  const path = (location.hash || '#/').replace('#', '').split('?')[0];
  const manquants = entreesAfficheesBarre(u, path).filter(x => !presents.has(x.h)
    && (!u.member || typeof memberCan !== 'function' || memberCan(u, permFor(x.h.slice(1)))));
  if (!manquants.length) return html;
  const liens = [...nav.matchAll(/<a\b[^>]*href="([^"]+)"[\s\S]*?<\/a>/g)].map(m => ({h: m[1], fin: m.index + m[0].length, debut: m.index}));
  const lien = x => `<a href="${x.h}" class="${path === x.h.slice(1) ? 'active' : ''}" data-barre="1"><span class="ico">${icon(x.ic, 17)}</span>${x.lib}</a>`;
  /* Positions : « Publier un bien » juste après les biens ; le reste avant Paramètres. */
  const inserts = manquants.map(x => {
    const biens = x.h === '#/owner/property/new' ? liens.find(l => /\/properties$/.test(l.h)) : null;
    const param = liens.find(l => ENTREE_PARAMETRES.test(l.h));
    return {pos: biens ? biens.fin : (param ? param.debut : nav.length), html: lien(x)};
  }).sort((p, q) => q.pos - p.pos);
  for (const i of inserts) nav = nav.slice(0, i.pos) + i.html + nav.slice(i.pos);
  return html.slice(0, n0 + 5) + nav + html.slice(n1);
}
(() => {
  const _shellAppBarre = shellApp;
  shellApp = function (u, content) {
    const html = _shellAppBarre(u, content);
    try { return u ? completerMenuLateral(html, u) : html; } catch (e) { return html; }
  };
})();

/* Agence (titulaire) : « Visites » et « Équipe » avaient été retirés du menu ; on ne
   trouvait plus où créer les agents. Ils reviennent, sur ordinateur comme sur téléphone. */
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'agency'); if (!d) return;
  const lire = () => d.get ? d.get.call(MENUS_RAW) : d.value;
  Object.defineProperty(MENUS_RAW, 'agency', {
    configurable: true, enumerable: true,
    get() {
      const m = lire(); let u = null; try { u = Auth.current(); } catch (e) {}
      if (!Array.isArray(m) || !u || u.role !== 'agency' || u.member) return m;
      const L = m.slice();
      [['#/agency/visits', 'Visites', 'calendar', '#/agency/clients'], ['#/agency/agents', 'Équipe', 'briefcase', '#/agency/visits']].forEach(([h, lib, ic, apres]) => {
        if (L.some(x => x[0] === h)) return;
        const i = L.findIndex(x => x[0] === apres), fin = L.findIndex(x => ENTREE_PARAMETRES.test(x[0]));
        L.splice(i >= 0 ? i + 1 : (fin < 0 ? L.length : fin), 0, [h, lib, ic]);
      });
      return L;
    },
    set(v) { if (d.set) d.set.call(MENUS_RAW, v); else d.value = v; }
  });
})();

/* --- 2. CNI : formulaire au moment de publier ---------------------------- */
let repriseApresCni = null;

(function () {
  /* Formulaire du bien : la CNI est vérifiée AVANT le récapitulatif « Publier cette
     annonce ? » (js/63-publication.js), qui ferme toutes les fenêtres après coup et
     aurait refermé aussitôt le formulaire de CNI. On garde de quoi reprendre ensuite. */
  const _saveProperty = saveProperty;
  saveProperty = function (form, id, intent) {
    if (intent === 'publish') {
      repriseApresCni = () => { if (form && form.isConnected) saveProperty(form, id, intent); };
      if (cniManquantePourPublier(Auth.current())) return;
    }
    return _saveProperty(form, id, intent);
  };
})();

/* Bouton « Publier » / « Republier » d'une carte de bien : on n'annonce le succès
   qu'après la réponse du serveur (avant : « Annonce publiée » s'affichait, puis la
   base refusait). Remplace le traitement de js/27-actions.js pour cette action. */
async function publierCarte(id) {
  const u = Auth.current();
  if (!u || !ownsProperty(id, u) || cniManquantePourPublier(u)) return;
  const n = (DB.erreurs || []).length;
  DB.updateItem(DB.K.properties, id, {listingStatus: 'publiee'});
  render();
  await DB.attendre();
  const p = DB.findItem(DB.K.properties, id);
  const refus = (DB.erreurs || []).slice(n).some(x => /^properties/.test(x.contexte || ''));
  if (p && p.listingStatus === 'publiee' && !refus) {
    try { notify('user_admin', `Nouvelle annonce en ligne : ${p.title}`, '#/admin/listings'); } catch (x) {}
    toast('Annonce publiée : elle est visible dans la recherche.');
  }
  render();
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="publish"]');
  if (!b || !b.dataset.id || !Auth.current()) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const id = b.dataset.id;
  repriseApresCni = () => publierCarte(id);
  publierCarte(id);
}, true);

function formulaireCni(compact) {
  return `<form data-action="cni-form">
    ${compact ? '' : `<p>Pour limiter les faux annonceurs, DEUKSIL demande le numéro de CNI du titulaire du compte avant de publier une annonce. Votre annonce reste en brouillon tant qu'il n'est pas renseigné.</p>`}
    <div class="field"><label for="cni-champ">Numéro de CNI (13 chiffres)</label>
      <input class="input" id="cni-champ" name="cni" inputmode="numeric" maxlength="13" autocomplete="off" placeholder="13 chiffres" required></div>
    <p class="small muted">Une fois enregistré, ce numéro n'est plus modifiable.</p>
    <p class="err" role="alert"></p>
    <div class="row" style="justify-content:flex-end;gap:10px">
      <button type="button" class="btn ghost" data-action="close-modal">Plus tard</button>
      <button class="btn">Enregistrer et continuer</button></div></form>`;
}

cniManquantePourPublier = function (u) {
  if (!u || u.role === 'admin' || /^\d{13}$/.test(u.cni || '')) return false;
  /* Fenêtre ouverte au tour suivant : un appelant qui ferme les fenêtres juste après
     (récapitulatif de publication) ne la refermera pas. */
  setTimeout(() => ouvrirFenetreCni(u), 0);
  return true;
};
function ouvrirFenetreCni(u) {
  if (u.member) {
    modal('CNI du titulaire à renseigner',
      `<p>Pour publier une annonce, le titulaire du compte de l'agence doit d'abord renseigner son numéro de CNI.</p>
       <p class="small muted">Il se connecte, ouvre <b>Paramètres</b> et remplit « Pièce d'identité (CNI) ». Votre brouillon est conservé.</p>
       <div class="row" style="justify-content:flex-end"><button class="btn" data-action="close-modal">J'ai compris</button></div>`);
    return;
  }
  modal('Renseignez votre CNI pour publier', formulaireCni(false));
  setTimeout(() => { const c = document.getElementById('cni-champ'); if (c) c.focus(); }, 40);
}

document.addEventListener('submit', async e => {
  const f = e.target.closest && e.target.closest('form[data-action="cni-form"]'); if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  const zone = f.querySelector('.err'), bouton = f.querySelector('button:not([type="button"])');
  const erreur = m => { if (zone) zone.textContent = m; };
  const cni = String(new FormData(f).get('cni') || '').replace(/\s/g, '');
  if (!/^\d{13}$/.test(cni)) return erreur('Le numéro de CNI comporte exactement 13 chiffres.');
  erreur(''); if (bouton) bouton.disabled = true;
  DB.updateItem(DB.K.users, u.id, {cni});
  await DB.attendre();                       /* attend la réponse du serveur ; en cas de refus la valeur est relue */
  const apres = Auth.current();
  if (!apres || apres.cni !== cni) {
    if (bouton) bouton.disabled = false;
    /* La vraie raison du refus (le serveur l'a notée) plutôt qu'une supposition. */
    const d = (DB.erreurs || []).slice(-1)[0];
    const recent = d && Date.now() - d.t < 15000 && /profiles/.test(d.contexte || '');
    if (recent && d.code === '23505') return erreur('Ce numéro de CNI est déjà utilisé par un autre compte. Vérifiez-le : il ne peut servir qu\'à un seul compte.');
    if (recent && d.code === 'P0001' && d.message) return erreur(d.message);   /* message clair du serveur (migration 20261112000100) */
    const detail = recent && typeof messageErreur === 'function' ? messageErreur({code: d.code, message: d.message}) : '';
    return erreur('Ce numéro n\'a pas pu être enregistré' + (detail ? ' : ' + detail.replace(/[.\s]+$/, '') : '') + '. Réessayez ; si le problème continue, contactez DEUKSIL.');
  }
  const dansModale = !!f.closest('.modal');
  if (dansModale) closeModal();
  toast('CNI enregistrée.');
  const reprise = repriseApresCni; repriseApresCni = null;
  if (dansModale && reprise) setTimeout(reprise, 60);
  else if (!dansModale) render();
}, true);

/* --- 3. Paramètres de l'agence : CNI et lien vers l'identité des documents - */
function cartesParametresAgence(u) {
  if (!u || u.member) return '';
  const cni = /^\d{13}$/.test(u.cni || '')
    ? `<div class="card"><h3 style="margin-bottom:6px">Pièce d'identité (CNI)</h3>
         <p class="small">${badge('Renseignée', 'ok')} &nbsp;••••••••• ${esc(String(u.cni).slice(-4))}</p>
         <p class="small muted">Une fois enregistrée, la CNI n'est plus modifiable.</p></div>`
    : `<div class="card"><h3 style="margin-bottom:6px">Pièce d'identité (CNI)</h3>
         <p class="small muted">Obligatoire pour publier une annonce. Sans elle, vos annonces restent en brouillon.</p>
         ${formulaireCni(true).replace('<button type="button" class="btn ghost" data-action="close-modal">Plus tard</button>', '').replace('Enregistrer et continuer', 'Enregistrer ma CNI')}</div>`;
  const identite = `<a class="card ds-lien" href="#/manage/identity"><span class="fhead-ic">${icon('file', 21)}</span><span><b>Identité sur vos documents</b><span>Nom, NINEA, RCCM : ce qui figure sur vos PDF</span></span>${icon('arrowRight', 18)}</a>`;
  return cni + identite;
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/agency\\/settings$'); if (!r) return;
  const g = r.fn;
  r.fn = (...a) => {
    const h = g(...a); if (h === false) return h;
    return h.replace('<div class="stack" style="gap:18px">', '<div class="stack" style="gap:18px">' + cartesParametresAgence(Auth.current()));
  };
})();

/* --- 4. Le site croit la CNI enregistrée, le serveur la refuse --------------
   Cas observé en recette : la CNI s'affiche dans Paramètres, mais la base répond
   « renseignez un numéro de CNI ». Le site se resynchronise sur le serveur : la CNI
   affichée disparaît, le formulaire de saisie réapparaît, et un message clair explique. */
(() => {
  if (typeof signalerErreur !== 'function') return;
  const _signaler = signalerErreur;
  signalerErreur = function (e, contexte) {
    /* Profil refusé pour doublon : c'est la CNI (l'e-mail ne se modifie pas ici). Message
       clair même si la migration 20261112000100 n'est pas encore appliquée. */
    if (e && e.code === '23505' && /^profiles/.test(contexte || '')) {
      return _signaler({code: 'P0001', message: 'Ce numéro de CNI est déjà utilisé par un autre compte DEUKSIL. Vérifiez-le ; si c\'est bien le vôtre, contactez DEUKSIL.', details: e.details}, contexte);
    }
    const u = (() => { try { return Auth.current(); } catch (x) { return null; } })();
    if (e && /CNI/.test(e.message || '') && /properties/.test(contexte || '') && u && /^\d{13}$/.test(u.cni || '')) {
      console.warn('[DEUKSIL] CNI affichée mais absente côté serveur : resynchronisation.', contexte, e);
      DB.erreurs.push({t: Date.now(), contexte, code: e.code, message: e.message});
      Promise.resolve(DB.relire(DB.K.users)).finally(() => {
        toast('Votre CNI n\'était pas enregistrée sur le serveur. Appuyez de nouveau sur « Publier » : le formulaire de CNI va s\'ouvrir.', 'bad');
        if (typeof render === 'function') render();
      });
      return;
    }
    return _signaler(e, contexte);
  };
})();

/* --- 5. « Mon profil » / « Paramètres » : la CNI saisie a-t-elle été enregistrée ? --
   Avant : « Profil mis à jour » s'affichait tout de suite ; si le serveur refusait
   (CNI déjà utilisée…), la CNI disparaissait sans explication. On vérifie après la
   réponse du serveur et on explique dans une fenêtre qui reste à l'écran. */
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-profile"]'); if (!f) return;
  const champ = f.querySelector('input[name="cni"]');
  const cni = champ ? String(champ.value || '').replace(/\s/g, '') : '';
  if (!/^\d{13}$/.test(cni)) return;
  const n = (DB.erreurs || []).length;
  setTimeout(async () => {
    await DB.attendre();
    const u = Auth.current();
    if (!u || u.cni === cni) return;
    const d = (DB.erreurs || []).slice(n).filter(x => /^profiles/.test(x.contexte || '')).slice(-1)[0];
    const raison = d && typeof messageErreur === 'function' ? messageErreur({code: d.code, message: d.message}).replace(/[.\s]+$/, '') : '';
    modal('CNI non enregistrée',
      `<p>Votre numéro de CNI <b>n'a pas été enregistré</b>${raison ? ' : ' + esc(raison) : ''}.</p>
       <p class="small muted">Rien n'a été modifié sur votre profil. Corrigez le numéro (ou laissez-le vide) puis enregistrez de nouveau.</p>
       <div class="row" style="justify-content:flex-end"><button class="btn" data-action="close-modal">Compris</button></div>`);
  }, 0);
}, true);

/* --- 6. Comptes ouverts par un tiers : identifiants clairs, fluides ----------
   Agent, gestionnaire, propriétaire mandant, locataire : chacun reçoit SES
   identifiants dès la création (e-mail + mot de passe provisoire, changé à la
   première connexion). Ici : fiche d'identifiants prête à transmettre, mot de
   passe provisoire régénérable pour l'équipe, message clair si la fonction
   serveur manque, fiche du mandant actualisée après l'ouverture de son accès. */
const ROLE_ACCES = c => !c ? 'utilisateur' : c.role === 'agent' ? 'agent' : c.role === 'manager' ? 'gestionnaire'
  : c.role === 'tenant' ? 'locataire' : (c.ownerRec || c.mandantOf) ? 'propriétaire' : c.role === 'agency' ? 'agence' : 'utilisateur';
const adresseConnexion = () => ((typeof DEUKSIL_CONFIG !== 'undefined' && DEUKSIL_CONFIG.siteUrl) || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/+$/, '') + '/#/login';
function numeroWhatsApp(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length === 9) return '221' + d;
  if (d.length === 12 && d.startsWith('221')) return d;
  return '';
}
function messageIdentifiants(c, mdp) {
  const prenom = (c.firstName || '').trim();
  return `Bonjour${prenom ? ' ' + prenom : ''}, votre accès DEUKSIL (${ROLE_ACCES(c)}) est prêt.\n`
    + `Adresse : ${adresseConnexion()}\nIdentifiant : ${c.email || ''}\nMot de passe provisoire : ${mdp}\n`
    + `À la première connexion, vous choisirez votre propre mot de passe.`;
}
let identifiantsCourants = null;
montrerMotDePasseProvisoire = function (compte, mdp) {
  const c = compte || {}, nom = `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Cette personne';
  const texte = messageIdentifiants(c, mdp), wa = numeroWhatsApp(c.phone);
  const afficher = () => {
    if (document.querySelector('.modal')) return setTimeout(afficher, 600);
    identifiantsCourants = texte;
    modal('Accès créé : identifiants à transmettre', `<p style="margin-top:0">${esc(nom)} (${esc(ROLE_ACCES(c))}) peut se connecter dès maintenant :</p>
      <div class="fin-l"><span>Adresse</span><b>${esc(adresseConnexion())}</b></div>
      <div class="fin-l"><span>Identifiant</span><b>${esc(c.email || '')}</b></div>
      <div class="fin-l"><span>Mot de passe provisoire</span><b class="mdp-prov" style="font-family:monospace;font-size:1.1rem">${esc(mdp)}</b></div>
      <p class="small muted" style="margin:12px 0 0">Il ne sera plus affiché : DEUKSIL ne le conserve pas. À sa première connexion, ${esc(nom.split(' ')[0])} choisira son propre mot de passe. Perdu ? Un nouveau mot de passe provisoire se génère depuis la liste (bouton « Nouveau mot de passe »).</p>
      <div class="row" style="gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn ghost" type="button" data-action="ident-copier">${icon('file', 15)} Copier les identifiants</button>
        <a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${wa}?text=${encodeURIComponent(texte)}">${icon('message', 15)} Envoyer par WhatsApp</a>
        ${c.email ? `<a class="btn ghost" href="mailto:${encodeURIComponent(c.email)}?subject=${encodeURIComponent('Votre accès DEUKSIL')}&body=${encodeURIComponent(texte)}">${icon('message', 15)} Envoyer par e-mail</a>` : ''}
        <button class="btn" data-action="close-modal">J'ai transmis les identifiants</button></div>`);
  };
  afficher();
};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="ident-copier"]'); if (!b || !identifiantsCourants) return;
  e.preventDefault();
  const fini = () => toast('Identifiants copiés : collez-les dans un SMS ou un message.');
  try { navigator.clipboard.writeText(identifiantsCourants).then(fini, () => toast('Copie impossible : sélectionnez le texte à la main.', 'warn')); }
  catch (x) { toast('Copie impossible : sélectionnez le texte à la main.', 'warn'); }
});

/* Fonction serveur absente ou injoignable : un message que l'on comprend. */
(() => {
  if (typeof fonction !== 'function') return;
  const _fonction = fonction;
  fonction = async function (nom, corps) {
    try { return await _fonction(nom, corps); }
    catch (e) {
      const m = String((e && e.message) || '');
      let clair = '';
      if (/Requested function was not found|NOT_FOUND|404/i.test(m)) clair = `La fonction serveur « ${nom} » n'est pas déployée sur Supabase : création d'accès impossible pour l'instant. Prévenez la personne qui gère Supabase (supabase functions deploy ${nom}).`;
      else if (/Failed to send a request|Failed to fetch|NetworkError|Load failed/i.test(m)) clair = `La fonction serveur « ${nom} » est injoignable (connexion, ou adresse du site non autorisée dans DEUKSIL_ORIGINES). Réessayez ; si cela continue, prévenez la personne qui gère Supabase.`;
      if (!clair) throw e;
      const err = new Error(clair); err.code = 'P0001'; throw err;
    }
  };
})();

/* Mandant : après l'ouverture de son accès, la fiche affiche « Compte rattaché ». */
(() => {
  if (typeof compteMandant !== 'function') return;
  const _compteMandant = compteMandant;
  compteMandant = async function (...a) {
    const r = await _compteMandant(...a);
    if (r) { try { await DB.relire(DB.K.owners); } catch (x) {} render(); }
    return r;
  };
})();

/* Équipe (agents, gestionnaires) : « Nouveau mot de passe » tant que la personne
   n'a pas choisi le sien (existait déjà pour les mandants et les locataires). */
function boutonsMdpEquipe() {
  let u = null; try { u = Auth.current(); } catch (e) {}
  if (!u || u.member || !['owner', 'agency'].includes(u.role)) return;
  document.querySelectorAll('#app [data-action="g4-toggle"][data-id]:not([data-mdp]), #app [data-action="ag-attribuer"][data-id]:not([data-mdp])').forEach(b => {
    b.dataset.mdp = '1';
    const m = DB.findItem(DB.K.users, b.dataset.id);
    if (!m || m.parentId !== u.id || !m.mdpProvisoire) return;
    b.insertAdjacentHTML('afterend', `<button class="btn ghost sm" data-action="mdp-regenerer" data-id="${m.id}" title="${esc(m.firstName || '')} ne s'est pas encore connecté(e) : générer un nouveau mot de passe provisoire">${icon('key', 14)} Nouveau mot de passe</button>`);
  });
}
if (typeof MutationObserver === 'function' && document.body) {
  new MutationObserver(() => requestAnimationFrame(() => { try { boutonsMdpEquipe(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
}
