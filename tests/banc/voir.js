/* node voir.js qui '#/hash' [--sans-bien] [--mobile] [--js "code"] [--png nom] */
const B = require('./banc'); const a = process.argv.slice(2);
const opt = k => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : null; };
(async () => {
  const s = await B.ouvrir({qui: a[0] === 'visiteur' ? null : a[0], hash: a[1], rentsSansBien: a.includes('--sans-bien'), mobile: a.includes('--mobile'), logout403: a.includes('--logout403'), refreshKo: a.includes('--refresh-ko')});
  if (opt('--js')) { const r = await s.page.evaluate(opt('--js')).catch(e => 'ERR ' + e.message); if (r !== undefined) console.log('JS>', typeof r === 'string' ? r : JSON.stringify(r)); await s.page.waitForTimeout(+(opt('--wait') || 800)); }
  const t = await s.page.evaluate(() => (document.querySelector('.main > .content') || document.querySelector('#app')).innerText + (document.querySelector('.modal') ? '\n[MODAL] ' + document.querySelector('.modal').innerText : '') + ([...document.querySelectorAll('.toast')].map(x => '\n[TOAST] ' + x.innerText).join('')));
  console.log(t.slice(0, +(opt('--max') || 3000)));
  if (opt('--png')) await s.page.screenshot({path: __dirname + '/' + opt('--png') + '.png', fullPage: a.includes('--full')});
  const err = s.erreurs.filter(x => !/ERR_TUNNEL|DB.pret/.test(x)); if (err.length) console.log('ERREURS', err);
  if (a.includes('--journal')) console.log(s.journal.filter(x => !/GET \/rest/.test(x)).join('\n'));
  await s.fermer(); B.arreter();
})();
