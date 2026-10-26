/* ==========================================================================
   MODULE : assistance.js — trois frictions relevées à l'usage.
   1. « 1 loyer en retard » menait à la liste complète des loyers : il fallait
      retrouver la ligne à la main. L'écran Loyers reçoit un filtre, et le
      raccourci arrive déjà filtré.
   2. Le formulaire de bail demandait de ressaisir un loyer déjà inscrit sur
      la fiche du bien, et la liste des locataires possibles était étroite.
   3. La publication d'une annonce est devenue immédiate (voir build.py) :
      les écrans qui parlaient encore de validation sont mis à jour.
   ========================================================================== */

/* --- 1. Filtrer les loyers --------------------------------------------- */
const RFILTRES = [
  ['tous',    'Tous',        () => true],
  ['retard',  'En retard',   t => t === 'bad'],
  ['attente', 'À venir',     t => t === 'info' || t === 'warn'],   // « warn » : acompte reçu, pas encore en retard
  ['paye',    'Encaissés',   t => t === 'ok'],
];
let rFiltre = 'tous';

/* Le ton du badge d'état porte déjà l'information : « bad » = en retard,
   « ok » = payé, « info » = à venir. On s'y branche plutôt que de recalculer. */
function tonLigne(tr) {
  const b = tr.querySelector('.badge');
  if (!b) return '';
  if (b.classList.contains('bad')) return 'bad';
  if (b.classList.contains('ok')) return 'ok';
  if (b.classList.contains('info')) return 'info';
  if (b.classList.contains('warn')) return 'warn';
  return '';
}

function appliquerFiltreLoyers() {
  const t = document.querySelector('.main > .content .table-wrap table');
  if (!t || !t.tBodies[0]) return;
  const test = (RFILTRES.find(f => f[0] === rFiltre) || RFILTRES[0])[2];
  let n = 0;
  [...t.tBodies[0].rows].forEach(tr => {
    const ok = test(tonLigne(tr));
    tr.dataset.f = ok ? '' : '1';
    tr.style.display = ok ? '' : 'none';
    if (ok) n++;
  });
  try { if (typeof t.__pg === 'function') t.__pg(); } catch (e) {}
  const c = document.querySelector('.rfiltre-n');
  if (c) c.textContent = rFiltre === 'tous' ? '' : `${n} ligne${n > 1 ? 's' : ''}`;
  if (rFiltre !== 'tous' && !n) {
    const w = t.closest('.table-wrap');
    if (w && !w.querySelector('.rfiltre-vide')) {
      const d = document.createElement('p');
      d.className = 'small muted rfiltre-vide';
      d.style.padding = '14px 2px';
      d.textContent = 'Rien dans cette catégorie.';
      w.appendChild(d);
    }
  } else {
    const v = document.querySelector('.rfiltre-vide');
    if (v) v.remove();
  }
}

function barreFiltreLoyers() {
  if (!/^#\/manage\/rents/.test(location.hash)) { rFiltre = 'tous'; return; }
  const c = document.querySelector('.main > .content');
  if (!c || c.querySelector('.rfiltre')) { appliquerFiltreLoyers(); return; }
  const kpis = c.querySelector('.kpis');
  if (!kpis) return;
  const d = document.createElement('div');
  d.className = 'rfiltre';
  d.innerHTML = RFILTRES.map(([k, lab]) =>
    `<button type="button" class="rchip${k === rFiltre ? ' on' : ''}" data-action="rfiltre" data-id="${k}">${lab}</button>`
  ).join('') + '<span class="rfiltre-n small muted"></span>';
  kpis.after(d);
  appliquerFiltreLoyers();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="rfiltre"]');
  if (!b) return;
  e.preventDefault();
  rFiltre = b.dataset.id;
  document.querySelectorAll('.rchip').forEach(x => x.classList.toggle('on', x.dataset.id === rFiltre));
  appliquerFiltreLoyers();
});

/* Le raccourci « n loyers en retard » du tableau de bord arrive filtré. */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href="#/manage/rents"]');
  if (!a) return;
  const txt = (a.textContent || '').toLowerCase();
  if (/en retard|impay/.test(txt)) rFiltre = 'retard';
}, true);

/* --- 2. Le formulaire de bail se remplit tout seul ---------------------- */
/* Le loyer et la caution sont déjà connus : ils figurent sur la fiche du
   bien. Les redemander, c'est inviter à la faute de frappe. */
