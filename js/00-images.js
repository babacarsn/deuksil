/* ==========================================================================
   MODULE : images.js — chemins des visuels et helpers de base.
   Les logos et les photos de démonstration sont des fichiers de img/ : le
   navigateur ne les télécharge qu'au moment de les afficher, au lieu de
   charger 1,8 Mo de base64 avant le premier écran.
   ========================================================================== */
const LOGO_LIGHT = 'img/logo-d-blanc.svg';   /* D blanc, pour les fonds bleu nuit */
const LOGO_DARK = 'img/logo-d-bleu.svg';     /* D bleu nuit, pour les fonds clairs */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = p => p + '_' + Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 6);
const now = () => new Date().toISOString();
const money = n => Number(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ') + ' FCFA';
const dateFr = d => d ? new Date(d).toLocaleDateString('fr-FR', {day:'2-digit', month:'short', year:'numeric'}) : '—';
const dateTimeFr = d => d ? new Date(d).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '—';
const daysBetween = (a, b) => Math.ceil((new Date(b) - new Date(a)) / 86400000);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x.toISOString(); };
const hash = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const initials = u => ((u.firstName || u.agencyName || '?')[0] + (u.lastName || u.firstName || '?')[0]).toUpperCase();
const avatarColor = id => `hsl(${hash(id) % 360} 45% 38%)`;
const telHref = phone => 'tel:' + String(phone || '').replace(/[^\d+]/g, '');
function avatarHtml(u, size = 36) {
  if (u && u.avatarPhoto) return `<img src="${u.avatarPhoto}" alt="" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * .3)}px;object-fit:cover;flex:none">`;
  return `<div class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.max(.6, size * .026)}rem;background:${avatarColor((u && u.id) || 'x')}">${initials(u || {})}</div>`;
}

/* Visuels de biens : illustrations SVG générées, déterministes par identifiant.
   Aucune image externe n'est chargée : la scène est dessinée selon le type de bien. */
