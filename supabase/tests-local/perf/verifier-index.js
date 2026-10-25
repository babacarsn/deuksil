// =============================================================================
// Vérifie que chaque index de la migration 0800 sert la requête pour laquelle il
// a été créé (base de TEST, données synthétiques).
//  * « choisi » : le planificateur l'utilise de lui-même avec les volumes actuels ;
//  * « utilisable » : avec enable_seqscan = off, le plan l'utilise — la forme de
//    la requête correspond à l'index ; sur une petite table, un parcours
//    séquentiel reste moins cher et c'est normal.
// Sortie : supabase/tests-local/perf/verification-index.json
// =============================================================================
const {Client} = require('pg'), fs = require('fs'), path = require('path');
const U = '00000000-0000-0000-0000-000000000001';
const REQ = {
  properties_owner_idx: `select id from public.properties where owner_id = '${U}'`,
  leases_owner_idx: `select id from public.leases where owner_id = '${U}'`,
  rents_owner_idx: `select id from public.rents where owner_id = '${U}'`,
  visits_owner_date_idx: `select id from public.visits where owner_id = '${U}' and date >= current_date`,
  billing_payments_owner_idx: `select id from public.billing_payments where owner_id = '${U}'`,
  documents_owner_idx: `select id from public.documents where owner_id = '${U}'`,
  tickets_owner_idx: `select id from public.tickets where owner_id = '${U}'`,
  expenses_owner_idx: `select id from public.expenses where owner_id = '${U}'`,
  contracts_owner_idx: `select id from public.contracts where owner_id = '${U}'`,
  deals_owner_idx: `select id from public.deals where owner_id = '${U}'`,
  owner_records_owner_idx: `select id from public.owner_records where owner_id = '${U}'`,
  mandates_owner_idx: `select id from public.mandates where owner_id = '${U}'`,
  sale_mandates_owner_idx: `select id from public.sale_mandates where owner_id = '${U}'`,
  owner_transfers_owner_idx: `select id from public.owner_transfers where owner_id = '${U}'`,
  fees_owner_idx: `select id from public.fees where owner_id = '${U}'`,
  providers_owner_idx: `select id from public.providers where owner_id = '${U}'`,
  client_requests_owner_idx: `select id from public.client_requests where owner_id = '${U}'`,
  audit_log_owner_date_idx: `select id from public.audit_log where owner_id = '${U}' order by created_at desc limit 50`,
  notifications_user_date_idx: `select id from public.notifications where user_id = '${U}' order by created_at limit 1000`,
  visits_client_idx: `select id from public.visits where client_id = '${U}'`,
  saved_searches_user_idx: `select id from public.saved_searches where user_id = '${U}'`,
  activity_log_actor_idx: `select id from public.activity_log where actor_id = '${U}'`,
  reports_reporter_idx: `select id from public.reports where reporter_id = '${U}'`,
  tickets_tenant_idx: `select id from public.tickets where tenant_id = '${U}'`,
  billing_docs_client_idx: `select id from public.billing_docs where client_id = '${U}'`,
  billing_payments_client_idx: `select id from public.billing_payments where client_id = '${U}'`,
  deals_client_idx: `select id from public.deals where client_id = '${U}'`,
  contracts_client_idx: `select id from public.contracts where client_id = '${U}'`,
  fees_agent_idx: `select id from public.fees where agent_id = '${U}'`,
  client_requests_agent_idx: `select id from public.client_requests where agent_id = '${U}'`,
  fees_apporteur_idx: `select id from public.fees where apporteur_id = '${U}'`,
  mandates_mandant_idx: `select id from public.mandates where owner_id2 = '${U}'`,
  sale_mandates_mandant_idx: `select id from public.sale_mandates where owner_id2 = '${U}'`,
  owner_transfers_mandant_idx: `select id from public.owner_transfers where owner_id2 = '${U}'`,
  agency_link_agence_idx: `select id from public.agency_link_requests where agence_id = '${U}'`,
  conversations_participants_gin: `select id from public.conversations where participants @> array['${U}'::uuid]`,
  conversation_messages_conv_idx: `select id from public.conversation_messages where conversation_id = '${U}' order by created_at`,
  conversation_messages_sender_idx: `select id from public.conversation_messages where sender_id = '${U}'`,
  lease_messages_lease_idx: `select id from public.lease_messages where lease_id = '${U}' order by created_at`,
  profiles_parent_idx: `select id from public.profiles where parent_id = '${U}'`,
  profiles_owner_ref_idx: `select id from public.profiles where owner_ref = '${U}'`,
  profiles_mandant_of_idx: `select id from public.profiles where mandant_of = '${U}'`,
  profiles_lease_idx: `select id from public.profiles where lease_id = '${U}'`,
  profiles_lease_ids_gin: `select id from public.profiles where lease_ids @> array['${U}'::uuid]`,
  owner_records_compte_idx: `select id from public.owner_records where compte_id = '${U}'`,
  properties_client_owner_idx: `select id from public.properties where client_owner_id = '${U}'`,
  properties_agent_idx: `select id from public.properties where agent_id = '${U}'`,
  properties_publiees_date_idx: `select id from public.properties where listing_status = 'publiee' order by created_at limit 1000`,
  leases_property_idx: `select id from public.leases where property_id = '${U}'`,
  rents_property_idx: `select id from public.rents where property_id = '${U}'`,
  billing_docs_property_idx: `select id from public.billing_docs where property_id = '${U}'`,
  expenses_property_idx: `select id from public.expenses where property_id = '${U}'`,
  tickets_property_idx: `select id from public.tickets where property_id = '${U}'`,
  favorites_property_idx: `select id from public.favorites where property_id = '${U}'`,
  billing_payments_doc_idx: `select id from public.billing_payments where doc_id = '${U}'`,
  documents_expiry_idx: `select id from public.documents where expiry <= current_date + 30`,
  visits_a_venir_idx: `select id from public.visits where status in ('attente', 'acceptee') and date in (current_date, current_date + 1)`,
  rents_impayes_idx: `select id from public.rents where paid_at is null and lease_id = '${U}'`
};
(async () => {
  const db = new Client({connectionString: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:54322/postgres'}); await db.connect();
  const out = [];
  for (const [idx, sql] of Object.entries(REQ)) {
    const ex = await db.query(`select 1 from pg_indexes where indexname = $1`, [idx]);
    if (!ex.rowCount) { out.push({index: idx, existe: false}); console.log('ABSENT  ', idx); continue; }
    const plan = async off => { await db.query('begin'); if (off) await db.query('set local enable_seqscan = off');
      const r = await db.query('explain (format json) ' + sql); await db.query('rollback'); return JSON.stringify(r.rows[0]['QUERY PLAN']); };
    const choisi = (await plan(false)).includes(`"Index Name":"${idx}"`), utilisable = choisi || (await plan(true)).includes(`"Index Name":"${idx}"`);
    const t = (await db.query(`select c.reltuples::bigint n from pg_index i join pg_class c on c.oid = i.indrelid join pg_class x on x.oid = i.indexrelid where x.relname = $1`, [idx])).rows[0].n;
    out.push({index: idx, requete: sql, lignes_table: +t, choisi, utilisable});
    console.log(`${choisi ? 'CHOISI  ' : utilisable ? 'UTILIS. ' : 'INUTILE '} ${idx.padEnd(34)} (${t} lignes)`);
  }
  fs.writeFileSync(path.join(__dirname, 'verification-index.json'), JSON.stringify({date: new Date().toISOString(), resultats: out}, null, 2));
  await db.end(); process.exit(out.some(x => !x.utilisable) ? 1 : 0);
})();
