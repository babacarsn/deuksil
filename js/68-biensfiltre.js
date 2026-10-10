/* ==========================================================================
   MODULE : biensfiltre.js — séparer la location de la vente dans « Mes biens ».
   Un propriétaire qui en a vingt cherchait son terrain à vendre au milieu de
   ses appartements loués. Trois boutons suffisent, avec le compte de chaque
   catégorie : on voit du premier coup d'œil ce qu'on possède et de quoi.
   ========================================================================== */

const BF_CATS = [
  ['tous', 'Tous', () => true],
  ['location', 'Location', p => p.transaction === 'location'],
  ['vente', 'Vente', p => ['vente', 'terrain'].includes(p.transaction)]
];
let bfChoix = 'tous';

const bfTable = () => document.querySelector('.main > .content .table-wrap table');
const bfBien = tr => {
  const e = tr.querySelector('[data-action="owner-bulk-toggle"][data-id]')
    || tr.querySelector('[data-id]');
  return e ? gProp(e.dataset.id) : null;
};

function bfAppliquer() {
  const t = bfTable();
  if (!t || !t.tBodies[0]) return;
  const test = (BF_CATS.find(c => c[0] === bfChoix) || BF_CATS[0])[2];
  /* La recherche de l'écran écrit sur la même ligne que nous. Plutôt que de
     se partager le verdict — et de l'écraser à tour de rôle —, on lit son
     champ et on applique les deux conditions nous-mêmes. */
  const champ = document.querySelector('.main > .content .tfilter input, .main > .content [data-gsearch]');
  const q = (champ ? champ.value : '').trim().toLowerCase();
  let n = 0;
  [...t.tBodies[0].rows].forEach(tr => {
    const p = bfBien(tr);
    const ok = (!p || test(p)) && (!q || (tr.textContent || '').toLowerCase().includes(q));
    tr.dataset.f = ok ? '' : '1';
    tr.style.display = ok ? '' : 'none';
    if (ok) n++;
  });
  try { if (typeof t.__pg === 'function') t.__pg(); } catch (e) {}
  const c = document.querySelector('.bf-n');
  if (c) c.textContent = `${n} bien${n > 1 ? 's' : ''}`;
}

function bfBarre() {
  if (!/^#\/(owner|agency)\/properties/.test(location.hash)) { bfChoix = 'tous'; return; }
  const c = document.querySelector('.main > .content');
  if (!c) return;
  if (c.querySelector('.rfiltre.bf')) { bfAppliquer(); return; }
  const t = bfTable();
  if (!t || !t.tBodies[0] || !t.tBodies[0].rows.length) return;
  const biens = [...t.tBodies[0].rows].map(bfBien).filter(Boolean);
  const n = cle => biens.filter((BF_CATS.find(x => x[0] === cle) || BF_CATS[0])[2]).length;

  const d = document.createElement('div');
  d.className = 'rfiltre bf';
  d.innerHTML = BF_CATS.map(([k, lab]) =>
    `<button type="button" class="rchip${k === bfChoix ? ' on' : ''}" data-action="bf" data-id="${k}">${
      lab}<span class="bf-c">${n(k)}</span></button>`).join('')
    + '<span class="bf-n small muted"></span>';
  const tete = c.querySelector('.page-head');
  if (tete) tete.after(d); else c.prepend(d);
  bfAppliquer();
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="bf"]');
  if (!b) return;
  e.preventDefault();
  bfChoix = b.dataset.id;
  document.querySelectorAll('.bf .rchip').forEach(x => x.classList.toggle('on', x.dataset.id === bfChoix));
  bfAppliquer();
});

document.addEventListener('input', e => {
  if (!e.target.closest('.tfilter input, [data-gsearch]')) return;
  if (!/^\#\/(owner|agency)\/properties/.test(location.hash)) return;
  requestAnimationFrame(bfAppliquer);
});

new MutationObserver(() => requestAnimationFrame(() => {
  try { bfBarre(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
