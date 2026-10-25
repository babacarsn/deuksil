// Formulaires réels contre Supabase (base de TEST) : inscription avec code reçu
// par e-mail, agence, connexion, mot de passe oublié, contact, photos.
// Les e-mails sont lus dans la capture SMTP de la base de test (MAILS : fichier
// JSON lignes {to, subject, body}). Rien n'est simulé : chaque étape passe par
// Supabase Auth et la base.
const fs = require('fs'), path = require('path');
const {open, goto, logout, loginAs} = require('./harnais.js');
const {Client} = require('pg');
const MAILS = process.env.MAILS || path.join(process.env.REPLIQUE_DIR || '/home/claude/sb', 'run', 'mails.jsonl');
const URL_DB = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres';
const S = Date.now().toString(36);

const code = async (email, depuis) => {
  for (let i = 0; i < 40; i++) {
    const L = fs.existsSync(MAILS) ? fs.readFileSync(MAILS, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
    const m = L.slice(depuis).reverse().find(x => x.to.includes(email));
    if (m) { const c = (m.body.match(/\b(\d{6})\b/) || [])[1]; if (c) return c; }
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
};
const nbMails = () => fs.existsSync(MAILS) ? fs.readFileSync(MAILS, 'utf8').trim().split('\n').filter(Boolean).length : 0;

(async () => {
  const db = new Client({connectionString: URL_DB}); await db.connect();
  const {b, p} = await open();
  let ok = 0, ko = 0;
  const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK   ' : 'ÉCHEC'} ${id}  ${m}`); };
  const remplir = (sel, o) => p.evaluate(([s, o]) => { const f = document.querySelector(s); for (const [k, v] of Object.entries(o)) { const e = f.querySelector(`[name="${k}"]`); if (!e) continue;
    if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('input', {bubbles: true})); e.dispatchEvent(new Event('change', {bubbles: true})); } }, [sel, o]);
  const envoyer = sel => p.evaluate(s => document.querySelector(s).requestSubmit(), sel);
  const err = () => p.evaluate(() => [...document.querySelectorAll('.champ-err, [role="alert"], .f-err, .err, .f-zone-err, .f-etat, .form-err-box')].map(e => e.innerText).join(' | '));
  const attendre = (fn, ms = 10000) => p.waitForFunction(fn, null, {timeout: ms}).then(() => true, () => false);

  // F1. Accueil → profil pré-coché
  await goto(p, '#/'); await p.waitForTimeout(400);
  await p.click('a.hx-pill-gold'); await p.waitForTimeout(500);
  T('F1a', await p.evaluate(() => (document.querySelector('#wiz input[name="role"]:checked') || {}).value) === 'owner', 'Accueil « Publier un bien » → Propriétaire coché');
  await p.evaluate(() => { location.hash = '#/register?role=agency'; }); await p.waitForTimeout(500);
  T('F1b', await p.evaluate(() => (document.querySelector('#wiz input[name="role"]:checked') || {}).value) === 'agency', '« Créer un compte agence » → Agence cochée');
  T('F1c', await p.evaluate(() => !/démonstration|fictif|paiement/i.test(document.querySelector('#wiz').innerText)), 'Aucune mention de démonstration, de numéro fictif ni de paiement');

  // F2. Inscription d'un client : contrôles, code par e-mail, session
  await goto(p, '#/login'); await goto(p, '#/register'); await p.waitForTimeout(500);
  const email = `awa.${S}@deuksil.test`, cni = '19' + String(Date.now()).slice(-11);
  await p.click('#wiz-next'); await p.waitForTimeout(250);
  await remplir('#wiz', {firstName: 'Awa', lastName: 'Ndiaye', email: 'pas-une-adresse', phone: '77 123 45 67', cni});
  await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2a', /e-mail/i.test(await err()) && await p.evaluate(() => document.querySelector('#wiz').dataset.cur) === '2', 'E-mail invalide : bloqué à l\'étape 2');
  await remplir('#wiz', {email, phone: '12345'}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2b', /téléphone/i.test(await err()), 'Téléphone invalide : refusé');
  await remplir('#wiz', {phone: '77 123 45 67', cni: '123'}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2c', /13 chiffres/.test(await err()), 'CNI incomplète : refusée');
  await remplir('#wiz', {cni}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2d', await p.evaluate(() => document.querySelector('#wiz').dataset.cur) === '3', 'Étape 2 correcte : passage à l\'étape 3');
  await remplir('#wiz', {password: 'abcdefgh', password2: 'abcdefgh', cgu: true}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2e', /faible|chiffre/i.test(await err()), 'Mot de passe sans chiffre : refusé');
  await remplir('#wiz', {password: 'Teranga2026', password2: 'Teranga2027'}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2f', /correspondent pas/i.test(await err()), 'Confirmation différente : refusée');
  await remplir('#wiz', {password2: 'Teranga2026', cgu: false}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2g', /conditions/i.test(await err()), 'Conditions non acceptées : refusé');
  const n0 = nbMails();
  await remplir('#wiz', {cgu: true}); await envoyer('#wiz');
  T('F2h', await attendre(() => location.hash === '#/verifier-email'), 'Inscription envoyée → page « Vérifiez votre adresse e-mail »');
  const c1 = await code(email, n0);
  T('F2i', !!c1, 'Code à 6 chiffres reçu par e-mail');
  await remplir('form[data-action="email-verif"]', {email, code: '000000'}); await envoyer('form[data-action="email-verif"]'); await p.waitForTimeout(1200);
  T('F2j', await p.evaluate(() => !Auth.current()), 'Mauvais code : refusé');
  await remplir('form[data-action="email-verif"]', {email, code: c1}); await envoyer('form[data-action="email-verif"]');
  T('F2k', await attendre(() => Auth.current() && Auth.current().role === 'client'), 'Bon code : adresse confirmée, session ouverte (client)');
  const pr = (await db.query('select role, cni, cgu_acceptees_le, phone from public.profiles where email = $1', [email])).rows[0];
  T('F2l', pr && pr.role === 'client' && pr.cni === cni && !!pr.cgu_acceptees_le, 'Profil en base : rôle client, CNI, CGU datées');

  // F3. Connexion / déconnexion avec l'adresse choisie
  await logout(p); await goto(p, '#/login'); await p.waitForTimeout(300);
  T('F3a', await p.evaluate(() => /e-mail/i.test((document.querySelector('label[for="au-cni"]') || {}).textContent || '') && (document.querySelector('.auth-forgot') || {}).getAttribute('href') === '#/mot-de-passe-oublie'), 'Page de connexion : « Adresse e-mail », lien « Mot de passe oublié »');
  const r1 = await p.evaluate(async e => (await Auth.login(e, 'Faux-mot-2026')).error || '', email);
  T('F3b', /incorrect/i.test(r1), 'Mauvais mot de passe : refusé (« ' + r1.slice(0, 60) + ' »)');
  const r2 = await p.evaluate(async e => (await Auth.login(e, 'Teranga2026')).error || '', email);
  T('F3c', !r2 && await p.evaluate(() => !!Auth.current()), 'Connexion avec l\'adresse et le mot de passe choisis');

  // F4. Mot de passe oublié : code, nouveau mot de passe
  await logout(p); await goto(p, '#/mot-de-passe-oublie'); await p.waitForTimeout(300);
  const n1 = nbMails();
  await remplir('form[data-action="mdp-oubli"]', {email}); await envoyer('form[data-action="mdp-oubli"]');
  T('F4a', await attendre(() => /Code envoyé/.test(document.body.innerText)), 'Demande de code : confirmation (sans révéler si le compte existe)');
  const c2 = await code(email, n1);
  await goto(p, '#/reinitialiser-mot-de-passe'); await p.waitForTimeout(300);
  await remplir('form[data-action="mdp-reinit"]', {email, code: c2 || '', nouveau: 'Nouveau2031', confirme: 'Nouveau2031'}); await envoyer('form[data-action="mdp-reinit"]');
  T('F4b', !!c2 && await attendre(() => location.hash !== '#/reinitialiser-mot-de-passe' && !!Auth.current() && /Mot de passe modifié/.test(document.getElementById('toasts').innerText)), 'Code reçu, nouveau mot de passe enregistré, retour à l\'espace du compte');
  await logout(p);
  const r3 = await p.evaluate(async e => (await Auth.login(e, 'Nouveau2031')).error || '', email);
  T('F4c', !r3, 'Connexion avec le nouveau mot de passe');
  await logout(p);

  // F5. Agence complète
  const ea = `agence.${S}@deuksil.test`, n2 = nbMails();
  await p.evaluate(() => { location.hash = '#/register?role=agency'; }); await p.waitForTimeout(500);
  await remplir('#wiz', {agencyName: 'Keur Immo Test', address: 'Saly Portudal, Mbour', ninea: '0012345678 2V2', firstName: 'Modou', lastName: 'Fall', email: ea, phone: '+221 78 555 44 33',
    cni: '18' + String(Date.now()).slice(-11), password: 'KeurImmo2026', password2: 'KeurImmo2026', cgu: true});
  await envoyer('#wiz'); await attendre(() => location.hash === '#/verifier-email');
  const c3 = await code(ea, n2);
  await remplir('form[data-action="email-verif"]', {email: ea, code: c3 || ''}); await envoyer('form[data-action="email-verif"]');
  await attendre(() => Auth.current());
  const ag = (await db.query('select role, agency_name, ninea from public.profiles where email = $1', [ea])).rows[0];
  T('F5', ag && ag.role === 'agency' && ag.agency_name === 'Keur Immo Test' && ag.ninea === '0012345678 2V2' && await p.evaluate(() => location.hash) === '#/agency/dashboard', 'Agence inscrite (nom, NINEA) et dirigée vers son tableau de bord');

  // F6. Photos : 20 au plus (agence connectée)
  await goto(p, '#/owner/property/new'); await p.waitForTimeout(600);
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#0C2745'; x.fillRect(0, 0, 800, 600); return c.toDataURL('image/jpeg', 0.8).split(',')[1]; });
  const fichiers = Array.from({length: 23}, (_, i) => ({name: `photo${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(png, 'base64')}));
  const champ = await p.$('[data-action="photos-input"]');
  if (champ) { await p.setInputFiles('[data-action="photos-input"]', fichiers); await p.waitForTimeout(4000); }
  const ph = await p.evaluate(() => typeof formPhotos !== 'undefined' ? {n: formPhotos.length, dis: document.querySelector('[data-action="photos-input"]').disabled} : null);
  T('F6', ph && ph.n === 20 && ph.dis, `23 photos choisies → ${ph && ph.n} gardées, ajout désactivé`);
  await logout(p);

  // F7. Contact (visiteur) : enregistré, administration notifiée
  await p.evaluate(() => { location.hash = '#/contact?sujet=acces'; }); await p.waitForTimeout(500);
  T('F7a', await p.evaluate(() => (document.querySelector('[name="subject"]') || {}).value) === 'acces', 'Lien d\'assistance : sujet présélectionné');
  const mc = `contact.${S}@deuksil.test`;
  await remplir('form[data-action="contact-form"]', {name: 'Awa Ndiaye', email: mc, message: 'court'}); await envoyer('form[data-action="contact-form"]'); await p.waitForTimeout(300);
  T('F7b', /court/.test(await err()), 'Message trop court : refusé');
  await remplir('form[data-action="contact-form"]', {message: 'Je n\'arrive plus à me connecter à mon compte propriétaire.'}); await envoyer('form[data-action="contact-form"]');
  await attendre(() => /envoyé/i.test(document.body.innerText), 8000);
  const cm = (await db.query(`select m.statut, (select count(*) from public.notifications n join public.profiles a on a.id = n.user_id and a.role = 'admin' where n.text like '%' || m.email || '%') as notif
     from public.contact_messages m where m.email = $1`, [mc])).rows[0];
  T('F7c', cm && cm.statut === 'nouveau' && +cm.notif > 0, 'Message enregistré (statut « nouveau »), administration notifiée');

  T('JS', p.errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(p.errs));
  console.log(`\n${ok}/${ok + ko} vérifications réussies`);
  await db.end(); await b.close(); process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
