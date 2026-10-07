/* ==========================================================================
   MODULE : router.js
   ========================================================================== */
const routes = [];
const route = (re, fn) => routes.push({re, fn});
function render() {
  const path = (location.hash || '#/').replace(/^#/, '');
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { const html = r.fn(...m.slice(1)); if (html !== false) { $('#app').innerHTML = html; window.scrollTo(0, 0); afterRender(); } return; }
  }
  $('#app').innerHTML = shellPublic(`<section class="section" style="border:0"><div class="wrap" style="max-width:560px;text-align:center">
    <div style="display:flex;justify-content:center;color:var(--line-strong);margin-bottom:6px">${icon('compass', 84)}</div>
    <h2>Cette adresse n'existe pas</h2>
    <p class="muted">La page demandée n'est pas disponible dans cette démonstration. Elle a peut-être été déplacée ou l'annonce n'existe plus.</p>
    <div class="row" style="justify-content:center;gap:10px;margin-top:10px">
      <a class="btn" href="#/">Retour à l'accueil</a>
      <a class="btn ghost" href="#/search">Rechercher un bien</a>
    </div>
  </div></section>`);
}
window.addEventListener('hashchange', render);