function valeursParDefautBail(f, force) {
  const sel = f.querySelector('[name="propertyId"]');
  const loyer = f.querySelector('[name="rent"]');
  const caution = f.querySelector('[name="deposit"]');
  if (!sel || !loyer) return;
  const p = gProp(sel.value);
  if (!p) return;
  const prix = +p.price || 0;
  if (!prix) return;
  /* On n'écrase pas une saisie : seulement un champ vide, ou le montant
     repris du bien précédemment choisi. */
  if (force || !loyer.value || loyer.dataset.auto === loyer.value) {
    loyer.value = prix;
    loyer.dataset.auto = String(prix);
  }
  if (caution && (force || !+caution.value || caution.dataset.auto === caution.value)) {
    caution.value = prix * 2;
    caution.dataset.auto = String(prix * 2);
  }
  const aide = f.querySelector('[data-rent-aide]');
  const note = `Repris de la fiche du bien (${money(prix)} par mois). Modifiable.`;
  if (aide) { if (aide.textContent !== note) aide.textContent = note; }
  else {
    const n = document.createElement('div');
    n.className = 'small muted';
    n.style.marginTop = '5px';
    n.setAttribute('data-rent-aide', '');
    n.textContent = note;
    loyer.after(n);
  }
}

document.addEventListener('change', e => {
  const sel = e.target.closest('form[data-action="g-lease"] [name="propertyId"]');
  if (!sel) return;
  valeursParDefautBail(sel.closest('form'), true);
});

/* --- 4. Les écrans ne parlent plus de validation préalable -------------- */
function motsPublication() {
  const c = document.querySelector('.main > .content');
  if (!c || c.dataset.pub) return;
  const h = location.hash;
  if (!/^#\/(owner|agency)\/properties/.test(h)) return;
  c.dataset.pub = '1';
  const p = c.querySelector('.page-head p, .page-head .small');
  if (p && /valid/i.test(p.textContent)) {
    p.textContent = 'Publiez, mettez en pause ou archivez vos annonces. La mise en ligne est immédiate.';
  }
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { barreFiltreLoyers(); } catch (e) {}
  try {
    const f = document.querySelector('.main form[data-action="g-lease"]');
    if (f) valeursParDefautBail(f, false);
  } catch (e) {}
  try { motsPublication(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* --- 5. Une annonce neuve se voit ------------------------------------- */
/* Les recommandations étaient classées par nombre de vues. Une annonce
   publiée à l'instant en a zéro : elle arrivait donc dernière et sortait
   de la sélection. On fait passer devant ce qui vient d'être mis en ligne,
   puis on classe le reste par intérêt, catégorie par catégorie. */
const JOURS_NEUF = 10;
const estNeuve = p => {
  const d = p.publishedAt || p.updatedAt || p.createdAt;
  return d ? daysBetween(d, now()) <= JOURS_NEUF : false;
};

mixed = function (pubs, n = 8) {
  const par = {location: [], vente: [], terrain: []};
  [...pubs].sort((a, b) => {
    const na = estNeuve(a), nb = estNeuve(b);
    if (na !== nb) return na ? -1 : 1;
    if (na && nb) return (b.createdAt || '') < (a.createdAt || '') ? -1 : 1;
    return (b.views || 0) - (a.views || 0);
  }).forEach(p => (par[p.transaction] || par.vente).push(p));
  const out = [];
  for (let i = 0; out.length < n && i < 8; i++) {
    ['location', 'vente', 'terrain'].forEach(k => {
      if (par[k][i] && out.length < n) out.push(par[k][i]);
    });
  }
  return out;
};

/* Publier, c'est le moment où l'annonce entre en ligne : on le date, pour
   que « neuve » veuille dire quelque chose même sur un bien ancien. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="publish"]');
  if (!b || !b.dataset.id) return;
  setTimeout(() => {
    try {
      const p = DB.findItem(DB.K.properties, b.dataset.id);
      if (p && p.listingStatus === 'publiee') {
        DB.updateItem(DB.K.properties, p.id, {publishedAt: now()});
      }
    } catch (err) {}
  }, 60);
}, true);

/* --- 6. Une fenêtre ne survit pas à un changement d'écran -------------- */
/* Ouvrir « Nouvelle facture » puis passer aux Contrats laissait la fenêtre
   par-dessus le nouvel écran : on croyait l'application figée. */
addEventListener('hashchange', () => {
  try { if (document.querySelector('.modal-back')) closeModal(); } catch (e) {}
});
