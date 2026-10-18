/* ==========================================================================
   MODULE : finalisation.js — corrections ciblées issues de AUDIT.md.
   Chaque section corrige un problème constaté et testé ; rien n'est refait.
     P1. Inscription publique : rôles autorisés seulement (jamais admin).
   ========================================================================== */

/* --- P1. Inscription publique : liste blanche des rôles -------------------
   Le choix du rôle venait d'un bouton radio de la page : en modifiant sa
   valeur, on créait un compte administrateur. Seuls les profils proposés
   au public sont acceptés. */
const ROLES_PUBLICS = ['client', 'owner', 'agency'];
const _startRegistrationFin = startRegistration;
startRegistration = function (data) {
  if (!data || !ROLES_PUBLICS.includes(data.role)) {
    toast('Type de compte non autorisé à l\'inscription.', 'bad');
    try { logActivity(`Inscription refusée : rôle « ${String(data && data.role).slice(0, 20)} » non autorisé`); } catch (e) {}
    return;
  }
  return _startRegistrationFin(data);
};

/* --- P3. Un agent n'agit que sur les biens qui lui sont attribués ---------
   Dans l'espace de l'agence, la seule vérification était « le bien
   appartient au compte de l'agence » : un agent pouvait modifier, mettre en
   pause ou archiver le bien d'un collègue. Il garde la vue « Toute
   l'agence » (pour renseigner un client), mais n'agit que sur les siens ;
   la suppression d'un bien est réservée au responsable. */
