/* ==========================================================================
   MODULE : trust.js — signalement d'annonces, modération admin, vérification
   ========================================================================== */
Object.assign(DB.K, {reports:'deuksil_reports', v5seed:'deuksil_v5seed'});
const REASONS = ['Fausse annonce', 'Bien déjà vendu', 'Bien déjà loué', 'Faux propriétaire', 'Photos incorrectes', 'Prix trompeur', 'Document suspect', 'Localisation incorrecte', 'Autre'];
const RSTATE = {nouveau:['Nouveau', 'warn'], examine:['En examen', 'info'], modifs:['Modifications demandées', 'info'], suspendu:['Annonce suspendue', 'bad'], rejete:['Sans suite', ''], supprime:['Annonce supprimée', 'bad']};
const VERIF = {none:['Non vérifié', ''], identite:['Identité vérifiée', 'info'], annonce:['Annonce vérifiée', 'ok'], bien:['Bien vérifié', 'ok'], pro:['Professionnel vérifié', 'gold']};
const vBadge = l => badge(...(VERIF[l] || VERIF.none));
MENUS_RAW.admin.splice(MENUS_RAW.admin.length - 1, 0, ['#/admin/signalements', 'Signalements', 'alert'], ['#/admin/verifications', 'Vérifications', 'checkCircle']);

/* Fiche d'un bien : niveau de vérification + bouton Signaler */
const _pr = routes.find(r => r.re.source.startsWith('^\\/property'));
const _pf = _pr.fn;
_pr.fn = id => {
  const h = _pf(id); if (typeof h !== 'string') return h;
  const p = DB.findItem(DB.K.properties, id); if (!p) return h;
  const o = DB.findItem(DB.K.users, p.ownerId) || {};
  const strip = `<div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">${vBadge(o.verifLevel)}${p.verifLevel && p.verifLevel !== 'none' ? vBadge(p.verifLevel) : ''}</div>
    <p class="small muted" style="margin:0 0 10px">La vérification DEUKSIL porte sur l'identité ou l'annonce, selon les contrôles réellement effectués. Elle ne vaut pas validation juridique ou foncière : faites contrôler tout titre par un notaire.</p>`;
  return h.replace('<div class="row-between"><h2>', strip + '<div class="row-between"><h2>')
    .replace(/(<button class="btn ghost" data-action="ask-visit"[^>]*>[^<]*<\/button>)/, `$1 <button class="btn ghost" data-action="g5-report" data-id="${p.id}">${icon('alert', 16)} Signaler</button>`);
};

/* Admin : signalements */
route(/^\/admin\/signalements$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const list = DB.getData(DB.K.reports).slice().reverse().sort((a, b) => (b.status === 'nouveau') - (a.status === 'nouveau'));
  const n = s => list.filter(r => r.status === s).length;
  return shellApp(u, page('Signalements', 'Examinez les annonces signalées par les utilisateurs.') +
    `<div class="kpis">${kpi(n('nouveau'), 'Nouveaux', 'bad')}${kpi(list.filter(r => ['examine', 'modifs'].includes(r.status)).length, 'En cours')}${kpi(list.filter(r => ['suspendu', 'supprime', 'rejete'].includes(r.status)).length, 'Traités')}</div><div style="margin-top:18px">` +
    gTable(['Date', 'Annonce', 'Motif', 'Signalé par', 'Statut', 'Actions'], list.map(r => {
      const p = DB.findItem(DB.K.properties, r.propertyId), by = DB.findItem(DB.K.users, r.reporterId) || {}, [lab, tone] = RSTATE[r.status] || ['—', ''];
      return `<tr><td class="small muted">${dateFr(r.createdAt)}</td><td class="small">${p ? `<a href="#/property/${p.id}"><b>${esc(p.title)}</b></a>` : `<b>${esc(r.title)}</b>`}</td>
        <td class="small"><b>${esc(r.reason)}</b>${r.comment ? `<br><span class="muted">${esc(r.comment)}</span>` : ''}</td><td class="small">${esc((by.firstName || '') + ' ' + (by.lastName || ''))}</td><td>${badge(lab, tone)}</td>
        <td>${p ? `<div class="row" style="gap:6px;flex-wrap:wrap">
          ${r.status === 'nouveau' ? `<button class="btn ghost sm" data-action="g5-act" data-do="examine" data-id="${r.id}">Examiner</button>` : ''}
          <button class="btn ghost sm" data-action="g5-act" data-do="mods" data-id="${r.id}">Demander modifs</button>
          ${r.status === 'suspendu' ? `<button class="btn sm" data-action="g5-act" data-do="restore" data-id="${r.id}">Restaurer</button>` : `<button class="btn ghost sm" data-action="g5-act" data-do="suspend" data-id="${r.id}">Suspendre</button>`}
          <button class="btn ghost sm" data-action="g5-act" data-do="delete" data-id="${r.id}">Supprimer</button>
          ${['nouveau', 'examine'].includes(r.status) ? `<button class="btn ghost sm" data-action="g5-act" data-do="dismiss" data-id="${r.id}">Sans suite</button>` : ''}</div>` : '<span class="small muted">—</span>'}</td></tr>`;
    }), ['Aucun signalement', 'Les annonces signalées apparaîtront ici.']) + '</div>');
});

