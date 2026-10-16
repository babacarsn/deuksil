// Six pratiques d'agence côté agent : planifier une visite, visites sans agent,
// messages par agent, rappels, validation des biens, commission partagée.
const {open, loginAs, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 390, height: 844}); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const AG = '1900000000012';
  const ids = await p.evaluate(ag => { const a = DB.getData(DB.K.users).find(u => u.cni === ag); const autre = DB.getData(DB.K.users).find(u => u.parentId === a.parentId && u.role === 'agent' && u.id !== a.id && u.status === 'actif');
    const ag2 = DB.findItem(DB.K.users, a.parentId); return {agent: a.id, agence: a.parentId, autre: autre && autre.id, resp: ag2.cni}; }, AG);
  const demain = await p.evaluate(() => new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10));

  // Données : un bien de l'agent, un bien du collègue, un bien sans agent, des fils de messages
  const d = await p.evaluate(({agent, agence, autre}) => {
    const props = DB.getData(DB.K.properties).filter(x => x.ownerId === agence);
    const mien = props.find(x => x.agentId === agent) || props[0];
    const sien = props.find(x => x.agentId === autre) || props.find(x => x.id !== mien.id);
    DB.updateItem(DB.K.properties, mien.id, {agentId: agent}); DB.updateItem(DB.K.properties, sien.id, {agentId: autre});
    const libre = sien;
    const clients = DB.getData(DB.K.users).filter(u => u.role === 'client');
    const fil = (c, pid, txt) => { c = c || clients[0]; return DB.addItem(DB.K.messages, {participants: [c.id, agence], propertyId: pid, items: [{senderId: c.id, text: txt, at: new Date().toISOString()}]}); };
    fil(clients[0], mien.id, 'FIL-MIEN'); fil(clients[1], sien.id, 'FIL-COLLEGUE'); fil(clients[2], '', 'FIL-LIBRE');
    DB.addItem(DB.K.demandes, {ownerId: agence, name: 'Demande Agent', phone: '775550000', transaction: 'location', budget: 0, agentId: agent, status: 'active'});
    return {mien: mien.id, sien: sien.id, libre: libre.id, libreSansAgent: !libre.agentId};
  }, ids);

  await loginAs(p, AG); await goto(p, '#/agency/visits'); await p.waitForTimeout(800);

  // 1. Planifier une visite
  T('P1', !!(await p.$('.page-head [data-action="agent-planif"]')), 'bouton « Planifier une visite » sur Mes visites');
  await p.click('.page-head [data-action="agent-planif"]'); await p.waitForTimeout(300);
  T('P2', await p.evaluate(a => { const o = [...document.querySelectorAll('form[data-action="agent-planif-ok"] [name="propertyId"] option')]; return o.length && o.every(x => DB.findItem(DB.K.properties, x.value).agentId === a); }, ids.agent), 'ses biens (disponibles) sont proposés');
  await p.evaluate(dt => { const f = document.querySelector('form[data-action="agent-planif-ok"]'); f.name.value = 'Moussa Diop'; f.phone.value = '77 444 55 66'; f.date.value = dt; f.time.value = '11:00'; f.requestSubmit(); }, demain);
  await p.waitForTimeout(500);
  const v = await p.evaluate(() => DB.getData(DB.K.visits).find(x => x.clientName === 'Moussa Diop'));
  T('P3', v && v.status === 'acceptee' && v.agentId === ids.agent && !v.clientId, 'visite créée, confirmée, à son nom, client sans compte');
  T('P4', await p.evaluate(() => /Moussa Diop/.test(document.querySelector('.content').textContent)), 'le client sans compte s\'affiche dans la liste');
  await p.click('.page-head [data-action="agent-planif"]'); await p.waitForTimeout(300);
  await p.evaluate(([dt, pid]) => { const f = document.querySelector('form[data-action="agent-planif-ok"]'); f.propertyId.value = pid; f.name.value = 'Autre'; f.phone.value = '770001122'; f.date.value = dt; f.time.value = '11:00'; f.requestSubmit(); }, [demain, v.propertyId]);
  await p.waitForTimeout(300);
  T('P5', await p.evaluate(() => DB.getData(DB.K.visits).filter(x => x.clientName === 'Autre').length === 0), 'double réservation du même créneau refusée');
  await p.evaluate(() => document.querySelector('[data-action="close-modal"]') && document.querySelector('[data-action="close-modal"]').click());
  await goto(p, '#/agency/clients'); await p.waitForTimeout(600);
  T('P6', !!(await p.$('[data-action="agent-planif"][data-dm]')), 'bouton « Visite » sur chaque demande client');

  // 3. Messages
  await goto(p, '#/agency/messages'); await p.waitForTimeout(700);
  const fils = await p.evaluate(() => DB.filterItems(DB.K.messages, t => t.participants.includes(Auth.current().id)).map(t => t.items[0] && t.items[0].text));
  T('MS1', fils.includes('FIL-MIEN') && fils.includes('FIL-LIBRE') && !fils.includes('FIL-COLLEGUE'), 'il voit ses fils et ceux que personne ne suit, pas ceux du collègue');
  await p.evaluate(() => { const t = DB.getData(DB.K.messages).find(x => x.items[0] && x.items[0].text === 'FIL-LIBRE'); DB.updateItem(DB.K.messages, t.id, {items: [...t.items, {senderId: Auth.current().id, text: 'Bonjour', at: new Date().toISOString()}]}); });
  T('MS2', await p.evaluate(a => DB.getData(DB.K.messages).find(x => x.items[0] && x.items[0].text === 'FIL-LIBRE').agentId === a, ids.agent), 'en répondant, il devient l\'agent qui suit le fil');
  const bloque = await p.evaluate(() => { const t = DB.getData(DB.K.messages).find(x => x.items[0] && x.items[0].text === 'FIL-COLLEGUE'); return DB.updateItem(DB.K.messages, t.id, {items: [...t.items, {senderId: Auth.current().id, text: 'intrus'}]}); });
  T('MS3', bloque === null, 'il ne peut pas écrire dans le fil d\'un collègue');

  // 4. Rappels
  await p.evaluate(() => { const u = Auth.current(); const auj = new Date().toISOString().slice(0, 10);
    DB.addItem(DB.K.visits, {ownerId: u.id, propertyId: DB.getData(DB.K.properties).find(x => x.agentId === u.member.id).id, clientName: 'Rappel Test', clientPhone: '770009988', date: auj, time: '23:59', status: 'acceptee', agentId: u.member.id}); rappelsVisites(); rappelsVisites(); });
  const rap = await p.evaluate(() => DB.filterItems(DB.K.notifications, n => n.userId === Auth.current().id).filter(n => /Rappel Test/.test(n.text)).length);
  T('R1', rap === 1, `rappel du jour reçu une seule fois (${rap})`);
  T('R2', await p.evaluate(() => DB.filterItems(DB.K.notifications, n => n.userId === Auth.current().id).some(n => /Demain à 11:00/.test(n.text))) === false, 'pas de rappel « demain » pour une visite dans 2 jours');

  // 5. Validation des biens publiés par l'agent
  const nb = await p.evaluate(() => { const u = Auth.current(); return DB.addItem(DB.K.properties, {ownerId: u.id, title: 'Studio à valider', type: 'studio', transaction: 'location', price: 150000, status: 'disponible', listingStatus: 'publiee'}); });
  T('V1', nb.listingStatus === 'avalider' && nb.agentId === ids.agent && nb.apporteurId === ids.agent, 'publié par l\'agent → « À valider », attribué et noté comme rentré par lui');
  T('V2', await p.evaluate(() => !DB.getData(DB.K.properties).filter(x => x.listingStatus === 'publiee').some(x => x.title === 'Studio à valider')), 'pas visible dans la recherche publique');

  // Commission partagée : le bien du collègue, loué grâce à une visite de l'agent
  const com = await p.evaluate(({agent, autre, sien, agence}) => {
    DB.updateItem(DB.K.properties, sien, {apporteurId: autre, agentId: autre});
    DB.addItem(DB.K.visits, {ownerId: agence, propertyId: sien, clientName: 'Aïda Fall', clientPhone: '776665544', date: '2026-01-10', time: '10:00', status: 'terminee', agentId: agent, cr: {outcome: 'interesse', by: agent}});
    const owner = DB.findItem(DB.K.users, agence);
    const f = honoraireBail(owner, {id: 'lease_test_x', propertyId: sien, rent: 300000, tenant: 'Aïda Fall', phone: '776665544'});
    return f && {agentId: f.agentId, agentPart: f.agentPart, apporteurId: f.apporteurId, apporteurPart: f.apporteurPart, ht: f.ht};
  }, {...ids, sien: d.sien});
  T('K1', com && com.agentId === ids.agent && com.apporteurId === ids.autre && com.agentPart === com.apporteurPart && com.agentPart + com.apporteurPart === Math.round(com.ht * 0.2),
    `commission partagée 50/50 : ${com && com.agentPart} (conclu) + ${com && com.apporteurPart} (rentré)`);
  await p.evaluate(() => DB.updateItem(DB.K.fees, DB.getData(DB.K.fees).find(f => f.leaseId === 'lease_test_x').id, {status: 'paye'}));
  await goto(p, '#/agent/commissions'); await p.waitForTimeout(600);
  T('K2', await p.evaluate(() => /Vous avez conclu/.test(document.querySelector('.content').textContent)), 'sa part et son rôle apparaissent dans Mes commissions');

  // Côté responsable
  await loginAs(p, ids.resp); await goto(p, '#/agency/properties'); await p.waitForTimeout(800);
  T('V3', await p.evaluate(() => /Studio à valider/.test((document.querySelector('#a-valider') || {}).textContent || '')), 'le responsable voit le bien à valider');
  await p.evaluate(id => document.querySelector(`[data-action="ag-renvoyer-bien"][data-id="${id}"]`).click(), nb.id); await p.waitForTimeout(300);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="ag-renvoyer-ok"]'); f.motif.value = 'Ajoutez des photos'; f.requestSubmit(); }); await p.waitForTimeout(300);
  T('V4', await p.evaluate(id => { const x = DB.findItem(DB.K.properties, id); return x.listingStatus === 'brouillon' && x.renvoiMotif === 'Ajoutez des photos'; }, nb.id), 'renvoyé à l\'agent avec le motif');
  await p.evaluate(id => DB.updateItem(DB.K.properties, id, {listingStatus: 'avalider'}), nb.id); await goto(p, '#/agency/dashboard'); await goto(p, '#/agency/properties'); await p.waitForTimeout(600);
  await p.evaluate(id => document.querySelector(`[data-action="ag-valider-bien"][data-id="${id}"]`).click(), nb.id); await p.waitForTimeout(300);
  T('V5', await p.evaluate(id => DB.findItem(DB.K.properties, id).listingStatus === 'publiee', nb.id), 'validé → en ligne');
  T('V6', await p.evaluate(a => DB.getData(DB.K.notifications).some(n => n.userId === a && /validé et en ligne/.test(n.text)), ids.agent), 'l\'agent est prévenu');
  const tous = await p.evaluate(() => DB.filterItems(DB.K.messages, t => t.participants.includes(Auth.current().id)).map(t => t.items[0] && t.items[0].text));
  T('MS4', tous.includes('FIL-COLLEGUE') && tous.includes('FIL-MIEN'), 'le responsable voit tous les fils');

  // 2. Visites sans agent
  await p.evaluate(({agence}) => { const p0 = DB.getData(DB.K.properties).find(x => x.ownerId === agence && !x.agentId) || DB.addItem(DB.K.properties, {ownerId: agence, title: 'Bien libre', type: 'villa', transaction: 'location', price: 900000, status: 'disponible', listingStatus: 'publiee'});
    DB.updateItem(DB.K.properties, p0.id, {agentId: ''}); window.__libre = p0.id;
    DB.addItem(DB.K.visits, {ownerId: agence, propertyId: p0.id, clientName: 'Sans Agent', clientPhone: '770101010', date: new Date(Date.now() + 864e5 * 3).toISOString().slice(0, 10), time: '15:00', status: 'attente'}); }, ids);
  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(700);
  T('S1', await p.evaluate(() => /sans agent/.test(document.querySelector('.content').textContent)), '« visites sans agent » dans À traiter');
  await goto(p, '#/agency/visits'); await p.waitForTimeout(600);
  const btn = await p.$('[data-action="ag-confier"]'); T('S2', !!btn, 'bouton « Confier » sur la visite');
  await btn.click(); await p.waitForTimeout(300);
  await p.evaluate(a => { const f = document.querySelector('form[data-action="ag-confier-ok"]'); f.agentId.value = a; f.requestSubmit(); }, ids.agent); await p.waitForTimeout(300);
  T('S3', await p.evaluate(a => { const v = DB.getData(DB.K.visits).find(x => x.clientName === 'Sans Agent'); return v.agentId === a && DB.findItem(DB.K.properties, v.propertyId).agentId === a; }, ids.agent), 'visite et bien confiés à l\'agent');

  // Réglage : sans validation
  await p.evaluate(() => DB.updateItem(DB.K.users, Auth.current().id, {regles: {...regles(Auth.current()), validationAgents: false}}));
  await loginAs(p, AG);
  const direct = await p.evaluate(() => { const u = Auth.current(); return DB.addItem(DB.K.properties, {ownerId: u.id, title: 'Direct', type: 'studio', transaction: 'location', price: 1, status: 'disponible', listingStatus: 'publiee'}).listingStatus; });
  T('V7', direct === 'publiee', 'règle désactivée : l\'agent publie directement');
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
