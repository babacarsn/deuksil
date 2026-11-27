/* =========================================================================
   Retest du 27 novembre 2026 : corrections des défauts majeurs restants.

     1. Administration : messages de contact et signalements « à 0 ».
        Les données sont relues à chaque ouverture de l'écran, les
        signalements envoyés sans compte (enregistrés comme messages
        « abus ») apparaissent aussi dans « Signalements », et quand la base
        ne reconnaît pas le compte comme administrateur, l'écran dit pourquoi
        au lieu d'afficher un 0 muet (fonction public.diagnostic_admin,
        migration 20261127000100).

   Les contrôles d'accès réels restent ceux de la base (RLS).
   ========================================================================= */

/* --- 1. Administration ------------------------------------------------------ */
const ADMIN_LISTES = {'#/admin/contacts': ['contacts'], '#/admin/signalements': ['reports', 'contacts']};
let adminDiag = null, adminDiagLe = 0, adminRelu = '';

/* La raison, en clair, pour laquelle la base ne montre rien à cet administrateur. */
function raisonAdmin(d) {
  if (!d) return '';
  if (d.absente) return 'La mise à jour de la base du 27 novembre (fichier supabase/migrations/20261127000100_recette_27nov.sql) n\'est pas encore installée : la base peut cacher les messages à l\'administrateur sans le dire. Demandez à la personne qui gère Supabase de l\'appliquer.';
  if (d.est_admin) return '';
  if (d.role !== 'admin') return `Votre profil a le rôle « ${esc(d.role || 'inconnu')} » dans la base, pas « admin ».`;
  if (d.statut !== 'actif') return `Votre compte est « ${esc(d.statut || 'inconnu')} » dans la base : il doit être « actif ».`;
  if (d.mfa_exigee && d.aal !== 'aal2') return 'La double authentification est exigée pour les administrateurs (réglage admin_mfa_obligatoire = oui) et votre session ne l\'a pas : connectez-vous avec la double authentification, ou repassez ce réglage à « non ».';
  return 'La base ne vous reconnaît pas comme administrateur.';
}
async function diagnostiquerAdmin() {
  if (adminDiag && Date.now() - adminDiagLe < 60000) return adminDiag;
  try {
    const {data, error} = await SB.rpc('diagnostic_admin');
    adminDiag = error ? (/diagnostic_admin|PGRST202|Could not find the function/i.test(String(error.message || '') + (error.code || '')) ? {absente: true} : null) : data;
  } catch (e) { adminDiag = null; }
  adminDiagLe = Date.now();
  return adminDiag;
}
function bandeauAdmin() {
  const u = Auth.current(), h = location.hash.split('?')[0];
  if (!u || u.role !== 'admin' || !/^#\/admin\//.test(h) || typeof SB === 'undefined' || !SB) return;
  diagnostiquerAdmin().then(d => {
    const texte = raisonAdmin(d), c = document.querySelector('.main > .content'); if (!c) return;
    const vieux = c.querySelector('.adm-diag');
    /* « Mise à jour non installée » : seulement là où elle explique un écran vide. */
    if (!texte || (d.absente && !ADMIN_LISTES[h])) { if (vieux) vieux.remove(); return; }
    if (vieux) return;
    const b = document.createElement('div'); b.className = 'adm-diag'; b.setAttribute('role', 'alert');
    b.innerHTML = `<span class="adm-diag-ic">${icon('alert', 18)}</span><div><b>La base ne vous montre peut-être pas tout</b><p>${texte}</p></div>`;
    c.prepend(b);
  });
  /* Données fraîches à chaque ouverture des écrans de messages et de signalements. */
  const cles = ADMIN_LISTES[h];
  if (cles && adminRelu !== h) {
    adminRelu = h;
    Promise.all(cles.map(k => DB.relire(DB.K[k]))).then(() => { if (location.hash.split('?')[0] === h) render(); });
  }
  if (!cles) adminRelu = '';
}
window.addEventListener('hashchange', () => { adminRelu = ''; });

/* Signalements envoyés sans compte : enregistrés comme messages « abus », affichés ici aussi. */
function signalementsVisiteurs() {
  if (location.hash.split('?')[0] !== '#/admin/signalements') return;
  const c = document.querySelector('.main > .content'); if (!c || c.querySelector('.adm-visiteurs')) return;
  const L = DB.getData(DB.K.contacts).filter(m => m.subject === 'abus').sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!L.length) return;
  const nouveaux = L.filter(m => m.statut !== 'traite').length;
  const s = document.createElement('section'); s.className = 'adm-visiteurs';
  s.innerHTML = `<h3>Signalements envoyés sans compte <span class="badge ${nouveaux ? 'bad' : 'ok'}">${nouveaux} à traiter</span></h3>
    <p class="small muted">Envoyés depuis une annonce par un visiteur non connecté. Ils figurent aussi dans « Messages de contact ».</p>` +
    gTable(['Reçu le', 'Expéditeur', 'Signalement', 'État', ''], L.map(m => `<tr><td class="small">${dateTimeFr(m.createdAt)}</td>
      <td class="small"><a class="lien-contact" href="mailto:${esc(m.email)}">${esc(m.email)}</a></td>
      <td class="small" style="max-width:460px;white-space:pre-wrap">${esc(m.message)}</td>
      <td>${badge(m.statut === 'traite' ? 'Traité' : 'À traiter', m.statut === 'traite' ? 'ok' : 'warn')}</td>
      <td>${m.statut === 'traite' ? '' : `<button class="btn ghost sm" data-action="contact-traite" data-id="${m.id}">Marquer traité</button>`}</td></tr>`));
  c.appendChild(s);
}

