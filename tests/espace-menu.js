const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open();
  for (const role of ['owner', 'client', 'agency']) {
    const cni = await p.evaluate(r => DB.getData(DB.K.users).find(u => u.role === r && !u.member).cni, role);
    await loginAs(p, cni); await p.setViewportSize({width: 390, height: 760}); await goto(p, '#/x'); await goto(p, '#/'); await p.waitForTimeout(700);
    const vis = await p.evaluate(() => [...document.querySelectorAll('header.nav a, header.nav button')].filter(e => e.offsetParent && getComputedStyle(e).display !== 'none').map(e => (e.textContent.trim() || e.getAttribute('aria-label'))));
    await p.click('[data-action="open-pub-menu"]'); await p.waitForTimeout(400);
    const menu = await p.evaluate(() => [...document.querySelectorAll('.sdrawer a')].map(a => a.textContent.trim()));
    await p.screenshot({path: __dirname + `/pub-${role}.png`});
    await p.evaluate(() => document.querySelector('.sdrawer-back') && document.querySelector('.sdrawer-back').click());
    await goto(p, '#/login'); await p.waitForTimeout(400); const apresLogin = await p.evaluate(() => location.hash);
    console.log(role, 'hash accueil', '| en-tête visible :', vis.join(', '), '| menu :', menu.join(', '), '| #/login →', apresLogin);
  }
  console.log(p.errs); await b.close(); })();
