/* ==========================================================================
   MODULE : uatfix.js — accès aux neuf espaces pour la recette (UAT).
   Deux obstacles empêchaient de tester l'application en entier :
   1. le compte locataire recevait la même adresse Gmail que le compte
      client (Tacko Samb dans les deux cas). La connexion retrouvait le
      client en premier : l'espace locataire était inatteignable.
   2. la liste des comptes de démonstration n'en proposait que cinq ;
      investisseur, promoteur, gestionnaire et agent devaient être saisis
      à la main.
   ========================================================================== */
const ROLE_MAIL = {tenant:'locataire', investor:'investisseur', promoter:'promotrice',
  manager:'gestionnaire', agent:'agent', agency:'agence', owner:'proprietaire', client:'client'};

/* Une adresse déjà prise est réattribuée avec le rôle en suffixe. */
function dedupeEmails() {
  const seen = new Map();
  DB.getData(DB.K.users).forEach(u => {
    const mail = (u.email || '').toLowerCase();
    if (!mail) return;
    if (!seen.has(mail)) { seen.set(mail, u.id); return; }
    if (seen.get(mail) === u.id) return;
    const base = (u.firstName || 'compte').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const neuf = `${base}.${ROLE_MAIL[u.role] || u.role}@gmail.com`;
    if (neuf.toLowerCase() === mail) return;
    DB.updateItem(DB.K.users, u.id, {email: neuf});
    seen.set(neuf.toLowerCase(), u.id);
  });
}
etapeAmorcage('adresses en double', dedupeEmails);
setTimeout(dedupeEmails, 1200);

/* Les neuf espaces accessibles depuis l'écran de connexion. */
if (typeof DEMO_ACCOUNTS !== 'undefined') {
  DEMO_ACCOUNTS.length = 0;
  DEMO_ACCOUNTS.push(
    ['Client', '1900000000002', 'demo123'],
    ['Propriétaire', '1900000000003', 'demo123'],
    ['Agence', '1900000000004', 'demo123'],
    ['Locataire', '1900000000013', 'demo123'],
    ['Investisseur', '1900000000021', 'demo123'],
    ['Promoteur', '1900000000022', 'demo123'],
    ['Gestionnaire', '1900000000011', 'demo123'],
    ['Agent', '1900000000012', 'demo123'],
    ['Administrateur', '1900000000001', 'admin123']);
}
