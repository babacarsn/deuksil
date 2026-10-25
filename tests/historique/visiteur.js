// Visiteur sans compte : aucune coordonnée, connexion d'abord ; inscription Client/Propriétaire/Agence ;
// le client inscrit revient sur l'annonce et peut agir ; un bail fait du client un locataire.
const {open, APP, loginAs, goto} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  await p.goto(APP + '#/login'); await p.waitForTimeout(800);
  t(await p.evaluate(() => ['cni', 'password'].every(n => { const i = document.querySelector(`form[data-action="login"] [name="${n}"]`); return !i.dataset.ic && getComputedStyle(i).backgroundImage === 'none'; })), 'Connexion : plus d\'icône superposée');
  await p.goto(APP + '#/register'); await p.waitForTimeout(700);
  const roles = await p.$$eval('#wiz input[name="role"]', l => l.map(x => x.value + (x.checked ? '*' : '')));
  t(roles.join() === 'client*,owner,agency', 'Inscription : Client (coché), Propriétaire, Agence → ' + roles.join());
  await p.goto(APP + '#/search'); await p.waitForTimeout(800);
  const tabs = await p.$$eval('[data-action="set-transaction"]', l => l.map(x => x.innerText.trim()));
  t(!tabs.includes('Terrains') && !tabs.includes('Terrain'), 'Recherche : plus de puce Terrains');
  const P = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.listingStatus === 'publiee' && x.status === 'disponible' && (DB.findItem(DB.K.users, x.ownerId) || {}).role === 'owner').id);
  const tel = await p.evaluate(pid => { const o = DB.findItem(DB.K.users, DB.findItem(DB.K.properties, pid).ownerId); return String(o.phone).replace(/\D/g, '').slice(-7); }, P);
  for (const act of ['call-owner', 'contact', 'ask-visit', 'toggle-fav']) {
    await p.goto(APP + '#/property/' + P); await p.waitForTimeout(800);
    const vis = await p.evaluate(a => { const b = document.querySelector(`[data-action="${a}"]`); return !!b && !!b.offsetParent; }, act);
    await p.evaluate(a => document.querySelector(`[data-action="${a}"]`).click(), act); await p.waitForTimeout(500);
    const r = await p.evaluate(t => ({h: location.hash, num: document.body.innerText.replace(/\D/g, '').includes(t), modal: !!document.querySelector('.modal')}), tel);
    t(vis && r.h === '#/login' && !r.modal, `Visiteur « ${act} » : bouton visible → page de connexion, rien d'autre`);
  }
  t(await p.evaluate(t => !document.querySelector('#app').innerText.replace(/\D/g, '').includes(t), tel), 'Aucun numéro de l\'annonceur affiché au visiteur');
  t(await p.evaluate(() => DB.getData(DB.K.visits).every(v => v.clientId)), 'Aucune visite créée sans compte');
  // Créer un compte client → retour sur l'annonce
  await p.evaluate(() => { location.hash = '#/register'; }); await p.waitForTimeout(700);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="register"]');
    Object.entries({cni: '1999999999555', firstName: 'Awa', lastName: 'Nouvelle', phone: '775554433', password: 'Secret-555', password2: 'Secret-555', email: 'awa.nouvelle555@exemple.sn', cgu: true}).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) { if (i.type === 'checkbox') i.checked = !!v; else i.value = v; } }); f.requestSubmit(); });
  await p.waitForTimeout(1200);
  const u = await p.evaluate(() => Auth.current() && {role: Auth.current().role, id: Auth.current().id});
  t(u && u.role === 'client', 'Compte client créé et connecté');
  t(await p.evaluate(pid => location.hash === annonceHref(DB.findItem(DB.K.properties, pid)), P), 'Retour automatique sur l\'annonce consultée');
  await p.evaluate(() => document.querySelector('[data-action="ask-visit"]').click()); await p.waitForTimeout(500);
  t(await p.evaluate(() => !!document.querySelector('form[data-action="create-visit"]')), 'Connecté : la demande de visite s\'ouvre');
  await p.evaluate(() => document.querySelector('form[data-action="create-visit"] button').click()); await p.waitForTimeout(700);
  t(await p.evaluate(id => DB.getData(DB.K.visits).some(v => v.clientId === id), u.id), 'Visite enregistrée au nom du client');
  // Un bail fait du client un locataire
  await p.evaluate(([id, pid]) => { const pr = DB.findItem(DB.K.properties, pid); const bl = DB.addItem(DB.K.leases, {ownerId: pr.ownerId, propertyId: pid, tenant: 'Awa Nouvelle', phone: '775554433', rent: pr.price, status: 'actif', start: new Date().toISOString().slice(0, 10)});
    rattacherBail(DB.findItem(DB.K.users, id), bl); }, [u.id, P]);
  await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(300);
  t(await p.evaluate(id => DB.findItem(DB.K.users, id).role === 'tenant' && Auth.current().role === 'tenant', u.id), 'Avec un bail, le client devient locataire (même compte)');
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
