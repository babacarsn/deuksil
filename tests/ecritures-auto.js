// Recense les écritures déclenchées sans action de l'utilisateur (simple navigation).
const {open, loginAs, logout, goto} = require('./harnais.js');
const PROFILS = {visiteur: null, admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012', client: '1900000000006', locataire: '1900000000002', mandant: '1900000000031'};
const sonde = () => { if (window.__sonde) return; window.__sonde = 1; window.__ecr = [];
  ['addItem', 'updateItem', 'deleteItem', 'setData'].forEach(m => { const f = DB[m]; DB[m] = function (k, ...a) {
    if (!window.__pause) { const pile = (new Error().stack || '').split('\n').slice(2, 6).map(l => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\)$/, '')).join(' < ');
      __ecr.push(m + ' ' + Object.keys(DB.K).find(n => DB.K[n] === k) + ' ' + (m === 'updateItem' ? JSON.stringify(a[1]).slice(0, 80) : '') + ' ← ' + pile); }
    return f.call(this, k, ...a); }; }); };
(async () => {
  const {b, p} = await open(); await p.evaluate(sonde);
  const tout = {};
  for (const [nom, cni] of Object.entries(PROFILS)) {
    await p.evaluate(() => { __pause = 1; }); try { if (cni) await loginAs(p, cni); else await logout(p); } catch (e) { console.log(nom, e.message); continue; }
    await p.evaluate(() => { __pause = 0; __ecr = []; });
    const home = cni ? await p.evaluate(() => Auth.home(Auth.current())) : '#/';
    await goto(p, home); await p.waitForTimeout(400);
    const pages = await p.evaluate(h => [...new Set([h, '#/search', ...[...document.querySelectorAll('.side a[href^="#/"], .tabbar a[href^="#/"]')].map(a => a.getAttribute('href'))])].filter(x => !/logout|#\/#|#\/$/.test(x)), home);
    for (const pg of pages) { process.stderr.write(nom + " " + pg + "\n"); await Promise.race([goto(p, pg), new Promise((_, r) => setTimeout(() => r(new Error("bloqué sur " + pg)), 15000))]); await p.waitForTimeout(350); }
    const L = await p.evaluate(() => __ecr);
    L.forEach(x => { const c = x.replace(/\{.*?\}|"[^"]*"/g, '…'); (tout[c] = tout[c] || new Set()).add(nom); });
  }
  for (const [c, n] of Object.entries(tout)) console.log(`[${[...n].join(',')}] ${c}`);
  await b.close();
})();