const _afterRenderRetest = afterRender;
afterRender = function () {
  const r = _afterRenderRetest.apply(this, arguments);
  try { bandeauAdmin(); } catch (e) { console.warn('[DEUKSIL] admin', e); }
  try { signalementsVisiteurs(); } catch (e) { console.warn('[DEUKSIL] signalements', e); }
  return r;
};

/* --- 4. Fiche d'un bien : carte du quartier et bouton « Partager » -----------------
   La carte est faite de tuiles OpenStreetMap (des images : la politique de sécurité du
   site interdit les cartes intégrées en cadre). Les biens n'ont pas de coordonnées :
   la carte montre la ZONE du quartier (ou de la ville), jamais l'adresse exacte. */
if (typeof ICONS === 'object') {
  ICONS.share = ICONS.share || '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>';
  ICONS.mail = ICONS.mail || '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>';
  ICONS.globe = ICONS.globe || '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>';
}
const COORD_QUARTIERS = {
  'Almadies': [14.7453, -17.5150], 'Mermoz': [14.7090, -17.4740], 'Sacré-Cœur': [14.7210, -17.4660], 'Mermoz-Sacré-Cœur': [14.7150, -17.4700],
  'Ouakam': [14.7240, -17.4900], 'Yoff': [14.7600, -17.4700], 'Plateau': [14.6700, -17.4320], 'Point E': [14.6960, -17.4600], 'Ngor': [14.7500, -17.5130],
  'Parcelles Assainies': [14.7600, -17.4400], 'Fann': [14.6880, -17.4660], 'Médina': [14.6850, -17.4480], 'Liberté 6': [14.7250, -17.4560],
  'HLM': [14.7070, -17.4450], 'Grand Yoff': [14.7330, -17.4500], 'Ouest Foire': [14.7470, -17.4740], 'Mamelles': [14.7300, -17.5030],
  'Sicap Baobab': [14.7090, -17.4590], 'Hann': [14.7200, -17.4300], 'Grand Dakar': [14.7030, -17.4490], 'Sicap Liberté': [14.7170, -17.4580]
};
const COORD_VILLES = {
  'Dakar': [14.6928, -17.4467], 'Pikine': [14.7550, -17.3900], 'Guédiawaye': [14.7770, -17.3950], 'Rufisque': [14.7160, -17.2730], 'Keur Massar': [14.7800, -17.3100],
  'Touba': [14.8500, -15.8833], 'Diourbel': [14.6550, -16.2310], 'Bambey': [14.7000, -16.4500], 'Mbacké': [14.7900, -15.9080],
  'Fatick': [14.3390, -16.4110], 'Foundiougne': [14.1330, -16.4670], 'Gossas': [14.4950, -16.0660],
  'Kaffrine': [14.1060, -15.5500], 'Birkelane': [14.1300, -15.7400], 'Koungheul': [13.9800, -14.8000], 'Malem-Hodar': [14.0900, -15.3000],
  'Kaolack': [14.1520, -16.0726], 'Nioro du Rip': [13.7500, -15.8000], 'Guinguinéo': [14.2700, -15.9500],
  'Kédougou': [12.5560, -12.1740], 'Saraya': [12.8400, -11.7500], 'Salémata': [12.6300, -12.8200],
  'Kolda': [12.8940, -14.9410], 'Vélingara': [13.1500, -14.1100], 'Médina Yoro Foulah': [13.2900, -14.7200],
  'Louga': [15.6190, -16.2240], 'Linguère': [15.3950, -15.1190], 'Kébémer': [15.3700, -16.4500],
  'Matam': [15.6560, -13.2550], 'Kanel': [15.4900, -13.1800], 'Ranérou-Ferlo': [15.3000, -13.9600],
  'Saint-Louis': [16.0326, -16.4818], 'Dagana': [16.5170, -15.5000], 'Podor': [16.6500, -14.9600],
  'Sédhiou': [12.7080, -15.5570], 'Bounkiling': [12.9500, -15.7000], 'Goudomp': [12.5800, -15.8700],
  'Tambacounda': [13.7700, -13.6670], 'Bakel': [14.9000, -12.4600], 'Goudiry': [14.1800, -12.7200], 'Koumpentoum': [13.9800, -14.5500],
  'Thiès': [14.7910, -16.9256], 'Mbour': [14.4200, -16.9640], 'Tivaouane': [14.9500, -16.8200],
  'Ziguinchor': [12.5833, -16.2719], 'Bignona': [12.8100, -16.2300], 'Oussouye': [12.4850, -16.5470]
};
const sansAccentsCarte = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
function zoneDuBien(p) {
  const cherche = (table, v) => { const k = Object.keys(table).find(x => sansAccentsCarte(x) === sansAccentsCarte(v)); return k ? table[k] : null; };
  const q = cherche(COORD_QUARTIERS, p.quartier) || cherche(COORD_QUARTIERS, p.commune);
  if (q) return {lat: q[0], lng: q[1], z: 15, nom: p.quartier || p.commune};
  const v = cherche(COORD_VILLES, p.city) || cherche(COORD_VILLES, p.commune) || cherche(COORD_VILLES, p.region);
  return v ? {lat: v[0], lng: v[1], z: 13, nom: p.city || p.region} : null;
}
function carteDuBien(p) {
  const zn = zoneDuBien(p); if (!zn) return '';
  const n = 2 ** zn.z, xt = (zn.lng + 180) / 360 * n, la = zn.lat * Math.PI / 180;
  const yt = (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2 * n;
  const x0 = Math.floor(xt) - 2, y0 = Math.floor(yt) - 1, px = Math.round((xt - x0) * 256), py = Math.round((yt - y0) * 256);
  let tuiles = '';
  for (let j = 0; j < 3; j++) for (let i = 0; i < 5; i++)
    tuiles += `<img src="https://tile.openstreetmap.org/${zn.z}/${x0 + i}/${y0 + j}.png" alt="" loading="lazy" decoding="async" style="left:${i * 256}px;top:${j * 256}px" referrerpolicy="strict-origin-when-cross-origin">`;
  const lieu = [...new Set([p.quartier, p.city, p.region].filter(Boolean))].join(', ');
  const q = encodeURIComponent(`${lieu}, Sénégal`);
  return `<div class="card fb-carte"><div class="row-between" style="gap:10px;flex-wrap:wrap"><h3 style="margin:0">Emplacement</h3>
      <span class="small muted">${esc(lieu)}</span></div>
    <div class="fb-plan" role="img" aria-label="Carte du quartier ${esc(zn.nom)}">
      <div class="fb-tuiles" style="left:calc(50% - ${px}px);top:calc(50% - ${py}px)">${tuiles}</div>
      <span class="fb-zone" aria-hidden="true"></span>
      <a class="fb-osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>
    </div>
    <p class="small muted" style="margin:10px 0 0">Zone approximative du ${zn.z === 15 ? 'quartier' : 'secteur'} : l'adresse exacte est communiquée par l'annonceur au moment de la visite.</p>
    <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
      <a class="btn ghost sm" href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">${icon('pin', 14)} Ouvrir dans Google Maps</a>
      <a class="btn ghost sm" href="https://www.openstreetmap.org/?mlat=${zn.lat}&mlon=${zn.lng}#map=${zn.z}/${zn.lat}/${zn.lng}" target="_blank" rel="noopener">${icon('pin', 14)} OpenStreetMap</a></div></div>`;
}

/* Partager : la feuille de partage du téléphone quand elle existe, sinon un choix clair. */
function lienPublicDuBien(p) {
  const base = /^https?:/.test(location.origin) ? location.origin + location.pathname : DEUKSIL_CONFIG.siteUrl + '/';
  return base + (typeof annonceHref === 'function' ? annonceHref(p) : '#/property/' + p.id);
}
function partagerBien(p) {
  const lien = lienPublicDuBien(p), titre = `${p.title} — ${money(p.price)}${p.transaction === 'location' ? ' / mois' : ''}`;
  const texte = `${titre} sur DEUKSIL`;
  if (navigator.share) { navigator.share({title: titre, text: texte, url: lien}).catch(() => {}); return; }
  const enc = encodeURIComponent;
  modal('Partager cette annonce', `<p class="small muted" style="margin:0 0 14px">${esc(titre)}</p>
    <div class="fb-partage-grille">
      <a class="fb-p" href="https://wa.me/?text=${enc(texte + ' : ' + lien)}" target="_blank" rel="noopener">${icon('message', 18)}<span>WhatsApp</span></a>
      <a class="fb-p" href="https://www.facebook.com/sharer/sharer.php?u=${enc(lien)}" target="_blank" rel="noopener">${icon('globe' in ICONS ? 'globe' : 'share' in ICONS ? 'share' : 'message', 18)}<span>Facebook</span></a>
      <a class="fb-p" href="mailto:?subject=${enc(titre)}&body=${enc(texte + ' : ' + lien)}">${icon('mail' in ICONS ? 'mail' : 'message', 18)}<span>E-mail</span></a>
      <a class="fb-p" href="sms:?&body=${enc(texte + ' : ' + lien)}">${icon('phone' in ICONS ? 'phone' : 'message', 18)}<span>SMS</span></a>
    </div>
    <div class="field" style="margin-top:14px"><label>Lien de l'annonce</label><div class="row" style="gap:8px;flex-wrap:nowrap">
      <input class="input" value="${esc(lien)}" readonly onfocus="this.select()"><button type="button" class="btn sm" data-cf-copier="${esc(lien)}">Copier</button></div></div>`);
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-fb-partager]'); if (!b) return;
  e.preventDefault(); const p = DB.findItem(DB.K.properties, b.dataset.fbPartager); if (p) partagerBien(p);
});