const SCENE_PALETTES = [
  {name:'jour',   sky:['#8FBDDC','#DDEBF2'], sun:'#FFF6DC', far:'#5F86A3', ground:'#CFC7AC', road:'#BDB49A', wall:'#F4EFE4', wall2:'#DCD3C2', roof:'#8C5A3C', trim:'#2F4A44', glass:'#9FC6D8', palm:'#2E5B46', palmDark:'#1E3F31'},
  {name:'dorée',  sky:['#F2B473','#FCE7CB'], sun:'#FFF1CC', far:'#B07B54', ground:'#D8BE95', road:'#C7A97F', wall:'#FBF3E6', wall2:'#E6D6BE', roof:'#9C4F32', trim:'#3B3026', glass:'#E0B98A', palm:'#3B5C3E', palmDark:'#27402B'},
  {name:'soir',   sky:['#48628A','#E8A379'], sun:'#FFE3B4', far:'#334A6B', ground:'#A79079', road:'#8E7A66', wall:'#EADFCF', wall2:'#C6B7A3', roof:'#6E3A2C', trim:'#222B33', glass:'#FFD98A', palm:'#25433A', palmDark:'#182D27'},
  {name:'matin',  sky:['#AECFD6','#EFF5F1'], sun:'#FFFBEA', far:'#7E9EA0', ground:'#C8CCB5', road:'#B6BBA4', wall:'#FFFFFF', wall2:'#E3E7E0', roof:'#4F6B63', trim:'#30433D', glass:'#B9D6DC', palm:'#356B4E', palmDark:'#224834'}
];
function palmTree(x, y, sc, pal) {
  const fronds = [[-1, -.35], [-1, .25], [1, -.35], [1, .25], [0, -1]]
    .map(([dx, dy]) => `<path d="M0 0 C ${22 * dx} ${-14 + 22 * dy}, ${44 * dx} ${-6 + 26 * dy}, ${54 * dx} ${10 + 30 * dy} C ${40 * dx} ${-2 + 22 * dy}, ${20 * dx} ${2 + 14 * dy}, 0 6 Z" fill="${pal.palm}"/>`).join('');
  return `<g transform="translate(${x},${y}) scale(${sc})">
    <path d="M0 0 C -4 -28, 2 -52, 10 -74 L2 -76 C -8 -52, -12 -28, -8 0 Z" fill="${pal.palmDark}"/>
    <g transform="translate(6,-76)">${fronds}<circle r="4" fill="${pal.palmDark}"/></g></g>`;
}
function windowGrid(x, y, cols, rows, w, h, gapX, gapY, pal, seed) {
  let out = '';
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const lit = (hash(seed + c * 7 + r * 13) % 10) > 5;
    out += `<rect x="${x + c * (w + gapX)}" y="${y + r * (h + gapY)}" width="${w}" height="${h}" rx="1.5" fill="${lit ? pal.glass : pal.trim}" opacity="${lit ? .95 : .55}"/>`;
  }
  return out;
}
function structure(p, pal) {
  const h = hash(p.id), t = p.transaction === 'terrain' ? 'terrain' : p.type;
  if (t === 'terrain') return `
    <g>${palmTree(72, 250, 1, pal)}${palmTree(342, 254, .8, pal)}
      <path d="M62 250 L146 202 H272 L352 250 Z" fill="${pal.ground}" opacity=".55" stroke="${pal.wall}" stroke-opacity=".7" stroke-width="2"/>
      <path d="M146 202 L62 250 M272 202 L352 250" stroke="${pal.wall}" stroke-opacity=".5" stroke-width="2"/>
      ${[70, 118, 168, 218, 268, 318].map((x, i) => `<rect x="${x}" y="${222 - (i % 2) * 6}" width="5" height="26" rx="2.5" fill="${pal.wall2}"/>`).join('')}
      ${[92, 156, 238, 302].map((x, i) => `<path d="M${x} 250 q -5 -12 -1 -20 M${x} 250 q 3 -14 8 -19 M${x} 250 q 8 -9 14 -11" stroke="${pal.palm}" stroke-width="2" fill="none" opacity=".8"/>`).join('')}
      <g transform="translate(200,150)">
        <rect x="-52" y="0" width="104" height="42" rx="5" fill="${pal.wall}" stroke="${pal.trim}" stroke-opacity=".25"/>
        <rect x="-38" y="12" width="76" height="5" rx="2.5" fill="${pal.trim}" opacity=".45"/>
        <rect x="-38" y="24" width="46" height="5" rx="2.5" fill="${pal.trim}" opacity=".28"/>
        <rect x="-14" y="42" width="5" height="46" fill="${pal.wall2}"/><rect x="9" y="42" width="5" height="46" fill="${pal.wall2}"/>
      </g></g>`;
  if (t === 'appartement' || t === 'bureau') return `
    <g>${palmTree(70, 246, .95, pal)}
      <rect x="240" y="150" width="86" height="96" fill="${pal.wall2}"/>
      ${windowGrid(252, 164, 3, 4, 16, 14, 10, 10, pal, h + 3)}
      <rect x="118" y="78" width="126" height="168" fill="${pal.wall}"/>
      <rect x="118" y="78" width="126" height="10" fill="${pal.roof}" opacity=".85"/>
      ${windowGrid(132, 100, 4, 5, 18, 16, 9, 12, pal, h)}
      <rect x="160" y="216" width="40" height="30" rx="2" fill="${pal.trim}" opacity=".8"/>
      ${palmTree(348, 250, 1.1, pal)}</g>`;
  if (t === 'local commercial') return `
    <g><rect x="90" y="140" width="220" height="106" fill="${pal.wall}"/>
      <rect x="90" y="140" width="220" height="16" fill="${pal.roof}"/>
      <path d="M86 172 H314 L300 200 H100 Z" fill="${pal.roof}" opacity=".9"/>
      ${[0, 1, 2, 3, 4, 5, 6].map(i => `<path d="M${90 + i * 32} 172 L${78 + i * 32} 200 H${94 + i * 32} L${106 + i * 32} 172 Z" fill="${pal.wall}" opacity=".55"/>`).join('')}
      <rect x="112" y="206" width="76" height="40" fill="${pal.glass}" opacity=".9"/>
      <rect x="212" y="206" width="40" height="40" fill="${pal.trim}" opacity=".85"/>
      ${palmTree(346, 250, .9, pal)}</g>`;
  if (t === 'studio' || t === 'chambre') return `
    <g>${palmTree(84, 244, .8, pal)}
      <rect x="130" y="166" width="150" height="80" fill="${pal.wall}"/>
      <path d="M118 166 L205 122 L292 166 Z" fill="${pal.roof}"/>
      <rect x="150" y="188" width="42" height="34" rx="2" fill="${pal.glass}"/>
      <rect x="220" y="196" width="30" height="50" rx="2" fill="${pal.trim}" opacity=".85"/>
      ${palmTree(330, 248, 1, pal)}</g>`;
  const pool = p.type === 'villa' ? `<ellipse cx="300" cy="248" rx="58" ry="17" fill="${pal.glass}" opacity=".85"/>
      <ellipse cx="300" cy="245" rx="44" ry="10" fill="#fff" opacity=".18"/>` : '';
  return `
    <g>${palmTree(72, 250, 1, pal)}
      <rect x="112" y="158" width="176" height="88" fill="${pal.wall}"/>
      <rect x="112" y="158" width="176" height="6" fill="${pal.wall2}"/>
      <path d="M98 158 L200 106 L302 158 Z" fill="${pal.roof}"/>
      <path d="M200 106 L302 158 H200 Z" fill="${pal.roof}" opacity=".78"/>
      <rect x="186" y="200" width="30" height="46" rx="2" fill="${pal.trim}" opacity=".88"/>
      <rect x="132" y="180" width="38" height="30" rx="2" fill="${pal.glass}"/>
      <rect x="236" y="180" width="38" height="30" rx="2" fill="${pal.glass}"/>
      ${pool}</g>`;
}
function sceneSvg(p) {
  const h = hash(p.id), pal = SCENE_PALETTES[h % SCENE_PALETTES.length];
  const gid = 'sky' + h.toString(36);
  const skyline = [30, 74, 118, 168, 214, 262, 310, 356]
    .map((x, i) => `<rect x="${x}" y="${132 + (hash(h + i) % 28)}" width="${20 + (hash(h + i * 3) % 18)}" height="86" fill="${pal.far}" opacity=".14"/>`).join('');
  return `<svg class="scene" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Illustration du bien">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="1" stop-color="${pal.sky[1]}"/></linearGradient>
      <linearGradient id="${gid}g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${pal.ground}"/><stop offset="1" stop-color="${pal.road}"/></linearGradient>
      <radialGradient id="${gid}h"><stop offset="0" stop-color="${pal.sun}" stop-opacity=".75"/><stop offset="1" stop-color="${pal.sun}" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="300" fill="url(#${gid})"/>
    <circle cx="${68 + h % 240}" cy="${52 + h % 26}" r="58" fill="url(#${gid}h)"/>
    <circle cx="${68 + h % 240}" cy="${52 + h % 26}" r="15" fill="${pal.sun}"/>
    ${skyline}
    <rect y="212" width="400" height="88" fill="url(#${gid}g)"/>
    <path d="M0 212 C 90 204, 150 220, 240 212 C 310 206, 360 216, 400 210 L400 224 L0 224 Z" fill="${pal.ground}" opacity=".7"/>
    ${structure(p, pal)}
    <ellipse cx="200" cy="254" rx="142" ry="13" fill="${pal.trim}" opacity=".10"/>
    <g fill="${pal.palm}" opacity=".28">
      <ellipse cx="${34 + h % 20}" cy="298" rx="34" ry="13"/><ellipse cx="${370 - h % 24}" cy="300" rx="38" ry="14"/>
      <ellipse cx="${140 + h % 70}" cy="304" rx="28" ry="11" opacity=".7"/></g>
    <rect y="262" width="400" height="38" fill="${pal.road}" opacity=".35"/>
  </svg>`;
}
/* Photothèque de démonstration (JPEG encodés) */
const PHOTOS = {"cover": "img/photos/cover.jpg", "villa1": "img/photos/villa1.jpg", "villa2": "img/photos/villa2.jpg", "villa3": "img/photos/villa3.jpg", "villa4": "img/photos/villa4.jpg", "maison1": "img/photos/maison1.jpg", "maison2": "img/photos/maison2.jpg", "maison3": "img/photos/maison3.jpg", "terrain": "img/photos/terrain.jpg", "local1": "img/photos/local1.jpg", "local2": "img/photos/local2.jpg", "bureau": "img/photos/bureau.jpg"};
Object.assign(PHOTOS, {"bnClient": "img/photos/bnClient.jpg", "bnOwner": "img/photos/bnOwner.jpg", "bnAgency": "img/photos/bnAgency.jpg", "bnPromo": "img/photos/bnPromo.jpg"});
