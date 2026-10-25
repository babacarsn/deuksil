const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open();
  const verif = () => p.evaluate(() => { const pb = [];
    document.querySelectorAll('*').forEach(el => { if (getComputedStyle(el).position !== 'fixed') return;
      for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) { const c = getComputedStyle(a);
        if (c.transform !== 'none' || c.filter !== 'none' || c.perspective !== 'none' || /paint|layout|strict|content/.test(c.contain) || /transform|filter/.test(c.willChange) || (c.backdropFilter && c.backdropFilter !== 'none'))
          { pb.push((el.className || el.id || el.tagName) + ' ⊂ ' + (a.className || a.id || a.tagName) + ' [' + (c.transform !== 'none' ? 'transform' : c.filter !== 'none' ? 'filter' : 'autre') + ']'); break; } } });
    return pb; });
  const roles = await p.evaluate(() => { const seen = {}; return DB.getData(DB.K.users).filter(u => !u.member && !seen[u.role] && (seen[u.role] = 1)).map(u => [u.role, u.cni]); });
  let total = 0;
  for (const vp of [{width: 390, height: 760}, {width: 1280, height: 800}]) { await p.setViewportSize(vp);
    for (const [role, cni] of [['public', null], ...roles]) {
      if (cni) await loginAs(p, cni); else await p.evaluate(() => localStorage.removeItem(DB.K.session));
      await goto(p, '#/'); await p.waitForTimeout(300);
      const liens = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href^="#/"]')].map(a => a.getAttribute('href').split('?')[0]))].filter(h => !/logout|#\/#/.test(h)).slice(0, 25));
      for (const h of liens) { await goto(p, h); await p.waitForTimeout(450); await p.evaluate(() => scrollTo(0, 500)); await p.waitForTimeout(150);
        const pb = await verif(); total++; if (pb.length) console.log(vp.width, role, h, [...new Set(pb)].join(' | ')); } } }
  console.log('pages vérifiées', total, 'erreurs JS', p.errs); await b.close(); })();
