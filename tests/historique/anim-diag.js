const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open(); await p.setViewportSize({width: 390, height: 760});
  const cni = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.role === 'owner' && !u.member).cni);
  await loginAs(p, cni); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(1200);
  const info = () => p.evaluate(() => { const t = document.querySelector('.tabbar').getBoundingClientRect(), a = document.getElementById('app'), cs = getComputedStyle(a);
    return {tabBas: Math.round(t.bottom), vh: innerHeight, y: scrollY, appTransform: cs.transform, appAnim: a.getAnimations().map(x => x.animationName + ':' + x.playState), appWillChange: cs.willChange}; });
  console.log('repos', JSON.stringify(await info()));
  await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(300);
  console.log('défilé', JSON.stringify(await info()));
  // échantillons de la barre pendant un défilement
  const ech = await p.evaluate(async () => { const out = []; for (let i = 0; i < 20; i++) { scrollBy(0, 30); await new Promise(r => requestAnimationFrame(r)); out.push(Math.round(document.querySelector('.tabbar').getBoundingClientRect().bottom)); } return out; });
  console.log('barre pendant défilement', ech.join(','));
  // changement de page : barre pendant la transition
  const nav = await p.evaluate(async () => { location.hash = '#/owner/properties'; const out = []; for (let i = 0; i < 30; i++) { await new Promise(r => requestAnimationFrame(r)); const t = document.querySelector('.tabbar'); out.push(t ? Math.round(t.getBoundingClientRect().bottom) : -1); } return out; });
  console.log('barre en changeant de page', nav.join(','));
  await p.waitForTimeout(800); await p.evaluate(() => scrollTo(0, 900)); await p.waitForTimeout(300);
  await p.click('.mhead .muser'); await p.waitForTimeout(500);
  const up = await p.evaluate(() => { const u = document.getElementById('upanel').getBoundingClientRect(), h = document.querySelector('.mhead').getBoundingClientRect(); return {panneauHaut: Math.round(u.top), panneauBas: Math.round(u.bottom), enteteBas: Math.round(h.bottom), y: scrollY, visible: u.bottom > 0 && u.top < innerHeight}; });
  console.log('panneau compte', JSON.stringify(up));
  await p.screenshot({path: __dirname + '/diag-upanel.png'});
  console.log('erreurs', p.errs); await b.close(); })();
