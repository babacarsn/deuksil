/* ==========================================================================
   99q-aide.js — Aide : tutoriels vidéo par espace.

   - Un bouton « Aide » à la fin du menu de chaque espace (ordinateur et
     téléphone) et dans l'en-tête du site public.
   - La page #/aide montre d'abord les vidéos de l'espace de la personne,
     puis permet de voir celles des autres espaces et de chercher.
   - Chaque vidéo s'ouvre dans un lecteur, avec les étapes écrites en dessous
     et un bouton qui ouvre directement l'écran concerné.

   Les vidéos sont dans videos/guides/<id>.mp4 (affiche : <id>.jpg). Elles sont
   tournées sur l'application elle-même, avec des données fictives, par
   tests/videos/tourner.js : en cas de changement d'écran, on les retourne.
   ========================================================================== */

ICONS.aide = '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6"/><path d="M12 17.2h.01"/>';
ICONS.play = '<path d="M8 5.5v13l10.5-6.5z"/>';

const AIDE_ESPACES = {
  visiteur: 'Visiteur', client: 'Client', owner: 'Propriétaire', agency: 'Agence', agent: 'Agent',
  manager: 'Gestionnaire', tenant: 'Locataire', mandant: 'Propriétaire avec agence'
};
/* Catalogue : id (nom du fichier vidéo), espaces concernés, titre, résumé, durée, étapes écrites, écran. */
const GUIDES = [
  {id: 'rechercher', pour: ['visiteur', 'client', 'tenant'], titre: 'Rechercher un logement', duree: '0:40',
    resume: 'Filtrer les annonces par ville, budget et type, puis ouvrir une fiche.', lien: '#/search',
    etapes: ['Ouvrez « Rechercher » dans le menu.', 'Choisissez « À louer » ou « À vendre ».', 'Indiquez la ville, le type de bien et votre budget.', 'Cliquez sur une annonce pour voir les photos, le prix et l\'adresse.']},
  {id: 'favoris-alertes', pour: ['client', 'tenant'], titre: 'Favoris, comparaison et alertes', duree: '0:38',
    resume: 'Garder les annonces qui vous plaisent, les comparer et être prévenu des nouvelles.', lien: '#/search',
    etapes: ['Sur une annonce, cliquez sur le cœur pour l\'ajouter à « Mes favoris ».', 'Cochez « Comparer » sur 2 ou 3 annonces, puis cliquez sur « Comparer ».', 'Dans la recherche, cliquez sur « Créer une alerte » : vous serez prévenu des nouvelles annonces qui correspondent.']},
  {id: 'visite-contact', pour: ['visiteur', 'client', 'tenant'], titre: 'Demander une visite', duree: '0:29',
    resume: 'Proposer un créneau de visite à l\'annonceur et suivre sa réponse.', lien: '#/search',
    etapes: ['Ouvrez la fiche du bien.', 'Cliquez sur « Demander une visite ».', 'Choisissez la date et l\'heure, ajoutez un message si besoin, puis envoyez.', 'Suivez la réponse dans « Mes visites ».']},
  {id: 'creer-compte', pour: ['visiteur'], titre: 'Créer son compte', duree: '0:41',
    resume: 'S\'inscrire comme client, propriétaire ou agence, puis confirmer son adresse e-mail.', lien: '#/register',
    etapes: ['Cliquez sur « Créer un compte ».', 'Choisissez votre profil : client, propriétaire ou agence.', 'Renseignez vos informations et un mot de passe (8 caractères, lettres et chiffres).', 'Saisissez le code reçu par e-mail pour activer le compte.']},
  {id: 'publier', pour: ['owner', 'agency', 'agent'], titre: 'Publier un bien', duree: '1:01',
    resume: 'Créer une annonce avec photos, prix et adresse, puis la mettre en ligne.', lien: '#/owner/property/new',
    etapes: ['Cliquez sur « Ajouter un bien ».', 'Remplissez le titre, le type, location ou vente, et le prix.', 'Indiquez la ville, la commune et le quartier.', 'Ajoutez vos photos (20 au plus) : la première sert de couverture.', 'Vérifiez le récapitulatif puis publiez. Un agent : l\'annonce part en validation chez l\'agence.', 'Votre numéro de CNI est demandé avant la première publication.']},
  {id: 'visites', pour: ['owner', 'agency', 'agent'], titre: 'Répondre aux demandes de visite', duree: '0:19',
    resume: 'Accepter ou refuser une visite et prévenir le client.', lien: '#/owner/visits',
    etapes: ['Ouvrez « Visites » dans le menu.', 'Chaque demande indique le bien, le client et le créneau souhaité.', 'Cliquez sur « Accepter » ou « Refuser » : le client est prévenu dans son espace.', 'Après la visite, marquez-la comme réalisée.']},
  {id: 'bail', pour: ['owner', 'agency', 'manager'], titre: 'Ajouter un locataire et son bail', duree: '0:37',
    resume: 'Enregistrer le bail (loyer, caution, durée) et créer l\'échéancier des loyers.', lien: '#/manage/leases',
    etapes: ['Ouvrez « Locataires » dans le menu.', 'Cliquez sur « Nouveau bail ».', 'Choisissez le bien, saisissez le nom et le téléphone du locataire.', 'Indiquez le loyer, la caution, la date de début et la durée.', 'Enregistrez : les loyers de chaque mois sont créés automatiquement.', 'Facultatif : « Ouvrir l\'accès » donne au locataire son propre espace.']},
  {id: 'loyer-quittance', pour: ['owner', 'agency', 'manager'], titre: 'Encaisser un loyer et remettre la quittance', duree: '0:35',
    resume: 'Noter un paiement (même partiel) et télécharger la quittance en PDF.', lien: '#/manage/rents',
    etapes: ['Ouvrez « Loyers » dans le menu.', 'Sur la ligne du mois, cliquez sur « Encaisser ».', 'Saisissez le montant reçu, la date et le moyen de paiement (Wave, Orange Money, espèces…).', 'Un paiement partiel est accepté : le reste à payer s\'affiche.', 'Cliquez sur « Quittance » pour l\'afficher et la télécharger en PDF.']},
  {id: 'devis-facture', pour: ['owner', 'agency', 'manager'], titre: 'Faire un devis puis une facture', duree: '0:53',
    resume: 'Créer un devis, le faire accepter, puis le transformer en facture et noter le paiement.', lien: '#/manage/docs',
    etapes: ['Ouvrez « Devis & Factures ».', 'Cliquez sur « Nouveau document » et choisissez « Devis ».', 'Saisissez le client, les lignes (désignation, quantité, prix) et la TVA : le total s\'affiche.', 'Quand le client accepte, cliquez sur « Accepté » puis « → Facture ».', 'Sur la facture, « Paiement » enregistre ce qui est payé ; « PDF » télécharge le document.']},
  {id: 'depense', pour: ['owner', 'agency', 'manager'], titre: 'Enregistrer une dépense', duree: '0:32',
    resume: 'Noter une réparation ou une charge sur un bien, avec son justificatif.', lien: '#/manage/expenses',
    etapes: ['Ouvrez « Finances » puis « Dépenses ».', 'Cliquez sur « Nouvelle dépense ».', 'Choisissez le bien, la catégorie, le montant et la date ; joignez la facture du fournisseur.', 'Enregistrez : la dépense apparaît dans les finances et, pour un mandant, dans son relevé.']},
  {id: 'equipe', pour: ['owner', 'agency'], titre: 'Ajouter un membre à l\'équipe', duree: '0:42',
    resume: 'Donner un accès à un agent ou un gestionnaire, avec ses propres identifiants et ses droits.', lien: '#/manage/team',
    etapes: ['Ouvrez « Équipe » (agence) ou « Paramètres › Équipe & accès » (propriétaire).', 'Cliquez sur « Ajouter un membre ».', 'Saisissez son nom, son e-mail, son téléphone, son rôle et cochez ses droits.', 'Validez : la fiche « Identifiants à transmettre » s\'affiche. Envoyez-la par WhatsApp ou e-mail.', 'Le membre se connecte et choisit son mot de passe. « Droits » et « Nouveau mot de passe » restent disponibles sur sa ligne.']},
  {id: 'mandant', pour: ['agency'], titre: 'Ajouter un propriétaire et lui ouvrir son espace', duree: '0:48',
    resume: 'Créer la fiche d\'un propriétaire qui vous confie ses biens et lui donner un accès en lecture.', lien: '#/manage/owners',
    etapes: ['Ouvrez « Propriétaires ».', 'Cliquez sur « Nouveau propriétaire » : nom, téléphone, e-mail, commission.', 'Rattachez ses biens à sa fiche (fiche du bien › Propriétaire).', 'Cliquez sur « Ouvrir l\'accès » : la fiche d\'identifiants s\'affiche, à lui transmettre.', 'Il voit ses biens, ses loyers et ses relevés, sans pouvoir les modifier.']},
  {id: 'mandat', pour: ['agency'], titre: 'Créer un mandat de gestion', duree: '0:36',
    resume: 'Formaliser la gestion d\'un propriétaire : biens, commission, durée, services.', lien: '#/manage/mandates',
    etapes: ['Ouvrez « Mandats ».', 'Cliquez sur « Nouveau mandat » et choisissez le propriétaire : sa commission est reprise.', 'Cochez les biens et les services, indiquez le début et la fin.', 'Enregistrez, puis « Voir » pour l\'aperçu et le PDF à faire signer.']},
  {id: 'reversement', pour: ['agency'], titre: 'Relevé et reversement au propriétaire', duree: '0:25',
    resume: 'Voir ce qui a été encaissé pour un propriétaire, la commission, et lui reverser son dû.', lien: '#/manage/transfers',
    etapes: ['Ouvrez « Reversements ».', 'Chaque propriétaire : loyers encaissés, dépenses, commission et solde à reverser.', 'Cliquez sur « Relevé » pour le détail du mois et le PDF.', 'Après le virement, cliquez sur « Reverser » et indiquez le montant et le moyen.']},
  {id: 'locataire', pour: ['tenant'], titre: 'Mon logement : bail, loyers et paiements', duree: '0:28',
    resume: 'Retrouver son bail, ce qui reste à payer, ses paiements et ses quittances.', lien: '#/tenant/home',
    etapes: ['« Mon logement » résume votre bail : loyer, caution, échéance, bailleur.', '« Mon contrat de bail (PDF) » télécharge le contrat.', '« Mon loyer » montre chaque mois et ce qui reste à payer.', '« Mes paiements » liste vos versements ; « Mes quittances » les reçus en PDF.']},
  {id: 'maintenance', pour: ['tenant'], titre: 'Signaler un problème dans le logement', duree: '0:30',
    resume: 'Prévenir son bailleur d\'une panne ou d\'une fuite, avec une photo, et suivre la réparation.', lien: '#/tenant/tickets',
    etapes: ['Ouvrez « Maintenance ».', 'Donnez un titre, la catégorie et l\'urgence, décrivez le problème.', 'Ajoutez une photo si possible, puis envoyez.', 'Suivez l\'avancement : Nouvelle → En cours → Terminée.']},
  {id: 'mandant-releves', pour: ['mandant'], titre: 'Suivre mes biens et mes relevés', duree: '0:27',
    resume: 'Voir la situation de chaque bien confié à l\'agence et l\'argent qui vous revient.', lien: '#/owner/properties',
    etapes: ['« Mes biens confiés » : chaque bien, son locataire, son loyer et les retards éventuels.', 'Cliquez sur un bien pour voir le bail, les loyers mois par mois et les dépenses.', '« Mes relevés » : encaissé pour vous, commission de l\'agence, dépenses et net à vous reverser.', 'Pour toute question, écrivez à votre agence depuis Messages.']},
  {id: 'profil-cni', pour: ['client', 'owner', 'agency', 'agent', 'manager', 'tenant', 'mandant'], titre: 'Mon profil, mot de passe et CNI', duree: '0:28',
    resume: 'Mettre à jour ses informations, changer son mot de passe et renseigner sa CNI.', lien: '#/owner/profile',
    etapes: ['Ouvrez « Mon profil » ou « Paramètres ».', 'Modifiez vos coordonnées et votre photo, puis enregistrez.', 'Renseignez votre numéro de CNI (13 chiffres) : il est demandé avant de publier une annonce.', 'Pour changer de mot de passe : « Changer mon mot de passe », sous le formulaire. Oublié ? « Mot de passe oublié » sur la page de connexion envoie un code.']}
];
const espaceAide = u => !u ? 'visiteur' : (u.role === 'owner' && u.ownerRec) ? 'mandant' : u.member ? (u.member.role || u.role) : u.role;
const lienGuide = (g, u) => {
  if (g.id === 'profil-cni' && u) return u.member ? '#/agent/profil' : u.role === 'agency' ? '#/agency/settings' : ['client', 'tenant'].includes(u.role) ? '#/client/profile' : '#/owner/profile';
  if (g.id === 'visites' && u && (u.role === 'agency' || u.member)) return '#/agency/visits';
  if (g.id === 'bail' && u && u.role === 'agency') return '#/manage/tenants';
  if (g.id === 'equipe' && u && u.role === 'agency') return '#/agency/agents';
  if (!u && g.lien !== '#/search' && g.lien !== '#/register') return '#/login';
  return g.lien;
};
const urlVideo = (id, ext) => `videos/guides/${id}.${ext}`;

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

