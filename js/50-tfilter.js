/* ==========================================================================
   MODULE : tfilter.js — champ de recherche automatique au-dessus des listes.
   Les écrans d'administration et de portefeuille affichaient des listes sans
   aucun moyen de filtrer. Le tri et la pagination existants exposent déjà la
   convention data-f="1" pour masquer une ligne : on s'y branche au lieu de
   réécrire ces écrans.
   - Écrans de gestion (admin, agence, propriétaire, gestion, agent) : le champ
     apparaît dès qu'une liste a une ligne, pour que l'écran garde le même
     aspect en grandissant. Ailleurs : à partir de 6 lignes, comme avant.
   - Plusieurs listes sur un écran de gestion : un seul champ filtre toutes
     les listes de l'écran (ailleurs on s'abstient, comme avant).
   - La comparaison ignore accents et majuscules et accepte plusieurs mots
     (correspond(), défini dans 79-recherche.js, chargé plus tard).
   - Messages : un champ filtre la liste des conversations (section 2).
   ========================================================================== */
const TF_MIN = 6;
const TF_GESTION = /^#\/(admin|agency|owner|manage|agent|mandant|coffre)(\/|$)/;
const tfMin = () => TF_GESTION.test(location.hash) ? 1 : TF_MIN;
const tfTrouve = (texte, q) => typeof correspond === 'function' ? correspond(texte, q) : String(texte || '').toLowerCase().includes(q.toLowerCase());

/* --- 1. Listes (tableaux) --------------------------------------------------- */
function tfBoite(placeholder, label) {
  const box = document.createElement('div');
  box.className = 'tfilter';
  box.innerHTML = `<span class="tfilter-ic">${icon('search', 16)}</span>
    <input class="input" type="text" inputmode="search" placeholder="${placeholder}" autocomplete="off" aria-label="${label}">
    <span class="tfilter-n small muted"></span>`;
  return box;
}

function tfBrancher(box, tables) {
  box.__tables = tables;
  const input = box.querySelector('input'), nEl = box.querySelector('.tfilter-n');
  const apply = () => {
    const q = input.value.trim();
    let shown = 0, total = 0;
    tables.forEach(t => {
      const tb = t.tBodies[0]; if (!tb) return;
      [...tb.rows].forEach(r => {
        total++;
        const hit = !q || tfTrouve(r.textContent, q);
        r.dataset.f = hit ? '' : '1';
        if (hit) shown++;
      });
      try { t.__pg(); } catch (e) {}
    });
    nEl.textContent = q ? `${shown} / ${total}` : '';
    box.classList.toggle('empty-hit', !!q && !shown);
  };
  input.addEventListener('input', apply);
}

function tfEcran() {
  const c = document.querySelector('.main > .content'); if (!c) return;
  /* L'écran a déjà sa propre recherche : on n'en ajoute pas une seconde. */
  if (c.querySelector('[data-gsearch], .tfilter, .sbar')) return;
  const toutes = [...c.querySelectorAll('.table-wrap table')].filter(t => t.tBodies[0] && t.tBodies[0].rows.length);
  if (!toutes.length) return;
  /* Une table pas encore équipée du tri/pagination : on réessaie juste après. */
  if (toutes.some(t => typeof t.__pg !== 'function')) { clearTimeout(tfEcran.t); tfEcran.t = setTimeout(tfEcran, 120); return; }
  if (toutes.some(t => t.dataset.tf)) return;
  const gestion = TF_GESTION.test(location.hash);
  let tables;
  if (toutes.length === 1) {
    if (toutes[0].tBodies[0].rows.length < tfMin()) return;
    tables = toutes;
  } else {
    /* Plusieurs listes : un seul champ pour toutes, seulement sur les écrans de gestion. */
    if (!gestion) return;
    tables = toutes;
  }
  const premier = tables[0].closest('.table-wrap') || tables[0].parentElement;
  if (!premier || !premier.parentElement) return;
  tables.forEach(t => { t.dataset.tf = '1'; });
  const box = tables.length > 1 ? tfBoite('Rechercher dans cette page…', 'Rechercher dans les listes de la page') : tfBoite('Filtrer cette liste…', 'Filtrer la liste');
  /* Plusieurs listes précédées de leur titre (h3 ou ligne de titre) : le champ se place au-dessus du premier titre. */
  const titre = el => el && (/^H[2-4]$/.test(el.tagName) || (el.classList.contains('row-between') && el.querySelector('h2, h3, h4, b, strong')));
  const ancre = tables.length > 1 && titre(premier.previousElementSibling) ? premier.previousElementSibling : premier;
  ancre.parentElement.insertBefore(box, ancre);
  tfBrancher(box, tables);
}

new MutationObserver(() => requestAnimationFrame(() => { try { tfEcran(); } catch (e) {} }))
  .observe(document.body, {childList: true, subtree: true});

/* --- 2. Messages : rechercher une conversation ------------------------------- */
let tfMsgQ = '', tfMsgEcran = '';
function tfMessages() {
  if (!/\/messages$/.test(location.hash.split('?')[0])) { tfMsgQ = ''; tfMsgEcran = ''; return; }
  if (tfMsgEcran !== location.hash) { tfMsgQ = ''; tfMsgEcran = location.hash; }
  const chat = document.querySelector('.main > .content .chat'); if (!chat) return;
  const fils = [...chat.querySelectorAll('.threads .thread')];
  let box = chat.parentElement.querySelector(':scope > .msg-recherche');
  if (!fils.length) { if (box) box.remove(); return; }
  if (!box) {
    box = document.createElement('div');
    box.className = 'tfilter msg-recherche';
    box.innerHTML = `<span class="tfilter-ic">${icon('search', 16)}</span>
      <input class="input" type="text" inputmode="search" placeholder="Rechercher une conversation…" autocomplete="off" aria-label="Rechercher une conversation">
      <span class="tfilter-n small muted"></span>`;
    chat.before(box);
    const input = box.querySelector('input');
    input.value = tfMsgQ;
    input.addEventListener('input', () => { tfMsgQ = input.value; tfMsgAppliquer(); });
  }
  box.hidden = chat.classList.contains('thread-open') && matchMedia('(max-width: 900px)').matches;
  tfMsgAppliquer();
}
function tfMsgAppliquer() {
  const chat = document.querySelector('.main > .content .chat'); if (!chat) return;
  const threads = chat.querySelector('.threads'); if (!threads) return;
  const fils = [...threads.querySelectorAll('.thread')], q = tfMsgQ.trim();
  let n = 0;
  fils.forEach(f => { const ok = !q || tfTrouve(f.textContent, q); const v = ok ? '' : 'none'; if (f.style.display !== v) f.style.display = v; if (ok) n++; });
  let vide = threads.querySelector(':scope > .msg-aucun');
  if (q && !n) {
    if (!vide) { vide = document.createElement('p'); vide.className = 'msg-aucun small muted'; threads.appendChild(vide); }
    const t = `Aucune conversation pour « ${q} ».`; if (vide.textContent !== t) vide.textContent = t;
  } else if (vide) vide.remove();
  const box = chat.parentElement.querySelector(':scope > .msg-recherche');
  if (box) {
    const nEl = box.querySelector('.tfilter-n'), t = q ? `${n} / ${fils.length}` : '';
    if (nEl.textContent !== t) nEl.textContent = t;
    box.classList.toggle('empty-hit', !!q && !n);
  }
}
new MutationObserver(() => requestAnimationFrame(() => { try { tfMessages(); } catch (e) {} }))
  .observe(document.body, {childList: true, subtree: true});