const bienDeLAgent = (u, id) => { const p = id && gProp(id); return !!p && p.agentId === u.member.id; };
const ACTIONS_BIEN = /^(pause|archive|publish|delete-prop|set-status|owner-bulk-(pause|archive|delete))$/;
function refusAgent(e, msg) {
  e.preventDefault(); e.stopImmediatePropagation();
  toast(msg || 'Ce bien est suivi par un collègue : seul son agent ou le responsable peut le modifier.', 'bad');
  if (e.type === 'change') setTimeout(render, 0);
}
['click', 'change'].forEach(type => document.addEventListener(type, e => {
  const el = e.target.closest && e.target.closest('[data-action]'); if (!el) return;
  const a = el.dataset.action; if (!ACTIONS_BIEN.test(a)) return;
  if (type === 'click' && el.tagName === 'SELECT') return;
  let u = null; try { u = Auth.current(); } catch (err) {} if (!estAgent(u)) return;
  if (a === 'delete-prop' || a === 'owner-bulk-delete') return refusAgent(e, 'La suppression d\'un bien est réservée au responsable de l\'agence.');
  const ids = /^owner-bulk/.test(a) ? (typeof ownerBulkSelected !== 'undefined' ? ownerBulkSelected : []) : [el.dataset.id];
  if (ids.some(id => !bienDeLAgent(u, id))) refusAgent(e);
}, true));
/* La fiche de modification d'un bien. */
(() => {
  const r = routes.find(x => x.re.source.includes('property') && x.re.source.includes('new')); if (!r) return;
  const f = r.fn;
  r.fn = (pid, ...a) => {
    const u = Auth.current();
    if (estAgent(u) && pid !== 'new' && !bienDeLAgent(u, pid)) {
      toast('Ce bien est suivi par un collègue : vous pouvez le consulter, pas le modifier.', 'bad');
      go('#/bien/' + pid); return false;
    }
    return f(pid, ...a);
  };
})();
const _savePropertyFin = saveProperty;
saveProperty = function (form, id, intent) {
  const u = Auth.current();
  if (estAgent(u) && id && !bienDeLAgent(u, id)) return toast('Ce bien est suivi par un collègue.', 'bad');
  return _savePropertyFin(form, id, intent);
};
/* Les boutons d'action ne s'affichent que sur ses biens. */
function masquerActionsAgent() {
  let u = null; try { u = Auth.current(); } catch (e) {} if (!estAgent(u)) return;
  document.querySelectorAll('#app [data-action][data-id]:not([data-agok])').forEach(el => {
    el.dataset.agok = '1';
    if (ACTIONS_BIEN.test(el.dataset.action) && gProp(el.dataset.id) && !bienDeLAgent(u, el.dataset.id)) el.remove();
    else if (el.dataset.action === 'delete-prop') el.remove();
  });
  document.querySelectorAll('#app a[href^="#/owner/property/"]:not([href="#/owner/property/new"]):not([data-agok])').forEach(a => {
    a.dataset.agok = '1';
    const id = a.getAttribute('href').split('/').pop().split('?')[0];
    if (!bienDeLAgent(u, id)) a.remove();
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { masquerActionsAgent(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* --- P4. Formulaire d'un bien : deux opérations, champs adaptés au type ----
   L'assistant proposait trois « opérations » (Location, Vente, Terrain) et,
   pour un terrain, demandait chambres, salles de bain et équipements sans
   aucune information foncière. Désormais :
   - deux opérations : Location ou Vente ;
   - le type « Terrain » adapte le formulaire : unité de surface (m² ou ha),
     statut foncier (obligatoire pour une vente), référence, viabilisation,
     documents disponibles ; plus de chambres ni d'équipements ;
   - le libellé du prix suit l'opération (loyer mensuel / prix de vente) ;
   - les informations foncières sont déclaratives : la fiche l'indique
     (« non vérifié par DEUKSIL ») tant qu'aucune vérification n'est faite.
   Contrat de données inchangé : une vente de terrain reste enregistrée avec
   transaction « terrain », comme l'attendent la recherche et les modules. */
const STATUTS_FONCIERS = ['Titre foncier (TF)', 'Bail emphytéotique', 'Délibération communale (droit d\'usage)', 'Acte de vente notarié', 'Permis d\'occuper', 'Autre ou en cours de régularisation'];
const VIABILISATION = ['Eau', 'Électricité', 'Route d\'accès'];
const DOCS_TERRAIN = ['Titre ou acte de propriété', 'Plan cadastral / bornage', 'Certificat d\'urbanisme', 'Quitus fiscal'];

function operationDe(f) { const r = f.querySelector('input[name="transaction"]:checked'); return r ? r.value : 'location'; }
function typeDe(f) { const r = f.querySelector('input[name="type"]:checked'); return r ? r.value : ''; }

function adapterFormBien(f) {
  if (!f || f.dataset.adapte) return;
  f.dataset.adapte = '1';
  const id = f.dataset.id, p = id ? gProp(id) : null, fo = (p && p.foncier) || {};
  /* 1. Deux opérations : l'option « Terrain » devient le type Terrain d'une vente. */
  const radT = f.querySelector('input[name="transaction"][value="terrain"]');
  if (radT) {
    const lab = radT.closest('label'); if (lab) lab.style.display = 'none';
    if (radT.checked) { const v = f.querySelector('input[name="transaction"][value="vente"]'); if (v) v.checked = true;
      const t = f.querySelector('input[name="type"][value="terrain"]'); if (t) t.checked = true; }
  }
  const q = f.querySelector('.wstep[data-step="1"] .wiz-q'); if (q) q.textContent = 'Que souhaitez-vous faire de ce bien ?';
  /* 2. Bloc foncier, inséré avant les champs chambres / salles de bain. */
  const rooms = f.querySelector('[name="rooms"]'), grilleRooms = rooms && rooms.closest('.form-grid');
  const surf = f.querySelector('[name="surface"]');
  if (surf && !f.querySelector('[name="surfaceUnite"]')) {
    const ha = p && p.surfaceUnite === 'ha';
    if (ha && +surf.value) surf.value = +(+surf.value / 10000).toFixed(4);
    surf.step = 'any';
    surf.insertAdjacentHTML('afterend', `<select class="input fin-unite" name="surfaceUnite" aria-label="Unité de surface" style="display:none;margin-top:8px">
      <option value="m2" ${ha ? '' : 'selected'}>m²</option><option value="ha" ${ha ? 'selected' : ''}>hectares (ha)</option></select>`);
  }
  if (grilleRooms && !f.querySelector('.fin-foncier')) {
    grilleRooms.insertAdjacentHTML('beforebegin', `<fieldset class="fin-foncier" style="display:none">
      <legend>Informations foncières</legend>
      <div class="form-grid">
        <div class="field"><label>Statut foncier <span class="req">*</span></label><select class="input" name="statutFoncier">
          <option value="">Choisir…</option>${STATUTS_FONCIERS.map(s => `<option ${fo.statut === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
        <div class="field"><label>Référence (n° de TF, délibération…)</label><input class="input" name="refFonciere" value="${esc(fo.reference || '')}" placeholder="TF 1234/DG"></div>
      </div>
      <div class="field"><label>Viabilisation</label><div class="row" style="flex-wrap:wrap;gap:10px">${VIABILISATION.map(v => `<label class="check"><input type="checkbox" name="viab" value="${esc(v)}" ${(fo.viabilisation || []).includes(v) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
      <div class="field"><label>Documents disponibles</label><div class="row" style="flex-wrap:wrap;gap:10px">${DOCS_TERRAIN.map(v => `<label class="check"><input type="checkbox" name="docsT" value="${esc(v)}" ${(fo.documents || []).includes(v) ? 'checked' : ''}>${esc(v)}</label>`).join('')}</div></div>
      <p class="small muted" style="margin:4px 0 0">Ces informations sont déclarées par vous. L'annonce indiquera « non vérifié par DEUKSIL » tant qu'aucun justificatif n'a été contrôlé.</p>
    </fieldset>`);
  }
  majFormBien(f);
}

function majFormBien(f) {
  const op = operationDe(f), terrain = typeDe(f) === 'terrain';
  const prix = f.querySelector('[name="price"]'), lab = prix && prix.closest('.field') && prix.closest('.field').querySelector('label');
  if (lab) lab.textContent = op === 'location' ? 'Loyer mensuel (FCFA)' : 'Prix de vente (FCFA)';
  const montrer = (el, oui) => { if (el) el.style.display = oui ? '' : 'none'; };
  const rooms = f.querySelector('[name="rooms"]');
  montrer(rooms && rooms.closest('.form-grid'), !terrain);
  const am = f.querySelector('[name="amenities"]'); montrer(am && am.closest('.field'), !terrain);
  const dispo = f.querySelector('[name="availableFrom"]'); montrer(dispo && dispo.closest('.field'), !terrain);
  montrer(f.querySelector('.fin-foncier'), terrain);
  montrer(f.querySelector('.fin-unite'), terrain);
  const statut = f.querySelector('[name="statutFoncier"]');
  if (statut) statut.required = terrain && op !== 'location';
  const req = f.querySelector('.fin-foncier .req'); montrer(req, terrain && op !== 'location');
  if (!terrain) { const u = f.querySelector('[name="surfaceUnite"]'); if (u) u.value = 'm2'; }
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { document.querySelectorAll('form[data-action="save-property"]').forEach(adapterFormBien); } catch (e) { console.warn('form bien', e); }
})).observe(document.body, {childList: true, subtree: true});
document.addEventListener('change', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]');
  if (f && /^(transaction|type)$/.test(e.target.name)) majFormBien(f);
});

/* À l'enregistrement : la vente d'un terrain reprend la valeur « terrain »
   attendue par la recherche, la surface est convertie en m², et les
   informations foncières accompagnent le bien. */
let extrasBien = null;
function preparerExtras(f) {
  const terrain = typeDe(f) === 'terrain', op = operationDe(f);
  const radT = f.querySelector('input[name="transaction"][value="terrain"]');
  if (terrain && op === 'vente' && radT) radT.checked = true;
  /* La saisie n'est pas modifiée (elle reste en ha à l'écran) : la
     conversion en m² se fait dans les données enregistrées. */
  const surf = f.querySelector('[name="surface"]'), unite = (f.querySelector('[name="surfaceUnite"]') || {}).value || 'm2';
  const m2 = terrain && unite === 'ha' && surf ? Math.round(+String(surf.value).replace(',', '.') * 10000) : null;
  const coches = n => [...f.querySelectorAll(`input[name="${n}"]:checked`)].map(i => i.value);
  extrasBien = terrain ? {
    surfaceUnite: unite === 'ha' ? 'ha' : 'm2', rooms: 0, baths: 0, ...(m2 ? {surface: m2} : {}),
    foncier: {statut: (f.querySelector('[name="statutFoncier"]') || {}).value || '', reference: ((f.querySelector('[name="refFonciere"]') || {}).value || '').trim(),
      viabilisation: coches('viab'), documents: coches('docsT'), verification: 'declaratif'}
  } : {surfaceUnite: 'm2', foncier: null};
  clearTimeout(preparerExtras.t); preparerExtras.t = setTimeout(() => { extrasBien = null; }, 4000);
}
/* Le contrôle « statut foncier obligatoire » s'applique aussi au bouton final
   (l'assistant ne le vérifie qu'en changeant d'étape). */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]'); if (!f) return;
  const intent = e.submitter && e.submitter.value;
  if (typeDe(f) === 'terrain' && operationDe(f) !== 'location' && intent === 'publish' && !(f.querySelector('[name="statutFoncier"]') || {}).value) {
    e.preventDefault(); e.stopImmediatePropagation();
    try { formError(f, 'Indiquez le statut foncier du terrain (titre foncier, délibération…) avant de publier.'); } catch (err) {}
    toast('Indiquez le statut foncier du terrain avant de publier.', 'bad');
    try { wizGo(f, 2); } catch (err) {}
    const s = f.querySelector('[name="statutFoncier"]'); if (s) setTimeout(() => s.focus(), 300);
    return;
  }
  preparerExtras(f);
  /* Enregistrement refusé (titre trop court…) : l'opération affichée reste
     « Vente » pour que la saisie soit retrouvée telle quelle. */
  setTimeout(() => { if (document.body.contains(f) && !document.querySelector('.modal')) retablirOperation(f); }, 1500);
}, true);
/* Publication annulée ou refusée : l'opération visible redevient « Vente ». */
function retablirOperation(f) { const t = f && f.querySelector('input[name="transaction"][value="terrain"]'); if (t && t.checked) { const v = f.querySelector('input[name="transaction"][value="vente"]'); if (v) v.checked = true; } }
document.addEventListener('click', e => { if (e.target.closest('[data-action="pub-non"], [data-action="close-modal"]')) retablirOperation(document.querySelector('form[data-action="save-property"]')); }, true);
document.addEventListener('click', e => { if (e.target.closest('[data-action="pub-oui"]')) { const f = document.querySelector('form[data-action="save-property"]'); if (f) preparerExtras(f); } }, true);
/* Le récapitulatif affiche la surface dans l'unité saisie. */
new MutationObserver(() => { const f = document.querySelector('form[data-action="save-property"]'), u = f && f.querySelector('[name="surfaceUnite"]');
  if (!u || u.value !== 'ha' || typeDe(f) !== 'terrain') return;
  document.querySelectorAll('.recap-l').forEach(l => { const b = l.querySelector('b'); if (/^Surface/.test(l.textContent) && b && / m²$/.test(b.textContent)) b.textContent = b.textContent.replace(/ m²$/, ' ha'); }); }).observe(document.body, {childList: true, subtree: true});
const _addItemBien = DB.addItem;
DB.addItem = function (k, item) {
  if (k === DB.K.properties && extrasBien && item && item.title) item = {...item, ...extrasBien};
  return _addItemBien.call(DB, k, item);
};
const _updateBien = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  if (k === DB.K.properties && extrasBien && patch && patch.title) patch = {...patch, ...extrasBien};
  return _updateBien.call(DB, k, id, patch);
};

