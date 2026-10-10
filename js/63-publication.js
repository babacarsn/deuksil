/* ==========================================================================
   MODULE : publication.js — confirmer avant de publier, puis voir son bien.
   Au bout du formulaire d'ajout, « Enregistrer et publier » publiait sans
   rien demander et renvoyait sur la liste complète : le propriétaire ne
   savait pas ce qu'il venait de mettre en ligne, ni où le retrouver.
   On intercale un récapitulatif — photos, prix, adresse — avec deux issues
   claires, et après publication on ouvre la fiche du bien concerné.
   ========================================================================== */

let bienEnAttente = null;

/* --- 0. Le formulaire ne doit rien perdre en route ---------------------- */
/* Ajouter ou retirer une photo redessine tout l'écran : le formulaire était
   reconstruit vide et ramené à l'étape 1. Autrement dit, on remplissait
   trois écrans, on ajoutait une photo, et tout était à refaire. On relève
   donc la saisie avant le redessin pour la remettre après. */
function lireWiz(f) {
  const d = {champs: {}, coches: [], radios: {}, etape: +(f.dataset.cur || 1)};
  f.querySelectorAll('input,select,textarea').forEach(e => {
    if (!e.name || e.type === 'file') return;
    if (e.type === 'checkbox') { if (e.checked) d.coches.push(e.name + '\u0000' + e.value); }
    else if (e.type === 'radio') { if (e.checked) d.radios[e.name] = e.value; }
    else d.champs[e.name] = e.value;
  });
  return d;
}

function ecrireWiz(f, d) {
  /* La région commande la liste des villes : on la repose en premier et on
     laisse l'écran reconstruire les villes avant d'y choisir la bonne. */
  const region = f.querySelector('[name="region"]');
  if (region && d.champs.region !== undefined) {
    region.value = d.champs.region;
    region.dispatchEvent(new Event('change', {bubbles: true}));
  }
  Object.entries(d.radios).forEach(([n, v]) => {
    const e = f.querySelector(`[name="${n}"][value="${CSS.escape(v)}"]`);
    if (e) { e.checked = true; }
  });
  f.querySelectorAll('input[type="checkbox"][name]').forEach(e => {
    e.checked = d.coches.includes(e.name + '\u0000' + e.value);
  });
  Object.entries(d.champs).forEach(([n, v]) => {
    const e = f.querySelector(`[name="${n}"]`);
    if (!e || e.type === 'file' || e.type === 'checkbox' || e.type === 'radio') return;
    if (n === 'region') return;
    if (e.tagName === 'SELECT' && ![...e.options].some(o => o.value === v)) return;
    e.value = v;
  });
  try { wizGo(f, d.etape); } catch (e) {}
}

const _renderWiz = render;
render = function () {
  const f = document.getElementById('wiz');
  const avant = f ? lireWiz(f) : null;
  const r = _renderWiz.apply(this, arguments);
  if (avant) requestAnimationFrame(() => {
    const g = document.getElementById('wiz');
    if (g) { try { ecrireWiz(g, avant); } catch (e) {} }
  });
  return r;
};

/* Les mêmes règles que l'enregistrement, appliquées avant d'ouvrir la
   fenêtre : il serait absurde de confirmer puis de voir une erreur. */
function bienValide(form) {
  const d = formData(form);
  if (!d.title || d.title.trim().length < 5) {
    formError(form, 'Le titre doit comporter au moins 5 caractères.'); return false;
  }
  if (!d.price || +d.price <= 0) {
    formError(form, 'Indiquez un prix supérieur à 0.'); return false;
  }
  if (!d.surface || +d.surface <= 0) {
    formError(form, 'Indiquez une surface supérieure à 0.'); return false;
  }
  clearFormError(form);
  return true;
}

