// Harnais commun des tests navigateur — application branchée sur Supabase.
// L'application est servie par la passerelle de test (supabase/tests-local), qui
// relaie /auth/v1, /rest/v1, /storage/v1 et /functions/v1 vers une base de TEST
// remplie avec le jeu de données de test (jamais la production).
//   APP_URL            adresse de l'application (défaut : passerelle locale)
//   SUPABASE_URL       projet Supabase de TEST, s'il n'est pas servi par la même adresse
//   COMPTES_TEST       fichier JSON {cni, email, role, id} produit par l'import
//   MOT_DE_PASSE_TEST  mot de passe commun des comptes de test
const { chromium } = require('playwright');
const path = require('path');
const APP = process.env.APP_URL || 'http://127.0.0.1:54321/';
const MDP = process.env.MOT_DE_PASSE_TEST || 'Essai-Local-2026';
const COMPTES = require(process.env.COMPTES_TEST || path.resolve(__dirname, '../supabase/tests-local/comptes-test.json'));
// Sites autorisés pendant les tests : l'application et, si elle est hébergée à part, le projet Supabase de TEST.
const HOTES = new Set([new URL(APP).host, ...(process.env.SUPABASE_URL ? [new URL(process.env.SUPABASE_URL).host] : [])]);

async function open() {
  const b = await chromium.launch(); const ctx = await b.newContext({viewport: {width: 1280, height: 900}});
  await ctx.route(u => !HOTES.has(new URL(u).host), r => r.abort());   // aucun autre site
  const p = await ctx.newPage(); p.errs = []; p.refus = [];
  p.on('pageerror', e => p.errs.push(e.message));
  p.on('dialog', d => d.dismiss());
  p.on('response', r => { if (r.status() >= 400 && /\/(rest|auth|storage|functions)\/v1\//.test(r.url())) p.refus.push(r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '').slice(0, 120)); });
  await p.goto(APP); await pret(p);
  return {b, ctx, p};
}
/* L'application est prête quand ses données sont chargées depuis la base. */
async function pret(p) { await p.waitForFunction(() => typeof DB !== 'undefined' && DB.pret === true, null, {timeout: 20000}); await p.waitForTimeout(150); }
const emailDe = cni => { const c = COMPTES.find(x => x.cni === cni); if (!c) throw new Error('Compte de test inconnu : ' + cni); return c.email; };
/* Connexion réelle (Supabase Auth), comme un utilisateur. */
async function loginAs(p, cni) {
  await p.evaluate(async ([e, m]) => {
    if (Auth.current()) await Auth.logout(true);
    const r = await Auth.login(e, m); if (r.error) throw new Error(r.error);
    location.hash = '#/';
  }, [emailDe(cni), MDP]);
  await p.waitForTimeout(250);
}
async function logout(p) { await p.evaluate(async () => { if (Auth.current()) await Auth.logout(true); location.hash = '#/'; }); await p.waitForTimeout(200); }
async function goto(p, h) { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(350); }
/* Attendre que les écritures en cours soient enregistrées (ou refusées) par la base. */
async function enregistre(p) { await p.evaluate(() => DB.attendre()); }
module.exports = {open, pret, loginAs, logout, goto, enregistre, emailDe, APP, MDP, COMPTES};
