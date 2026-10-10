/* ==========================================================================
   MODULE : interactions.js — refermer les boucles entre les rôles.
   Quatre enchaînements s'arrêtaient en chemin :
   1. le locataire recevait un accès sans jamais en être informé ;
   2. la relance d'un loyer sortait vers WhatsApp, sans trace ni rappel
      dans l'espace du locataire ;
   3. une visite acceptée ne menait pas au bail ;
   4. l'acquéreur d'une vente était saisi à la main, sans lien avec le
      client qui avait visité.
   ========================================================================== */

/* --- 1. Le locataire est accueilli dans son espace ---------------------- */
const _compteBail = compteDuBail;
compteDuBail = function (bail) {
  const u = _compteBail(bail);
  if (!u) return u;
  try {
    const prop = DB.findItem(DB.K.users, bail.ownerId);
    const bien = (gProp(bail.propertyId) || {}).title || 'votre logement';
    notify(u.id, `Bienvenue : votre espace locataire pour « ${bien} » est ouvert.`, '#/tenant/home');
    /* Un premier mot du propriétaire, pour que le fil ne soit pas vide. */
    if (!DB.findItem(DB.K.tmsgs, m => m.leaseId === bail.id)) {
      DB.addItem(DB.K.tmsgs, {leaseId: bail.id, from: 'owner', read: false,
        text: `Bienvenue ${u.firstName}. Vous trouverez ici vos loyers et vos quittances, et vous pouvez me signaler tout problème dans le logement.`});
    }
    if (prop) notify(prop.id, `${u.firstName} ${u.lastName} a reçu son accès locataire.`, '#/manage/tenants');
  } catch (e) {}
  return u;
};

/* --- 2. Relance d'un loyer : dans l'application, et datée --------------- */
function poserRelances() {
  document.querySelectorAll('.main .table-wrap tbody tr').forEach(tr => {
    const wa = tr.querySelector('a[href^="https://wa.me/"]');
    if (!wa || tr.dataset.rel) return;
    const pay = tr.querySelector('[data-action="g-pay"]');
    if (!pay) return;
    tr.dataset.rel = '1';
    const r = DB.findItem(DB.K.rents, pay.dataset.id);
    const b = document.createElement('button');
    b.className = 'btn ghost sm';
    b.setAttribute('data-action', 'relance-interne');
    b.setAttribute('data-id', pay.dataset.id);
    b.innerHTML = `${icon('bell', 14)} Relancer`;
    wa.before(b);
    wa.innerHTML = `${icon('phone', 14)} WhatsApp`;
    if (r && r.remindedAt) {
      const note = document.createElement('div');
      note.className = 'small muted';
      note.style.cssText = 'flex-basis:100%;margin-top:4px';
      note.textContent = `Relancé le ${dateFr(r.remindedAt)}${r.reminders > 1 ? ` · ${r.reminders} relances` : ''}`;
      wa.parentElement.append(note);
    }
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="relance-interne"]');
  if (!b) return;
  const u = Auth.current(); if (!u) return;
  const r = DB.findItem(DB.K.rents, b.dataset.id); if (!r) return;
  const bail = DB.findItem(DB.K.leases, r.leaseId);
  const loc = bail ? locataireDuBail(bail) : null;
  DB.updateItem(DB.K.rents, r.id, {remindedAt: now(), reminders: (r.reminders || 0) + 1});
  if (loc) {
    notify(loc.id, `Rappel : le loyer de ${monthLabel(r.month)} (${money(r.amount)}) reste à régler.`, '#/tenant/rents');
    if (bail) DB.addItem(DB.K.tmsgs, {leaseId: bail.id, from: 'owner', read: false,
      text: `Rappel : le loyer de ${monthLabel(r.month)} (${money(r.amount)}) n'a pas encore été réglé.`});
    toast(`${loc.firstName} a été relancé dans son espace.`);
  } else {
    toast('Relance enregistrée. Ce locataire n\'a pas encore de compte.', 'warn');
  }
  render();
});

