// Espace de l'agent : menu, tableau de bord, mes biens, visites et compte rendu,
// mes clients, mes commissions, mon profil, et ce qui lui reste interdit.
const {open, loginAs, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const val = (s, v) => p.evaluate(([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', {bubbles: true})); }, [s, v]);
  const envoyer = s => p.evaluate(s => document.querySelector(s).requestSubmit(), s);
  const AG = '1900000000012';
  const ids = await p.evaluate(ag => { const a = DB.getData(DB.K.users).find(u => u.cni === ag); const autre = DB.getData(DB.K.users).find(u => u.parentId === a.parentId && u.role === 'agent' && u.id !== a.id && u.status === 'actif');
    return {agent: a.id, agence: a.parentId, autre: autre && autre.id}; }, AG);
  // données : une visite passée acceptée sur un bien à vendre de l'agent, une demande d'un collègue, des honoraires
  await p.evaluate(({agent, agence, autre}) => {
    const props = DB.getData(DB.K.properties).filter(x => x.ownerId === agence && x.agentId === agent);
    let pv = props.find(x => x.transaction !== 'location' && x.status !== 'vendu'); if (!pv) { pv = props[0]; DB.updateItem(DB.K.properties, pv.id, {transaction: 'vente', status: 'disponible'}); }
    const client = DB.getData(DB.K.users).find(u => u.role === 'client');
    const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    DB.addItem(DB.K.visits, {clientId: client.id, propertyId: pv.id, ownerId: agence, status: 'acceptee', date: hier, time: '10:00', message: 'Test'});
    DB.addItem(DB.K.demandes, {ownerId: agence, name: 'Client du collègue', phone: '770000099', transaction: 'location', budget: 0, agentId: autre, status: 'active'});
    DB.addItem(DB.K.fees, {ownerId: agence, ref: 'HON-T-1', kind: 'location', propertyId: pv.id, ht: 300000, tva: 54000, ttc: 354000, agentId: agent, agentPart: 60000, status: 'paye', createdAt: new Date().toISOString()});
    DB.addItem(DB.K.fees, {ownerId: agence, ref: 'HON-T-2', kind: 'location', propertyId: pv.id, ht: 500000, tva: 0, ttc: 500000, agentId: autre, agentPart: 100000, status: 'paye', createdAt: new Date().toISOString()});
    window.__pv = pv.id;
  }, ids);
  await loginAs(p, AG); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(1500);

  // 1. Menu, barre du bas, tableau de bord
  const menu = await p.evaluate(() => MENUS[Auth.current().role].map(m => m[1]));
  T('M1', menu.join() === 'Tableau de bord,Mes biens,Mes visites,Mes clients,Messages,Mes commissions,Mon profil', `menu de l'agent : ${menu.join(' · ')}`);
  const barre = await p.evaluate(() => [...document.querySelectorAll('.tabbar a')].map(a => a.textContent.trim()));
  T('M2', barre.includes('Messages') && barre.includes('Visites'), `barre du bas : ${barre.join(' · ')}`);
  const dash = await p.evaluate(() => ({titre: document.querySelector('.hero-banner h1').textContent, interdits: [...document.querySelectorAll('.content a[href]')].map(a => a.getAttribute('href')).filter(h => /manage\/(owners|leases|mandates)|agency\/commissions/.test(h))}));
  T('D1', /journée|visite/.test(dash.titre) && !dash.interdits.length, `tableau de bord de l'agent (« ${dash.titre} »), aucun lien vers une page interdite`);
  T('D2', await p.evaluate(() => /compte rendu/.test(document.querySelector('.pd-todo:last-of-type, .content').textContent)), 'la visite passée sans compte rendu apparaît dans « À traiter »');

  // 2. Mes biens / toute l'agence ; bien publié attribué
  await goto(p, '#/agency/properties'); await p.waitForTimeout(800);
  const n1 = await p.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  await p.click('[data-action="agent-portee"][data-v="tous"]'); await p.waitForTimeout(500);
  const n2 = await p.evaluate(() => document.querySelectorAll('.table-wrap tbody tr').length);
  const nb = await p.evaluate(a => [DB.getData(DB.K.properties).filter(x => x.agentId === a).length], ids.agent);
  T('B1', n1 === nb[0] && n2 > n1, `« Mes biens » : ${n1}, « Toute l'agence » : ${n2}`);
  await p.click('[data-action="agent-portee"][data-v="miens"]');
  const nouveau = await p.evaluate(() => { const u = Auth.current(); return DB.addItem(DB.K.properties, {ownerId: u.id, title: 'Bien test agent', type: 'appartement', transaction: 'location', price: 100000, status: 'disponible', listingStatus: 'attente'}); });
  T('B2', nouveau.agentId === ids.agent, 'un bien publié par l\'agent lui est attribué');

  // 3. Compte rendu de visite avec offre → dossier de vente
  await goto(p, '#/agency/visits'); await p.waitForTimeout(800);
  const btn = await p.$('[data-action="agent-cr"]');
  T('V1', !!btn, 'bouton « Compte rendu » sur la visite passée');
  await btn.click(); await p.waitForTimeout(300);
  await val('form[data-action="agent-cr-ok"] [name="outcome"]', 'offre');
  T('V2', await p.evaluate(() => document.querySelector('[data-cr-offre]').style.display !== 'none'), 'le choix « A fait une offre » affiche le montant');
  await envoyer('form[data-action="agent-cr-ok"]'); await p.waitForTimeout(300);
  T('V3', !!(await p.$('form[data-action="agent-cr-ok"]')), 'offre sans montant refusée');
  await p.evaluate(() => { const i = document.querySelector('form[data-action="agent-cr-ok"] [name="offre"]'); i.value = '80000000'; document.querySelector('form[data-action="agent-cr-ok"] [name="note"]').value = 'Veut négocier'; });
  await envoyer('form[data-action="agent-cr-ok"]'); await p.waitForTimeout(500);
  const r = await p.evaluate(() => { const v = DB.getData(DB.K.visits).find(x => x.propertyId === window.__pv && x.message === 'Test'); const d = DB.getData(DB.K.deals).find(x => x.propertyId === window.__pv && x.stage === 'offre'); return {cr: v && v.cr, st: v && v.status, deal: d && {offer: d.offer, agentId: d.agentId}}; });
  T('V4', r.cr && r.cr.outcome === 'offre' && r.st === 'terminee', 'compte rendu enregistré, visite terminée');
  T('V5', r.deal && r.deal.offer === 80000000 && r.deal.agentId === ids.agent, `dossier de vente ouvert pour l'offre (${r.deal && r.deal.offer})`);

  // 4. Mes clients : seulement les siennes
  await goto(p, '#/agency/clients'); await p.waitForTimeout(800);
  T('C1', await p.evaluate(() => !document.body.textContent.includes('Client du collègue')), 'les demandes d\'un collègue ne sont pas visibles');
  T('C2', await p.evaluate(() => !document.querySelector('form[data-action="ag-demande"] [name="agentId"]')), 'pas de choix d\'agent : la demande est à lui');
  await p.evaluate(() => { const f = document.querySelector('form[data-action="ag-demande"]'); f.name.value = 'Prospect Agent'; f.phone.value = '771230000'; f.requestSubmit(); }); await p.waitForTimeout(400);
  T('C3', await p.evaluate(a => (DB.getData(DB.K.demandes).find(x => x.name === 'Prospect Agent') || {}).agentId === a, ids.agent), 'une demande créée par l\'agent lui est attribuée');

  // 5. Mes commissions : les siennes seulement
  await goto(p, '#/agent/commissions'); await p.waitForTimeout(700);
  const com = await p.evaluate(() => ({txt: document.querySelector('.content').textContent, n: document.querySelectorAll('.table-wrap tbody tr').length}));
  T('K1', /60\s?000/.test(com.txt.replace(/ | /g, ' ')) && !/100\s?000 FCFA/.test(com.txt.replace(/ | /g, ' ')) && com.n === 1, 'ses commissions (60 000 à recevoir), pas celles du collègue');

  // 6. Interdits
  for (const h of ['#/agency/commissions', '#/agency/agents', '#/manage/owners', '#/manage/rents']) { await goto(p, h); await p.waitForTimeout(400);
    T('I-' + h.split('/').pop(), await p.evaluate(h => location.hash !== h, h), `${h} refusé à l'agent`); }

  // 7. Profil : téléphone, mot de passe
  await goto(p, '#/agent/profil'); await p.waitForTimeout(600);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="agent-mdp"]'); f.ancien.value = 'faux'; f.nouveau.value = 'nouveau1'; f.confirme.value = 'nouveau1'; f.requestSubmit(); }); await p.waitForTimeout(300);
  T('P1', await p.evaluate(a => DB.findItem(DB.K.users, a).password, ids.agent) === 'demo123', 'mauvais mot de passe actuel refusé');
  await p.evaluate(() => { const f = document.querySelector('form[data-action="agent-mdp"]'); f.ancien.value = 'demo123'; f.nouveau.value = 'nouveau1'; f.confirme.value = 'nouveau1'; f.requestSubmit(); }); await p.waitForTimeout(300);
  T('P2', await p.evaluate(a => DB.findItem(DB.K.users, a).password, ids.agent) === 'nouveau1', 'mot de passe changé');
  await p.evaluate(a => DB.updateItem(DB.K.users, a, {password: 'demo123'}), ids.agent);
  T('P3', await p.evaluate(() => document.querySelector('form[data-action="agent-profil"] input[disabled]') !== null), 'nom et CNI non modifiables par l\'agent');

  // 8. Le responsable voit les comptes rendus et l'agent de chaque visite
  const resp = await p.evaluate(a => DB.findItem(DB.K.users, a).cni, ids.agence);
  await loginAs(p, resp); await goto(p, '#/agency/visits'); await p.waitForTimeout(700);
  T('R1', await p.evaluate(() => /A fait une offre/.test(document.querySelector('.content').textContent) && /Agent :/.test(document.querySelector('.content').textContent)), 'le responsable voit le compte rendu et l\'agent');
  T('R2', (await p.evaluate(() => MENUS.agency.map(m => m[1]))).includes('Honoraires'), 'le menu du responsable n\'a pas changé');
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
