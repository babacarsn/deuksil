/* ==========================================================================
   MODULE : animations.js — donne du mouvement au site, sans gêner l'usage.
     1. Transition douce à chaque changement de page.
     2. Apparition des blocs au défilement, en cascade (les cartes d'une même
        rangée arrivent l'une après l'autre).
     3. Compteurs qui défilent jusqu'à leur valeur (chiffres de l'accueil,
        montants des tableaux de bord).
     4. Barres des graphiques qui se remplissent.
     5. En-tête qui prend une ombre quand on fait défiler la page.
     6. Onde au clic sur les boutons.
   Les animations ne se rejouent pas quand la même page se redessine (frappe
   dans une recherche, filtre) : seulement quand on change de page.
   Si l'appareil demande moins d'animations (réglage d'accessibilité), tout
   s'affiche directement, sans mouvement.
   ========================================================================== */

const ANIM_CALME = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Ce qui apparaît au défilement. Les éléments d'un carrousel ne sont pas
   dedans : ils sont hors champ horizontalement et resteraient invisibles. */
const ANIM_BLOCS = [
  '.hx-cat', '.hx-sec > .hx-kicker', '.hx-sec > .hx-h2', '.hx-head', '.hx-car', '.hx-une',
  '.hx-step', '.hx-prof', '.hx-stat', '.hx-q', '.hx-act', '.ft-grid > *',
  '.pd-card', '.pd-actions', '.quick-card', '.kpi', '.kpi-rich', '.card', '.prop', '.section-head',
  '.panel', '.tile', '.list-row', 'table.tbl'
].join(',');

let animVu = null;
function animObservateur() {
  if (animVu || !('IntersectionObserver' in window)) return animVu;
  animVu = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target; animVu.unobserve(el);
    el.classList.add('rv-on');
    el.querySelectorAll('[data-compte]').forEach(animCompter);
    if (el.matches('[data-compte]')) animCompter(el);
  }), {rootMargin: '0px 0px -6% 0px', threshold: .08});
  return animVu;
}

/* Compteur : on garde le texte autour du nombre (FCFA, « biens »…) et on ne
   fait défiler que les chiffres. À la fin, le texte d'origine est remis tel
   quel, au caractère près. */
function animCompter(el) {
  if (el.dataset.compte === 'fait') return;
  const orig = el.dataset.compteTxt || el.textContent;
  el.dataset.compte = 'fait';
  const m = orig.match(/\d[\d\s  .]*\d|\d/);
  if (!m) return;
  const cible = parseInt(m[0].replace(/\D/g, ''), 10);
  if (!cible || cible < 4) return;
  const av = orig.slice(0, m.index), ap = orig.slice(m.index + m[0].length);
  const t0 = performance.now(), duree = Math.min(1400, 700 + String(cible).length * 90);
  const pas = t => {
    const k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 3);
    if (k < 1) { el.textContent = av + Math.round(cible * e).toLocaleString('fr-FR') + ap; requestAnimationFrame(pas); }
    else el.textContent = orig;
  };
  requestAnimationFrame(pas);
}

function animPage() {
  const app = document.getElementById('app');
  if (!app || ANIM_CALME()) return;
  app.classList.remove('anim-page'); void app.offsetWidth; app.classList.add('anim-page');
  animBlocs();
}
function animBlocs() {
  const app = document.getElementById('app'), io = animObservateur();
  if (!app || !io || ANIM_CALME()) return;
  app.querySelectorAll('.hx-stat b, .pd-big, .pd-val, .kpi b, .kpi-rich b').forEach(el => {
    if (el.dataset.compte) return; el.dataset.compteTxt = el.textContent; el.dataset.compte = '1';
  });
  const vus = new Map();
  app.querySelectorAll(ANIM_BLOCS).forEach(el => {
    /* Un bloc dans un bloc déjà animé : c'est le parent qui porte le
       mouvement, on ne l'anime pas deux fois. */
    if (el.closest('.hx-car > *, .modal, [data-no-anim]') || el.parentElement.closest('.rv')) return;
    const p = el.parentElement, i = vus.get(p) || 0; vus.set(p, i + 1);
    el.style.setProperty('--rv-i', Math.min(i, 7));
    el.classList.add('rv');
    io.observe(el);
  });
  /* Les chiffres qui ne sont dans aucun bloc animé partent quand ils sont vus. */
  app.querySelectorAll('[data-compte="1"]').forEach(el => { if (!el.closest('.rv')) io.observe(el); });
}

/* On rejoue les animations seulement si l'adresse a changé. */
let animDerniere = null, animT = 0;
(() => {
  const app = document.getElementById('app');
  if (!app) return;
  new MutationObserver(() => {
    const ici = location.hash.split('?')[0];
    /* Une page qui se redessine juste après son arrivée (chargement en deux
       temps) est encore « nouvelle » : ses blocs doivent apparaître aussi. */
    const t = performance.now(), changee = ici !== animDerniere, tot = t - animT < 700;
    animDerniere = ici; if (changee) animT = t;
    if (changee) animPage(); else if (tot) animBlocs();
  }).observe(app, {childList: true});
  if (app.children.length) { animDerniere = location.hash.split('?')[0]; animT = performance.now(); animPage(); }
})();

