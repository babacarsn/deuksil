// =============================================================================
// Mesure des requêtes représentatives de DEUKSIL — base de TEST avec les données
// synthétiques (donnees-synthetiques.sql). Chaque requête est exécutée comme le
// ferait PostgREST : rôle « authenticated » (ou « anon ») et claims JWT de
// l'utilisateur, donc AVEC la RLS. Les requêtes qui écrivent sont annulées
// (ROLLBACK). Aucun chiffre n'est estimé : tout vient d'EXPLAIN ANALYZE.
//
//   DATABASE_URL=postgres://postgres@127.0.0.1:54322/postgres \
//   node supabase/tests-local/perf/mesurer.js avant      (puis « apres »)
// Sortie : supabase/tests-local/perf/resultats-<etiquette>.json
// =============================================================================
const {Client} = require('pg'), fs = require('fs'), path = require('path');
const ETIQ = process.argv[2] || 'mesure', RUNS = +process.env.RUNS || 7;
const URL_DB = process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres';
if (!/127\.0\.0\.1|localhost/.test(URL_DB) && process.env.DEUKSIL_TEST_AUTORISE !== '1') { console.error('Base non locale : refus.'); process.exit(2); }

const md5uuid = s => { const h = require('crypto').createHash('md5').update(s).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const QUI = {
  proprietaire: md5uuid('perf-owner-1'), agence: md5uuid('perf-agence-1'), agent: md5uuid('perf-membre-2'),
  client: md5uuid('perf-client-2'),
  admin: '716d80b4-c644-5528-bfdc-5db5d85cab75'   // administrateur du jeu de test (comptes-test.json)
};
const C = t => `select * from public.${t} order by created_at limit 1000 offset 0`;   // forme des lectures de l'interface (03-storage)
const SCENARIOS = [
  ['anon', null, 'Catalogue public (annonces publiées)', `select * from public.properties order by created_at limit 1000`],
  ['anon', null, 'Annuaire public (rpc annuaire)', `select * from public.annuaire()`],
  ['proprietaire', 'proprietaire', 'Propriétaire : annuaire (rpc annuaire)', `select * from public.annuaire()`],
  ['client', 'client', 'Client : annuaire (rpc annuaire)', `select * from public.annuaire()`],
  ['proprietaire', 'proprietaire', 'Propriétaire : ses biens', C('properties')],
  ['proprietaire', 'proprietaire', 'Propriétaire : ses baux', C('leases')],
  ['proprietaire', 'proprietaire', 'Propriétaire : ses loyers', C('rents')],
  ['proprietaire', 'proprietaire', 'Propriétaire : ses visites', C('visits')],
  ['proprietaire', 'proprietaire', 'Propriétaire : ses notifications', C('notifications')],
  ['proprietaire', 'proprietaire', 'Propriétaire : conversations', C('conversations')],
  ['proprietaire', 'proprietaire', 'Propriétaire : messages des conversations', C('conversation_messages')],
  ['proprietaire', 'proprietaire', 'Propriétaire : profils visibles', C('profiles')],
  ['agence', 'agence', 'Agence : factures', C('billing_docs')],
  ['agence', 'agence', 'Agence : encaissements', C('billing_payments')],
  ['agence', 'agence', 'Agence : documents', C('documents')],
  ['agence', 'agence', 'Agence : tickets', C('tickets')],
  ['agence', 'agence', 'Agence : journal d\'audit', C('audit_log')],
  ['agent', 'agent', 'Agent : biens de l\'agence', C('properties')],
  ['agent', 'agent', 'Agent : visites de l\'agence', C('visits')],
  ['locataire', 'locataire', 'Locataire : ses loyers', C('rents')],
  ['locataire', 'locataire', 'Locataire : son bail', C('leases')],
  ['locataire', 'locataire', 'Locataire : tickets', C('tickets')],
  ['client', 'client', 'Client : ses visites', C('visits')],
  ['client', 'client', 'Client : ses favoris', C('favorites')],
  ['client', 'client', 'Client : ses notifications', C('notifications')],
  ['client', 'client', 'Client : conversations', C('conversations')],
  ['client', 'client', 'Client : messages', C('conversation_messages')],
  ['client', 'client', 'Client : notifier un propriétaire contacté', 'NOTIFIER', true],
  ['admin', 'admin', 'Administrateur : biens (tous)', C('properties')],
  ['admin', 'admin', 'Administrateur : loyers (tous)', C('rents')],
  ['admin', 'admin', 'Administrateur : messages (tous)', C('conversation_messages')],
  ['serveur', null, 'Rappels quotidiens (app.generer_rappels)', `select * from app.generer_rappels()`, true, 2],
  ['proprietaire', 'proprietaire', 'Suppression d\'un bien (cascade)', `delete from public.properties where id = (select id from public.properties where owner_id = '${QUI.proprietaire}' and not exists (select 1 from public.leases l where l.property_id = properties.id) limit 1)`, true],
  ['serveur', null, 'Suppression d\'un compte client (cascade)', `delete from auth.users where id = '${QUI.client}'`, true]
];

const mediane = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
function parcours(n, f) { f(n); (n.Plans || []).forEach(x => parcours(x, f)); }

(async () => {
  const db = new Client({connectionString: URL_DB}); await db.connect();
  const loc = await db.query(`select id from public.profiles where email like 'loc-%@perf.deuksil.test' order by email limit 1`);
  QUI.locataire = loc.rows[0] && loc.rows[0].id;
  // destinataire en relation avec le client : l'autre participant de sa conversation
  const conv = await db.query(`select participants[2] as dest from public.conversations where $1 = any (participants) limit 1`, [QUI.client]);
  const sc = SCENARIOS.find(x => x[3] === 'NOTIFIER'); sc[3] = `select public.notifier('${conv.rows[0].dest}', 'Test de mesure', '#/')`;
  const res = [];
  for (const [role, qui, nom, sql, ecrit, passages] of SCENARIOS) {
    const temps = [], plans = [];
    for (let i = 0; i <= (passages || RUNS); i++) {
      await db.query('begin');
      try {
        if (role === 'anon') { await db.query(`select set_config('request.jwt.claims', '{"role":"anon"}', true)`); await db.query('set local role anon'); }
        else if (role !== 'serveur') { await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({sub: QUI[qui], role: 'authenticated'})]); await db.query('set local role authenticated'); }
        const r = await db.query(`explain (analyze, buffers, format json) ${sql}`);
        const p = r.rows[0]['QUERY PLAN'][0];
        if (i > 0) { temps.push(p['Execution Time'] + p['Planning Time']); plans.push(p); }   // 1er passage = mise en cache
      } finally { await db.query('rollback'); }
    }
    const p = plans[0], seq = [], idx = new Set();
    parcours(p.Plan, n => {
      if (n['Node Type'] === 'Seq Scan') seq.push(`${n['Relation Name']} (${n['Actual Rows']} lignes gardées, ${n['Rows Removed by Filter'] || 0} écartées)`);
      if (/Index/.test(n['Node Type']) && n['Index Name']) idx.add(n['Index Name']);
    });
    res.push({role, nom, sql, ecrit: !!ecrit, passages: passages || RUNS, ms_mediane: +mediane(temps).toFixed(3), ms_min: +Math.min(...temps).toFixed(3), ms_max: +Math.max(...temps).toFixed(3),
      lignes: p.Plan['Actual Rows'], tampons_lus: (p.Plan['Shared Hit Blocks'] || 0) + (p.Plan['Shared Read Blocks'] || 0), parcours_sequentiels: seq, index: [...idx]});
    console.log(`${mediane(temps).toFixed(2).padStart(9)} ms  ${String(p.Plan['Actual Rows']).padStart(6)} l.  ${nom}${seq.length ? '  [seq: ' + seq.map(s => s.split(' ')[0]).join(', ') + ']' : ''}`);
  }
  const vol = (await db.query(`select relname, n_live_tup from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc`)).rows;
  fs.writeFileSync(path.join(__dirname, `resultats-${ETIQ}.json`), JSON.stringify({etiquette: ETIQ, date: new Date().toISOString(), passages: RUNS,
    postgres: (await db.query('show server_version')).rows[0].server_version, volumes: vol, resultats: res}, null, 2));
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
