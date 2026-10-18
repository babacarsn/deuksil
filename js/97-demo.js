/* =========================================================================
   97-demo.js — Mode démonstration prêt à tester
   1. Tous les profils sur l'écran de connexion (ajout du gestionnaire).
   2. Note de l'écran de connexion à jour (les mots de passe ne sont plus en
      clair) + accès au guide et à la remise à zéro sans être administrateur.
   3. Page #/guide-demo : un scénario de test par profil, connexion en un clic.
   Rien n'est envoyé hors du navigateur : chaque testeur a ses propres données.
   ========================================================================= */

/* --- 1. Le gestionnaire (membre du propriétaire) ------------------------- */
if (typeof DEMO_ACCOUNTS !== 'undefined' && !DEMO_ACCOUNTS.some(a => a[1] === '1900000000011')) {
  const i = DEMO_ACCOUNTS.findIndex(a => a[1] === '1900000000004');
  DEMO_ACCOUNTS.splice(i < 0 ? DEMO_ACCOUNTS.length : i, 0, ['Gestionnaire du propriétaire (accès limité)', '1900000000011', 'demo123']);
}

/* --- 3. Scénarios ----------------------------------------------------------- */
const SCENARIOS_DEMO = [
  {visiteur: true, titre: 'Visiteur sans compte', icone: 'lock', etapes: [
    'Rechercher un bien et ouvrir une annonce : prix, photos, lieu visibles',
    'Cliquer « Voir le numéro », « Contacter », « Demander une visite » ou le cœur',
    'Résultat attendu : aucune coordonnée affichée, la page de connexion s\'ouvre',
    'Créer un compte client, puis revenir sur l\'annonce']},
  {cni: '1900000000006', titre: 'Client qui cherche un bien', icone: 'search', etapes: [
    'Rechercher, ajouter aux favoris, voir le numéro',
    'Demander une visite, écrire à l\'annonceur',
    'Quand un bailleur lui fait un bail, son compte devient locataire']},
  {cni: '1900000000002', titre: 'Client avec un bail en cours', icone: 'home', etapes: [
    'Voir son bail, payer un loyer, télécharger la quittance',
    'Signaler un problème (maintenance) et suivre son traitement']},
  {cni: '1900000000304', titre: 'Locataire en retard de 2 loyers', icone: 'alert', etapes: [
    'Voir l\'alerte de retard sur le tableau de bord',
    'Régler un loyer en retard et vérifier que le compteur baisse']},
  {cni: '1900000000003', titre: 'Propriétaire indépendant', icone: 'building', etapes: [
    'Ajouter un bien, dont un terrain (surface en ha, statut foncier, documents)',
    'Planifier une visite, gérer Locataires et Travaux',
    'Lier son compte à une agence (demande à accepter côté agence)',
    'Mon profil : changer le mot de passe, règles de location (reconduction tacite)']},
  {cni: '1900000000201', titre: 'Propriétaire à Thiès (6 biens)', icone: 'chart', etapes: [
    'Tableau de bord chargé : cliquer « En retard », « Loyers »… chaque raccourci ouvre la liste filtrée',
    'Générer les PDF : quittance, contrat, état des lieux, reçu de caution']},
  {cni: '1900000000011', titre: 'Gestionnaire du propriétaire', icone: 'users', etapes: [
    'Vérifier que le menu est réduit aux droits accordés',
    'Les liens vers une page non autorisée sont désactivés']},
  {cni: '1900000000004', titre: 'Agence', icone: 'briefcase', etapes: [
    'Mandants : accepter une demande de lien, voir le relevé (TVA, net vendeur)',
    'Honoraires : télécharger une facture PDF ; partage agent / apporteur',
    'Agents : valider ou renvoyer une annonce soumise',
    'Créer un compte : le mot de passe provisoire s\'affiche une seule fois']},
  {cni: '1900000000012', titre: 'Agent d\'agence', icone: 'user', etapes: [
    'Planifier une visite pour un client sans compte (conflit d\'horaire détecté)',
    'Soumettre une annonce à la validation de l\'agence',
    'Recevoir les rappels de visite et les alertes de correspondance']},
  {cni: '1900000000001', titre: 'Administration', icone: 'lock', etapes: [
    'Vérifications : valider ou refuser un terrain (motif envoyé à l\'annonceur)',
    'Doublons : comparer deux comptes et « Garder celui-ci »',
    'Suspendre un compte : sa session est coupée immédiatement']}
];

function compteDemo(cni) {
  const a = (typeof DEMO_ACCOUNTS !== 'undefined' && DEMO_ACCOUNTS.find(x => x[1] === cni)) || [null, cni, 'demo123'];
  const u = DB.findItem(DB.K.users, x => x.cni === cni);
  return {u, pwd: a[2]};
}

