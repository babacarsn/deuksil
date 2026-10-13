const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open();
  for (const vp of [{width: 390, height: 760}]) { await p.setViewportSize(vp);
    for (const role of ['owner', 'agency', 'tenant', 'client', 'admin']) {
      const cni = await p.evaluate(r => DB.getData(DB.K.users).find(u => u.role === r && !u.member).cni, role);
      await loginAs(p, cni); await goto(p, {owner:'#/owner/dashboard',agency:'#/agency/dashboard',tenant:'#/client/dashboard',client:'#/client/dashboard',admin:'#/admin/dashboard'}[role]); await p.waitForTimeout(500); await p.evaluate(() => scrollTo(0, 700)); await p.waitForTimeout(200);
      await p.click('.mhead .muser'); await p.waitForTimeout(400);
      const btn = await p.$('#upanel [data-action="logout"]');
      if (!btn) { console.log(role, 'pas de bouton de déconnexion'); continue; }
      await btn.click(); await p.waitForTimeout(600);
      console.log(role, 'déconnecté :', await p.evaluate(() => !localStorage.getItem(DB.K.session) || !Auth.current()), await p.evaluate(() => location.hash));
    } }
  // animations toujours actives
  await p.setViewportSize({width: 1280, height: 800}); await goto(p, '#/x'); await goto(p, '#/'); await p.waitForTimeout(400);
  for (let y = 0; y < 6000; y += 400) { await p.mouse.wheel(0, 400); await p.waitForTimeout(100); }
  await p.waitForTimeout(1500);
  console.log('apparitions', JSON.stringify(await p.evaluate(() => ({rv: document.querySelectorAll('.rv').length, on: document.querySelectorAll('.rv-on').length, opac: [...document.querySelectorAll('.rv-on')].filter(e => getComputedStyle(e).opacity !== '1').length}))));
  // onde sur un bouton : positionnement préservé
  console.log('erreurs', p.errs); await b.close(); })();
