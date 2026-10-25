// Sonde XSS stockée — base de TEST uniquement.
// 1. Insère une charge HTML/JS dans TOUS les champs texte modifiables de la base
//    (comme si un utilisateur malveillant les avait saisis) ;
// 2. visite chaque page du menu de chaque profil ;
// 3. échoue si la charge s'exécute (window.__xss) ou si un élément <img onerror>
//    issu des données apparaît dans le DOM.
// Les champs refusés par une contrainte (format, liste fermée) sont ignorés : la
// base les protège déjà.
const {Client} = require('pg');
const {open, loginAs, logout, goto} = require('./harnais.js');
const URL_DB = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres';
if (!/127\.0\.0\.1|localhost/.test(URL_DB) && process.env.DEUKSIL_TEST_AUTORISE !== '1') { console.error('Base non locale : refus (DEUKSIL_TEST_AUTORISE=1 pour un projet de TEST dédié).'); process.exit(2); }
const CHARGE = `"><img src=x data-xss=1 onerror="window.__xss=(window.__xss||[]).concat(location.hash)">'`;
const PROFILS = {visiteur: null, admin: '1900000000001', proprietaire: '1900000000003', gestionnaire: '1900000000011', agence: '1900000000004',
  agent: '1900000000012', client: '1900000000006', locataire: '1900000000002', mandant: '1900000000031'};
const SAUF = /^(id|.*_id|role|status|statut|type|transaction|listing_status|prev_listing|month|time|link|email|cni|key|storage_path|mime|phone|ref|rec|kind|stage|mode|payer|lien|verif_level|perms|method|pay_ref|src_ref|pj_src|source|cat|category|priority|genre|caution_chez|caution_statut|doc_ref|unit_ref|promise_ref|act_ref|who|owner_decision|decided_by|ninea|rccm|avatar_url|photo|hours)$/;

(async () => {
  const db = new Client({connectionString: URL_DB}); await db.connect();
  const cols = (await db.query(`select table_name t, column_name c, data_type d from information_schema.columns
    where table_schema = 'public' and data_type in ('text', 'jsonb') and table_name not in ('audit_log') order by 1, 2`)).rows;
  let ok = 0, ko = 0;
  await db.query('begin');
  for (const {t, c, d} of cols) {
    if (SAUF.test(c)) continue;
    await db.query('savepoint s');
    try {
      if (d === 'text') await db.query(`update public.${t} set "${c}" = coalesce("${c}", '') || $1 where "${c}" is not null or random() < 0.5`, [CHARGE]);
      else if (c === 'items') await db.query(`update public.${t} set items = (select coalesce(jsonb_agg(jsonb_set(i, '{label}', to_jsonb(coalesce(i->>'label', '') || $1::text))), '[]') from jsonb_array_elements(items) i) where jsonb_typeof(items) = 'array'`, [CHARGE]);
      else continue;
      await db.query('release savepoint s'); ok++;
    } catch (e) { await db.query('rollback to savepoint s'); ko++; }
  }
  await db.query('commit'); await db.end();
  console.log(`charge insérée dans ${ok} colonnes (${ko} refusées par une contrainte)`);

  const {b, p} = await open(); const trouves = [];
  for (const [nom, cni] of Object.entries(PROFILS)) {
    try { if (cni) await loginAs(p, cni); else await logout(p); } catch (e) { console.log(nom, 'connexion', e.message); continue; }
    const home = cni ? await p.evaluate(() => Auth.home(Auth.current())) : '#/';
    await goto(p, home); await p.waitForTimeout(400);
    const pages = await p.evaluate(h => [...new Set([h, '#/search', ...[...document.querySelectorAll('.sidebar a[href^="#/"], .side a[href^="#/"], .tabbar a[href^="#/"]')].map(a => a.getAttribute('href'))])].filter(x => !/logout|#\/#|#\/$/.test(x)), home);
    // fiches d'annonces : les données des annonceurs y sont affichées
    pages.push(...await p.evaluate(() => DB.getData(DB.K.properties).slice(0, 3).map(x => '#/property/' + x.id)));
    for (const pg of pages) {
      await goto(p, pg); await p.waitForTimeout(350);
      const r = await p.evaluate(() => ({x: window.__xss || [], dom: document.querySelectorAll('img[data-xss]').length}));
      if (r.x.length || r.dom) { trouves.push(`${nom} ${pg} : ${r.x.length} exécution(s), ${r.dom} élément(s) injecté(s)`); await p.evaluate(() => { window.__xss = []; document.querySelectorAll('img[data-xss]').forEach(e => e.remove()); }); }
    }
    console.log(`${nom} : ${pages.length} pages visitées`);
  }
  await b.close();
  if (trouves.length) { console.log('\nINJECTIONS DÉTECTÉES :\n  ' + trouves.join('\n  ')); process.exit(1); }
  console.log('\nAucune exécution ni élément injecté détecté.'); process.exit(0);
})().catch(e => { console.error(e); process.exit(2); });
