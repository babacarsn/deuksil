// Audit des boutons : sur chaque page de chaque profil, on clique chaque bouton
// non destructif ; on relève les erreurs JS et les boutons qui ne font rien.
const {open, loginAs, goto} = require('./harnais.js');
const fs = require('fs');
const PROFILS = {admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004', agent: '1900000000012',
  client: '1900000000005', locataire: '1900000000002', mandant: '1900000000201'};
const DANGER = /del|suppr|delete|archive|cancel|resil|end-lease|g-end|logout|reject|refus|toggle|reset|user-del|odel|tdel|close-modal|vider|deconn/i;
(async () => {
  const nom = process.env.PROFIL, cni = PROFILS[nom];
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  p.on('console', m => { if (m.type() === 'error' && !/net::|Failed to load resource|ERR_/.test(m.text())) p.errs.push('console: ' + m.text()); });
  await loginAs(p, cni); await p.waitForTimeout(300);
  const home = await p.evaluate(() => Auth.home(Auth.current()));
  await goto(p, home); await p.waitForTimeout(500);
  const pages = await p.evaluate(h => [...new Set([h, ...[...document.querySelectorAll('.sidebar a[href^="#/"], .tabbar a[href^="#/"]')].map(a => a.getAttribute('href'))])]
    .filter(x => !/logout|#\/$|#\/login|#\/register/.test(x)), home);
  /* Pages de gestion visitées en plus : le hub et ses onglets. */
  if (['proprietaire', 'agence', 'gestionnaire', 'mandant'].includes(nom)) {
    await goto(p, '#/manage'); await p.waitForTimeout(500);
    (await p.evaluate(() => [...document.querySelectorAll('#app .content a[href^="#/manage/"]')].map(a => a.getAttribute('href').split('?')[0]))).forEach(h => { if (!pages.includes(h)) pages.push(h); });
  }
  const out = [];
  for (const pg of pages) {
    await goto(p, pg); await p.waitForTimeout(450);
    if (await p.evaluate(pg => location.hash !== pg, pg)) continue;
    const n = await p.evaluate(() => document.querySelectorAll('#app .content button, #app .content [data-action]:not(form)').length);
    for (let i = 0; i < Math.min(n, 60); i++) {
      const info = await p.evaluate(([i, D]) => {
        const el = [...document.querySelectorAll('#app .content button, #app .content [data-action]:not(form)')][i];
        if (!el || !el.offsetParent) return null;
        const a = el.dataset.action || '', t = (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
        if (new RegExp(D, 'i').test(a + ' ' + t) || el.type === 'submit' && !a || el.closest('form') && !a) return null;
        return {a, t, avant: document.querySelector('#app').innerHTML.length + '|' + location.hash + '|' + document.querySelectorAll('.modal').length};
      }, [i, DANGER.source]);
      if (!info) continue;
      const e0 = p.errs.length;
      await p.evaluate(i => { const el = [...document.querySelectorAll('#app .content button, #app .content [data-action]:not(form)')][i]; el && el.click(); }, i);
      await p.waitForTimeout(260);
      const apres = await p.evaluate(() => document.querySelector('#app').innerHTML.length + '|' + location.hash + '|' + document.querySelectorAll('.modal').length);
      const errs = p.errs.slice(e0);
      if (errs.length) out.push({page: pg, bouton: info.t, action: info.a, souci: 'erreur JS', detail: errs.join(' | ')});
      else if (apres === info.avant && !/ds-detail|rfiltre|^bf$|lien-tout|agent-portee|ag-mtype|seg|tab/.test(info.a)) out.push({page: pg, bouton: info.t, action: info.a, souci: 'aucun effet visible'});
      /* On referme ce qui s'est ouvert et on revient sur la page. */
      await p.evaluate(() => { try { closeModal(); } catch (e) {} });
      if (await p.evaluate(pg => location.hash !== pg, pg)) { await goto(p, pg); await p.waitForTimeout(300); }
    }
  }
  fs.writeFileSync(__dirname + '/audit-boutons-' + nom + '.json', JSON.stringify(out, null, 1));
  console.log(nom, pages.length, 'pages', out.length, 'soucis', 'erreurs JS totales', p.errs.length); await b.close();
})();