/* Admin : niveaux de vérification */
route(/^\/admin\/verifications$/, () => {
  const u = Auth.guard('admin'); if (!u) return false;
  const sel = (act, id, cur, keys) => `<select class="input" data-action="${act}" data-id="${id}">${keys.map(k => `<option value="${k}" ${(cur || 'none') === k ? 'selected' : ''}>${VERIF[k][0]}</option>`).join('')}</select>`;
  const users = DB.filterItems(DB.K.users, x => ['owner', 'agency'].includes(x.role) && !x.parentId), props = DB.getData(DB.K.properties);
  return shellApp(u, page('Vérifications', 'Attribuez un niveau uniquement après un contrôle réel des pièces ou de l\'annonce.') +
    `<h3>Propriétaires et agences</h3>` + gTable(['Compte', 'Rôle', 'Niveau'], users.map(x => `<tr><td class="small"><b>${esc(x.role === 'agency' ? x.agencyName : x.firstName + ' ' + x.lastName)}</b></td><td class="small">${x.role === 'agency' ? 'Agence' : 'Propriétaire'}</td><td>${sel('g5-vuser', x.id, x.verifLevel, ['none', 'identite', 'pro'])}</td></tr>`), ['Aucun compte', '']) +
    `<h3 style="margin-top:26px">Annonces</h3>` + gTable(['Annonce', 'Niveau'], props.map(p => `<tr><td class="small"><b>${esc(p.title)}</b></td><td>${sel('g5-vprop', p.id, p.verifLevel, ['none', 'annonce', 'bien'])}</td></tr>`), ['Aucune annonce', '']));
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-action="g5-vuser"],[data-action="g5-vprop"]'), u = Auth.current(); if (!el || !u || u.role !== 'admin') return;
  const isU = el.dataset.action === 'g5-vuser', it = DB.updateItem(isU ? DB.K.users : DB.K.properties, el.dataset.id, {verifLevel: el.value}); if (!it) return;
  notify(isU ? it.id : it.ownerId, `Niveau de vérification mis à jour : ${VERIF[el.value][0]}.`, ''); toast('Niveau enregistré.');
});

