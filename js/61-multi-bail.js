/* ==========================================================================
   MODULE : multi-bail.js — les conséquences, côté écrans, du fait qu'une
   personne puisse louer plusieurs logements (voir baux.js).
   Trois choses à régler : l'espace du locataire doit montrer tous ses
   logements et non le premier ; les écrans du propriétaire doivent retrouver
   la bonne personne derrière un bail ; et on ne doit pas pouvoir louer deux
   fois le même logement à la même personne.
   ========================================================================== */

/* --- 1. Le locataire consulte le logement qu'il a choisi ----------------- */
/* Tout l'espace locataire lit `u.leaseId`. Plutôt que de réécrire chacun de
   ces écrans, on fait pointer `leaseId` sur le bail sélectionné : le reste
   suit tout seul. */
const _authCurrent = Auth.current.bind(Auth);
Auth.current = function () {
  const u = _authCurrent();
  if (u && u.role === 'tenant') {
    const b = bailCourant(u);
    if (b) u.leaseId = b.id;
  }
  return u;
};

/* --- 2. Retrouver la personne derrière un bail -------------------------- */
tenantOf = l => locataireDuBail(l);

/* --- 3. Le sélecteur de logement, dans l'espace locataire --------------- */
function selecteurLogement() {
  const u = Auth.current();
  if (!u || u.role !== 'tenant') return;
  if (!/^#\/(tenant|coffre)/.test(location.hash)) return;
  const tous = bauxDe(u);
  if (tous.length < 2) return;
  const c = document.querySelector('.main > .content');
  if (!c || c.querySelector('.choix-logement')) return;

  const courant = bailCourant(u);
  const d = document.createElement('div');
  d.className = 'card choix-logement';
  d.innerHTML = `<div class="row-between" style="gap:12px;flex-wrap:wrap;align-items:center">
    <div style="min-width:0">
      <b class="small">Vous louez ${tous.filter(b => b.status === 'actif').length} logements</b>
      <div class="small muted">Choisissez celui que vous consultez : loyers, quittances et signalements suivent.</div>
    </div>
    <select class="input" data-action="choix-bail" style="max-width:280px">
      ${tous.map(b => {
        const p = gProp(b.propertyId) || {};
        const fin = b.status === 'actif' ? '' : ' · bail terminé';
        return `<option value="${b.id}"${b.id === (courant || {}).id ? ' selected' : ''}>${
          esc(p.title || 'Logement')}${b.unitRef ? ' · ' + esc(b.unitRef) : ''} · ${money(b.rent)}${fin}</option>`;
      }).join('')}
    </select>
  </div>`;
  const tete = c.querySelector('.page-head, .space-hero, .dash-hero');
  if (tete && tete.nextSibling) tete.parentNode.insertBefore(d, tete.nextSibling);
  else c.prepend(d);
}

document.addEventListener('change', e => {
  const s = e.target.closest('[data-action="choix-bail"]');
  if (!s) return;
  try { localStorage.setItem(CLE_BAIL_ACTIF, s.value); } catch (err) {}
  const b = DB.findItem(DB.K.leases, s.value), p = b && gProp(b.propertyId);
  toast(p ? `Vous consultez ${p.title}.` : 'Logement changé.');
  render();
});

/* --- 4. Deux fois le même logement à la même personne, c'est une erreur -- */
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="g-lease"]');
  if (!f) return;
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  const bien = (f.querySelector('[name="propertyId"]') || {}).value;
  const sel = f.querySelector('[data-action="bc-choisir"]');
  const tel = telCle((f.querySelector('[name="phone"]') || {}).value);
  const nom = String((f.querySelector('[name="tenant"]') || {}).value || '').trim().toLowerCase();
  if (!bien) return;
  const qui = sel && sel.value ? DB.findItem(DB.K.users, sel.value)
    : DB.findItem(DB.K.users, x => ['client', 'tenant'].includes(x.role)
        && ((tel && telCle(x.phone) === tel) || (nom && nomCle(x) === nom)));
  if (!qui) return;
  const deja = bauxActifs(qui).find(b => b.propertyId === bien
    && (!b.unitId || b.unitId === (f.querySelector('[name="unitId"]') || {}).value));
  if (deja) {
    e.preventDefault(); e.stopImmediatePropagation();
    toast(`${qui.firstName} loue déjà ce logement. Choisissez-en un autre.`, 'bad');
  }
}, true);

/* Et on le dit avant de cliquer, pas après. */
document.addEventListener('change', e => {
  const f = e.target.closest('form[data-action="g-lease"]');
  if (!f) return;
  const aide = f.querySelector('[data-bc-aide]');
  const sel = f.querySelector('[data-action="bc-choisir"]');
  if (!aide || !sel || !sel.value) return;
  const qui = DB.findItem(DB.K.users, sel.value);
  const bien = (f.querySelector('[name="propertyId"]') || {}).value;
  if (!qui || !bien) return;
  const collision = bauxActifs(qui).some(b => b.propertyId === bien);
  aide.classList.toggle('bc-conflit', collision);
  if (collision) {
    aide.textContent = `${qui.firstName} loue déjà ce logement. Choisissez-en un autre `
      + `— un même logement ne se loue pas deux fois à la même personne.`;
  } else {
    const r = resumeBaux(qui);
    aide.textContent = r
      ? `${qui.firstName} ${r}. Ce bail s'ajoutera aux siens : un seul compte, plusieurs logements.`
      : `${qui.firstName} n'a pas encore de logement chez vous. Un accès lui sera créé.`;
  }
});

/* --- 5. L'écran « Équipe » ne propose plus un bail déjà pourvu ---------- */
function nettoyerChoixBail() {
  const s = document.querySelector('form[data-action="g4-tenant"] select[name="leaseId"]');
  if (!s || s.dataset.mb) return;
  s.dataset.mb = '1';
  [...s.options].forEach(o => {
    if (o.value && locataireDuBail(o.value)) o.remove();
  });
  if (!s.options.length) {
    s.innerHTML = '<option value="">Tous vos baux ont déjà un accès</option>';
  }
}

/* --- 6. Reprise des comptes existants ----------------------------------- */
/* Les comptes créés avant cette version n'ont pas de `leaseIds`. On les
   complète une fois, sans rien écraser. */
const MB_FLAG = 'deuksil_multibail_v1';
function reprendreComptes() {
  try {
    if (localStorage.getItem(MB_FLAG)) return;
    DB.filterItems(DB.K.users, u => u.leaseId && !Array.isArray(u.leaseIds))
      .forEach(u => DB.updateItem(DB.K.users, u.id, {leaseIds: [u.leaseId]}));
    localStorage.setItem(MB_FLAG, '1');
  } catch (e) {}
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { reprendreComptes(); } catch (e) {}
  try { selecteurLogement(); } catch (e) {}
  try { nettoyerChoixBail(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
setTimeout(reprendreComptes, 1200);
