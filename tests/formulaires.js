// Formulaires de compte prêts pour la mise en ligne (js/99g-formulaires.js, 38-ds3, 46, 47, 24).
const {open, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.waitForTimeout(3000);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const err = () => p.evaluate(() => [...document.querySelectorAll('.champ-err')].map(x => x.textContent).join(' | '));
  const remplir = (sel, o) => p.evaluate(([sel, o]) => { const f = document.querySelector(sel); Object.entries(o).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (!i) return; if (i.type === 'checkbox') i.checked = !!v; else i.value = v; }); }, [sel, o]);
  const envoyer = sel => p.evaluate(s => document.querySelector(s).requestSubmit(), sel);

  // F1. Accueil → « Publier un bien » / « Créer un compte agence » : profil coché
  await goto(p, '#/'); await p.waitForTimeout(500);
  await p.click('a.hx-pill-gold'); await p.waitForTimeout(500);
  T('F1a', await p.evaluate(() => (document.querySelector('#wiz input[name="role"]:checked') || {}).value) === 'owner', 'Publier un bien → Propriétaire coché');
  await goto(p, '#/'); await p.waitForTimeout(500);
  await p.click('a.hx-pill-navy'); await p.waitForTimeout(500);
  const ag = await p.evaluate(() => ({r: (document.querySelector('#wiz input[name="role"]:checked') || {}).value, vis: !document.querySelector('#agency-fields').classList.contains('hidden'), req: document.querySelector('[name="agencyName"]').required}));
  T('F1b', ag.r === 'agency' && ag.vis && ag.req, 'Créer un compte agence → Agence cochée, champs agence actifs et obligatoires');
  await goto(p, '#/'); await p.waitForTimeout(300); await goto(p, '#/register'); await p.waitForTimeout(400);
  T('F1c', await p.evaluate(() => (document.querySelector('#wiz input[name="role"]:checked') || {}).value) === 'client', 'Lien « Créer un compte » simple → Client coché');
  T('F1d', await p.evaluate(() => !/démonstration|fictif|paiement/i.test(document.querySelector('#wiz').innerText)), 'Plus aucune mention de démonstration, de numéro fictif ni de paiement');

  // F2. Contrôles de l'inscription
  await p.click('#wiz-next'); await p.waitForTimeout(250);
  await remplir('#wiz', {firstName: 'Awa', lastName: 'Ndiaye', email: 'pas-une-adresse', phone: '77 123 45 67', cni: '1999999999401'});
  await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2a', /e-mail invalide/i.test(await err()) && await p.evaluate(() => document.querySelector('#wiz').dataset.cur) === '2', 'E-mail invalide : bloqué à l\'étape 2, message sous le champ');
  const mailPris = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.email).email);
  await remplir('#wiz', {email: mailPris}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2b', /existe déjà avec cette adresse/i.test(await err()), 'E-mail déjà utilisé : refusé');
  await remplir('#wiz', {email: 'awa.ndiaye@exemple.sn', phone: '12345'}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2c', /téléphone invalide/i.test(await err()), 'Téléphone invalide : refusé');
  await remplir('#wiz', {phone: '77 123 45 67', cni: '123'}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2d', /13 chiffres/.test(await err()), 'CNI incomplète : refusée');
  await remplir('#wiz', {cni: '1999999999401'}); await p.click('#wiz-next'); await p.waitForTimeout(250);
  T('F2e', await p.evaluate(() => document.querySelector('#wiz').dataset.cur) === '3', 'Étape 2 correcte : passage à l\'étape 3');
  await remplir('#wiz', {password: 'abcdefgh', password2: 'abcdefgh', cgu: true}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2f', /trop faible/i.test(await err()), 'Mot de passe sans chiffre : refusé');
  await remplir('#wiz', {password: 'Teranga2026', password2: 'Teranga2027'}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2g', /ne correspondent pas/i.test(await err()), 'Confirmation différente : refusée');
  await remplir('#wiz', {password2: 'Teranga2026', cgu: false}); await envoyer('#wiz'); await p.waitForTimeout(300);
  T('F2h', /conditions d'utilisation/i.test(await err()), 'Conditions non acceptées : refusé');
  await remplir('#wiz', {cgu: true}); await envoyer('#wiz'); await p.waitForTimeout(900);
  const cree = await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1999999999401'); return u && {role: u.role, email: u.email, cgu: !!u.cguAccepteesLe, clair: 'password' in u, connecte: (Auth.current() || {}).id === u.id}; });
  T('F2i', cree && cree.role === 'client' && cree.email === 'awa.ndiaye@exemple.sn' && cree.cgu && !cree.clair && cree.connecte, 'Compte créé avec son e-mail, CGU datées, mot de passe non stocké en clair, session ouverte');
  await p.evaluate(() => { localStorage.removeItem(DB.K.session); }); await goto(p, '#/login'); await p.waitForTimeout(300);
  await remplir('form[data-action="login"]', {cni: 'awa.ndiaye@exemple.sn', password: 'Teranga2026'}); await envoyer('form[data-action="login"]'); await p.waitForTimeout(600);
  T('F2j', await p.evaluate(() => (Auth.current() || {}).cni) === '1999999999401', 'Connexion avec l\'adresse e-mail choisie à l\'inscription');

  // F3. Agence complète
  await p.evaluate(() => localStorage.removeItem(DB.K.session)); await p.evaluate(() => { location.hash = '#/register?role=agency'; }); await p.waitForTimeout(500);
  await remplir('#wiz', {agencyName: 'Keur Immo Saly', address: 'Saly Portudal, Mbour', ninea: '0012345678 2V2', firstName: 'Modou', lastName: 'Fall', email: 'contact@keurimmo.sn', phone: '+221 78 555 44 33', cni: '1999999999402', password: 'KeurImmo2026', password2: 'KeurImmo2026', cgu: true});
  await envoyer('#wiz'); await p.waitForTimeout(900);
  const a = await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1999999999402'); return u && {role: u.role, n: u.agencyName, ninea: u.ninea, h: location.hash}; });
  T('F3', a && a.role === 'agency' && a.n === 'Keur Immo Saly' && a.ninea === '0012345678 2V2' && a.h === '#/agency/dashboard', 'Agence inscrite (nom, NINEA) et dirigée vers son tableau de bord');
  await p.evaluate(() => localStorage.removeItem(DB.K.session));

  // F4. Connexion : libellés réels, mot de passe oublié en page dédiée, Google non configuré
  await goto(p, '#/login'); await p.waitForTimeout(300);
  const lg = await p.evaluate(() => ({lab: document.querySelector('label[for="au-cni"]').textContent, href: document.querySelector('.auth-forgot').getAttribute('href')}));
  T('F4a', lg.lab === 'Adresse e-mail' && lg.href === '#/mot-de-passe-oublie', 'Libellé « Adresse e-mail » ; « Mot de passe oublié ? » → page dédiée');
  await p.click('[data-action="g-choose"]'); await p.waitForTimeout(300);
  const g = await p.evaluate(() => ({t: (document.querySelector('.modal') || {}).innerText || '', comptes: document.querySelectorAll('[data-action="g-pick"]').length}));
  T('F4b', /pas encore activée/.test(g.t) && g.comptes === 0, 'Google sans identifiant client : message clair, plus de faux sélecteur de comptes');
  await p.evaluate(() => closeModal());
  const jwt = await p.evaluate(() => { DEUKSIL_CONFIG.googleClientId = 'test.apps.googleusercontent.com';
    const u = DB.findItem(DB.K.users, x => x.cni === '1900000000003'), b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    return 'x.' + b64({iss: 'https://accounts.google.com', aud: 'test.apps.googleusercontent.com', exp: Math.floor(Date.now() / 1000) + 600, email: u.email, email_verified: true, given_name: 'X'}) + '.sig'; });
  await p.evaluate(j => recevoirJetonGoogle({credential: j}), jwt); await p.waitForTimeout(500);
  T('F4c', await p.evaluate(() => (Auth.current() || {}).cni) === '1900000000003', 'Jeton Google valide d\'une adresse connue : session ouverte sur le bon compte');
  await p.evaluate(() => localStorage.removeItem(DB.K.session));
  const jwt2 = await p.evaluate(() => { const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, ''); return 'x.' + b64({iss: 'accounts.google.com', aud: 'test.apps.googleusercontent.com', exp: Math.floor(Date.now() / 1000) + 600, email: 'nouveau.venu@gmail.com', email_verified: true, given_name: 'Nouveau', family_name: 'Venu'}) + '.sig'; });
  await p.evaluate(j => recevoirJetonGoogle({credential: j}), jwt2); await p.waitForTimeout(600);
  const pre = await p.evaluate(() => ({h: location.hash, e: (document.querySelector('#wiz [name="email"]') || {}).value, n: (document.querySelector('#wiz [name="firstName"]') || {}).value}));
  T('F4d', pre.h === '#/register' && pre.e === 'nouveau.venu@gmail.com' && pre.n === 'Nouveau', 'Adresse Google inconnue : inscription pré-remplie');
  const jwt3 = await p.evaluate(() => { const b64 = o => btoa(JSON.stringify(o)).replace(/=+$/, ''); return 'x.' + b64({iss: 'accounts.google.com', aud: 'autre-appli', exp: Math.floor(Date.now() / 1000) + 600, email: 'nouveau.venu@gmail.com'}) + '.sig'; });
  await p.evaluate(j => recevoirJetonGoogle({credential: j}), jwt3); await p.waitForTimeout(300);
  T('F4e', await p.evaluate(() => !Auth.current()), 'Jeton destiné à une autre application : refusé');
  await p.evaluate(() => { DEUKSIL_CONFIG.googleClientId = ''; });

  // F5. Mot de passe oublié / réinitialisation / vérification (sans serveur)
  await goto(p, '#/mot-de-passe-oublie'); await p.waitForTimeout(300);
  await remplir('form[data-action="mdp-oubli"]', {identifiant: 'abc'}); await envoyer('form[data-action="mdp-oubli"]'); await p.waitForTimeout(200);
  T('F5a', /adresse e-mail valide/.test(await err()), 'Identifiant invalide : refusé');
  await remplir('form[data-action="mdp-oubli"]', {identifiant: 'awa.ndiaye@exemple.sn'}); await envoyer('form[data-action="mdp-oubli"]'); await p.waitForTimeout(200);
  T('F5b', await p.evaluate(() => /pas encore activé/.test((document.querySelector('.f-etat.info') || {}).innerText || '') && !!document.querySelector('.f-etat a[href="#/contact?sujet=acces"]')), 'Sans serveur : le formulaire le dit et propose l\'assistance');
  await goto(p, '#/reinitialiser-mot-de-passe'); await p.waitForTimeout(300);
  T('F5c', await p.evaluate(() => document.querySelector('[name="identifiant"]').value) === 'awa.ndiaye@exemple.sn', 'Page « Nouveau mot de passe » : identifiant repris');
  await remplir('form[data-action="mdp-reinit"]', {code: '12', nouveau: 'Nouveau2026', confirme: 'Nouveau2026'}); await envoyer('form[data-action="mdp-reinit"]'); await p.waitForTimeout(200);
  T('F5d', /6 chiffres/.test(await err()), 'Code incomplet : refusé');
  // Avec un serveur (simulé) : les bonnes routes sont appelées
  await p.evaluate(() => { DEUKSIL_CONFIG.apiBase = 'https://api.exemple.test'; window.__appels = []; window.fetch = async (u, o) => { __appels.push([u, JSON.parse(o.body)]); return {ok: true, json: async () => ({})}; }; });
  await remplir('form[data-action="mdp-reinit"]', {code: '123456'}); await envoyer('form[data-action="mdp-reinit"]'); await p.waitForTimeout(300);
  const ap = await p.evaluate(() => ({a: __appels, ok: /Mot de passe modifié/.test((document.querySelector('.f-etat.ok') || {}).innerText || '')}));
  T('F5e', ap.a.length === 1 && ap.a[0][0] === 'https://api.exemple.test/auth/password/reset' && ap.a[0][1].code === '123456' && ap.ok, 'Avec serveur : POST /auth/password/reset puis confirmation');
  await goto(p, '#/mot-de-passe-oublie'); await p.waitForTimeout(300);
  await remplir('form[data-action="mdp-oubli"]', {identifiant: '77 123 45 67'}); await envoyer('form[data-action="mdp-oubli"]'); await p.waitForTimeout(300);
  T('F5f', await p.evaluate(() => __appels.at(-1)[0].endsWith('/auth/password/forgot') && /par SMS/.test(document.querySelector('.f-etat.ok').innerText)), 'Avec serveur : demande de code par téléphone → « par SMS »');
  await p.evaluate(() => { window.fetch = async () => ({ok: false, status: 400, json: async () => ({message: 'Code expiré.'})}); });
  await goto(p, '#/verifier-email'); await p.waitForTimeout(300);
  await remplir('form[data-action="email-verif"]', {email: 'awa.ndiaye@exemple.sn', code: '000000'}); await envoyer('form[data-action="email-verif"]'); await p.waitForTimeout(300);
  T('F5g', await p.evaluate(() => /Code expiré/.test((document.querySelector('.f-etat.bad') || {}).innerText || '')), 'Erreur du serveur affichée telle quelle');
  await p.evaluate(() => { DEUKSIL_CONFIG.apiBase = ''; });

  // F6. Contact
  await goto(p, '#/'); await p.waitForTimeout(300);
  T('F6a', await p.evaluate(() => !!document.querySelector('footer a[href="#/contact"]')), 'Pied de page : « Nous écrire » → page Contact');
  await p.evaluate(() => { location.hash = '#/contact?sujet=acces'; }); await p.waitForTimeout(400);
  T('F6b', await p.evaluate(() => document.querySelector('[name="subject"]').value) === 'acces', 'Lien d\'assistance : sujet « Accès à mon compte » présélectionné');
  await remplir('form[data-action="contact-form"]', {name: 'Awa Ndiaye', email: 'awa@exemple.sn', message: 'court'}); await envoyer('form[data-action="contact-form"]'); await p.waitForTimeout(200);
  T('F6c', /trop court/.test(await err()), 'Message trop court : refusé');
  await remplir('form[data-action="contact-form"]', {message: 'Je n\'arrive plus à me connecter à mon compte propriétaire.'}); await envoyer('form[data-action="contact-form"]'); await p.waitForTimeout(400);
  const c = await p.evaluate(() => ({n: DB.getData(DB.K.contacts).length, notif: DB.getData(DB.K.notifications).some(x => x.userId === 'user_admin' && /Contact · Accès à mon compte — Awa Ndiaye/.test(x.text || x.message || '')), ok: /Message envoyé/.test((document.querySelector('.f-etat.ok') || {}).innerText || '')}));
  T('F6d', c.n === 1 && c.notif && c.ok, 'Message enregistré, administration notifiée, confirmation affichée');

  // F7. Photos : 20 maximum
  await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1900000000004'); localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()})); });
  await goto(p, '#/owner/property/new'); await p.waitForTimeout(500);
  T('F7a', await p.evaluate(() => MAX_PHOTOS === 20 && /jusqu'à 20 photos/.test(document.querySelector('[data-action="photos-input"]').closest('.upload-btn').innerText)), 'Agence : jusqu\'à 20 photos annoncées');
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 1600; c.height = 1200; const x = c.getContext('2d'); for (let i = 0; i < 400; i++) { x.fillStyle = `hsl(${i * 7},60%,${30 + i % 40}%)`; x.fillRect(Math.random() * 1600, Math.random() * 1200, 200, 150); } return c.toDataURL('image/jpeg', .9).split(',')[1]; });
  const fichiers = Array.from({length: 23}, (_, i) => ({name: `photo${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(png, 'base64')}));
  await p.setInputFiles('[data-action="photos-input"]', fichiers); await p.waitForTimeout(4000);
  const ph = await p.evaluate(() => ({n: formPhotos.length, max: Math.max(...formPhotos.map(s => s.length)), dis: document.querySelector('[data-action="photos-input"]').disabled}));
  T('F7b', ph.n === 20 && ph.dis, `23 photos choisies → 20 gardées, ajout désactivé (photo la plus lourde : ${Math.round(ph.max / 1024)} Ko)`);
  await p.evaluate(() => localStorage.removeItem(DB.K.session));

  T('JS', p.errs.length === 0, 'aucune erreur JavaScript ' + JSON.stringify(p.errs));
  console.log(`\n${ok}/${ok + ko} erreurs JS ${JSON.stringify(p.errs)}`);
  await b.close(); process.exit(ko ? 1 : 0);
})();
