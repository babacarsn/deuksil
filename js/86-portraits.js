/* ==========================================================================
   MODULE : portraits.js — photo de profil par défaut des comptes.
   Tant qu'un utilisateur n'a pas ajouté sa propre photo, son compte affiche
   un portrait illustré (et non plus ses initiales) : une personne noire,
   homme ou femme selon le prénom, avec teint, coiffure, tenue et fond qui
   varient d'un compte à l'autre mais restent toujours les mêmes pour un
   compte donné. Les portraits sont dessinés ici (SVG), aucun visage réel
   n'est utilisé. Une photo ajoutée par l'utilisateur reste prioritaire.
   ========================================================================== */

const PRENOMS_FEMININS = new Set(('awa fatou aminata seynabou nafissatou aissatou mariama khadija astou ndeye coumba rokhaya aida aicha ' +
  'khady adja bineta dieynaba mareme ramatoulaye yacine nafi oumy fatoumata penda maimouna anta dior codou sophie marie kine ngone fama aby ' +
  'mame sokhna fanta binta diarra hawa kadiatou salimata ndella rama sira soda absa arame daba mbene ndiaye_f nogaye selly thioro yaye').split(/\s+/));
const sansAccents = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function estFemme(u) {
  if (u && (u.sexe || u.genre)) return /^f/i.test(u.sexe || u.genre);
  const p = sansAccents((u && (u.firstName || u.name)) || '').split(/[\s-]+/)[0];
  return PRENOMS_FEMININS.has(p) || /^(ndeye|mame|sokhna|adja|yaye)/.test(p);
}

const PT = {
  peaux: [['#8D5A3B', '#74452B'], ['#6E4127', '#58321D'], ['#5B3520', '#472817'], ['#7B4A2D', '#633920'], ['#4B2C1B', '#3A2114'], ['#9A6644', '#7F5134']],
  fonds: ['#E7ECF3', '#F2E6D2', '#DCE5F0', '#EADBC2', '#E3E8EF', '#F5EBDC'],
  tenues: ['#0C2745', '#1F4673', '#D0A361', '#F4F1EA', '#7A2E3A', '#2F6B57', '#B5651D', '#3B3F8C'],
  pagnes: ['#0C2745', '#B03A2E', '#1F7A5C', '#7A2E3A', '#2B4C9B', '#5B2C6F'],
  cheveux: '#1B1210'
};
const ptHash = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

