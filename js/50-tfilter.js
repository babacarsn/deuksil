/* ==========================================================================
   MODULE : tfilter.js — champ de recherche automatique au-dessus des listes
   longues. Les écrans d'administration et de portefeuille affichaient
   jusqu'à vingt lignes sans aucun moyen de filtrer. Le tri et la pagination
   existants exposent déjà la convention data-f="1" pour masquer une ligne :
   on s'y branche au lieu de réécrire ces écrans.
   ========================================================================== */
const TF_MIN = 6;

function tfAdd(t) {
  if (t.dataset.tf || typeof t.__pg !== 'function') return;
  const tb = t.tBodies[0]; if (!tb || tb.rows.length < TF_MIN) return;
  const wrap = t.closest('.table-wrap') || t.parentElement; if (!wrap || !wrap.parentElement) return;
  /* L'écran a déjà sa propre recherche : on n'en ajoute pas une seconde. */
  if (document.querySelector('.main > .content [data-gsearch], .main > .content .tfilter')) return;
  /* Plusieurs listes sur le même écran : un champ unique ne filtrerait que
     l'une d'elles, ce qui induirait en erreur. On s'abstient. */
  if (document.querySelectorAll('.main > .content .table-wrap table').length > 1) return;
  t.dataset.tf = '1';

  const box = document.createElement('div');
  box.className = 'tfilter';
  box.innerHTML = `<span class="tfilter-ic">${icon('search', 16)}</span>
    <input class="input" type="text" inputmode="search" placeholder="Filtrer cette liste…" autocomplete="off" aria-label="Filtrer la liste">
    <span class="tfilter-n small muted"></span>`;
  wrap.parentElement.insertBefore(box, wrap);

  const input = box.querySelector('input'), nEl = box.querySelector('.tfilter-n');
  const total = tb.rows.length;
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    [...tb.rows].forEach(r => {
      const hit = !q || (r.textContent || '').toLowerCase().includes(q);
      r.dataset.f = hit ? '' : '1';
      if (hit) shown++;
    });
    nEl.textContent = q ? `${shown} / ${total}` : '';
    box.classList.toggle('empty-hit', !!q && !shown);
    try { t.__pg(); } catch (e) {}
  };
  input.addEventListener('input', apply);
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { document.querySelectorAll('.main > .content .table-wrap table[data-enh="1"]:not([data-tf])').forEach(tfAdd); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
