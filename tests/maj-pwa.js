// Application installée : service worker actif, mise à jour détectée et appliquée, données conservées.
// À lancer avec SRV=<dossier servi> URL=http://localhost:8765/
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path');
let ok = 0, ko = 0; const t = (c, m) => { c ? ok++ : ko++; console.log((c ? '✓ ' : '✗ ') + m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 390, height: 844}}); const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(process.env.URL + 'index.html'); await p.waitForTimeout(4500);
  t(await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())), 'Service worker enregistré');
  await p.reload(); await p.waitForTimeout(1500);
  t(await p.evaluate(() => !!navigator.serviceWorker.controller), 'Il contrôle la page après rechargement');
  await p.evaluate(() => localStorage.setItem('test_donnee', 'garde-moi'));
  await p.evaluate(() => window.verifierMiseAJour()); await p.waitForTimeout(800);   // signature de départ
  const f = path.join(process.env.SRV, 'js/98-cartes.js');
  fs.appendFileSync(f, '\n/* nouvelle version ' + Date.now() + ' */\n'); await new Promise(r => setTimeout(r, 1100)); fs.appendFileSync(f, '\n');
  const nav = p.waitForEvent('load', {timeout: 8000}).then(() => true).catch(() => false);
  await p.evaluate(() => window.verifierMiseAJour());
  t(await nav, 'Fichier modifié sur le serveur → l\'application se recharge seule');
  await p.waitForTimeout(1500);
  t(await p.evaluate(async () => (await (await fetch('js/98-cartes.js')).text()).includes('nouvelle version')), 'La nouvelle version du fichier est servie (pas l\'ancienne copie)');
  t(await p.evaluate(() => localStorage.getItem('test_donnee') === 'garde-moi'), 'Les données de l\'utilisateur sont conservées');
  // Saisie en cours → bandeau au lieu de recharger
  await p.evaluate(() => window.verifierMiseAJour()); await p.waitForTimeout(800);
  await p.evaluate(() => { const i = document.createElement('input'); i.id = 'zz'; document.body.appendChild(i); i.focus(); });
  fs.appendFileSync(f, '\n/* encore ' + Date.now() + ' */\n');
  await p.evaluate(() => window.verifierMiseAJour()); await p.waitForTimeout(1200);
  t(await p.evaluate(() => !!document.querySelector('.maj-bandeau') && !!document.getElementById('zz')), 'Saisie en cours : bandeau « Mettre à jour », pas de rechargement');
  // Hors ligne : la copie locale prend le relais
  await ctx.setOffline(true); await p.reload().catch(() => {}); await p.waitForTimeout(2500);
  t(await p.evaluate(() => typeof Auth !== 'undefined' && !!document.querySelector('#app').innerText.trim()), 'Hors ligne : l\'application s\'ouvre quand même');
  await ctx.setOffline(false);
  t(errs.length === 0, 'Aucune erreur JS ' + errs.join(' | '));
  console.log(`\n${ok}/${ok + ko}`); await b.close(); process.exit(ko ? 1 : 0);
})();
