-- =============================================================================
-- Données SYNTHÉTIQUES pour mesurer les performances (base de TEST uniquement).
-- Volume visé (ordre de grandeur d'une plateforme régionale en croissance) :
--   1 500 propriétaires, 300 agences (+600 membres), 20 000 clients,
--   30 000 biens, 12 000 baux et locataires, 144 000 échéances de loyer,
--   60 000 visites, 200 000 notifications, 20 000 conversations / 120 000 messages,
--   30 000 factures, 30 000 encaissements, 20 000 documents, 10 000 tickets,
--   100 000 lignes de journal, 50 000 favoris.
-- Déterministe (setseed) ; identifiants dérivés de md5 pour être reproductibles.
-- NE PAS exécuter sur la production : le script crée des comptes d'authentification.
-- Lancer en une seule transaction : psql -1 -f donnees-synthetiques.sql
-- =============================================================================
\set ON_ERROR_STOP on
do $$ begin
  if exists (select 1 from public.profiles where email like '%@perf.deuksil.test') then
    raise exception 'Données synthétiques déjà présentes.';
  end if;
end $$;
select setseed(0.42);

-- Comptes : propriétaires, agences, clients
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('perf-owner-' || i)::uuid, 'authenticated', 'authenticated', 'proprio' || i || '@perf.deuksil.test',
       jsonb_build_object('deuksil_role', 'owner'), jsonb_build_object('first_name', 'Proprio', 'last_name', 'N' || i), now(), now()
  from generate_series(1, 1500) i;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('perf-agence-' || i)::uuid, 'authenticated', 'authenticated', 'agence' || i || '@perf.deuksil.test',
       jsonb_build_object('deuksil_role', 'agency'), jsonb_build_object('first_name', 'Agence', 'last_name', 'N' || i, 'agency_name', 'Agence ' || i), now(), now()
  from generate_series(1, 300) i;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('perf-membre-' || i)::uuid, 'authenticated', 'authenticated', 'membre' || i || '@perf.deuksil.test',
       jsonb_build_object('deuksil_role', case when i % 2 = 0 then 'agent' else 'manager' end, 'parent_id', md5('perf-agence-' || (1 + (i - 1) / 2))::uuid,
                          'perms', case when i % 2 = 0 then '["biens","visites","messages"]'::jsonb else '["biens","visites","messages","gestion","documents"]'::jsonb end),
       jsonb_build_object('first_name', 'Membre', 'last_name', 'N' || i), now(), now()
  from generate_series(1, 600) i;
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('perf-client-' || i)::uuid, 'authenticated', 'authenticated', 'client' || i || '@perf.deuksil.test',
       jsonb_build_object('deuksil_role', 'client'), jsonb_build_object('first_name', 'Client', 'last_name', 'N' || i), now(), now()
  from generate_series(1, 20000) i;

-- Espaces : 1..1500 propriétaires, 1501..1800 agences
create temporary table espaces as
  select row_number() over () as n, id from (
    select md5('perf-owner-' || i)::uuid as id from generate_series(1, 1500) i
    union all select md5('perf-agence-' || i)::uuid from generate_series(1, 300) i) s;

-- Biens : 30 000 (agences plus fournies que les particuliers)
insert into public.properties (id, owner_id, title, type, transaction, price, region, city, quartier, rooms, listing_status, status, created_at, published_at)
select md5('perf-bien-' || i)::uuid,
       (select id from espaces where n = case when i % 3 = 0 then 1501 + (i % 300) else 1 + (i % 1500) end),
       'Bien de test ' || i, (array['appartement','villa','studio','bureau','terrain'])[1 + i % 5],
       (array['location','vente','location','terrain'])[1 + i % 4], 50000 + (i % 400) * 5000,
       'Dakar', (array['Dakar','Thiès','Saint-Louis','Mbour','Ziguinchor','Rufisque'])[1 + (i / 7) % 6], 'Quartier ' || (i % 120), i % 7,
       case when i % 5 = 0 then 'brouillon' else 'publiee' end, 'disponible',
       now() - make_interval(days => i % 900), now() - make_interval(days => i % 900)
  from generate_series(1, 30000) i;

-- Baux : 12 000, un par bien (biens de location)
insert into public.leases (id, owner_id, property_id, tenant, rent, deposit, start, months, status, created_at)
select md5('perf-bail-' || i)::uuid, p.owner_id, p.id, 'Locataire ' || i, 100000 + (i % 50) * 10000, 200000,
       date '2025-01-01' + (i % 600), 12, 'actif', now() - make_interval(days => i % 600)
  from (select id, owner_id, (row_number() over (order by id))::int as i from public.properties where transaction = 'location' and title like 'Bien de test %') p
 where i <= 12000;
-- Locataires (comptes) rattachés à leur bail
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select md5('perf-locataire-' || l.id)::uuid, 'authenticated', 'authenticated', 'loc-' || left(l.id::text, 8) || '@perf.deuksil.test',
       jsonb_build_object('deuksil_role', 'tenant', 'owner_ref', l.owner_id, 'lease_id', l.id, 'lease_ids', jsonb_build_array(l.id)),
       jsonb_build_object('first_name', 'Locataire', 'last_name', left(l.id::text, 8)), now(), now()
  from public.leases l where l.tenant like 'Locataire %';
-- Échéances : 12 par bail
insert into public.rents (owner_id, lease_id, property_id, month, amount, paid_at, created_at)
select l.owner_id, l.id, l.property_id, to_char(l.start + make_interval(months => m), 'YYYY-MM'), l.rent,
       case when (l.start + make_interval(months => m))::date < current_date - 10 and random() < 0.9 then (l.start + make_interval(months => m))::date + 3 end,
       now()
  from public.leases l, generate_series(0, 11) m where l.tenant like 'Locataire %';

-- Visites : 60 000 (créneaux uniques par bien)
insert into public.visits (property_id, owner_id, client_id, status, date, time, created_at)
select p.id, p.owner_id, md5('perf-client-' || (1 + (i * 7919) % 20000))::uuid,
       (array['attente','acceptee','terminee','refusee','annulee'])[1 + i % 5],
       current_date - 300 + (i % 400), lpad((8 + i % 10)::text, 2, '0') || ':' || lpad(((i / 10) % 4 * 15)::text, 2, '0'), now() - make_interval(days => i % 300)
  from generate_series(1, 60000) i
  join public.properties p on p.id = md5('perf-bien-' || (1 + (i * 31) % 30000))::uuid
on conflict do nothing;

-- Notifications : 200 000
insert into public.notifications (user_id, text, link, read, created_at)
select case when i % 4 = 0 then (select id from espaces where n = 1 + i % 1800) else md5('perf-client-' || (1 + i % 20000))::uuid end,
       'Notification de test ' || i, '#/', random() < 0.7, now() - make_interval(mins => i)
  from generate_series(1, 200000) i;

-- Conversations (client ↔ espace) et messages
insert into public.conversations (id, participants, property_id, created_at)
select md5('perf-conv-' || i)::uuid, array[md5('perf-client-' || (1 + i % 20000))::uuid, p.owner_id], p.id, now() - make_interval(days => i % 365)
  from generate_series(1, 20000) i join public.properties p on p.id = md5('perf-bien-' || (1 + (i * 13) % 30000))::uuid;
insert into public.conversation_messages (conversation_id, sender_id, text, created_at)
select c.id, c.participants[1 + m % 2], 'Message ' || m, c.created_at + make_interval(hours => m)
  from public.conversations c, generate_series(1, 6) m where c.id in (select md5('perf-conv-' || i)::uuid from generate_series(1, 20000) i);

-- Facturation
insert into public.billing_docs (id, owner_id, type, ref, client, items, status, due, created_at)
select md5('perf-fac-' || i)::uuid, e.id, 'FAC', 'FAC-2026-' || lpad(i::text, 5, '0'), 'Client ' || i,
       jsonb_build_array(jsonb_build_object('label', 'Prestation', 'qty', 1, 'price', 50000 + i % 100 * 1000)), 'émise',
       current_date - 200 + (i % 300), now() - make_interval(days => i % 300)
  from generate_series(1, 30000) i join espaces e on e.n = 1 + i % 1800;
insert into public.billing_payments (owner_id, doc_id, doc_ref, amount, method, ref, created_at)
select d.owner_id, d.id, d.ref, 50000, 'Wave', 'PAY-2026-' || lpad(row_number() over ()::text, 6, '0'), d.created_at + interval '5 days'
  from public.billing_docs d where d.ref like 'FAC-2026-%' and random() < 0.8;

-- Documents, tickets, journal, favoris
insert into public.documents (owner_id, name, storage_path, expiry, created_at)
select e.id, 'Document ' || i, e.id || '/doc-' || i || '.pdf', case when i % 4 = 0 then current_date - 100 + i % 300 end, now() - make_interval(days => i % 500)
  from generate_series(1, 20000) i join espaces e on e.n = 1 + i % 1800;
insert into public.tickets (owner_id, property_id, title, status, created_at)
select l.owner_id, l.property_id, 'Panne ' || i, (array['ouvert','en cours','résolu'])[1 + i % 3], now() - make_interval(days => i % 400)
  from generate_series(1, 10000) i join public.leases l on l.id = md5('perf-bail-' || (1 + i % 12000))::uuid;
insert into public.audit_log (owner_id, who, action, detail, created_at)
select e.id, 'test', 'Action ' || (i % 20), 'détail ' || i, now() - make_interval(mins => i * 3)
  from generate_series(1, 100000) i join espaces e on e.n = 1 + i % 1800;
insert into public.favorites (user_id, property_id)
select md5('perf-client-' || (1 + i % 20000))::uuid, md5('perf-bien-' || (1 + (i * 17) % 30000))::uuid
  from generate_series(1, 50000) i on conflict do nothing;

analyze;
select relname as table, n_live_tup as lignes from pg_stat_user_tables where schemaname = 'public' and n_live_tup > 0 order by n_live_tup desc;
