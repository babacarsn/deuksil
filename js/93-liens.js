/* ==========================================================================
   MODULE : liens.js — chaque raccourci mène exactement là où il le dit.
   « 2 loyers en retard » ouvrait tous les loyers, « 1 demande de visite à
   confirmer » toutes les visites, « Ajouter un locataire » la liste des
   baux sans le formulaire. Il fallait chercher soi-même.
   1. Règles générales : selon la page visée et le texte du raccourci, le
      lien reçoit un filtre (?f=), une recherche (?q=), une section (?s=),
      un formulaire (?form=) ou une action (?ouvrir=). Elles s'appliquent à
      tous les écrans, tableaux de bord compris.
   2. À l'arrivée, la page applique ces paramètres : lignes filtrées avec un
      bandeau « Filtré : … · Tout afficher », section mise en vue, formulaire
      ouvert et premier champ prêt.
   3. Un lien ne mène jamais à un refus : vers une page que le profil ne
      peut pas ouvrir, il est remplacé par l'équivalent autorisé, ou désactivé.
   ========================================================================== */

if (!ICONS.filter) ICONS.filter = '<path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"/>';
/* --- 1. Les filtres que comprennent toutes les listes ---------------------- */
const lienNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const badgesDe = tr => [...tr.querySelectorAll('.badge')].map(b => b.textContent.trim());
const lienAuj = () => { try { return dateFr(ymd()); } catch (e) { return ''; } };
const FILTRES = {
  retard:     ['En retard',        tr => badgesDe(tr).some(b => /en retard|impay/i.test(b))],
  nonpaye:    ['À encaisser',      tr => badgesDe(tr).some(b => /en retard|à venir|acompte|partiel/i.test(b))],
  paye:       ['Encaissés',        tr => badgesDe(tr).some(b => /^pay[ée]e?$|encaiss|versée/i.test(b))],
  confirmer:  ['À confirmer',      tr => badgesDe(tr).some(b => /en attente|à confirmer/i.test(b))],
  aujourdhui: ['Aujourd\'hui',     tr => /aujourd/i.test(tr.textContent) || (lienAuj() && tr.textContent.includes(lienAuj()))],
  avenir:     ['À venir',          tr => badgesDe(tr).some(b => /en attente|acceptée|reportée|à venir/i.test(b))],
  encours:    ['En cours',         tr => badgesDe(tr).some(b => /^(nouvelle|ouvert|en cours|planifi|devis|attente)/i.test(b))],
  renouveler: ['À renouveler',     tr => badgesDe(tr).some(b => /expir/i.test(b))],
  impayee:    ['À encaisser',      tr => badgesDe(tr).some(b => /émise|en retard|partiel|envoy/i.test(b))],
  suspendu:   ['Comptes suspendus', tr => badgesDe(tr).some(b => /suspendu/i.test(b))],
  sansagent:  ['Sans agent',       tr => badgesDe(tr).some(b => /sans agent/i.test(b))],
  crafaire:   ['Compte rendu à faire', tr => !!tr.querySelector('[data-action="agent-cr"]') && !/Modifier le compte rendu/.test(tr.textContent)],
  aencaisser: ['À encaisser',      tr => badgesDe(tr).some(b => /à encaisser/i.test(b))],
  actif:      ['Actifs',           tr => badgesDe(tr).some(b => /^actif$|en cours/i.test(b))]
};
/* L'écran des loyers a déjà ses propres boutons de filtre : on s'en sert. */
if (typeof RFILTRES !== 'undefined' && !RFILTRES.some(x => x[0] === 'nonpaye')) RFILTRES.splice(1, 0, ['nonpaye', 'À encaisser', t => t === 'bad' || t === 'info' || t === 'warn']);
const FILTRE_LOYERS = {retard: 'retard', nonpaye: 'nonpaye', avenir: 'attente', paye: 'paye'};

/* --- 2. Règles : quelle précision ajouter à quel lien ----------------------
   [page visée, texte du lien, paramètres | fonction(texte, lien) → params] */
