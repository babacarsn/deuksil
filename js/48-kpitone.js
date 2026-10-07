/* ==========================================================================
   MODULE : kpitone.js — teinte automatique des bulles de KPI
   Les KPI des écrans de liste portent leur couleur en style inline
   (color:var(--ok) / var(--bad)…). On en déduit la teinte du dégradé
   pour qu'ils aient le même rendu que ceux de l'accueil.
   ========================================================================== */
function toneKpis() {
  document.querySelectorAll('.kpi:not([data-tone])').forEach(k => {
    const n = k.querySelector('.n');
    const src = (n ? (n.getAttribute('style') || '') + ' ' + n.className : '') + ' ' + k.className;
    const tone = /--bad|\bbad\b|danger/.test(src) ? 'bad'
      : /--ok|\bok\b|success/.test(src) ? 'ok'
      : /--gold|--yellow|\bwarn\b/.test(src) ? 'gold'
      : /--info|\binfo\b/.test(src) ? 'info'
      : 'brand';
    k.dataset.tone = tone;
  });
}
new MutationObserver(() => requestAnimationFrame(() => { try { toneKpis(); } catch (e) {} }))
  .observe(document.body, {childList: true, subtree: true});
toneKpis();