function pageGuideDemo() {
  const cartes = SCENARIOS_DEMO.map(s => {
    if (s.visiteur) return `<div class="card demo-scen">
      <div class="row" style="gap:10px;align-items:center">${icon(s.icone, 20)}<b>${esc(s.titre)}</b></div>
      <p class="small muted" style="margin:4px 0 8px">Aucune connexion</p>
      <ol class="small">${s.etapes.map(e => `<li>${esc(e)}</li>`).join('')}</ol>
      <button class="btn sm" data-action="demo-visiteur">Tester sans compte ${icon('arrowRight', 15)}</button></div>`;
    const {u} = compteDemo(s.cni); if (!u) return '';
    const nom = u.role === 'agency' ? (u.agencyName || u.firstName) : `${u.firstName || ''} ${u.lastName || ''}`.trim();
    return `<div class="card demo-scen">
      <div class="row" style="gap:10px;align-items:center">${icon(s.icone, 20)}<b>${esc(s.titre)}</b></div>
      <p class="small muted" style="margin:4px 0 8px">${esc(nom)} · ${esc(u.email || u.cni)}</p>
      <ol class="small">${s.etapes.map(e => `<li>${esc(e)}</li>`).join('')}</ol>
      <button class="btn sm" data-action="demo-entrer" data-cni="${esc(s.cni)}">Tester ce profil ${icon('arrowRight', 15)}</button>
    </div>`;
  }).join('');
  return shellPublic(`<section class="section" style="border:0"><div class="wrap" style="max-width:980px">
    <h2>Guide de test</h2>
    <p class="muted">Choisissez un profil : vous êtes connecté directement et chaque scénario indique quoi vérifier.
      Les données restent dans ce navigateur ; chaque testeur a les siennes.</p>
    <div class="row" style="gap:10px;margin:6px 0 18px;flex-wrap:wrap">
      <a class="btn ghost sm" href="#/login">Écran de connexion</a>
      <button class="btn ghost sm" data-action="reset-demo">Repartir de zéro</button>
    </div>
    <div class="demo-grille">${cartes}</div>
    <p class="small muted" style="margin-top:18px">Astuce : pour passer d'un profil à l'autre (ex. le propriétaire demande un lien, l'agence l'accepte),
      déconnectez-vous puis revenez sur cette page.</p>
  </div></section>`);
}

routes.unshift({re: /^\/guide-demo$/, fn: () => pageGuideDemo()});

document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="demo-visiteur"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  try { localStorage.removeItem(DB.K.session); resetSessionUiState(); } catch (err) {}
  toast('Vous naviguez comme un visiteur, sans compte.'); go('#/search'); render();
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="demo-entrer"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const {pwd} = compteDemo(b.dataset.cni);
  if (Auth.current()) { try { localStorage.removeItem(DB.K.session); resetSessionUiState(); } catch (err) {} }
  const res = Auth.login(b.dataset.cni, pwd);
  if (res.error) { toast(/incorrect/.test(res.error) ? 'Le mot de passe de ce compte a été changé. Utilisez « Repartir de zéro ».' : res.error); return; }
  toast(`Connecté : ${res.user.role === 'agency' ? res.user.agencyName : res.user.firstName}.`);
  go(Auth.home(res.user)); render();
}, true);

/* --- 2. Écran de connexion ------------------------------------------------- */
(() => {
  const r = routes.find(x => x.re.test('/login')); if (!r) return;
  const fn = r.fn;
  r.fn = (...a) => {
    const html = fn(...a); if (typeof html !== 'string') return html;
    return html.replace(/<p class="small muted" style="margin:10px 0 0">Démonstration : les mots de passe sont stockés en clair dans le navigateur\.<\/p>/,
      `<p class="small muted" style="margin:10px 0 0">Démonstration : les données restent dans ce navigateur.</p>
       <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
         <a class="btn sm" href="#/guide-demo">${icon('compass', 15)} Guide de test</a>
         <button type="button" class="btn ghost sm" data-action="reset-demo">Repartir de zéro</button></div>`);
  };
})();

/* --- 4. Visiteur sans compte : connexion d'abord, puis retour à l'annonce ---
   Numéro, message, visite, favori, signalement : un visiteur est envoyé vers
   la connexion (ou la création d'un compte client). Une fois connecté, il
   revient sur l'annonce qu'il regardait. */
const CLE_RETOUR = 'deuksil_retour';
document.addEventListener('click', e => {
  if (Auth.current()) return;
  const b = e.target.closest && e.target.closest('[data-action="call-owner"], [data-action="contact"], [data-action="ask-visit"], [data-action="toggle-fav"], [data-action="g5-report"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const h = location.hash || '#/'; try { sessionStorage.setItem(CLE_RETOUR, /^#\/(login|register)/.test(h) ? '#/search' : h); } catch (err) {}
  toast('Connectez-vous ou créez un compte client pour contacter l\'annonceur.');
  go('#/login');
}, true);
const _goRetour = go;
go = function (h) {
  let r = null; try { r = sessionStorage.getItem(CLE_RETOUR); } catch (e) {}
  const u = Auth.current();
  if (r && u && ['client', 'tenant'].includes(u.role) && h === Auth.home(u)) { try { sessionStorage.removeItem(CLE_RETOUR); } catch (e) {} return _goRetour(r); }
  return _goRetour(h);
};
