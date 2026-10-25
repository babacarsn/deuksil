// Audit global : pour chaque profil et chaque page de menu, à 3 largeurs :
// débordement horizontal, erreurs JS, titre de page, nombre de H1, images sans alt,
// icône des messages (identique partout), liste vide sans message.
const {open, loginAs, goto, APP} = require('./harnais.js');
const fs = require('fs');
const PROFILS = {visiteur: null, admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012',
  client: '1900000000006', locataire: '1900000000002', mandant: '1900000000201'};
const LARG = [[390, 844], [820, 1180], [1280, 900]];
(async () => {
  const {b, p} = await open(); const out = [], icones = {};
  for (const [nom, cni] of Object.entries(PROFILS).filter(([n]) => !process.env.PROFIL || process.env.PROFIL.split(',').includes(n))) {
    await p.setViewportSize({width: 1280, height: 900});
    if (cni) await loginAs(p, cni); else await p.evaluate(() => localStorage.removeItem(DB.K.session));
    const home = cni ? await p.evaluate(() => Auth.home(Auth.current())) : '#/';
    await goto(p, home); await p.waitForTimeout(500);
    let pages = await p.evaluate(h => [...new Set([h, ...[...document.querySelectorAll('.sidebar a[href^="#/"], .tabbar a[href^="#/"], .nav-links a[href^="#/"]')].map(a => a.getAttribute('href'))])]
      .filter(x => !/logout|#\/#/.test(x)), home);
    if (!cni) pages = [...new Set([...pages, '#/search', '#/login', '#/register', '#/property/property_001'])];
    for (const [w, h] of LARG) {
      await p.setViewportSize({width: w, height: h});
      for (const pg of pages) {
        const e0 = p.errs.length;
        await goto(p, pg); await p.waitForTimeout(450);
        const r = await p.evaluate(() => {
          const W = innerWidth, sw = document.documentElement.scrollWidth;
          const larges = [...document.querySelectorAll('#app *')].filter(e => { const b = e.getBoundingClientRect(); return b.width && b.right > W + 2 && !e.closest('.table-wrap, .hscroll, .hx-car, .gtabs, [style*="overflow"], .tabs-op, .filters, .cats') && getComputedStyle(e).position !== 'fixed'; })
            .slice(0, 3).map(e => e.tagName.toLowerCase() + '.' + [...e.classList].slice(0, 2).join('.'));
          const msg = [...document.querySelectorAll('a[href*="messages"], a[href*="msgs"], [data-action*="message"]')].map(a => { const s = a.querySelector('svg'); return s ? s.innerHTML.replace(/\s+/g, '').slice(0, 80) : 'aucune'; });
          return {debord: sw > W + 1 ? sw - W : 0, larges, titre: document.title, h1: document.querySelectorAll('#app h1').length,
            sansAlt: [...document.querySelectorAll('#app img:not([alt])')].length, msg,
            vide: !(document.querySelector('#app .content, #app main, #app') || {}).innerText?.trim()};
        });
        const pb = [];
        if (r.debord) pb.push('débordement ' + r.debord + 'px ' + r.larges.join(' '));
        if (p.errs.length > e0) pb.push('erreur JS ' + p.errs.slice(e0).join(' | '));
        if (r.sansAlt) pb.push(r.sansAlt + ' image(s) sans alt');
        if (r.vide) pb.push('page vide');
        if (w === 1280 && r.h1 !== 1) pb.push(r.h1 + ' H1');
        r.msg.forEach(m => { (icones[m] = icones[m] || new Set()).add(nom + ' ' + pg); });
        if (pb.length) out.push({profil: nom, largeur: w, page: pg, titre: r.titre, pb});
      }
    }
  }
  fs.writeFileSync(__dirname + '/audit-global' + (process.env.PROFIL ? '-' + process.env.PROFIL.replace(/,/g, '-') : '') + '.json', JSON.stringify({out, icones: Object.fromEntries(Object.entries(icones).map(([k, v]) => [k, [...v].slice(0, 4)]))}, null, 1));
  console.log('problèmes', out.length, 'variantes icône message', Object.keys(icones).length); await b.close();
})();