/* Fiche du bien : surface dans l'unité choisie et informations foncières. */
function blocFoncier(p) {
  if (!p || !(p.type === 'terrain' || p.transaction === 'terrain')) return '';
  const fo = p.foncier || {};
  const ligne = (l, v) => `<div class="fin-l"><span>${esc(l)}</span><b>${v}</b></div>`;
  return `<section class="card fin-fiche" id="infos-foncieres"><h3 style="margin-top:0">Informations foncières</h3>
    ${ligne('Surface', p.surfaceUnite === 'ha' ? `${(+p.surface / 10000).toLocaleString('fr-FR')} ha (${(+p.surface).toLocaleString('fr-FR')} m²)` : `${(+p.surface || 0).toLocaleString('fr-FR')} m²`)}
    ${ligne('Statut foncier', esc(fo.statut || 'Non renseigné'))}
    ${fo.reference ? ligne('Référence', esc(fo.reference)) : ''}
    ${ligne('Viabilisation', esc((fo.viabilisation || []).join(', ') || 'Non renseignée'))}
    ${ligne('Documents disponibles', esc((fo.documents || []).join(', ') || 'Non renseignés'))}
    <p class="small" style="margin:10px 0 0">${badge(fo.verification === 'verifie' ? 'Vérifié par DEUKSIL' : 'Déclaré par l\'annonceur · non vérifié par DEUKSIL', fo.verification === 'verifie' ? 'ok' : 'warn')}</p>
    <p class="small muted" style="margin:8px 0 0">Avant toute transaction, faites vérifier le titre et le plan auprès des services des Domaines et du Cadastre, ou par un notaire.</p></section>`;
}
/* Placé dans la colonne principale, juste après la description du bien. */
function poserBlocFoncier() {
  const m = location.hash.match(/^#\/(?:property|bien)\/([\w]+)(?:\/apercu)?$/), ma = !m && location.hash.match(/^#\/annonce\/[a-z0-9-]+-([a-z0-9]{7})$/);
  const id = m ? m[1] : ma && typeof bienDeRef === 'function' ? (bienDeRef(ma[1]) || {}).id : ''; if (!id) return;
  if (document.getElementById('infos-foncieres')) return;
  const bloc = blocFoncier(gProp(id)); if (!bloc) return;
  const h = [...document.querySelectorAll('#app h3')].find(x => /^(Description|Informations principales)$/i.test(x.textContent.trim()));
  const carte = h && h.closest('.card');
  if (carte) carte.insertAdjacentHTML('afterend', bloc);
  else { const st = document.querySelector('#app .stack'); if (st) st.insertAdjacentHTML('beforeend', bloc); }
}
new MutationObserver(() => requestAnimationFrame(() => { try { poserBlocFoncier(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* --- P2 / P5. Relation propriétaire – agence ------------------------------
   Constat : l'agence qui enregistrait comme mandant un propriétaire déjà
   inscrit lui créait un second compte (même CNI). Le propriétaire était
   dupliqué, et l'agence pouvait le « rattacher » sans son accord.
   Règles appliquées :
   - une seule fiche par propriétaire dans une agence (CNI ou téléphone) ;
   - pas de second compte : si la personne a déjà un compte propriétaire,
     l'agence lui envoie une DEMANDE de rattachement ; rien n'est visible
     tant qu'il n'a pas accepté ;
   - le propriétaire garde son compte, ses biens et leur gestion ; il voit
     à part ses « biens confiés à une agence » et les relevés de l'agence ;
   - l'agence n'obtient aucun droit sur les biens du propriétaire : seuls
     les biens qu'elle gère (sous mandat) sont concernés ;
   - clore la relation archive la fiche au lieu de la supprimer : le compte
     du propriétaire et l'historique (loyers, reversements) sont conservés. */
const tel9 = x => String(x || '').replace(/\D/g, '').slice(-9);
function compteExistant(fiche) {
  return DB.findItem(DB.K.users, u => u.id !== fiche.ownerId && !u.parentId && u.role !== 'admin' && u.ownerRec !== fiche.id &&
    ((fiche.cni && u.cni === fiche.cni) || (tel9(fiche.phone).length === 9 && tel9(u.phone) === tel9(fiche.phone))));
}
const fichesAcceptees = u => u ? DB.filterItems(DB.K.owners, o => o.compteId === u.id && o.lien === 'accepte') : [];
const fichesEnDemande = u => u ? DB.filterItems(DB.K.owners, o => o.compteId === u.id && o.lien === 'demande' && o.status !== 'close') : [];
const nomAgence = id => { const a = DB.findItem(DB.K.users, id); return a ? (a.agencyName || displayName(a)) : 'Une agence'; };

/* 1. Pas de second compte. */
const _compteMandantFin = compteMandant;
compteMandant = function (fiche) {
  if (!fiche || !fiche.name || fiche.compteId || fiche.status === 'close') return null;
  if (DB.findItem(DB.K.users, u => u.ownerRec === fiche.id)) return null;
  const ex = compteExistant(fiche);
  if (ex) {
    if (ex.role === 'owner') {
      DB.updateItem(DB.K.owners, fiche.id, {compteId: ex.id, lien: 'demande', demandeLe: now()});
      notify(ex.id, `${nomAgence(fiche.ownerId)} souhaite vous rattacher comme propriétaire mandant : acceptez pour suivre les biens qu'elle gère pour vous.`, '#/owner/properties?s=demandes-agence');
      notify(fiche.ownerId, `${fiche.name} a déjà un compte DEUKSIL : une demande de rattachement lui a été envoyée (aucun second compte créé).`, '#/manage/owners');
    } else {
      DB.updateItem(DB.K.owners, fiche.id, {compteId: ex.id, lien: 'autre-role'});
      notify(fiche.ownerId, `${fiche.name} a déjà un compte DEUKSIL (${ex.role === 'client' ? 'client' : ex.role}) : aucun second compte créé. Les relevés peuvent lui être envoyés par message ou en PDF.`, '#/manage/owners');
    }
    return null;
  }
  return _compteMandantFin(fiche);
};
/* 2. Une seule fiche par propriétaire dans l'agence. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g9-owner"]'); if (!f) return;
  const u = Auth.current(); if (!u) return;
  const d = formData(f);
  const doublon = DB.findItem(DB.K.owners, o => o.ownerId === u.id && o.status !== 'close' &&
    ((d.cni && o.cni === d.cni) || (tel9(d.phone).length === 9 && tel9(o.phone) === tel9(d.phone))));
  if (doublon) {
    e.preventDefault(); e.stopImmediatePropagation();
    toast(`${doublon.name} est déjà enregistré dans vos propriétaires (même ${d.cni && doublon.cni === d.cni ? 'CNI' : 'téléphone'}) : ouvrez sa fiche plutôt que d'en créer une seconde.`, 'bad');
  }
}, true);

/* 3. Le propriétaire accepte ou refuse. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="lien-accepter"], [data-action="lien-refuser"]'); if (!b) return;
  e.preventDefault();
  const u = Auth.current(); if (!u || u.role !== 'owner' || u.member) return;
  const o = DB.findItem(DB.K.owners, x => x.id === b.dataset.id && x.compteId === u.id && x.lien === 'demande'); if (!o) return;
  const ok = b.dataset.action === 'lien-accepter';
  DB.updateItem(DB.K.owners, o.id, {lien: ok ? 'accepte' : 'refuse', lienLe: now()});
  notify(o.ownerId, `${displayName(u)} a ${ok ? 'accepté' : 'refusé'} le rattachement à votre agence.`, '#/manage/owners');
  logActivity(`${displayName(u)} a ${ok ? 'accepté' : 'refusé'} le rattachement de ${nomAgence(o.ownerId)}`);
  toast(ok ? `Rattachement accepté : vous suivez les biens que ${nomAgence(o.ownerId)} gère pour vous.` : 'Demande refusée : l\'agence en est informée.');
  render();
});

/* 4. « Mes biens » : gestion directe et biens confiés, bien distingués. */
function blocsRelationAgence(u) {
  const dem = fichesEnDemande(u), acc = fichesAcceptees(u);
  let h = '';
  if (dem.length) h += `<section class="card fin-lien" id="demandes-agence"><h4 style="margin-top:0">${icon('building', 17)} Demande${dem.length > 1 ? 's' : ''} de rattachement</h4>
    ${dem.map(o => `<div class="av-row"><div class="av-t"><span class="itile sm gold">${icon('building', 17)}</span><div style="min-width:0"><b>${esc(nomAgence(o.ownerId))}</b>
      <div class="small muted">vous a enregistré comme propriétaire mandant (commission de gestion ${+o.rate || 0} %). En acceptant, vous suivez les biens qu'elle gère pour vous et ses relevés. Vos propres biens restent sous votre seule gestion.</div></div></div>
      <div class="av-b"><button class="btn sm" data-action="lien-accepter" data-id="${o.id}">Accepter</button><button class="btn ghost sm" data-action="lien-refuser" data-id="${o.id}">Refuser</button></div></div>`).join('')}</section>`;
  if (acc.length) {
    const biens = DB.filterItems(DB.K.properties, p => acc.some(o => o.id === p.clientOwnerId));
    h += `<section class="card fin-lien" id="biens-confies"><h4 style="margin-top:0">${icon('home', 17)} Biens confiés à une agence <span class="badge info">${biens.length}</span></h4>
      <p class="small muted" style="margin:0 0 8px">Gérés par l'agence sous mandat : vous les suivez ici, l'agence s'occupe des locataires et des loyers.</p>
      ${biens.length ? biens.map(p => { const o = acc.find(x => x.id === p.clientOwnerId);
        return `<a class="trow" href="#/property/${p.id}"><span class="itile sm">${icon('home', 17)}</span><div class="txt" style="min-width:0"><b>${esc(p.title)}</b>
          <div class="sub">${esc(nomAgence(o.ownerId))} · ${esc((STATUS_LABEL || {})[p.status] || p.status || '')}</div></div>${icon('arrowRight', 16)}</a>`; }).join('')
        : '<p class="small muted">Aucun bien confié pour le moment.</p>'}
      <a class="btn ghost sm" href="#/mandant/releves" style="margin-top:10px">${icon('money', 15)} Relevés de l'agence</a></section>`;
  }
  return h;
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/owner\\/properties$'); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => {
    const h = f(...a); if (h === false || typeof h !== 'string') return h;
    const u = Auth.current(); if (!u || u.role !== 'owner' || u.member || estMandant(u)) return h;
    const blocs = blocsRelationAgence(u); if (!blocs) return h;
    const directs = myProps(u).length;
    const titre = `<p class="small muted fin-direct" style="margin:0 0 10px">${icon('key', 14)} Gestion directe : ${pluriel(directs, 'bien')} que vous gérez vous-même.</p>`;
    return h.replace(/(<div class="(?:rfiltre|bf-bar|table-wrap)|<div class="empty")/, blocs + titre + '$1');
  };
})();

/* 5. Relevés de l'agence : aussi pour un propriétaire rattaché ; une
      relation close garde son historique. */
function relevesPour(u, fiche) {
  const base = myProps, filtre = DB.filterItems, fin = fiche.status === 'close' ? fiche.closedAt : null;
  myProps = x => DB.getData(DB.K.properties).filter(p => p.clientOwnerId === fiche.id || p.exClientOwnerId === fiche.id);
  DB.filterItems = function (k, pred) { const r = filtre.call(DB, k, pred); return k === DB.K.rents && fin ? r.filter(x => !x.paidAt || x.paidAt.slice(0, 10) <= fin) : r; };
  try { return relevesMandant({...u, ownerRec: fiche.id}); } finally { myProps = base; DB.filterItems = filtre; }
}
(() => {
  const r = routes.find(x => x.re.source === '^\\/mandant\\/releves$'); if (!r) return;
  r.fn = () => {
    const u = Auth.current(); if (!u) { go('#/login'); return false; }
    const fiches = estMandant(u) ? [DB.findItem(DB.K.owners, u.ownerRec)].filter(Boolean) : fichesAcceptees(u);
    if (!fiches.length) { toast('Aucune agence ne gère de bien pour vous.', 'bad'); go(Auth.home(u)); return false; }
    return shellApp(u, fiches.map(o => (fiches.length > 1 || !estMandant(u) ? `<h2 class="fin-agence">${esc(nomAgence(o.ownerId))}${o.status === 'close' ? ' <span class="badge">Relation close</span>' : ''}</h2>` : '') + relevesPour(u, o)).join('<hr style="margin:28px 0;border:0;border-top:1px solid var(--line)">'));
  };
})();
/* Le menu d'un propriétaire rattaché propose ses relevés. */
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner'); if (!d || !d.get) return;
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, enumerable: true, set: d.set, get() {
    const m = d.get.call(MENUS_RAW); let u = null; try { u = Auth.current(); } catch (e) {}
    if (u && !estMandant(u) && !u.member && fichesAcceptees(u).length && !m.some(x => x[0] === '#/mandant/releves')) {
      const c = m.slice(); const i = c.findIndex(x => x[0] === '#/owner/properties'); c.splice(i + 1, 0, ['#/mandant/releves', 'Relevés de mon agence', 'money']); return c;
    }
    return m;
  }});
})();

/* 6. Clore la relation au lieu de supprimer la fiche (les contrôles de
      81-agence.js — mandat actif, solde à reverser — passent avant). */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="g9-odel"]'); if (!b) return;
  const u = Auth.current(), o = u && DB.findItem(DB.K.owners, x => x.id === b.dataset.id && x.ownerId === u.id); if (!o) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (o.status === 'close') return toast('Cette relation est déjà close.', 'bad');
  confirmDialog({title: 'Clore la relation', message: `La relation avec ${o.name} sera close : ses biens seront détachés de sa fiche. Son compte, ses relevés et l'historique (loyers, reversements) sont conservés.`, confirmLabel: 'Clore la relation', danger: true,
    onConfirm: () => {
      DB.filterItems(DB.K.properties, p => p.clientOwnerId === o.id).forEach(p => DB.updateItem(DB.K.properties, p.id, {clientOwnerId: '', exClientOwnerId: o.id}));
      DB.updateItem(DB.K.owners, o.id, {status: 'close', closedAt: ymd()});
      const compte = DB.findItem(DB.K.users, x => x.ownerRec === o.id || (o.compteId && x.id === o.compteId));
      if (compte) notify(compte.id, `${nomAgence(o.ownerId)} a clos votre relation de gestion. Vos relevés restent consultables.`, '#/mandant/releves');
      audit('Relation propriétaire close', o.name); toast(`Relation avec ${o.name} close. L'historique est conservé.`); render();
    }});
}, true);
/* La liste de l'agence dit où en est chaque relation. */
function etatsRelations() {
  if (!/^#\/manage\/owners/.test(location.hash)) return;
  document.querySelectorAll('#app [data-action="g9-ofiche"][data-id]:not([data-lien-etat])').forEach(b => {
    b.dataset.lienEtat = '1';
    const o = DB.findItem(DB.K.owners, b.dataset.id); if (!o) return;
    const td = b.closest('tr') && b.closest('tr').querySelector('td'); if (!td) return;
    const compte = DB.findItem(DB.K.users, x => x.ownerRec === o.id);
    const etat = o.status === 'close' ? ['Relation close', ''] : o.lien === 'accepte' ? ['Compte rattaché', 'ok'] : o.lien === 'demande' ? ['Rattachement en attente', 'warn']
      : o.lien === 'refuse' ? ['Rattachement refusé', 'bad'] : o.lien === 'autre-role' ? ['Compte existant (non propriétaire)', ''] : compte ? ['Accès propriétaire créé', 'info'] : ['Sans accès', ''];
    td.insertAdjacentHTML('beforeend', `<br>${badge(etat[0], etat[1])}`);
    const del = b.parentElement.querySelector('[data-action="g9-odel"]');
    if (del) { if (o.status === 'close') del.remove(); else { del.title = 'Clore la relation'; del.setAttribute('aria-label', 'Clore la relation'); } }
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { etatsRelations(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});

/* --- P6. Administration : suspension confirmée et journalisée -------------
   La suspension ou la réactivation d'un compte se faisait d'un clic, sans
   confirmation ni trace. Elle ne touche qu'au statut (aucune donnée métier
   n'est supprimée), demande confirmation, est inscrite au journal de la
   plateforme, et ne s'applique jamais à un compte administrateur. */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="user-toggle"], [data-action="user-del"]'); if (!b) return;
  const u = Auth.current(); if (!u || u.role !== 'admin') return;
  const x = DB.findItem(DB.K.users, b.dataset.id); if (!x) return;
  if (x.role === 'admin' || x.id === u.id) { e.preventDefault(); e.stopImmediatePropagation(); return toast('Un compte administrateur ne peut pas être suspendu ni supprimé ici.', 'bad'); }
  if (b.dataset.action === 'user-del') {
    /* La suppression a déjà sa confirmation : on ajoute seulement la trace. */
    b.dataset.journal = displayName(x);
    return;
  }
  e.preventDefault(); e.stopImmediatePropagation();
  const suspendre = x.status !== 'suspendu';
  confirmDialog({title: suspendre ? 'Suspendre le compte' : 'Réactiver le compte',
    message: suspendre ? `${displayName(x)} ne pourra plus se connecter. Ses biens, documents et dossiers sont conservés ; vous pourrez réactiver le compte à tout moment.`
      : `${displayName(x)} pourra de nouveau se connecter.`,
    confirmLabel: suspendre ? 'Suspendre' : 'Réactiver', danger: suspendre,
    onConfirm: () => {
      DB.updateItem(DB.K.users, x.id, {status: suspendre ? 'suspendu' : 'actif', statutLe: now(), statutPar: u.id});
      logActivity(`Admin ${displayName(u)} : compte ${displayName(x)} (${x.role}) ${suspendre ? 'suspendu' : 'réactivé'}`);
      toast(suspendre ? 'Compte suspendu. Ses données sont conservées.' : 'Compte réactivé.'); render();
    }});
}, true);
const _cascadeDeleteUserFin = cascadeDeleteUser;
cascadeDeleteUser = function (id) {
  const x = DB.findItem(DB.K.users, id), u = Auth.current();
  if (x && x.role === 'admin') return toast('Un compte administrateur ne peut pas être supprimé.', 'bad');
  const r = _cascadeDeleteUserFin(id);
  try { if (x) logActivity(`Admin ${u ? displayName(u) : ''} : compte ${displayName(x)} (${x.role}) supprimé définitivement`); } catch (e) {}
  return r;
};
/* Un compte suspendu perd aussi la session déjà ouverte : la vérification
   ne se faisait qu'à la connexion. */
const _currentFin = Auth.current.bind(Auth);
Auth.current = function () {
  const u = _currentFin();
  if (u && (u.status === 'suspendu' || (u.member && u.member.status === 'suspendu'))) {
    try { localStorage.removeItem(DB.K.session); } catch (e) {}
    return null;
  }
  return u;
};

/* --- Suppressions sans confirmation ----------------------------------------
   Quelques boutons « corbeille » effaçaient sans rien demander (dossier de
   vente ou intervention dans l'ancienne vue, prestataire, lot, agent).
   Une suppression définitive demande désormais confirmation. */
const SUPPRESSIONS = {'g-del': 'cet élément', 'g3-delprov': 'ce prestataire', 'g9-ldel': 'ce lot', 'agent-del': 'cet agent'};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action]'); if (!b || !SUPPRESSIONS[b.dataset.action]) return;
  if (b.dataset.confirme === '1') { delete b.dataset.confirme; return; }
  e.preventDefault(); e.stopImmediatePropagation();
  const quoi = b.dataset.coll === 'deals' ? 'ce dossier de vente' : b.dataset.coll === 'tickets' ? 'cette intervention' : SUPPRESSIONS[b.dataset.action];
  confirmDialog({title: 'Supprimer définitivement', message: `Voulez-vous vraiment supprimer ${quoi} ? Cette action est définitive.`, confirmLabel: 'Supprimer', danger: true,
    onConfirm: () => { b.dataset.confirme = '1'; if (document.body.contains(b)) b.click(); }});
}, true);