/* En-tête : une ombre dès qu'on a défilé un peu. */
(() => {
  let att = false;
  const maj = () => { att = false; document.documentElement.classList.toggle('defile', window.scrollY > 8); };
  window.addEventListener('scroll', () => { if (!att) { att = true; requestAnimationFrame(maj); } }, {passive: true});
})();

/* Onde au clic sur les boutons et les actions rapides. */
document.addEventListener('pointerdown', e => {
  if (ANIM_CALME()) return;
  const b = e.target.closest('.btn, .quick-card, .hx-cat, .hx-arrow, .pd-more');
  if (!b || b.disabled) return;
  const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height) * 2;
  const o = document.createElement('span');
  o.className = 'onde';
  o.style.cssText = `width:${d}px;height:${d}px;left:${e.clientX - r.left - d / 2}px;top:${e.clientY - r.top - d / 2}px`;
  b.classList.add('onde-hote'); b.appendChild(o);
  setTimeout(() => o.remove(), 650);
}, true);

/* --------------------------------------------------------------------------
   Bouton flottant « Remonter en haut »
   - Apparaît en glissant quand on a descendu d'environ un écran.
   - Son anneau doré se remplit au fil de la lecture de la page.
   - Au clic, la page glisse jusqu'en haut (accélère puis ralentit) ; une
     molette ou un doigt sur l'écran interrompt le glissement.
   - Seulement sur la page d'accueil publique.
   - Se place au-dessus de l'assistant et de la barre d'onglets du mobile,
     pour ne jamais les recouvrir.
   -------------------------------------------------------------------------- */
let remonterEnCours = 0;
function remonterEnHaut() {
  const y0 = window.scrollY;
  if (!y0) return;
  if (ANIM_CALME()) { window.scrollTo(0, 0); return; }
  const id = ++remonterEnCours, t0 = performance.now();
  const duree = Math.min(1100, Math.max(450, y0 * .35));
  const ease = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
  const html = document.documentElement, avant = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  const pas = t => {
    if (id !== remonterEnCours) { html.style.scrollBehavior = avant; return; }
    const k = Math.min(1, (t - t0) / duree);
    window.scrollTo(0, Math.round(y0 * (1 - ease(k))));
    if (k < 1) requestAnimationFrame(pas);
    else { html.style.scrollBehavior = avant; const b = document.querySelector('.haut'); if (b) b.blur(); }
  };
  requestAnimationFrame(pas);
}
/* L'utilisateur reprend la main : on arrête le glissement. */
['wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, e => {
  if (ev === 'keydown' && !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(e.key)) return;
  remonterEnCours++;
}, {passive: true}));

(() => {
  const C = 2 * Math.PI * 23; /* circonférence de l'anneau (rayon 23) */
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'haut'; b.setAttribute('aria-label', 'Remonter en haut de la page');
  b.title = 'Remonter en haut';
  b.innerHTML = `<svg class="haut-anneau" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23" class="haut-fond"/><circle cx="26" cy="26" r="23" class="haut-prog" style="stroke-dasharray:${C};stroke-dashoffset:${C}"/></svg>
    <svg class="haut-fleche" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  b.addEventListener('click', () => { b.classList.add('part'); setTimeout(() => b.classList.remove('part'), 600); remonterEnHaut(); });
  const prog = () => b.querySelector('.haut-prog');

  /* Hauteur à laisser libre en bas : assistant, barre d'onglets du mobile. */
  const placer = () => {
    let bas = 22;
    /* offsetParent est toujours nul pour un élément fixe : on regarde sa boîte. */
    const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(), c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const tab = document.querySelector('.tabbar'), ai = document.querySelector('.ai-fab');
    if (vis(tab)) bas = Math.max(bas, innerHeight - tab.getBoundingClientRect().top + 14);
    if (vis(ai)) {
      const r = ai.getBoundingClientRect();
      if (r.right > innerWidth - 120) bas = Math.max(bas, innerHeight - r.top + 14);
    }
    b.style.setProperty('--haut-bas', bas + 'px');
  };

  let att = false;
  const maj = () => {
    att = false;
    const max = document.documentElement.scrollHeight - innerHeight, y = window.scrollY;
    /* Seulement sur la page d'accueil publique. */
    const accueil = ['', '#', '#/'].includes(location.hash.split('?')[0]) && !!document.querySelector('#app .hx:not(.hx-in-app)');
    const montre = accueil && y > Math.min(innerHeight * .9, 700) && max > 400;
    if (montre && !b.classList.contains('on')) placer();
    b.classList.toggle('on', montre);
    b.tabIndex = montre ? 0 : -1;
    b.setAttribute('aria-hidden', montre ? 'false' : 'true');
    const p = prog(); if (p) p.style.strokeDashoffset = C * (1 - (max > 0 ? Math.min(1, y / max) : 0));
  };
  const plus = () => { if (!att) { att = true; requestAnimationFrame(maj); } };
  const poser = () => { if (!b.isConnected) document.body.appendChild(b); placer(); plus(); };
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
  window.addEventListener('scroll', plus, {passive: true});
  window.addEventListener('resize', () => { placer(); plus(); });
  window.addEventListener('hashchange', () => { b.classList.remove('on'); setTimeout(() => { placer(); plus(); }, 60); });
})();
