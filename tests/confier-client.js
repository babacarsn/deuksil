// Recette AG4 : un agent confie un client (demande) à un collègue.
const {open, loginAs, goto} = require('./harnais.js');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const {b, p} = await open();
  await loginAs(p, '1900000000012'); await goto(p, '#/agency/clients'); await p.waitForTimeout(500); await goto(p, '#/agency/clients'); await p.waitForTimeout(700);
  const avant = await p.evaluate(() => [...document.querySelectorAll('[data-action="ag-demande-confier"]')].map(b => b.dataset.id));
  t(avant.length >= 1, `Agent : bouton « Confier » sur ses clients (${avant.length})`);
  t(await p.evaluate(() => /Fatou Diop/.test(document.body.innerText) && !/Mariama Ba/.test(document.body.innerText)), 'L\'agent ne voit que les clients qu\'il suit');
  await p.evaluate(id => document.querySelector(`[data-action="ag-demande-confier"][data-id="${id}"]`).click(), avant[0]); await p.waitForTimeout(400);
  const opts = await p.evaluate(() => [...document.querySelectorAll('#dm-agent option')].map(o => o.textContent.trim()));
  t(opts.length && !opts.some(o => /Aïssatou/.test(o)) && !opts.some(o => /Moussa/.test(o)), 'Choix : collègues actifs seulement ' + opts.join(', '));
  const cible = await p.evaluate(() => { const s = document.getElementById('dm-agent'); const o = [...s.options].find(x => /Ousmane/.test(x.textContent)); s.value = o.value; document.getElementById('dm-note').value = 'Cherche près de l\'école'; document.querySelector('form[data-action="ag-demande-confier-ok"]').requestSubmit(); return o.value; });
  await p.waitForTimeout(600);
  const r = await p.evaluate(([id, c]) => ({dm: DB.findItem(DB.K.demandes, x => x.id === id).agentId === c, notif: DB.getData(DB.K.notifications).some(n => n.userId === c && /vous confie le client/.test(n.text) && /école/.test(n.text)), liste: [...document.querySelectorAll('[data-action="ag-demande-confier"]')].length}), [avant[0], cible]);
  t(r.dm && r.notif, 'Demande transmise, collègue prévenu avec la note');
  t(r.liste === avant.length - 1, 'Le client disparaît des demandes de l\'agent');
  await loginAs(p, await p.evaluate(c => DB.findItem(DB.K.users, c).cni, cible));
  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(300); await goto(p, '#/agency/clients'); await p.waitForTimeout(700);
  t(await p.evaluate(id => document.body.innerText.includes(DB.findItem(DB.K.demandes, x => x.id === id).name), avant[0]), 'Le collègue retrouve le client dans ses demandes');
  t(p.errs.length === 0, 'Aucune erreur JS ' + p.errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
