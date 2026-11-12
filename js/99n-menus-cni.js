/* ==========================================================================
   MODULE : menus-cni.js — correctifs issus de la recette (UAT Agence)

   1. Parité barre du bas / menu latéral : tout ce que la barre du bas montre
      sur téléphone (Publier, Gestion, Messages…) figure aussi dans le menu
      latéral de l'ordinateur. Calculé à partir des barres elles-mêmes
      (BARRE_PRO, BARRE_AGENT, BARRE_MANDANT, PILL) : si une barre change,
      le menu suit sans autre modification.
   2. Agence : « Visites » et « Équipe » reviennent dans le menu latéral
      (l'agence ne trouvait pas où créer ses agents).
   3. CNI : au moment de publier, si la CNI du compte manque, un formulaire
      s'ouvre (au lieu d'un message renvoyant vers une page absente du menu
      de l'agence) ; la CNI se renseigne aussi dans Paramètres de l'agence.
      La règle côté base (migration 20261028000100) est inchangée.
   Ce module se charge en dernier : il complète, il ne remplace rien.
   ========================================================================== */

/* --- 1. Parité barre du bas / menu latéral ------------------------------- */
const ENTREES_BARRE = {
  '#/owner/property/new': ['Publier un bien', 'plus'],
  '#/manage': ['Gestion', 'briefcase']
};
const ENTREE_PARAMETRES = /\/(owner\/profile|agent\/profil|agency\/settings|client\/profile|admin\/settings)$/;

function entreesBarre(u) {
  if (!u) return [];
  if (typeof estAgent === 'function' && estAgent(u)) return BARRE_AGENT;
  if (typeof estMandant === 'function' && estMandant(u)) return BARRE_MANDANT;
  if (!u.member && BARRE_PRO[u.role]) return BARRE_PRO[u.role];
  const c = PILL[u.role];                 /* seul le bouton central est affiché sans condition */
  return c && c[1] ? [c[1]] : [];
}

function completerMenu(m, u) {
  if (!Array.isArray(m) || !u) return m;
  let out = null;
  const liste = () => out || m;
  const copie = () => out || (out = m.slice());
  const finDeMenu = () => { const i = liste().findIndex(x => ENTREE_PARAMETRES.test(x[0])); return i < 0 ? liste().length : i; };
  const absent = h => !liste().some(x => x[0] === h);

  entreesBarre(u).forEach(([h, libelle, ico]) => {
    if (!absent(h)) return;
    const [lib, ic] = ENTREES_BARRE[h] || [libelle, ico];
    if (!lib) return;
    const L = copie();
    const biens = h === '#/owner/property/new' ? L.findIndex(x => /\/properties$/.test(x[0])) : -1;
    L.splice(biens >= 0 ? biens + 1 : finDeMenu(), 0, [h, lib, ic || 'grid']);
  });

  /* Agence (titulaire) : Visites puis Équipe, juste après Clients. */
  if (u.role === 'agency' && !u.member) {
    [['#/agency/visits', 'Visites', 'calendar', '#/agency/clients'], ['#/agency/agents', 'Équipe', 'briefcase', '#/agency/visits']].forEach(([h, lib, ic, apres]) => {
      if (!absent(h)) return;
      const L = copie(), i = L.findIndex(x => x[0] === apres);
      L.splice(i >= 0 ? i + 1 : finDeMenu(), 0, [h, lib, ic]);
    });
  }
  return out || m;
}

['owner', 'agency'].forEach(role => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, role); if (!d) return;
  const lire = () => d.get ? d.get.call(MENUS_RAW) : d.value;
  Object.defineProperty(MENUS_RAW, role, {
    configurable: true, enumerable: true,
    get() { let u = null; try { u = Auth.current(); } catch (e) {} return completerMenu(lire(), u); },
    set(v) { if (d.set) d.set.call(MENUS_RAW, v); else d.value = v; }
  });
});

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
