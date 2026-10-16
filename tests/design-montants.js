// Les montants s'affichent « 150 000 » mais sont enregistrés en nombre (150000).
const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open(); await p.setViewportSize({width: 390, height: 844});
  const cni = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.role === 'owner' && !u.member).cni);
  await loginAs(p, cni); await goto(p, '#/manage/leases'); await p.waitForTimeout(800);
  const f = 'form[data-action="g-lease"]';
  await p.fill(`${f} [name="tenant"]`, 'Test Montant'); await p.fill(`${f} [name="phone"]`, '771112233');
  const rent = await p.$(`${f} [name="rent"]`); await rent.click({clickCount: 3}); await rent.type('175000');
  const vu = await p.evaluate(s => { const i = document.querySelector(s); return [Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(i), i.value, i.type]; }, `${f} [name="rent"]`);
  console.log('affiché / lu / type :', JSON.stringify(vu));
  const dep = await p.$(`${f} [name="deposit"]`); if (dep) { await dep.click({clickCount: 3}); await dep.type('350000'); }
  await p.evaluate(s => { const st = document.querySelector(s + ' [name="start"]'); if (st && !st.value) st.value = new Date().toISOString().slice(0, 10); }, f);
  await p.click(`${f} button[type="submit"], ${f} .btn:not(.ghost)`); await p.waitForTimeout(800);
  const bail = await p.evaluate(() => DB.getData(DB.K.leases).find(l => l.tenant === 'Test Montant'));
  console.log(bail && bail.rent == 175000 ? 'OK   bail enregistré, loyer = ' + bail.rent + ' (' + typeof bail.rent + ')' : 'ÉCHEC bail : ' + JSON.stringify(bail && {rent: bail.rent}));
  await goto(p, '#/manage/deals'); await p.waitForTimeout(800);
  const v = 'form[data-action="v-new"]';
  const prix = await p.$(`${v} [name="price"]`); console.log('prix affiché :', await p.evaluate(s => Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').get.call(document.querySelector(s)), `${v} [name="price"]`));
  await prix.click({clickCount: 3}); await prix.type('91500000');
  const nom = await p.$(`${v} [name="buyer"], ${v} [name="buyerName"], ${v} input[placeholder="Nom complet"]`); if (nom) await nom.fill('Acheteur Test');
  const tel = await p.$(`${v} input[type="tel"], ${v} [name="buyerPhone"], ${v} [name="phone"]`); if (tel) await tel.fill('771234567');
  await p.click(`${v} button[type="submit"], ${v} .btn:not(.ghost)`); await p.waitForTimeout(900);
  const d = await p.evaluate(() => DB.getData(DB.K.deals).find(x => x.price == 91500000 || x.amount == 91500000));
  console.log(d ? 'OK   vente enregistrée, prix = ' + (d.price || d.amount) + ' (' + typeof (d.price || d.amount) + ')' : 'ÉCHEC vente non trouvée');
  console.log('erreurs JS', p.errs); await b.close(); })();
