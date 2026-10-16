// Messagerie entre tous les acteurs : chaque message envoyé depuis l'interface
// doit arriver dans la boîte « Messages » du destinataire (et le prévenir).
const {open, loginAs, goto} = require('./harnais.js');
const CNI = {client1: '1900000000005', client2: '1900000000006', owner: '1900000000003', agence: '1900000000004', agent: '1900000000012',
  manager: '1900000000011', tacko: '1900000000002', aida: '1900000000309', mandant: '1900000000201', astou: '1900000000301'};
(async () => {
  const {b, p} = await open(); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const route = async () => p.evaluate(() => { const u = Auth.current(); return u.role === 'tenant' || u.role === 'client' ? '#/client/messages' : `#/${u.role}/messages`; });
  const ouvrirMessages = async cni => { await loginAs(p, cni); await goto(p, await route()); await p.waitForTimeout(500); };
  const tel = cni => p.evaluate(c => DB.findItem(DB.K.users, x => x.cni === c).phone, cni);
  const idDe = cni => p.evaluate(c => DB.findItem(DB.K.users, x => x.cni === c).id, cni);
  /* Ouvre la conversation avec quelqu'un (par son numéro, comme un utilisateur) puis écrit. */
  async function ecrire(de, vers, texte) {
    await ouvrirMessages(de);
    const t = await tel(vers);
    await p.evaluate(() => { const b = document.querySelector('[data-action="nd-new"]'); b && b.click(); }); await p.waitForTimeout(250);
    await p.evaluate(t => { const f = document.querySelector('form[data-action="nd-ouvrir"]'); f.tel.value = t; f.requestSubmit(); }, t); await p.waitForTimeout(600);
    return repondre(texte);
  }
  async function repondre(texte) {
    const okC = await p.evaluate(x => { const f = document.querySelector('.msgs form.composer, .main form.composer'); if (!f) return false; f.querySelector('[name="text"]').value = x; f.requestSubmit(); return true; }, texte);
    await p.waitForTimeout(500); return okC;
  }
  /* Le destinataire voit-il le texte dans sa boîte ? (toutes les conversations) */
  async function recu(cni, texte) {
    await ouvrirMessages(cni);
    const badge = await p.evaluate(() => { const a = [...document.querySelectorAll('.sidebar-badge, .tabbar .badge, .tab-item .sidebar-badge')]; return a.map(x => x.textContent).join(','); });
    const n = await p.evaluate(() => document.querySelectorAll('.thread').length);
    for (let i = 0; i < Math.max(n, 1); i++) {
      if (await p.evaluate(x => (document.querySelector('#msg-list') || {}).textContent ? document.querySelector('#msg-list').textContent.includes(x) : false, texte)) return {vu: true, badge};
      if (i < n) { await p.evaluate(i => document.querySelectorAll('.thread')[i].click(), i); await p.waitForTimeout(250); }
    }
    return {vu: await p.evaluate(x => (document.querySelector('#msg-list') || {}).textContent ? document.querySelector('#msg-list').textContent.includes(x) : false, texte), badge};
  }
  const notifie = (cni, re) => p.evaluate(([c, re]) => { const id = DB.findItem(DB.K.users, x => x.cni === c).id; return DB.getData(DB.K.notifications).some(n => n.userId === id && new RegExp(re).test(n.text)); }, [cni, re]);
  const lien = (cni) => p.evaluate(c => { const id = DB.findItem(DB.K.users, x => x.cni === c).id; const n = DB.getData(DB.K.notifications).filter(n => n.userId === id).slice(-1)[0]; return n && n.link; }, cni);

  // 1. Client → propriétaire (depuis la fiche du bien) et réponse
  await loginAs(p, CNI.client1);
  await p.evaluate(o => { const pr = DB.getData(DB.K.properties).find(x => x.ownerId === o); openContact(pr.id); }, await idDe(CNI.owner)); await p.waitForTimeout(600);
  await repondre('M1 client vers proprio');
  let r = await recu(CNI.owner, 'M1 client vers proprio'); T('1a', r.vu, 'client → propriétaire : reçu dans Messages');
  T('1b', await notifie(CNI.owner, 'message'), 'propriétaire notifié');
  await repondre('M2 proprio vers client');
  r = await recu(CNI.client1, 'M2 proprio vers client'); T('1c', r.vu, 'propriétaire → client : réponse reçue');
  r = await recu(CNI.manager, 'M1 client vers proprio'); T('1d', r.vu, 'le gestionnaire (membre) du propriétaire voit le message');

  // 2. Client → agence (bien suivi par l'agent), agent répond, responsable voit
  const agenceId = await idDe(CNI.agence), agentId = await p.evaluate(c => DB.findItem(DB.K.users, x => x.cni === c).id, CNI.agent);
  await loginAs(p, CNI.client2);
  const pid = await p.evaluate(([a, g]) => { const pr = DB.getData(DB.K.properties).find(x => x.ownerId === a && x.agentId === g) || DB.getData(DB.K.properties).find(x => x.ownerId === a); DB.updateItem(DB.K.properties, pr.id, {agentId: g}); return pr.id; }, [agenceId, agentId]);
  await p.evaluate(id => openContact(id), pid); await p.waitForTimeout(600);
  await repondre('M3 client vers agence');
  r = await recu(CNI.agent, 'M3 client vers agence'); T('2a', r.vu, 'client → agence : l\'agent du bien le reçoit');
  await repondre('M4 agent vers client');
  r = await recu(CNI.client2, 'M4 agent vers client'); T('2b', r.vu, 'agent → client : reçu');
  r = await recu(CNI.agence, 'M3 client vers agence'); T('2c', r.vu, 'le responsable voit la conversation');
  r = await recu(CNI.agence, 'M4 agent vers client'); T('2d', r.vu, 'le responsable voit la réponse de l\'agent');

  // 3. Locataire ↔ propriétaire
  await ouvrirMessages(CNI.tacko); await repondre('M5 locataire vers proprio');
  r = await recu(CNI.owner, 'M5 locataire vers proprio'); T('3a', r.vu, 'locataire → propriétaire : reçu dans Messages du propriétaire');
  T('3b', await notifie(CNI.owner, 'M5'), 'propriétaire notifié');
  await repondre('M6 proprio vers locataire');
  r = await recu(CNI.tacko, 'M6 proprio vers locataire'); T('3c', r.vu, 'propriétaire → locataire (réponse dans la boîte) : reçu');
  await ecrire(CNI.owner, CNI.tacko, 'M7 proprio nouvelle discussion');
  r = await recu(CNI.tacko, 'M7 proprio nouvelle discussion'); T('3d', r.vu, 'propriétaire → locataire (nouvelle discussion par numéro) : reçu');
  await repondre('M8 locataire repond');
  r = await recu(CNI.owner, 'M8 locataire repond'); T('3e', r.vu, 'la réponse du locataire revient au propriétaire dans la même boîte');

  // 4. Locataire ↔ agence
  await ouvrirMessages(CNI.aida); await repondre('M9 locataire vers agence');
  r = await recu(CNI.agence, 'M9 locataire vers agence'); T('4a', r.vu, 'locataire → agence : reçu dans Messages de l\'agence');
  await repondre('M10 agence vers locataire');
  r = await recu(CNI.aida, 'M10 agence vers locataire'); T('4b', r.vu, 'agence → locataire : reçu');
  r = await recu(CNI.agent, 'M9 locataire vers agence'); T('4c', !r.vu, 'l\'agent (sans droit sur les baux) ne voit pas les échanges du bail');
  await ouvrirMessages(CNI.aida); await repondre('M9b non lu');
  await loginAs(p, CNI.agence); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(500);
  T('4d', await p.evaluate(() => sidebarBadge(Auth.current(), '#/agency/messages').n >= 1), 'la pastille Messages de l\'agence compte le message non lu du locataire');
  await goto(p, '#/manage/tmsgs'); await p.waitForTimeout(400);
  T('4e', await p.evaluate(() => location.hash === '#/agency/messages'), 'l\'ancien lien « Messages locataires » mène à la boîte');

  // 5. Propriétaire (mandant) ↔ agence
  await ecrire(CNI.mandant, CNI.agence, 'M11 mandant vers agence');
  r = await recu(CNI.agence, 'M11 mandant vers agence'); T('5a', r.vu, 'propriétaire → agence (par numéro) : reçu');
  await repondre('M12 agence vers mandant');
  r = await recu(CNI.mandant, 'M12 agence vers mandant'); T('5b', r.vu, 'agence → propriétaire : reçu');

  // 6. Client ↔ client, et agence → client par numéro
  await ecrire(CNI.agence, CNI.client1, 'M13 agence vers client');
  r = await recu(CNI.client1, 'M13 agence vers client'); T('6a', r.vu, 'agence → client (par numéro) : reçu');

  // 7. Les liens des notifications mènent à un écran qui existe pour le destinataire
  for (const k of ['owner', 'client1', 'client2', 'tacko', 'aida', 'agence', 'mandant']) {
    await loginAs(p, CNI[k]); const l = await lien(CNI[k]); if (!l) continue;
    await goto(p, l); await p.waitForTimeout(400);
    T('7-' + k, await p.evaluate(l => location.hash === l || /messages/.test(location.hash), l), `lien de notification « ${l} » ouvert par ${k}`);
  }
  // 8. Pas de fils en double entre deux mêmes personnes
  const doubles = await p.evaluate(() => { const vus = {}; let n = 0; DB.getData(DB.K.messages).forEach(t => { const k = t.participants.slice().sort().join('|'); if (vus[k]) n++; vus[k] = 1; }); return n; });
  T('8', doubles === 0, `aucun fil en double (${doubles})`);
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
