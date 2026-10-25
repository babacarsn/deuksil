// Pour chaque membre (agent, gestionnaire) : toutes les adresses connues, accès conforme à permFor ?
const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open(); await p.waitForTimeout(4000);
  const membres = await p.evaluate(() => DB.getData(DB.K.users).filter(u => u.parentId && u.status === 'actif').map(u => u.cni));
  const adresses = ['#/agency/dashboard', '#/agency/properties', '#/agency/clients', '#/agency/visits', '#/agency/messages', '#/agency/commissions', '#/agency/agents', '#/agency/settings', '#/manage', '#/manage/owners', '#/manage/mandates', '#/manage/leases', '#/manage/rents', '#/manage/deals', '#/manage/docs', '#/manage/fpay', '#/manage/expenses', '#/manage/transfers', '#/manage/team', '#/manage/reports', '#/manage/finance', '#/agent/commissions', '#/agent/profil', '#/owner/dashboard', '#/owner/properties', '#/owner/visits', '#/coffre', '#/admin/dashboard'];
  const fautes = [];
  for (const cni of membres) { await loginAs(p, cni); await goto(p, '#/'); await p.waitForTimeout(200);
    const qui = await p.evaluate(() => { const u = Auth.current(); return u.member.firstName + ' (' + u.member.role + ', ' + u.member.perms.join('+') + ')'; });
    for (const h of adresses) { await goto(p, '#/x'); await goto(p, h); await p.waitForTimeout(250);
      const r = await p.evaluate(h => { const u = Auth.current(); const perm = permFor(h.slice(1)); const attendu = !perm || memberCan(u, perm);
        const special = /agency\/(commissions|agents|settings)|manage\/team|admin/.test(h) || (/^#\/owner/.test(h) && u.role !== 'owner') ? false : null;
        return {arrive: location.hash === h, attendu: special === null ? attendu : (attendu && special !== false)}; }, h);
      if (r.arrive && !r.attendu) fautes.push(qui + ' entre dans ' + h); }
  }
  console.log('membres', membres.length, '· accès anormaux :', fautes.length ? fautes : 'aucun', p.errs); await b.close(); })();
