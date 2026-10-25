// Audit des liens : pour chaque profil, chaque page de son menu, chaque lien
// ou tuile cliquable → où il mène vraiment (page inexistante, accès refusé,
// renvoi ailleurs, erreur JS). Résultat : tests/audit-liens.json
const {open, loginAs, goto} = require('./harnais.js');
const fs = require('fs');
const PROFILS = {admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012',
  client: '1900000000005', locataire: '1900000000002', mandant: '1900000000201'};
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  await p.evaluate(() => { window.__toasts = []; const t = toast; toast = function (m, ton) { window.__toasts.push([String(m), ton || 'ok']); return t.apply(this, arguments); }; });
  const out = [];
  for (const [nom, cni] of Object.entries(PROFILS).filter(([n]) => !process.env.PROFIL || process.env.PROFIL.split(',').includes(n))) {
    await loginAs(p, cni); await p.waitForTimeout(300);
    const home = await p.evaluate(() => Auth.home(Auth.current()));
    await goto(p, home); await p.waitForTimeout(500);
    /* Pages de départ : le menu, la barre du bas, et l'accueil de l'espace. */
    const pages = await p.evaluate(h => [...new Set([h, ...[...document.querySelectorAll('.sidebar a[href^="#/"], .tabbar a[href^="#/"], nav a[href^="#/"]')].map(a => a.getAttribute('href'))])]
      .filter(x => !/logout|#\/$|#\/login|#\/register|property\/new/.test(x)), home);
    const vus = new Set();
    for (const pg of pages) {
      await goto(p, pg); await p.waitForTimeout(450);
      const ici = await p.evaluate(() => location.hash);
      if (ici !== pg) { out.push({profil: nom, page: pg, label: '(menu)', href: pg, final: ici, souci: 'page du menu renvoyée ailleurs'}); continue; }
      const liens = await p.evaluate(() => [...document.querySelectorAll('.main a[href^="#/"], .content a[href^="#/"]')]
        .filter(a => a.offsetParent !== null && !a.closest('.sidebar, .tabbar, .mhead, nav'))
        .map(a => ({label: (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 90), href: a.getAttribute('href'), action: a.dataset.action || ''})));
      for (const l of liens) {
        const cle = pg + '|' + l.label + '|' + l.href; if (vus.has(cle)) continue; vus.add(cle);
        await p.evaluate(() => { window.__toasts = []; });
        const errs0 = p.errs.length;
        await goto(p, l.href); await p.waitForTimeout(220);
        const r = await p.evaluate(() => ({final: location.hash, inconnue: /Cette adresse n'existe pas/.test(document.body.innerText), toasts: window.__toasts.slice(),
          vide: !(document.querySelector('.main .content') || document.querySelector('#app')).innerText.trim(), titre: ((document.querySelector('.page-head h2, .page-head h1, .hero-banner h1, h1, h2') || {}).innerText || '').trim().slice(0, 60)}));
        const refus = r.toasts.find(t => t[1] === 'bad');
        const souci = r.inconnue ? 'page inexistante' : refus ? 'refus : ' + refus[0] : p.errs.length > errs0 ? 'erreur JS : ' + p.errs.slice(errs0).join(' | ') : r.vide ? 'page vide' : (r.final.split('?')[0] !== l.href.split('?')[0] ? 'renvoyé vers ' + r.final : '');
        out.push({profil: nom, page: pg, label: l.label, href: l.href, final: r.final, titre: r.titre, souci});
        await goto(p, pg); await p.waitForTimeout(120);
      }
    }
    console.log(nom, pages.length, 'pages', out.filter(x => x.profil === nom).length, 'liens', out.filter(x => x.profil === nom && x.souci).length, 'soucis');
  }
  fs.writeFileSync(__dirname + '/audit-liens' + (process.env.PROFIL ? '-' + process.env.PROFIL.replace(/,/g, '-') : '') + '.json', JSON.stringify(out, null, 1));
  console.log('erreurs JS', p.errs); await b.close();
})();