/* ==========================================================================
   PARTIE 2 — navigation, formulaires, parcours.
   N1. Les erreurs s'affichent à côté du champ concerné.
   ========================================================================== */
/* Les messages d'erreur partaient dans un bandeau temporaire, loin du champ :
   on ne savait plus quoi corriger. Quand une erreur survient pendant l'envoi
   d'un formulaire, elle est aussi écrite sous le champ en cause, qui est
   entouré de rouge et reçoit le curseur. Le bandeau reste. */
const CHAMPS_ERREUR = [
  [/statut foncier/i, ['statutFoncier']], [/\bcni\b/i, ['cni']], [/t[ée]l[ée]phone|num[ée]ro/i, ['phone', 'tel']],
  [/loyer/i, ['rent']], [/locataire/i, ['tenant']], [/prix/i, ['price']], [/surface/i, ['surface']], [/titre/i, ['title']],
  [/mot de passe actuel/i, ['ancien']], [/ne correspondent pas|confirm/i, ['confirme', 'password2']], [/mot de passe/i, ['nouveau', 'password']],
  [/montant|offre/i, ['amount', 'offre', 'offer', 'montant']], [/heure/i, ['time']], [/date/i, ['date', 'start']],
  [/commission|taux/i, ['rate']], [/\bnom\b|client/i, ['name', 'lastName', 'firstName', 'buyer']], [/bien/i, ['propertyId']], [/agent/i, ['agentId']]
];
const champVide = i => { const v = String(i.value || '').trim(); return !v || (i.type === 'number' && +v <= 0) || !i.checkValidity(); };
function champFautif(f, msg) {
  const cands = [];
  CHAMPS_ERREUR.forEach(([re, noms]) => { if (re.test(msg)) noms.forEach(n => { const i = f.querySelector(`[name="${n}"]`); if (i && i.type !== 'hidden' && !cands.includes(i)) cands.push(i); }); });
  return cands.find(champVide) || cands[0] || null;
}
function effacerErreursChamps(f) {
  f.querySelectorAll('.champ-err').forEach(x => x.remove());
  f.querySelectorAll('.champ-ko').forEach(x => { x.classList.remove('champ-ko'); x.removeAttribute('aria-invalid'); });
}
function erreurSousChamp(f, msg) {
  if (!f || !document.body.contains(f) || !msg) return;
  effacerErreursChamps(f);
  const i = champFautif(f, msg);
  const bloc = document.createElement('div');
  bloc.className = 'champ-err'; bloc.setAttribute('role', 'alert'); bloc.textContent = msg;
  if (i) {
    i.classList.add('champ-ko'); i.setAttribute('aria-invalid', 'true');
    const champ = i.closest('.field') || i.parentElement; champ.appendChild(bloc);
    /* Le champ peut être sur une autre étape de l'assistant. */
    const etape = i.closest('.wstep'); if (etape && !etape.classList.contains('on') && typeof wizGo === 'function') try { wizGo(f, +etape.dataset.step); } catch (e) {}
    setTimeout(() => { try { i.focus({preventScroll: true}); i.scrollIntoView({block: 'center', behavior: 'smooth'}); } catch (e) {} }, 60);
  } else {
    bloc.classList.add('champ-err-form'); f.insertBefore(bloc, f.firstElementChild ? f.firstElementChild.nextSibling : null);
  }
}
const formRecent = () => FORM_SOUMIS && Date.now() - FORM_SOUMIS.t < 1500 && document.body.contains(FORM_SOUMIS.f) ? FORM_SOUMIS.f : null;
const _toastChamp = toast;
toast = function (m, ton) {
  if (ton === 'bad') { const f = formRecent(); if (f) try { erreurSousChamp(f, String(m)); } catch (e) {} }
  return _toastChamp.apply(this, arguments);
};
if (typeof formError === 'function') {
  const _formErrorChamp = formError;
  formError = function (form, msg) { const r = _formErrorChamp.apply(this, arguments); try { erreurSousChamp(form, String(msg)); } catch (e) {} return r; };
}
/* Les écrans de gestion écrivent leurs erreurs dans une zone #g-err en bas
   du formulaire : on les rapproche du champ aussi. */