/* Un nom de personne ne passe pas dans l'adresse : on y met un jeton court, résolu en mémoire. */
const JETONS_LIEN = new Map();
function jetonLien(t) { for (const [k, v] of JETONS_LIEN) if (v === t) return k; const k = 'j' + (JETONS_LIEN.size + 1).toString(36); JETONS_LIEN.set(k, t); return k; }
const sousTitre = a => { const s = a.querySelector('.sub, .pd-foot, .small, .muted'); return s ? s.textContent.trim() : ''; };
const unNom = a => { const s = sousTitre(a); return s && !/[,·0-9]/.test(s) && s.length < 40 ? s : ''; };
const REGLES = [
  [/^#\/manage\/rents$/,              /retard|impay/i,                         'f=retard'],
  [/^#\/manage\/rents$/,              /encaisser un loyer/i,                    'f=nonpaye'],
  [/^#\/manage\/rents$/,              /encaiss[ée]|total encaiss|ce mois/i,     'f=paye'],
  [/^#\/(owner|agency)\/visits$/,     /aujourd/i,                               'f=aujourdhui'],
  [/^#\/(owner|agency)\/visits$/,     /confirmer|demandes? de visite|attente/i, 'f=confirmer'],
  [/^#\/(owner|agency)\/visits$/,     /à venir|prochaines/i,                    'f=avenir'],
  [/^#\/agency\/visits$/,             /planifier/i,                             'ouvrir=agent-planif'],
  [/^#\/client\/visits$/,             /à venir/i,                               'f=avenir'],
  [/^#\/manage\/tickets$/,            /maintenance|panne|travaux|en cours|intervention/i, 'f=encours'],
  [/^#\/manage\/contracts$/,          /renouvel|expir/i,                        'f=renouveler'],
  [/^#\/manage\/leases$/,             /ajouter un locataire|nouveau bail|établir/i, 'form=Nouveau bail'],
  [/^#\/manage\/leases$/,             /échu|échéance|fin de bail/i,             a => unNom(a) ? 'q=' + jetonLien(unNom(a)) : ''],
  [/^#\/manage\/deals$/,              /ajouter un acheteur|vendre un bien|nouvelle vente/i, 'form=Vendre un bien'],
  [/^#\/manage\/owners$/,             /ajouter un propriétaire/i,               'form=Nouveau propriétaire'],
  [/^#\/manage\/mandates$/,           /sans mandat|nouveau mandat|ajouter un mandat/i, 'form=Nouveau mandat de gestion'],
  [/^#\/manage\/transfers$/,          /revers|à payer/i,                        's=Comptes des propriétaires'],
  [/^#\/manage\/docs$/,               /créer une facture|nouvelle facture/i,    'ouvrir=g2-new:Facture'],
  [/^#\/manage\/docs$/,               /créer un devis|nouveau devis/i,          'ouvrir=g2-new:Devis'],
  [/^#\/manage\/docs$/,               /impay|à encaisser|en attente/i,          'f=impayee'],
  [/^#\/coffre$/,                     /ajouter un document/i,                   'ouvrir=g7-add'],
  [/^#\/agency\/clients$/,            /nouvelle demande/i,                      'form=Nouvelle demande client'],
  [/^#\/agency\/clients$/,            /sans bien/i,                             's=Demandes en cours'],
  [/^#\/admin\/users$/,               /^\d+ comptes? suspendus?/i,             'f=suspendu'],
  [/^#\/admin\/listings$/,            /^(\d+ )?annonces? à valider|^à valider|^valider les annonces/i, 's=attente'],
  [/^#\/tenant\/rents$/,              /loyer d[eu'] ?(\S+ \d{4})/i,             (a, t) => 'q=' + t.match(/loyer d[eu'] ?(\S+ \d{4})/i)[1]],
  [/^#\/tenant\/rents$/,              /retard/i,                                'f=retard'],
  [/^#\/agency\/properties$/,        /à valider/i,                             's=a-valider'],
  [/^#\/agency\/visits$/,             /sans agent/i,                            'f=sansagent'],
  [/^#\/agency\/visits$/,             /compte rendu|comptes rendus/i,           'f=crafaire'],
  [/^#\/agency\/commissions$/,        /caution/i,                               's=Cautions'],
  [/^#\/agency\/commissions$/,        /honoraires? à encaisser/i,               'f=aencaisser'],
  [/^#\/manage\/leases$/,             /départ de (.+?) (dans|dépassé)/i,        (a, t) => 'q=' + jetonLien(t.match(/départ de (.+?) (dans|dépassé)/i)[1])],
  [/^#\/manage\/rents$/,              /loyer d[eu'] ?(\S+ \d{4})/i,             (a, t) => 'q=' + t.match(/loyer d[eu'] ?(\S+ \d{4})/i)[1]]
];
/* Adresses qui ont changé de place. */
const ALIAS = {
  '#/manage/tmsgs': u => u && ['owner', 'agency'].includes(u.role) ? `#/${u.role}/messages` : '#/client/messages',
  '#/tenant/messages': () => '#/client/messages'
};
/* Liens qui pointaient sur la page où l'on est déjà, sans rien de plus. */
const PLUS_JUSTE = [
  [/^#\/tenant\/home$/, /fin du bail/i, '#/coffre/contrats']
];

function precisionDe(a, href) {
  const t = (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim();
  for (const [re, lab, p] of REGLES) {
    if (!re.test(href) || !lab.test(t)) continue;
    const v = typeof p === 'function' ? p(a, t) : p;
    if (v) return v;
  }
  return '';
}

/* --- 3. Préciser les liens affichés --------------------------------------- */
function preciserLiens() {
  const u = Auth.current(); if (!u) return;
  /* Le menu et les grandes rubriques (Gestion) ouvrent la rubrique entière :
     seuls les raccourcis des tableaux de bord et des listes sont précisés. */
  const hub = /^#\/manage$/.test(location.hash);
  document.querySelectorAll('#app a[href^="#/"]:not([data-lien])').forEach(a => {
    a.dataset.lien = '1';
    const menu = !!a.closest('.sidebar, .tabbar, nav, .drawer, .upanel, .mhead, header');
    let href = a.getAttribute('href');
    if (ALIAS[href]) { href = ALIAS[href](u); a.setAttribute('href', href); }
    for (const [re, lab, cible] of PLUS_JUSTE) if (re.test(href) && lab.test(a.textContent || '')) { href = cible; a.setAttribute('href', href); }
    /* Un raccourci vers une page interdite à ce profil ne s'affiche pas
       comme un lien : il menait à « Accès non autorisé ». */
    if (u.member && typeof permFor === 'function') {
      const perm = permFor(href.slice(1).split('?')[0]);
      if (perm && !memberCan(u, perm)) {
        const alt = /manage\/(finance|fpay)/.test(href) && memberCan(u, 'gestion') ? '#/manage/rents?f=paye' : '';
        if (alt) { a.setAttribute('href', alt); return; }
        a.removeAttribute('href'); a.classList.add('lien-off'); a.setAttribute('aria-disabled', 'true');
        a.title = 'Réservé au responsable'; return;
      }
    }
    if (href.includes('?') || menu || hub) return;
    const p = precisionDe(a, href);
    if (p) a.setAttribute('href', href + '?' + p);
  });
}

/* --- 4. À l'arrivée : appliquer le filtre, la section, le formulaire ------ */
function lignesDeLaPage() {
  return [...document.querySelectorAll('.main > .content table tbody tr, #app .content table tbody tr')].filter(tr => !tr.closest('.modal'));
}
function filtrerLignes(test, q) {
  const tables = new Set(); let n = 0;
  lignesDeLaPage().forEach(tr => {
    const ok = (!test || test(tr)) && (!q || lienNorm(tr.textContent).includes(lienNorm(q)));
    tr.dataset.f = ok ? '' : '1'; tr.style.display = ok ? '' : 'none'; if (ok) n++;
    const t = tr.closest('table'); if (t) tables.add(t);
  });
  tables.forEach(t => { try { if (typeof t.__pg === 'function') t.__pg(); } catch (e) {} });
  return n;
}
function bandeauFiltre(texte, n) {
  const c = document.querySelector('.main > .content') || document.querySelector('#app .content'); if (!c) return;
  const ancre = c.querySelector('.table-wrap, table, .empty'); if (!ancre) return;
  let d = c.querySelector('.lien-filtre');
  if (!d) { d = document.createElement('div'); d.className = 'lien-filtre'; (ancre.closest('.table-wrap') || ancre).before(d); }
  d.innerHTML = `${icon('filter', 15)}<span>Filtré : <b>${esc(texte)}</b> · ${n ? pluriel(n, 'résultat') : 'aucun résultat'}</span>
    <button type="button" class="btn ghost sm" data-action="lien-tout">Tout afficher</button>`;
}
document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="lien-tout"]')) return;
  filtrerLignes(null, ''); const d = document.querySelector('.lien-filtre'); if (d) d.remove();
});
function mettreEnVue(el) {
  if (!el) return false;
  /* L'en-tête est fixe : on s'arrête juste en dessous. */
  const haut = (document.querySelector('.mhead, .topbar, header') || {}).offsetHeight || 64;
  window.scrollTo({top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - haut - 14), behavior: 'smooth'});
  el.classList.add('lien-cible'); setTimeout(() => el.classList.remove('lien-cible'), 2200);
  return true;
}
function sectionParTitre(txt) {
  const k = lienNorm(txt);
  return [...document.querySelectorAll('#app .content h2, #app .content h3, #app .content h4, #app .content .pd-h, #app .content summary')]
    .find(h => lienNorm(h.textContent).includes(k)) || document.getElementById(txt);
}

let lienApplique = null;
function appliquerLien() {
  if (!LIEN || lienApplique === LIEN) return;
  if (location.hash !== LIEN.path) { if (Date.now() - LIEN.at > 4000) LIEN = null; return; }
  const c = document.querySelector('#app .content'); if (!c || !c.children.length) return;
  lienApplique = LIEN;
  const P = LIEN.p, f = P.get('f'), q = (v => v && JETONS_LIEN.has(v) ? JETONS_LIEN.get(v) : v)(P.get('q')), s = P.get('s'), form = P.get('form'), ouvrir = P.get('ouvrir');
  try {
    if (f && /^#\/manage\/rents$/.test(location.hash) && FILTRE_LOYERS[f]) {
      rFiltre = FILTRE_LOYERS[f];
      const b = document.querySelector(`[data-action="rfiltre"][data-id="${rFiltre}"]`); if (b) b.click();
      if (q) setTimeout(() => filtrerLignes(FILTRES[f] && FILTRES[f][1], q), 60);
      mettreEnVue(document.querySelector('.rfiltre'));
    } else if (f || q) {
      const n = filtrerLignes(f && FILTRES[f] ? FILTRES[f][1] : null, q);
      bandeauFiltre([f && FILTRES[f] ? FILTRES[f][0] : '', q ? `« ${q} »` : ''].filter(Boolean).join(' · '), n);
      mettreEnVue(document.querySelector('.lien-filtre'));
    }
    if (s) {
      const h = sectionParTitre(s);
      if (!mettreEnVue(h) && /attente|valider/i.test(s)) toast('Rien n\'attend de validation pour le moment.');
    }
    if (form) {
      const h = sectionParTitre(form);
      const zone = h && (h.closest('form') || h.parentElement.querySelector('form') || h.nextElementSibling);
      const det = h && h.closest('details'); if (det) det.open = true;
      mettreEnVue(h && (h.closest('form, .card') || h));
      const champ = zone && zone.querySelector && zone.querySelector('input:not([type=hidden]):not([disabled]), select, textarea');
      if (champ) setTimeout(() => { try { champ.focus({preventScroll: true}); } catch (e) {} }, 450);
    }
    if (ouvrir) {
      const [act, txt] = ouvrir.split(':');
      const b = [...document.querySelectorAll(`#app [data-action="${act}"]`)].find(x => !txt || lienNorm(x.textContent).includes(lienNorm(txt)));
      if (b) setTimeout(() => b.click(), 80);
    }
  } catch (e) { console.warn('lien', e); }
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { preciserLiens(); } catch (e) {}
  try { appliquerLien(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* Le raccourci de base « en retard → filtre » de assistance.js n'est plus
   utile, mais reste inoffensif. On réinitialise le filtre des loyers quand
   on arrive sans précision, pour ne pas garder celui d'une visite passée. */
addEventListener('hashchange', () => {
  if (/^#\/manage\/rents$/.test(location.hash) && !(LIEN && LIEN.path === '#/manage/rents')) { try { rFiltre = 'tous'; } catch (e) {} }
});
