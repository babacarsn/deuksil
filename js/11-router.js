/* ==========================================================================
   MODULE : router.js
   ========================================================================== */
const routes = [];
const route = (re, fn) => routes.push({re, fn});
/* Un lien peut préciser ce qu'il faut montrer à l'arrivée :
   #/manage/rents?f=retard (filtre), ?q=texte (recherche), ?s=section,
   ?form=titre du formulaire, ?ouvrir=action. Les paramètres sont retirés
   de l'adresse et gardés dans LIEN, le temps que la page les applique. */
let LIEN = null;
function render() {
  if (!DB.pret) return;               // les données ne sont pas encore chargées (voir js/76-demarrage.js)
  const h0 = location.hash || '#/', iq = h0.indexOf('?');
  if (iq >= 0) {
    LIEN = {path: h0.slice(0, iq), p: new URLSearchParams(h0.slice(iq + 1)), at: Date.now()};
    try { history.replaceState(history.state, '', location.href.split('#')[0] + h0.slice(0, iq)); } catch (e) {}
  }
  const path = (location.hash || '#/').replace(/^#/, '').split('?')[0];
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) { const html = r.fn(...m.slice(1)); if (html !== false) { $('#app').innerHTML = html; window.scrollTo(0, 0); afterRender(); } return; }
  }
  $('#app').innerHTML = shellPublic(`<section class="section" style="border:0"><div class="wrap" style="max-width:560px;text-align:center">
    <div style="display:flex;justify-content:center;color:var(--line-strong);margin-bottom:6px">${icon('compass', 84)}</div>
    <h2>Cette adresse n'existe pas</h2>
    <p class="muted">La page demandée n'existe pas ou n'est plus disponible. Elle a peut-être été déplacée, ou l'annonce a été retirée.</p>
    <div class="row" style="justify-content:center;gap:10px;margin-top:10px">
      <a class="btn" href="#/">Retour à l'accueil</a>
      <a class="btn ghost" href="#/search">Rechercher un bien</a>
    </div>
  </div></section>`);
}
window.addEventListener('hashchange', render);