/* Signalement côté utilisateur et décisions de l'admin */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action^="g5-"]'), u = Auth.current(); if (!el || el.tagName === 'SELECT') return;
  const a = el.dataset.action, id = el.dataset.id;
  if (a === 'g5-report') {
    e.preventDefault(); const p = DB.findItem(DB.K.properties, id);
    if (!u) { toast('Connectez-vous pour signaler une annonce.', 'bad'); go('#/login'); return; }
    if (u.role === 'admin' || !p || p.ownerId === u.id) { toast('Vous ne pouvez pas signaler cette annonce.', 'bad'); return; }
    modal('Signaler cette annonce', `<p class="small muted">${esc(p.title)}</p><form data-action="g5-send" data-id="${p.id}"><div class="field"><label>Motif</label><select class="input" name="reason">${REASONS.map(r => `<option>${r}</option>`).join('')}</select></div>
      <div class="field"><label>Précisions (facultatif)</label><textarea name="comment" maxlength="400"></textarea></div><button class="btn block">Envoyer le signalement</button></form>`);
  }
  if (a !== 'g5-act' || !u || u.role !== 'admin') return;
  const r = DB.findItem(DB.K.reports, id), p = r && DB.findItem(DB.K.properties, r.propertyId); if (!r || !p) return;
  const done = (st, msg, patch) => { DB.updateItem(DB.K.reports, id, {status: st, ...patch}); if (msg) notify(p.ownerId, msg, ''); render(); };
  const how = el.dataset.do;
  if (how === 'examine') done('examine');
  if (how === 'dismiss') { done('rejete'); notify(r.reporterId, 'Votre signalement a été examiné : aucune suite n\'a été donnée.', ''); }
  if (how === 'mods') promptDialog({title: 'Demander des modifications', label: 'Message au propriétaire', onConfirm: v => done('modifs', `Annonce « ${p.title} » : modification demandée. ${v}`)});
  if (how === 'suspend') confirmDialog({title: 'Suspendre l\'annonce', message: 'Elle sera retirée de la recherche (en pause) jusqu\'à restauration.', confirmLabel: 'Suspendre', danger: true, onConfirm: () => {
    DB.updateItem(DB.K.properties, p.id, {listingStatus: 'pause', prevListing: p.listingStatus === 'pause' ? 'publiee' : p.listingStatus});
    done('suspendu', `Votre annonce « ${p.title} » a été suspendue suite à un signalement.`); notify(r.reporterId, 'Merci : l\'annonce signalée a été suspendue.', ''); }});
  if (how === 'restore') { DB.updateItem(DB.K.properties, p.id, {listingStatus: p.prevListing || 'publiee'}); done('examine', `Votre annonce « ${p.title} » est de nouveau en ligne.`); }
  if (how === 'delete') confirmDialog({title: 'Supprimer l\'annonce', message: 'Définitif : l\'annonce, ses favoris et ses visites seront supprimés.', confirmLabel: 'Supprimer', danger: true, onConfirm: () => {
    notify(p.ownerId, `Votre annonce « ${p.title} » a été supprimée après signalement.`, ''); cascadeDeleteProperty(p.id); DB.updateItem(DB.K.reports, id, {status: 'supprime'}); render(); }});
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="g5-send"]'), u = Auth.current(); if (!f || !u) return;
  e.preventDefault(); const p = DB.findItem(DB.K.properties, f.dataset.id), d = formData(f);
  if (!p || p.ownerId === u.id || u.role === 'admin') return;
  if (DB.findItem(DB.K.reports, r => r.propertyId === p.id && r.reporterId === u.id && ['nouveau', 'examine'].includes(r.status))) { closeModal(); toast('Vous avez déjà signalé cette annonce.', 'bad'); return; }
  DB.addItem(DB.K.reports, {propertyId: p.id, title: p.title, ownerId: p.ownerId, reporterId: u.id, reason: REASONS.includes(d.reason) ? d.reason : 'Autre', comment: (d.comment || '').slice(0, 400), status: 'nouveau'});
  DB.filterItems(DB.K.users, x => x.role === 'admin').forEach(a => notify(a.id, `Nouveau signalement : « ${p.title} » (${d.reason}).`, '#/admin/signalements'));
  closeModal(); toast('Signalement envoyé. Merci.');
});

/* Démo : un signalement et quelques niveaux de vérification */
function seedV5() {
  if (localStorage.getItem(DB.K.v5seed)) return;
  const props = DB.filterItems(DB.K.properties, p => p.listingStatus === 'publiee'), cl = DB.findItem(DB.K.users, x => x.cni === '1900000000002'); if (!props.length || !cl) return;
  localStorage.setItem(DB.K.v5seed, '1');
  DB.addItem(DB.K.reports, {propertyId: props[0].id, title: props[0].title, ownerId: props[0].ownerId, reporterId: cl.id, reason: 'Prix trompeur', comment: 'Le prix affiché ne correspond pas à celui annoncé au téléphone.', status: 'nouveau'});
  DB.updateItem(DB.K.properties, props[0].id, {verifLevel: 'annonce'});
  [['1900000000003', 'identite'], ['1900000000004', 'pro']].forEach(([c, l]) => { const x = DB.findItem(DB.K.users, y => y.cni === c); if (x) DB.updateItem(DB.K.users, x.id, {verifLevel: l}); });
}
etapeAmorcage('signalements', seedV5);