/* Côté locataire : un bandeau tant qu'un loyer reste dû. */
function bandeauRetard() {
  const u = Auth.current();
  if (!u || u.role !== 'tenant' || !u.leaseId) return;
  const c = document.querySelector('.main > .content');
  if (!c || c.querySelector('.retard-bandeau')) return;
  if (!/^#\/tenant\/(home|rents)/.test(location.hash)) return;
  const dus = DB.filterItems(DB.K.rents, r => r.leaseId === u.leaseId && !r.paidAt)
    .filter(r => rentState(r)[1] === 'bad');
  if (!dus.length) return;
  const total = dus.reduce((s, r) => s + (r.amount || 0), 0);
  const relance = dus.find(r => r.remindedAt);
  const d = document.createElement('div');
  d.className = 'retard-bandeau';
  d.innerHTML = `<span class="rb-ic">${icon('alert', 18)}</span>
    <div style="min-width:0"><b>${dus.length} loyer${dus.length > 1 ? 's' : ''} en retard · ${money(total)}</b>
      <div class="small">${relance ? `Votre propriétaire vous a relancé le ${dateFr(relance.remindedAt)}.` : 'Réglez auprès de votre propriétaire, qui enregistrera le paiement.'}</div></div>
    <a class="btn sm" href="#/tenant/messages" style="margin-left:auto">Le contacter</a>`;
  c.prepend(d);
}

/* --- 3. D'une visite acceptée au bail ----------------------------------- */
let clientPourBail = null;

/* Les lignes de visite en état final ne portent aucun bouton : on place
   le raccourci dans un bloc à part, qui recense les clients ayant visité
   et pouvant recevoir un bail. */
function poserBlocBail() {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  if (!/^#\/(owner|agency)\/visits/.test(location.hash)) return;
  const c = document.querySelector('.main > .content');
  if (!c || c.querySelector('.suite-visite')) return;

  const vus = new Map();
  DB.getData(DB.K.visits)
    .filter(v => v.ownerId === u.id && ['acceptee', 'terminee'].includes(v.status))
    .forEach(v => {
      const cl = DB.findItem(DB.K.users, v.clientId);
      /* Une personne qui loue déjà reste proposée : elle peut prendre un
         logement de plus. On l'écarte seulement pour le bien qu'elle occupe
         déjà, où il n'y a rien à signer. */
      if (!cl || vus.has(cl.id)) return;
      if (bauxActifs(cl).some(x => x.propertyId === v.propertyId)) return;
      vus.set(cl.id, {cl, v});
    });
  if (!vus.size) return;

  const d = document.createElement('div');
  d.className = 'card suite-visite';
  d.innerHTML = `<h4 style="margin-top:0">Suite à une visite</h4>
    <p class="small muted">Ces clients ont visité un de vos biens. Établissez leur bail sans ressaisir leurs coordonnées.</p>
    <div class="stack" style="gap:9px;margin-top:12px">
      ${[...vus.values()].map(({cl, v}) => `<div class="row-between" style="gap:12px;flex-wrap:wrap">
        <div style="min-width:0"><b class="small">${esc(cl.firstName + ' ' + cl.lastName)}</b>
          <div class="small muted">${esc((gProp(v.propertyId) || {}).title || '')} · visite ${esc(VISIT_LABEL[v.status].toLowerCase())}</div></div>
        <button class="btn sm" data-action="visite-bail" data-id="${v.id}">Établir le bail</button>
      </div>`).join('')}
    </div>`;
  c.prepend(d);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="visite-bail"]');
  if (!b) return;
  const v = DB.findItem(DB.K.visits, b.dataset.id); if (!v) return;
  clientPourBail = {clientId: v.clientId, propertyId: v.propertyId};
  go('#/manage/leases');
});

/* Le formulaire de bail s'ouvre déjà rempli avec ce client et ce bien. */
function appliquerPreselection() {
  if (!clientPourBail) return;
  const f = document.querySelector('.main form[data-action="g-lease"]');
  const sel = f && f.querySelector('[data-action="bc-choisir"]');
  if (!sel) return;
  const opt = [...sel.options].find(o => o.value === clientPourBail.clientId);
  if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change', {bubbles: true})); }
  const pr = f.querySelector('[name="propertyId"]');
  if (pr && [...pr.options].some(o => o.value === clientPourBail.propertyId)) pr.value = clientPourBail.propertyId;
  f.scrollIntoView({block: 'center'});
  toast(opt ? 'Client et bien pré-remplis : vérifiez le loyer et la durée.'
            : 'Ce client n\'est plus disponible pour un bail.', opt ? '' : 'warn');
  clientPourBail = null;
}

/* --- 4. L'acquéreur d'une vente est un client connu --------------------- */
function enrichirFormulaireVente() {
  const f = document.querySelector('.main form[data-action="g-deal"]');
  if (!f || f.dataset.bc) return;
  const champ = f.querySelector('[name="buyer"]');
  const u = Auth.current();
  if (!champ || !u || !['owner', 'agency'].includes(u.role)) return;
  f.dataset.bc = '1';
  const liste = clientsDuProprietaire(u);
  const bloc = document.createElement('div');
  bloc.className = 'field';
  bloc.innerHTML = `<label>Qui est l'acquéreur ?</label>
    <select class="input" data-action="bc-acquereur">
      <option value="">— Une personne sans compte —</option>
      ${liste.map(c => `<option value="${c.id}">${esc(c.firstName + ' ' + c.lastName)}${c.phone ? ' · ' + esc(c.phone) : ''}</option>`).join('')}
    </select>
    <div class="small muted" style="margin-top:5px">${liste.length
      ? 'Choisissez le client qui a visité le bien : la vente lui sera rattachée.'
      : 'Aucun client ne vous a encore contacté. Saisissez son nom ci-dessous.'}</div>`;
  champ.closest('.field').before(bloc);
}

document.addEventListener('change', e => {
  const sel = e.target.closest('[data-action="bc-acquereur"]');
  if (!sel) return;
  const f = sel.closest('form'), nom = f.querySelector('[name="buyer"]');
  const c = sel.value ? DB.findItem(DB.K.users, sel.value) : null;
  if (c) { nom.value = `${c.firstName || ''} ${c.lastName || ''}`.trim(); nom.readOnly = true; }
  else { nom.readOnly = false; nom.value = ''; }
});

/* --- Pose des quatre greffes après chaque rendu -------------------------- */
new MutationObserver(() => requestAnimationFrame(() => {
  try { poserRelances(); } catch (e) {}
  try { bandeauRetard(); } catch (e) {}
  try { poserBlocBail(); } catch (e) {}
  try { enrichirFormulaireVente(); } catch (e) {}
  try { appliquerPreselection(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