function recapPublication(form) {
  const d = formData(form);
  const equipements = $$('input[name="amenities"]:checked', form).map(i => i.value);
  const photos = (typeof formPhotos !== 'undefined' ? formPhotos : []).slice(0, 4);
  const reste = (typeof formPhotos !== 'undefined' ? formPhotos.length : 0) - photos.length;
  const lieu = [d.quartier, d.commune, d.city].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', ');
  const ligne = (l, v) => v ? `<div class="recap-l"><span>${esc(l)}</span><b>${esc(String(v))}</b></div>` : '';

  return `<div class="recap">
    ${photos.length ? `<div class="recap-ph">
        ${photos.map(src => `<img src="${src}" alt="">`).join('')}
        ${reste > 0 ? `<span class="recap-plus">+${reste}</span>` : ''}
      </div>`
    : `<div class="recap-vide">${icon('image', 20)} Aucune photo.
        <span class="small muted">Une annonce avec photos est bien plus consultée.</span></div>`}
    <h4 class="recap-t">${esc(d.title || 'Sans titre')}</h4>
    <div class="recap-p">${money(+d.price || 0)}${d.transaction === 'location' ? ' <small>par mois</small>' : ''}</div>
    <div class="recap-g">
      ${ligne('Type', `${d.type || ''} · ${(TRANSACTION_LABEL || {})[d.transaction] || d.transaction || ''}`)}
      ${ligne('Localisation', lieu)}
      ${ligne('Surface', (+d.surface || 0) + ' m²')}
      ${+d.rooms ? ligne('Chambres', d.rooms) : ''}
      ${+d.baths ? ligne('Salles de bain', d.baths) : ''}
      ${equipements.length ? ligne('Équipements', equipements.join(', ')) : ''}
      ${d.availableFrom ? ligne('Disponible le', dateFr(d.availableFrom)) : ''}
    </div>
    <p class="recap-n small">Une fois publiée, l'annonce est <b>immédiatement visible</b> dans la
      recherche. Vous pourrez la modifier, la mettre en pause ou l'archiver à tout moment.</p>
    <div class="recap-b">
      <button type="button" class="btn ghost" data-action="pub-non">Annuler</button>
      <button type="button" class="btn" data-action="pub-oui">${icon('check', 16)} Publier l'annonce</button>
    </div>
  </div>`;
}

const _savePropertyPub = saveProperty;
saveProperty = function (form, id, intent) {
  if (intent !== 'publish') return _savePropertyPub(form, id, intent);
  if (!bienValide(form)) return;
  bienEnAttente = {form, id};
  modal(id ? 'Publier les modifications ?' : 'Publier cette annonce ?', recapPublication(form));
};

document.addEventListener('click', e => {
  if (e.target.closest('[data-action="pub-non"]')) {
    e.preventDefault();
    bienEnAttente = null;
    closeModal();
    toast('Publication annulée. Votre saisie est conservée.');
    return;
  }
  const b = e.target.closest('[data-action="pub-oui"]');
  if (!b || !bienEnAttente) return;
  e.preventDefault();
  const {form, id} = bienEnAttente;
  bienEnAttente = null;
  const u = Auth.current();
  const avant = new Set(DB.getData(DB.K.properties).map(p => p.id));

  /* On retient la destination au lieu de la suivre : l'enregistrement
     renvoie vers la liste, nous voulons la fiche du bien publié. */
  const _go = go, _toast = toast;
  let demande = null, souci = null;
  go = h => { demande = h; };
  /* L'enregistrement annonce « Annonce publiée. » ; on dira mieux juste
     après, avec le nom du bien. Deux bandeaux pour un seul geste, c'est un
     de trop — sauf si c'est une erreur, qu'il faut montrer. */
  toast = (m, ton) => { if (ton === 'bad' || ton === 'warn') souci = [m, ton]; };
  try { _savePropertyPub(form, id, 'publish'); }
  finally { go = _go; toast = _toast; }
  if (souci) toast(souci[0], souci[1]);

  closeModal();

  let pid = id;
  if (!pid) {
    const neuf = DB.getData(DB.K.properties).find(p => !avant.has(p.id) && p.ownerId === u.id);
    pid = neuf ? neuf.id : null;
  }
  if (!pid && !demande) return;          /* l'enregistrement a échoué : on reste */
  if (pid) {
    try { DB.updateItem(DB.K.properties, pid, {publishedAt: now()}); } catch (err) {}
    const p = DB.findItem(DB.K.properties, pid);
    toast(`« ${(p && p.title) || 'Votre annonce'} » est en ligne.`);
    go('#/bien/' + pid);
  } else {
    go(demande);
  }
});

/* Fermer la fenêtre par la croix ou l'extérieur ne doit pas laisser une
   publication en suspens. */
document.addEventListener('click', e => {
  if (e.target.closest('[data-action="close-modal"]') || e.target.classList.contains('modal-back')) {
    bienEnAttente = null;
  }
}, true);
