/* ==========================================================================
   99q-aide.js — bouton « Aide » dans chaque menu, et chargement à la demande.

   Ce fichier est le seul toujours chargé (≈ 2 Ko) : il ajoute « Aide » à la fin
   du menu de chaque espace (ordinateur et téléphone) et dans l'en-tête public.
   La page elle-même (js/aide-page.js), sa feuille de style (css/06-aide.css) et
   les vignettes ne sont téléchargées qu'à la première visite de #/aide ; une
   vidéo, seulement quand on ouvre son tutoriel.

   Les adresses versionnées des deux fichiers sont dans <template id="aide-fichiers">
   d'index.html (mises à jour par outils/versionner-site.js ; un <template> ne
   charge rien).
   ========================================================================== */

ICONS.aide = '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17.2h.01"/>';

/* --- Bouton « Aide » à la fin de chaque menu ----------------------------------- */
(() => {
  const ENTREE = ['#/aide', 'Aide', 'aide'];
  const ajouter = m => Array.isArray(m) && !m.some(x => x[0] === '#/aide') ? m.concat([ENTREE]) : m;
  Object.keys(MENUS_RAW).forEach(k => {
    const d = Object.getOwnPropertyDescriptor(MENUS_RAW, k); if (!d) return;
    if (d.get) Object.defineProperty(MENUS_RAW, k, {configurable: true, enumerable: true, set: d.set, get() { return ajouter(d.get.call(MENUS_RAW)); }});
    else { let v = d.value; Object.defineProperty(MENUS_RAW, k, {configurable: true, enumerable: true, get() { return ajouter(v); }, set(x) { v = x; }}); }
  });
})();
/* Site public : « Aide » dans l'en-tête. */
shellPublic = (function (prec) {
  return function (...a) { const h = prec.apply(this, a); return h.includes('href="#/aide"') ? h : h.replace('</nav>', '<a href="#/aide">Aide</a></nav>'); };
})(shellPublic);


/* --- Chargement de la page à la demande ------------------------------------- */
let aideChargement = null;
function chargerAide() {
  if (window.rendreAide) return Promise.resolve();
  if (aideChargement) return aideChargement;
  const t = document.getElementById('aide-fichiers'), c = t && t.content;
  const sc = c && c.querySelector('script'), li = c && c.querySelector('link');
  const js = sc ? sc.getAttribute('src') : 'js/aide-page.js', css = li ? li.getAttribute('href') : 'css/06-aide.css';
  aideChargement = new Promise((ok, ko) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = css; document.head.appendChild(l);
    const s = document.createElement('script'); s.src = js; s.onload = ok; s.onerror = () => { aideChargement = null; ko(new Error('aide')); };
    document.body.appendChild(s);
  });
  return aideChargement;
}
route(/^\/aide(?:\?.*)?$/, () => {
  if (window.rendreAide) return window.rendreAide();
  chargerAide().then(() => { if (/^#\/aide/.test(location.hash)) render(); },
    () => toast('L\'aide ne s\'est pas chargée : vérifiez la connexion puis réessayez.', 'bad'));
  const u = Auth.current(), h = page('Aide', 'Chargement des tutoriels…') + '<div class="empty"><p class="small muted">Un instant…</p></div>';
  return u ? shellApp(u, h) : shellPublic(`<section class="wrap" style="padding:34px 0 60px">${h}</section>`);
});
/* Lien direct vers un tutoriel (#/aide?video=publier) : la page se charge et l'ouvre. */
const lienDirectAide = () => { if (/^#\/aide\?video=/.test(location.hash)) chargerAide().catch(() => {}); };
addEventListener('hashchange', lienDirectAide); lienDirectAide();