new MutationObserver(ms => ms.forEach(m => {
  const z = m.target.nodeType === 1 ? m.target : m.target.parentElement;
  if (!z || z.id !== 'g-err' || !z.textContent.trim()) return;
  const f = z.closest('form') || formRecent(); if (f) erreurSousChamp(f, z.textContent.trim());
})).observe(document.body, {childList: true, subtree: true, characterData: true});
/* Corriger le champ efface son message. */
document.addEventListener('input', e => {
  const i = e.target; if (!i.classList || !i.classList.contains('champ-ko')) return;
  i.classList.remove('champ-ko'); i.removeAttribute('aria-invalid');
  const c = (i.closest('.field') || i.parentElement).querySelector('.champ-err'); if (c) c.remove();
});
/* Le bail : le message générique devient précis. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="g-lease"]'); if (!f) return;
  const d = formData(f);
  if (String(d.tenant || '').trim() && !(+d.rent > 0)) { e.preventDefault(); e.stopImmediatePropagation(); toast('Indiquez un loyer mensuel supérieur à 0.', 'bad'); }
}, true);

/* --- N2. Modifier une annonce sans traverser tout l'assistant -------------
   Pour changer un prix, il fallait passer les 3 étapes puis confirmer. En
   modification, « Enregistrer les modifications » est proposé à chaque
   étape : l'annonce garde son statut (publiée reste publiée). La création
   d'un bien garde l'assistant complet et son récapitulatif. */
