// Harnais commun : ouvre l'app, connexion directe par session.
const { chromium } = require('playwright');
const APP = 'file://' + (process.env.APP || require('path').resolve(__dirname, '..')) + '/index.html';
async function open() {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport:{width:1280,height:900}});
  await ctx.route(/^https?:/, r => r.abort());
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.dismiss());
  await p.goto(APP); await p.waitForTimeout(800);
  return {b, ctx, p};
}
async function loginAs(p, cni) {
  await p.evaluate(c => { const u = DB.findItem(DB.K.users, x => x.cni === c); localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()})); }, cni);
  await p.evaluate(() => { location.hash = '#/'; }); await p.waitForTimeout(150);
}
async function goto(p, h) { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(350); }
module.exports = {open, loginAs, goto, APP};