function ficheRetest() {
  const id = typeof idBienDeLaPage === 'function' ? idBienDeLaPage() : null; if (!id) return;
  const g = document.querySelector('#detail-grid'); if (!g) return;
  const p = DB.findItem(DB.K.properties, id); if (!p) return;
  /* Carte sous la description. */
  const gauche = g.querySelector('.stack');
  if (gauche && !g.querySelector('.fb-carte')) { const h = carteDuBien(p); if (h) gauche.insertAdjacentHTML('beforeend', h); }
  /* Un vrai bouton « Partager » dans la carte des actions, et en tête du bloc de partage. */
  const actions = [...g.querySelectorAll('.card .stack')].find(s => s.querySelector('[data-action="toggle-fav"], [data-action="ask-visit"], [data-action="contact"], .cf-mienne'))
    || g.querySelector('.card .cf-mienne');
  if (actions && !g.querySelector('.fb-btn-partager')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="btn ghost fb-btn-partager" data-fb-partager="${p.id}">${icon('share' in ICONS ? 'share' : 'arrowRight', 16)} Partager</button>`);
  const bloc = g.querySelector('.cf-partage .row');
  if (bloc && !bloc.querySelector('[data-fb-partager]')) bloc.insertAdjacentHTML('afterbegin', `<button type="button" class="btn sm" data-fb-partager="${p.id}">${icon('share' in ICONS ? 'share' : 'arrowRight', 14)} Partager</button>`);
}
new MutationObserver(() => { try { ficheRetest(); } catch (e) { console.warn('[DEUKSIL] fiche', e); } })
  .observe(document.getElementById('app') || document.body, {childList: true, subtree: true});

/* --- 7. Baux terminés : pas de faux « loyer non reçu », pas de caution jamais reçue « à restituer » --- */
/* État d'un loyer : un loyer jamais dû (bail terminé avant son échéance, aucun versement) n'est
   ni « en retard » ni « à venir ». La règle d'échéance est echeanceLoyer / loyerDu (99r-simple). */
rentState = (function (prec) {
  return function (r) {
    if (r && !r.paidAt && typeof loyerDu === 'function' && !loyerDu(r)) return ['Non dû · bail terminé', 'info'];
    return prec.apply(this, arguments);
  };
})(rentState);

/* Fin de bail : en plus des mois suivants, l'échéance du dernier mois n'est retirée que si elle
   tombe le jour du départ ou après, et qu'aucun versement n'a été reçu (un impayé reste une dette). */
terminerBail = (function (prec) {
  return function (l, fin) {
    const r = prec.apply(this, arguments);
    try {
      const f = String(fin || ymd()).slice(0, 10), bail = DB.findItem(DB.K.leases, l.id) || {...l, status: 'termine', endedAt: f};
      DB.filterItems(DB.K.rents, x => x.leaseId === l.id && !x.paidAt && rPaid(x) === 0 && echeanceLoyer(x, bail) >= f)
        .forEach(x => DB.deleteItem(DB.K.rents, x.id));
    } catch (e) { console.warn('[DEUKSIL] fin de bail', e); }
    return r;
  };
})(terminerBail);

/* Caution : « détenue » seulement si elle a été reçue. Un bail sans suivi de caution (créé avant
   ce suivi) est considéré comme payé s'il a déjà reçu un loyer ; sinon la caution est « attendue ».
   Un bail terminé sans caution reçue n'affiche donc plus « caution à restituer ». */
cautionDe = (function (prec) {
  return function (u, l) {
    const c = prec(u, l);
    if (l && !l.cautionStatut && +l.deposit > 0 && !l.cautionRecue) {
      const unLoyerPaye = DB.getData(DB.K.rents).some(r => r.leaseId === l.id && (r.paidAt || rPaid(r) > 0));
      if (!unLoyerPaye) c.statut = 'attendue';
    }
    return c;
  };
})(cautionDe);
/* Nouveau bail d'un propriétaire (comme pour une agence) : caution « attendue » jusqu'à sa réception. */
DB.addItem = (function (prec) {
  return function (k, item) {
    const x = prec.apply(DB, arguments);
    try {
      if (k === DB.K.leases && x && +x.deposit > 0 && !x.cautionStatut && !x.cautionRecue) {
        const owner = DB.findItem(DB.K.users, x.ownerId);
        if (owner && owner.role !== 'agency') DB.updateItem(DB.K.leases, x.id, {cautionChez: x.cautionChez || 'bailleur', cautionStatut: 'attendue'});
      }
    } catch (e) { console.warn('[DEUKSIL] caution', e); }
    return x;
  };
})(DB.addItem);

/* --- Accueil : Louer / Acheter avant de chercher (VIS-02) ---------------------------- */
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-sp-mode]'); if (!b) return;
  e.preventDefault();
  searchState = {...searchState, transaction: b.dataset.spMode, page: 1};
  b.parentElement.querySelectorAll('[data-sp-mode]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
});

/* --- Mes alertes : modifier une alerte (CLI-17) --------------------------------------- */
function formulaireAlerte(a) {
  const c = a.criteria || {}, opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur || '') === v ? 'selected' : ''}>${esc(l)}</option>`;
  const villes = c.region ? Object.keys(LOCATIONS[c.region] || {}) : [], quartiers = c.region && c.city ? (LOCATIONS[c.region] || {})[c.city] || [] : [];
  return `<form data-alerte-form="${a.id}" novalidate>
    <div class="field"><label>Nom de l'alerte <span class="req">*</span></label><input class="input" name="name" maxlength="120" value="${esc(a.name || '')}" required></div>
    <div class="field"><label>Je souhaite</label><select class="input" name="transaction">${opt('', 'Louer ou acheter', c.transaction)}${opt('location', 'Louer', c.transaction)}${opt('vente', 'Acheter', c.transaction)}</select></div>
    <div class="field"><label>Type de bien</label><select class="input" name="type">${opt('', 'Tous', c.type)}${PROPERTY_TYPES.map(t => opt(t, t[0].toUpperCase() + t.slice(1), c.type)).join('')}</select></div>
    <div class="form-grid">
      <div class="field"><label>Région</label><select class="input" name="region" data-alerte-region>${opt('', 'Toutes', c.region)}${Object.keys(LOCATIONS).map(r => opt(r, r, c.region)).join('')}</select></div>
      <div class="field"><label>Ville</label><select class="input" name="city" data-alerte-ville>${opt('', 'Toutes', c.city)}${villes.map(v => opt(v, v, c.city)).join('')}</select></div>
      <div class="field"><label>Quartier</label><select class="input" name="quartier">${opt('', 'Tous', c.quartier)}${quartiers.map(q => opt(q, q, c.quartier)).join('')}</select></div>
      <div class="field"><label>Chambres (min.)</label><input class="input" type="number" min="0" name="rooms" value="${+c.rooms || ''}" placeholder="0"></div>
      <div class="field"><label>Budget minimum (FCFA)</label><input class="input" type="number" min="0" name="min" value="${+c.min || ''}" placeholder="0"></div>
      <div class="field"><label>Budget maximum (FCFA)</label><input class="input" type="number" min="0" name="max" value="${+c.max || ''}" placeholder="Sans limite"></div>
    </div>
    <div class="f-zone-err"></div>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:6px"><button type="button" class="btn ghost" data-action="close-modal">Annuler</button><button class="btn">Enregistrer</button></div></form>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-alerte-modifier]'); if (!b) return;
  e.preventDefault(); const u = Auth.current(), a = u && DB.findItem(DB.K.searches, x => x.id === b.dataset.alerteModifier && x.userId === u.id); if (!a) return;
  modal('Modifier l\'alerte', formulaireAlerte(a));
});
document.addEventListener('change', e => {
  const f = e.target.closest && e.target.closest('form[data-alerte-form]'); if (!f) return;
  const reg = f.querySelector('[name="region"]').value, vil = f.querySelector('[name="city"]'), qua = f.querySelector('[name="quartier"]');
  const remplir = (sel, L, lib) => { sel.innerHTML = `<option value="">${lib}</option>` + L.map(v => `<option value="${esc(v)}">${esc(v)}</option>`).join(''); };
  if (e.target.name === 'region') { remplir(vil, reg ? Object.keys(LOCATIONS[reg] || {}) : [], 'Toutes'); remplir(qua, [], 'Tous'); }
  if (e.target.name === 'city') remplir(qua, reg && vil.value ? (LOCATIONS[reg] || {})[vil.value] || [] : [], 'Tous');
});
document.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form[data-alerte-form]'); if (!f) return;
  e.preventDefault();
  const u = Auth.current(), a = u && DB.findItem(DB.K.searches, x => x.id === f.dataset.alerteForm && x.userId === u.id); if (!a) return;
  const d = formData(f), nom = String(d.name || '').trim(), min = +d.min || 0, max = +d.max || 0, fautes = [];
  if (nom.length < 2) fautes.push(['name', 'Donnez un nom à l\'alerte.']);
  if (min && max && min > max) fautes.push(['max', 'Le budget maximum doit être supérieur au minimum.']);
  if (fautes.length) return erreursIci(f, fautes);
  const criteria = {...(a.criteria || {}), transaction: d.transaction || '', type: d.type || '', region: d.region || '', city: d.city || '', quartier: d.quartier || '',
    rooms: +d.rooms || '', min: min || '', max: max || '', page: 1};
  DB.updateItem(DB.K.searches, a.id, {name: nom.slice(0, 120), criteria});
  closeModal(); toast('Alerte modifiée : vous serez prévenu des nouvelles annonces qui correspondent.'); render();
});