const _wizGoFin = wizGo;
wizGo = function (form, n) {
  const r = _wizGoFin.apply(this, arguments);
  try {
    if (form && form.dataset.action === 'save-property' && form.dataset.id) {
      const end = form.querySelector('#wiz-end'); if (end) { end.classList.remove('hidden'); end.style.display = 'inline-flex'; }
      const p = gProp(form.dataset.id), brouillon = form.querySelector('#wiz-end button[value="draft"]');
      if (brouillon && p && p.listingStatus === 'publiee') brouillon.textContent = 'Enregistrer les modifications';
      const pub = form.querySelector('#wiz-end button[value="publish"]');
      if (pub && p && p.listingStatus === 'publiee') pub.style.display = 'none';   // déjà en ligne : un seul bouton, sans ambiguïté
    }
  } catch (e) {}
  return r;
};
/* Le message suit : on n'enregistre pas un « brouillon » quand l'annonce est en ligne. */
let modifEnLigne = 0;
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]'); if (!f || !f.dataset.id) return;
  const p = gProp(f.dataset.id); if (p && p.listingStatus === 'publiee' && e.submitter && e.submitter.value === 'draft') modifEnLigne = Date.now();
}, true);
const _toastModif = toast;
toast = function (m, ton) {
  if (m === 'Brouillon mis à jour.' && Date.now() - modifEnLigne < 2000) { modifEnLigne = 0; return _toastModif('Modifications enregistrées : l\'annonce reste en ligne.', ton); }
  return _toastModif.apply(this, arguments);
};

