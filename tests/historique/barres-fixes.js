const {open, loginAs, goto} = require('./harnais.js');
(async () => { const {b, p} = await open();
  const mesure = async (nom) => { const r = await p.evaluate(async () => { const out = {};
      for (const y of [0, 800, 1600]) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
        const q = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return r.height ? Math.round(r.top) : null; };
        out[y] = {haut: q('.mhead') ?? q('header.nav'), bas: q('.tabbar'), side: q('.side'), y: Math.round(scrollY)}; }
      return out; }); console.log(nom, JSON.stringify(r)); };
  await p.setViewportSize({width: 390, height: 760});
  await goto(p, '#/'); await mesure('mobile accueil public');
  await goto(p, '#/search'); await mesure('mobile recherche publique');
  const cni = await p.evaluate(() => DB.getData(DB.K.users).find(u => u.role === 'owner' && !u.member).cni);
  await loginAs(p, cni); await goto(p, '#/owner/properties'); await mesure('mobile propriétaire');
  await p.setViewportSize({width: 1280, height: 800}); await goto(p, '#/owner/properties'); await mesure('ordinateur propriétaire');
  await p.evaluate(() => localStorage.removeItem(DB.K.session)); await goto(p, '#/search'); await mesure('ordinateur recherche publique');
  await goto(p, '#/x'); await goto(p, '#/'); await mesure('ordinateur accueil public');
  await b.close(); })();