/* --- Page #/aide ------------------------------------------------------------------ */
let aideFiltre = null, aideRecherche = '';
function carteGuide(g, u) {
  return `<button type="button" class="aide-carte" data-action="aide-voir" data-id="${g.id}">
    <span class="aide-affiche"><img src="${urlVideo(g.id, 'jpg')}" alt="" loading="lazy"><span class="aide-play">${icon('play', 22, true)}</span><span class="aide-duree">${g.duree}</span></span>
    <span class="aide-txt"><b>${esc(g.titre)}</b><span class="small muted">${esc(g.resume)}</span></span></button>`;
}
function pageAide() {
  const u = Auth.current(), moi = espaceAide(u), esp = aideFiltre || moi;
  const q = aideRecherche.trim().toLowerCase();
  const correspond = g => !q || (g.titre + ' ' + g.resume + ' ' + g.etapes.join(' ')).toLowerCase().includes(q);
  const liste = q ? GUIDES.filter(correspond) : GUIDES.filter(g => g.pour.includes(esp));
  const espaces = Object.keys(AIDE_ESPACES).filter(k => GUIDES.some(g => g.pour.includes(k)));
  return page('Aide', 'Des vidéos courtes pour chaque action importante. Choisissez un tutoriel : la vidéo montre où cliquer, les étapes sont écrites en dessous.') +
    `<div class="aide-outils"><label class="aide-cherche">${icon('search', 16)}<input class="input" type="text" inputmode="search" data-aide-cherche placeholder="Que voulez-vous faire ? Ex. facture, visite, loyer…" value="${esc(aideRecherche)}"></label>
      <div class="aide-espaces" role="tablist">${espaces.map(k => `<button type="button" role="tab" class="chip ${!q && k === esp ? 'on' : ''}" data-action="aide-espace" data-id="${k}" aria-selected="${!q && k === esp}">${esc(AIDE_ESPACES[k])}${k === moi ? ' (vous)' : ''}</button>`).join('')}</div></div>` +
    (liste.length ? `<div class="aide-grille">${liste.map(g => carteGuide(g, u)).join('')}</div>`
      : `<div class="empty"><b>Aucun tutoriel ne correspond</b><p class="small">Essayez un autre mot, ou écrivez-nous : nous vous répondrons.</p></div>`) +
    `<div class="card aide-contact"><div><b>Vous ne trouvez pas la réponse ?</b><p class="small muted" style="margin:4px 0 0">Écrivez-nous : l'équipe DEUKSIL vous répond et ajoute un tutoriel si la question revient souvent.</p></div><a class="btn ghost" href="#/contact">${icon('message', 16)} Nous écrire</a></div>`;
}
route(/^\/aide$/, () => {
  const u = Auth.current(), h = pageAide();
  return u ? shellApp(u, h) : shellPublic(`<section class="wrap aide-public">${h}</section>`);
});
function ouvrirGuide(id) {
  const g = GUIDES.find(x => x.id === id); if (!g) return;
  const u = Auth.current(), lien = lienGuide(g, u), autres = GUIDES.filter(x => x.id !== g.id && x.pour.some(p => g.pour.includes(p))).slice(0, 3);
  modal(esc(g.titre), `<div class="aide-lecteur"><video controls autoplay playsinline preload="metadata" poster="${urlVideo(g.id, 'jpg')}" src="${urlVideo(g.id, 'mp4')}"></video>
      <p class="small muted aide-video-ko" hidden>La vidéo ne se charge pas : suivez les étapes ci-dessous.</p></div>
    <h4 style="margin:16px 0 8px">Les étapes</h4><ol class="aide-etapes">${g.etapes.map(e => `<li>${esc(e)}</li>`).join('')}</ol>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:14px"><a class="btn" href="${lien}" data-action="close-modal">${icon('arrowRight', 16)} ${u || lien === '#/search' || lien === '#/register' ? 'Ouvrir cet écran' : 'Se connecter pour commencer'}</a><button class="btn ghost" data-action="close-modal">Fermer</button></div>
    ${autres.length ? `<p class="small muted" style="margin:18px 0 6px">À voir aussi</p><div class="aide-suite">${autres.map(x => `<button type="button" class="chip" data-action="aide-voir" data-id="${x.id}">${icon('play', 12, true)} ${esc(x.titre)}</button>`).join('')}</div>` : ''}`);
  const v = document.querySelector('.modal .aide-lecteur video');
  if (v) v.addEventListener('error', () => { v.remove(); const k = document.querySelector('.modal .aide-video-ko'); if (k) k.hidden = false; }, {once: true});
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-action="aide-voir"], [data-action="aide-espace"]'); if (!b) return;
  e.preventDefault();
  if (b.dataset.action === 'aide-voir') return ouvrirGuide(b.dataset.id);
  aideFiltre = b.dataset.id; aideRecherche = ''; render();
});
document.addEventListener('input', e => {
  const i = e.target; if (!i || !i.matches || !i.matches('[data-aide-cherche]')) return;
  aideRecherche = i.value; const pos = i.selectionStart; render();
  const n = document.querySelector('[data-aide-cherche]'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) {} }
});
/* Lien direct vers un tutoriel : #/aide?video=publier */
addEventListener('hashchange', () => { const m = /^#\/aide\?video=([\w-]+)/.exec(location.hash); if (m) { history.replaceState(null, '', '#/aide'); render(); setTimeout(() => ouvrirGuide(m[1]), 50); } });
/* Affiche absente (vidéo pas encore tournée) : on garde le fond et le bouton lecture. */
document.addEventListener('error', e => { const t = e.target; if (t && t.tagName === 'IMG' && t.closest && t.closest('.aide-affiche')) t.remove(); }, true);
