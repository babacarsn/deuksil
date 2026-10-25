// Ouverture d'accès par un tiers (locataire, membre d'équipe, mandant) — parcours
// réels dans l'interface, contre la base de TEST. Vérifie : adresse e-mail réelle
// exigée, mot de passe provisoire affiché une fois, rattachement à un compte
// existant uniquement s'il y a une relation, première connexion → nouveau mot de passe.
const {open, loginAs, logout, goto, enregistre, emailDe} = require('./harnais.js');
const OK = [], KO = [];
const verif = (c, m) => (c ? OK : KO).push(m);
const suffixe = Date.now().toString(36);

async function modalMotDePasse(p) {
  await p.waitForSelector('.modal .mdp-prov', {timeout: 15000});
  const mdp = await p.$eval('.modal .mdp-prov', e => e.textContent.trim());
  await p.click('.modal [data-action="close-modal"]'); return mdp;
}
const dernierToast = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).pop() || '');

(async () => {
  const {b, p} = await open();
  // --- 1. Propriétaire : nouveau bail, accès d'un locataire sans compte ----------------
  await loginAs(p, '1900000000003');
  const bail = await p.evaluate(async () => {
    const u = Auth.current(), bien = myProps(u).find(x => !DB.findItem(DB.K.leases, l => l.propertyId === x.id && l.status === 'actif'));
    const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: bien.id, tenant: 'Fatou Diop', phone: '771112233', rent: 150000, deposit: 150000, start: '2031-01-01', months: 12, status: 'actif'});
    await DB.attendre(); return l;
  });
  await goto(p, '#/manage/tenants'); await p.waitForTimeout(500);
  const form = `form[data-action="acces-loc"][data-id="${bail.id}"]`;
  verif(!!(await p.$(form)), 'Fiche locataire : formulaire « Ouvrir son accès » présent pour un bail sans compte');
  await p.fill(form + ' input[name="email"]', 'pas-une-adresse');
  await p.click(form + ' button'); await p.waitForTimeout(300);
  verif(!(await p.$('.modal .mdp-prov')), 'Adresse invalide : aucun compte créé');
  const email = `fatou.diop.${suffixe}@exemple-test.sn`;
  await p.fill(form + ' input[name="email"]', email);
  await p.click(form + ' button');
  let mdp = '';
  try { mdp = await modalMotDePasse(p); } catch (e) { KO.push('Mot de passe provisoire non affiché : ' + await dernierToast(p)); }
  verif(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{5}$/.test(mdp), 'Mot de passe provisoire généré par le serveur (' + mdp.replace(/./g, '•') + ')');
  await enregistre(p);
  const compte = await p.evaluate(id => DB.findItem(DB.K.users, u => u.leaseId === id || (u.leaseIds || []).includes(id)), bail.id);
  verif(compte && compte.role === 'tenant' && compte.email === email && compte.mdpProvisoire === true, 'Compte locataire créé, rattaché au bail, mot de passe provisoire');

  // --- 2. Rattachement à un compte existant -------------------------------------------
  const bail2 = await p.evaluate(async () => {
    const u = Auth.current(), bien = myProps(u).find(x => !DB.findItem(DB.K.leases, l => l.propertyId === x.id && l.status === 'actif'));
    const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: bien.id, tenant: 'Ibrahima Sarr', rent: 90000, start: '2031-02-01', months: 12, status: 'actif'});
    await DB.attendre(); return l;
  });
  const r1 = await p.evaluate(async ([l, e]) => { const ok = await ouvrirAccesLocataire(DB.findItem(DB.K.leases, l.id), e); return ok; }, [bail2, emailDe('1900000000005')]);
  verif(r1 === true, 'Client qui a demandé une visite : bail rattaché à son compte existant (pas de second compte)');
  const bail3 = await p.evaluate(async () => {
    const u = Auth.current(), bien = myProps(u).find(x => !DB.findItem(DB.K.leases, l => l.propertyId === x.id && l.status === 'actif'));
    const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: bien.id, tenant: 'Astou Faye', rent: 90000, start: '2031-03-01', months: 12, status: 'actif'});
    await DB.attendre(); return l;
  });
  const r2 = await p.evaluate(async ([l, e]) => ouvrirAccesLocataire(DB.findItem(DB.K.leases, l.id), e), [bail3, emailDe('1900000000301')]);
  const t2 = await dernierToast(p);
  verif(r2 === false && /doit d'abord vous contacter/.test(t2), 'Compte existant SANS relation : rattachement refusé (« ' + t2.slice(0, 70) + '… »)');

  // --- 3. Membre d'équipe : e-mail exigé, mot de passe provisoire -----------------------
  await goto(p, '#/manage/team'); await p.waitForTimeout(400);
  const fm = 'form[data-action="g4-member"]';
  await p.fill(fm + ' [name="firstName"]', 'Awa'); await p.fill(fm + ' [name="lastName"]', 'Test' + suffixe);
  await p.fill(fm + ' [name="email"]', `awa.${suffixe}@exemple-test.sn`); await p.fill(fm + ' [name="phone"]', '770009988');
  verif(!(await p.$(fm + ' [name="password"]')), 'Formulaire équipe : pas de mot de passe saisi par le titulaire');
  await p.click(fm + ' button.btn');
  let mdpM = ''; try { mdpM = await modalMotDePasse(p); } catch (e) { KO.push('Membre : mot de passe non affiché : ' + await dernierToast(p)); }
  verif(!!mdpM, 'Membre d\'équipe créé avec un mot de passe provisoire');

  // --- 4. Première connexion du locataire : choix du mot de passe imposé ----------------
  await p.evaluate(async () => { await Auth.logout(true); });
  const r = await p.evaluate(async ([e, m]) => { const r = await Auth.login(e, m); return r.error || null; }, [email, mdp]);
  verif(!r, 'Connexion du locataire avec le mot de passe provisoire' + (r ? ' : ' + r : ''));
  if (process.env.TRACE) p.on('response', async x => { if (/\/(auth|rest)\/v1/.test(x.url())) console.log('TRACE', x.status(), x.request().method(), x.url().slice(22, 110), x.status() >= 400 ? (await x.text().catch(() => '')).slice(0, 160) : ''); });
  await goto(p, '#/tenant/home'); await p.waitForTimeout(600);
  verif(await p.evaluate(() => location.hash === '#/mot-de-passe'), 'Première connexion : redirigé vers « choisir son mot de passe »');
  if (process.env.TRACE) console.log('ÉTAT', await p.evaluate(() => JSON.stringify({h: location.hash, u: Auth.current() && {role: Auth.current().role, mdp: Auth.current().mdpProvisoire}, t: [...document.querySelectorAll('.toast')].map(t => t.textContent)})));
  await p.fill('#mdp1-nouveau', 'Nouveau-Mdp-2031'); await p.fill('#mdp1-confirme', 'Nouveau-Mdp-2031');
  await p.click('form[data-action="mdp-premier"] button.btn'); await p.waitForFunction(() => location.hash !== '#/mot-de-passe', null, {timeout: 15000}).catch(() => {}); await enregistre(p);
  const etatMdp = await p.evaluate(() => ({h: location.hash, t: [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' / '), e: DB.erreurs.map(x => x.contexte + ' ' + x.message).join(' / ')}));
  verif(etatMdp.h !== '#/mot-de-passe', 'Mot de passe personnel enregistré, accès à l\'espace' + (etatMdp.h === '#/mot-de-passe' ? ' — ' + JSON.stringify(etatMdp) : ''));

  // --- 5. Agence : accès d'un propriétaire mandant ---------------------------------------
  await logout(p); await loginAs(p, '1900000000004');
  const fiche = await p.evaluate(async () => { const u = Auth.current(); const f = DB.addItem(DB.K.owners, {ownerId: u.id, name: 'Moustapha Test', phone: '770001122', status: 'actif'}); await DB.attendre(); return f; });
  await goto(p, '#/manage/owners'); await p.waitForTimeout(700);
  const bt = `[data-action="acces-mandant"][data-id="${fiche.id}"]`;
  verif(!!(await p.$(bt)), 'Propriétaires de l\'agence : bouton « Ouvrir l\'accès » pour une fiche sans compte');
  if (await p.$(bt)) {
    await p.click(bt); await p.waitForSelector('.modal input', {timeout: 5000});
    await p.fill('.modal input', `moustapha.${suffixe}@exemple-test.sn`); await p.click('.modal .btn:not(.ghost)');
    let mdpA = ''; try { mdpA = await modalMotDePasse(p); } catch (e) { KO.push('Mandant : mot de passe non affiché : ' + await dernierToast(p)); }
    verif(!!mdpA, 'Accès mandant créé avec un mot de passe provisoire');
  }
  verif(p.errs.length === 0, 'Aucune erreur JavaScript' + (p.errs.length ? ' : ' + p.errs.join(' | ') : ''));
  console.log(OK.map(m => 'OK    ' + m).join('\n')); console.log(KO.map(m => 'ÉCHEC ' + m).join('\n'));
  console.log(`\n${OK.length}/${OK.length + KO.length} vérifications réussies`); if (p.refus.length) console.log('Requêtes refusées :', p.refus.join('\n  '));
  await b.close(); process.exit(KO.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