/* --- N3. Le propriétaire indépendant planifie ses visites ------------------
   Un propriétaire qui prend rendez-vous par téléphone ne pouvait pas
   l'enregistrer : seules l'agence et l'agent le pouvaient. Le même bouton
   « Planifier une visite » (et la même fenêtre) lui est proposé sur son
   écran Visites, et son menu gagne l'entrée « Visites ». */
function boutonPlanifProprio() {
  if (location.hash !== '#/owner/visits') return;
  const u = Auth.current(); if (!u || u.role !== 'owner' || estMandant(u) || (u.member && !memberCan(u, 'visites'))) return;
  const head = document.querySelector('#app .page-head'); if (!head || head.querySelector('[data-action="agent-planif"]')) return;
  const b = document.createElement('button'); b.className = 'btn'; b.dataset.action = 'agent-planif';
  b.innerHTML = `${icon('plus', 16)} Planifier une visite`;
  (head.querySelector('.row') || head).appendChild(b);
}
new MutationObserver(() => requestAnimationFrame(() => { try { boutonPlanifProprio(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner'); if (!d || !d.get) return;
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, enumerable: true, set: d.set, get() {
    const m = d.get.call(MENUS_RAW); let u = null; try { u = Auth.current(); } catch (e) {}
    if (!u || estMandant(u) || m.some(x => x[0] === '#/owner/visits')) return m;
    const c = m.slice(), i = c.findIndex(x => x[0] === '#/owner/properties');
    c.splice(i < 0 ? 1 : i + 1, 0, ['#/owner/visits', 'Visites', 'calendar']); return c;
  }});
})();

/* --- N4. Un écran, un nom ; une barre du bas complète pour le mandant ------
   « Travaux » chez le propriétaire, « Maintenance » chez son gestionnaire
   pour le même écran ; « Locataires » menait à deux écrans différents selon
   le profil. Et la barre du bas du mandant n'avait que 2 entrées. */
(() => {
  const d = Object.getOwnPropertyDescriptor(MENUS_RAW, 'owner'); if (!d || !d.get) return;
  Object.defineProperty(MENUS_RAW, 'owner', {configurable: true, enumerable: true, set: d.set, get() {
    const m = d.get.call(MENUS_RAW); if (!Array.isArray(m)) return m;
    return m.map(x => x[0] === '#/manage/tickets' ? [x[0], 'Travaux', x[2]] : x[0] === '#/manage/tenants' && x[1] === 'Locataires' ? ['#/manage/leases', 'Locataires', x[2]] : x);
  }});
})();
const BARRE_MANDANT = [['#/owner/dashboard', 'Accueil', 'grid'], ['#/owner/properties', 'Biens confiés', 'home'], ['#/mandant/releves', 'Relevés', 'money'], ['#/coffre', 'Documents', 'file'], ['#/owner/messages', 'Messages', 'message']];
const _tabBarMandant = tabBarHtml;
tabBarHtml = function (u, path) {
  if (!estMandant(u)) return _tabBarMandant(u, path);
  return `<nav class="tabbar" aria-label="Navigation principale">${BARRE_MANDANT.map(([h, l, ic]) =>
    `<a href="${h}" class="tab-item ${path === h.slice(1) ? 'active' : ''}">${icon(ic, 21)}<span>${esc(l)}</span></a>`).join('')}</nav>`;
};
/* L'option « Terrain » (3e opération) est masquée dès la construction de la
   page, et non après affichage : aucun clignotement sur un téléphone lent. */
(() => {
  const r = routes.find(x => x.re.source.includes('property') && x.re.source.includes('new')); if (!r) return;
  const f = r.fn;
  r.fn = (...a) => { const h = f(...a); return typeof h === 'string' ? h.replace('<label class="opt"><input type="radio" name="transaction" value="terrain"', '<label class="opt" style="display:none"><input type="radio" name="transaction" value="terrain"') : h; };
})();

/* ==========================================================================
   PARTIE 3 — informations au bon moment, fiabilité métier.
   I1. Un bien loué ou vendu ne repasse pas « En discussion ».
   I2. Une annonce qui n'est pas visible ne s'affiche pas « Publiée ».
   ========================================================================== */
/* I1. Accepter une visite mettait le bien « En discussion », même loué : un
   état incompatible avec son bail. La règle est posée au niveau des données,
   pour tous les chemins (visite, planification, import…). */
const _updateEtat = DB.updateItem;
DB.updateItem = function (k, id, patch) {
  if (k === DB.K.properties && patch && patch.status === 'discussion') {
    const p = DB.findItem(DB.K.properties, id);
    const engage = p && (['loue', 'vendu', 'archive'].includes(p.status) || DB.findItem(DB.K.leases, l => l.propertyId === id && l.status === 'actif' && !l.unitId));
    if (engage) { const {status, ...reste} = patch; if (!Object.keys(reste).length) return p; patch = reste; }
  }
  return _updateEtat.call(DB, k, id, patch);
};

/* I2. « Publiée » ne doit vouloir dire qu'une chose : visible dans la
   recherche. Pour un bien loué, vendu ou sans lot libre, le badge dit
   pourquoi l'annonce est hors ligne. */
const RAISON_HORS_LIGNE = p => {
  if (p.status === 'vendu') return 'Hors ligne · vendu';
  if (p.status === 'archive') return 'Hors ligne · archivé';
  if (p.status === 'maintenance') return 'Hors ligne · travaux';
  if (DB.getData(DB.K.units).some(x => x.propertyId === p.id && x.status !== 'archivee')) return 'Hors ligne · aucun lot libre';
  return 'Hors ligne · loué';
};
function badgesAnnonces() {
  if (!/^#\/(owner|agency|admin)\/(properties|listings)$/.test(location.hash.split('?')[0])) return;
  document.querySelectorAll('#app table tbody tr:not([data-enligne])').forEach(tr => {
    tr.dataset.enligne = '1';
    const el = tr.querySelector('[data-id]') || tr.querySelector('a[href^="#/bien/"], a[href^="#/property/"]'); if (!el) return;
    const id = el.dataset.id || (el.getAttribute('href') || '').split('/').pop();
    const p = gProp(id); if (!p || p.listingStatus !== 'publiee' || listable(p)) return;
    const b = [...tr.querySelectorAll('.badge')].find(x => x.textContent.trim() === LISTING_LABEL.publiee); if (!b) return;
    b.className = 'badge info'; b.innerHTML = '<i class="dot"></i>' + esc(RAISON_HORS_LIGNE(p));
    b.title = 'L\'annonce réapparaîtra dans la recherche quand le bien sera de nouveau disponible.';
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { badgesAnnonces(); } catch (e) {} })).observe(document.body, {childList: true, subtree: true});
