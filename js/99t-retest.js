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