function portraitSvg(u) {
  const id = (u && (u.id || u.email || u.firstName)) || 'x', h = ptHash(id), f = estFemme(u);
  const pick = (arr, k) => arr[(h >>> k) % arr.length];
  const [peau, ombre] = pick(PT.peaux, 1), fond = pick(PT.fonds, 4), tenue = pick(PT.tenues, 7), pagne = pick(PT.pagnes, 10);
  const style = (h >>> 13) % (f ? 5 : 4), lunettes = (h >>> 17) % 6 === 0, C = PT.cheveux;
  const clair = ['#F4F1EA', '#D0A361'].includes(tenue);
  let derriere = '', dessus = '', barbe = '', bijoux = '', col = '';

  if (f) {
    if (style === 0) { /* afro */
      derriere = `<circle cx="32" cy="24" r="17" fill="${C}"/><circle cx="20" cy="30" r="8" fill="${C}"/><circle cx="44" cy="30" r="8" fill="${C}"/>`;
      dessus = `<path d="M21 26c0-9 5-13 11-13s11 4 11 13c-3-5-7-7-11-7s-8 2-11 7z" fill="${C}"/>`;
    } else if (style === 1) { /* tresses */
      derriere = `<path d="M18 26c0-10 6-15 14-15s14 5 14 15v22h-6V30H24v18h-6z" fill="${C}"/>` +
        [20, 23, 41, 44].map(x => `<path d="M${x} 30v20" stroke="#2B1D18" stroke-width="1" opacity=".55"/>`).join('');
      dessus = `<path d="M21 27c0-9 5-14 11-14s11 5 11 14c-2-6-6-9-11-9s-9 3-11 9z" fill="${C}"/><path d="M26 15l-2 9M32 13v9M38 15l2 9" stroke="#2B1D18" stroke-width=".9" opacity=".6"/>`;
    } else if (style === 2) { /* foulard (moussor) */
      dessus = `<path d="M19 27c-1-11 5-17 13-17s15 6 13 17c-3-4-8-6-13-6s-10 2-13 6z" fill="${pagne}"/>` +
        `<path d="M22 13c4-6 16-6 20 0-2 5-6 6-10 6s-8-1-10-6z" fill="${pagne}"/><path d="M38 9c4-1 8 1 9 4-3 1-6 0-9-4z" fill="${pagne}"/>` +
        `<path d="M21 22c6-3 16-3 22 0M23 16c5-2 13-2 18 0" stroke="#fff" stroke-width="1.1" opacity=".45" fill="none"/>`;
    } else if (style === 3) { /* voile */
      derriere = `<path d="M17 30c0-12 7-19 15-19s15 7 15 19v12c0 4-4 7-8 8H25c-4-1-8-4-8-8z" fill="${pagne}"/>`;
      dessus = `<path d="M20 26c1-8 6-12 12-12s11 4 12 12c-3-4-7-6-12-6s-9 2-12 6z" fill="${pagne}"/>`;
      col = `<path d="M20 44c3 4 7 6 12 6s9-2 12-6l2 8H18z" fill="${pagne}" opacity=".95"/>`;
    } else { /* chignon */
      derriere = `<circle cx="32" cy="11" r="6.5" fill="${C}"/>`;
      dessus = `<path d="M21 27c0-9 5-14 11-14s11 5 11 14c-1-5-5-9-11-9s-10 4-11 9z" fill="${C}"/>`;
    }
    if (style !== 3) bijoux = `<circle cx="21.3" cy="33.5" r="1.4" fill="#D0A361"/><circle cx="42.7" cy="33.5" r="1.4" fill="#D0A361"/>`;
  } else {
    if (style === 0) dessus = `<path d="M21.2 26c-.3-8 4.6-12.5 10.8-12.5S43.1 18 42.8 26c-2.4-4.3-6.2-6-10.8-6s-8.4 1.7-10.8 6z" fill="${C}"/>`;
    else if (style === 1) dessus = `<path d="M20.5 26c-.8-9.5 4.8-14.5 11.5-14.5S44.3 16.5 43.5 26c-1.5-4.8-6-7.5-11.5-7.5S22 21.2 20.5 26z" fill="${C}"/>`;
    else if (style === 2) dessus = `<path d="M22.5 22c2-5 5.5-7 9.5-7s7.5 2 9.5 7c-3-2-6-2.8-9.5-2.8s-6.5.8-9.5 2.8z" fill="${C}" opacity=".85"/>`; /* rasé */
    else { /* calotte */
      dessus = `<path d="M21 22c1-6 5.5-9 11-9s10 3 11 9c-3-1.6-7-2.4-11-2.4S24 20.4 21 22z" fill="${pagne}"/><path d="M21 22c3-1.6 7-2.4 11-2.4s8 .8 11 2.4" stroke="#fff" stroke-width=".8" opacity=".5" fill="none"/>`;
    }
    if ((h >>> 20) % 3 !== 0) barbe = `<path d="M22.5 31c.5 7 4.3 11 9.5 11s9-4 9.5-11c-1.5 3-3.6 4.2-5.2 4.2-1.4-1.4-2.6-1.9-4.3-1.9s-2.9.5-4.3 1.9c-1.6 0-3.7-1.2-5.2-4.2z" fill="${C}" opacity=".92"/>`;
  }

  const yeux = `<ellipse cx="27.6" cy="29.2" rx="1.35" ry="1.5" fill="#140C08"/><ellipse cx="36.4" cy="29.2" rx="1.35" ry="1.5" fill="#140C08"/>` +
    `<circle cx="28" cy="28.7" r=".4" fill="#fff"/><circle cx="36.8" cy="28.7" r=".4" fill="#fff"/>`;
  const sourcils = `<path d="M25.4 26.4c1.4-.9 3-.9 4.3-.2M34.3 26.2c1.3-.7 2.9-.7 4.3.2" stroke="#140C08" stroke-width="${f ? .9 : 1.25}" stroke-linecap="round" fill="none"/>`;
  const nez = `<path d="M30.6 33.4c.8.6 2 .6 2.8 0" stroke="${ombre}" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;
  const bouche = f ? `<path d="M28.6 36.6c2 1.8 4.8 1.8 6.8 0-1.2.4-2.2.5-3.4.5s-2.2-.1-3.4-.5z" fill="#5A2219"/><path d="M28.6 36.6c1.2-.6 2.2-.8 3.4-.5 1.2-.3 2.2-.1 3.4.5" stroke="#5A2219" stroke-width=".8" fill="none"/>`
    : `<path d="M29 36.6c1.9 1.3 4.1 1.3 6 0" stroke="#3B1A12" stroke-width="1.2" stroke-linecap="round" fill="none"/>`;
  const verres = lunettes ? `<g fill="none" stroke="#111" stroke-width=".9"><rect x="24.2" y="26.9" width="6.8" height="5" rx="1.8"/><rect x="33" y="26.9" width="6.8" height="5" rx="1.8"/><path d="M31 28.8h2"/></g>` : '';
  const encolure = clair ? '#0C2745' : '#FFFFFF';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="11 8 42 42">
    <rect width="64" height="64" fill="${fond}"/><circle cx="54" cy="10" r="16" fill="#fff" opacity=".35"/>
    ${derriere}
    <path d="M7 64c1-11 9-17 19-19h12c10 2 18 8 19 19z" fill="${tenue}"/>
    <path d="M26.5 45h11l-5.5 7z" fill="${encolure}" opacity="${clair ? .25 : .9}"/>
    <path d="M27 37h10v9c-1.5 2-3.2 3-5 3s-3.5-1-5-3z" fill="${ombre}"/>
    ${col}
    <ellipse cx="21.6" cy="30" rx="2.1" ry="3" fill="${ombre}"/><ellipse cx="42.4" cy="30" rx="2.1" ry="3" fill="${ombre}"/>
    <path d="M21.5 27c0-8 4.6-13 10.5-13s10.5 5 10.5 13c0 8.6-4.8 15-10.5 15S21.5 35.6 21.5 27z" fill="${peau}"/>
    ${barbe}${dessus}${sourcils}${yeux}${verres}${nez}${bouche}${bijoux}
  </svg>`.replace(/\s{2,}/g, ' ');
}

const _portraits = new Map();
function portraitUrl(u) {
  const k = ((u && (u.id || u.email)) || '') + '|' + ((u && u.firstName) || '') + '|' + ((u && (u.sexe || u.genre)) || '');
  if (!_portraits.has(k)) _portraits.set(k, 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(portraitSvg(u)));
  return _portraits.get(k);
}

/* La photo de l'utilisateur d'abord ; sinon son portrait. */
avatarHtml = function (u, size = 36) {
  const src = (u && u.avatarPhoto) || portraitUrl(u || {});
  return `<img class="avatar-img" src="${src}" alt="" width="${size}" height="${size}" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .3)}px;object-fit:cover;flex:none">`;
};

/* Sur téléphone, le texte d'aide de la recherche d'accueil est raccourci
   pour tenir en entier dans la barre. */
(() => {
  const app = document.getElementById('app'); if (!app) return;
  const court = () => {
    const i = app.querySelector('.hx-search input[name="q"]'); if (!i) return;
    i.placeholder = innerWidth < 600 ? 'Ville, quartier, type de bien…' : 'Rechercher une ville, un quartier, un bien…';
  };
  new MutationObserver(court).observe(app, {childList: true}); court();
  window.addEventListener('resize', court);
})();
