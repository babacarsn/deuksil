-- =============================================================================
-- DEUKSIL — Migration 0800 : performances (RLS, fonctions, index)
--
-- Mesures AVANT / APRÈS : supabase/tests-local/perf (données synthétiques,
-- EXPLAIN ANALYZE avec la RLS de chaque rôle) et docs/PERFORMANCES.md.
-- Constats sur ~1 million de lignes de test :
--   * app.biens_mandant() et app.biens_locataire() appelaient app.mes_fiches() /
--     app.mes_baux() POUR CHAQUE LIGNE parcourue (30 000 biens, 12 000 baux) :
--     ~250 ms ajoutées à toute lecture de biens, baux, loyers, factures, dépenses ;
--   * la politique des annonces publiques appelait app.compte_actif(owner_id) par
--     ligne (SubPlan) ;
--   * « x = any (participants) » ne peut utiliser aucun index : les conversations
--     et TOUS les messages étaient parcourus à chaque lecture ;
--   * public.annuaire() (appelée à chaque chargement) prenait ~20 s connecté ;
--   * app.generer_rappels() prenait ~71 s (jointure OR sur profiles, sous-requêtes
--     corrélées par facture).
-- Aucune règle d'accès n'est élargie : les fonctions et politiques réécrites
-- renvoient les mêmes lignes (vérifié par supabase/tests-local/securite-rls.test.js).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fonctions d'appartenance : l'ensemble est calculé UNE fois par requête
-- ---------------------------------------------------------------------------
create or replace function app.biens_locataire() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l.property_id), '{}') from public.leases l where l.id = any ((select app.mes_baux())::uuid[])
$$;

create or replace function app.biens_mandant() returns uuid[]
language sql stable security definer set search_path = '' as $$
  with f as (select app.mes_fiches() as fiches)
  select coalesce(array_agg(p.id), '{}') from public.properties p, f
   where cardinality(f.fiches) > 0 and p.client_owner_id = any (f.fiches)
$$;

-- Comptes non actifs (suspendus) : liste courte, calculée une fois par requête.
create or replace function app.comptes_inactifs() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.id), '{}') from public.profiles p where p.status <> 'actif'
$$;
grant execute on function app.comptes_inactifs() to anon, authenticated;

-- Conversations visibles : celles où l'utilisateur participe (lui-même, ou son espace
-- s'il a la permission « messages ») ; toutes pour l'administration. Deux recherches
-- indexées (GIN sur participants). Les politiques n'ont alors qu'UN prédicat
-- « id = any (…) », servi par un index (un « OR est_admin » forçait un parcours complet).
create or replace function app.mes_conversations() returns uuid[]
language sql stable security definer set search_path = '' as $$
  with moi as (select auth.uid() as uid, app.espace() as esp, app.a_droit('messages') as droit, app.est_admin() as admin)
  select case when (select admin from moi) then (select coalesce(array_agg(c.id), '{}') from public.conversations c)
  else (select coalesce(array_agg(distinct x), '{}') from (
    select c.id x from public.conversations c where c.participants @> array[(select uid from moi)]
    union all
    select c.id from public.conversations c where (select droit from moi) and (select esp from moi) is not null
       and c.participants @> array[(select esp from moi)]
  ) s) end
$$;
grant execute on function app.mes_conversations() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Politiques réécrites (mêmes règles, prédicats indexables)
-- ---------------------------------------------------------------------------
drop policy "annonce publiée : lecture" on public.properties;
create policy "annonce publiée : lecture" on public.properties for select to anon, authenticated
  using (listing_status = 'publiee' and not (owner_id = any ((select app.comptes_inactifs())::uuid[])));

drop policy "conversation : lecture" on public.conversations;
drop policy "conversation : création" on public.conversations;
drop policy "conversation : modification" on public.conversations;
-- Trois prédicats tous indexables (GIN sur participants, clé primaire) : le
-- planificateur combine les index (BitmapOr) au lieu de parcourir la table.
create or replace function app.toutes_conversations_admin() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select case when app.est_admin() then (select coalesce(array_agg(c.id), '{}') from public.conversations c) else '{}'::uuid[] end
$$;
grant execute on function app.toutes_conversations_admin() to authenticated;
create policy "conversation : lecture" on public.conversations for select to authenticated using (
  participants @> array[(select auth.uid())]
  or ((select app.a_droit('messages')) and participants @> array[(select app.espace())])
  or id = any ((select app.toutes_conversations_admin())::uuid[]));
create policy "conversation : création" on public.conversations for insert to authenticated with check (
  participants @> array[(select auth.uid())]
  or ((select app.a_droit('messages')) and participants @> array[(select app.espace())]));
create policy "conversation : modification" on public.conversations for update to authenticated
  using (participants @> array[(select auth.uid())] or ((select app.a_droit('messages')) and participants @> array[(select app.espace())]))
  with check (participants @> array[(select auth.uid())] or ((select app.a_droit('messages')) and participants @> array[(select app.espace())]));

drop policy "message : lecture" on public.conversation_messages;
drop policy "message : lu" on public.conversation_messages;
create policy "message : lecture" on public.conversation_messages for select to authenticated
  using (conversation_id = any ((select app.mes_conversations())::uuid[]));
create policy "message : lu" on public.conversation_messages for update to authenticated
  using (conversation_id = any ((select app.mes_conversations())::uuid[]))
  with check (conversation_id = any ((select app.mes_conversations())::uuid[]));

-- Lecture administrateur exprimée par un intervalle sur owner_id (indexable) au lieu
-- d'un « OR est_admin() » : un seul bras non indexable dans un OU de politiques
-- oblige PostgreSQL à parcourir TOUTE la table, même pour un utilisateur qui ne voit
-- que ses 12 lignes. Pour un administrateur, l'intervalle couvre tous les
-- identifiants (même résultat qu'avant) ; pour les autres, il est vide (NULL).
create or replace function app.admin_borne_min() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when app.est_admin() then '00000000-0000-0000-0000-000000000000'::uuid end
$$;
create or replace function app.admin_borne_max() returns uuid
language sql stable security definer set search_path = '' as $$
  select case when app.est_admin() then 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid end
$$;
grant execute on function app.admin_borne_min(), app.admin_borne_max() to authenticated;
do $$
declare t text;
begin
  foreach t in array array['properties','units','visits','client_requests','leases','rents','lease_messages','inspections',
    'providers','tickets','deals','contracts','billing_docs','billing_payments','expenses','owner_records','mandates',
    'sale_mandates','owner_transfers','fees','documents'] loop
    execute format('drop policy "admin : lecture" on public.%I', t);
    execute format('create policy "admin : lecture" on public.%I for select to authenticated using (owner_id between (select app.admin_borne_min()) and (select app.admin_borne_max()))', t);
  end loop;
end $$;
drop policy "audit : lecture" on public.audit_log;
create policy "audit : lecture" on public.audit_log for select to authenticated
  using ((owner_id = (select app.espace()) and (select app.a_droit('finances')))
         or owner_id between (select app.admin_borne_min()) and (select app.admin_borne_max()));

-- ---------------------------------------------------------------------------
-- 3. Annuaire : relations calculées par des recherches indexées, une seule fois
-- ---------------------------------------------------------------------------
create or replace function public.annuaire()
returns table (id uuid, role text, status text, first_name text, last_name text, agency_name text, agency_desc text,
               address text, avatar_url text, verif_level text, hours text, phone text, email text, parent_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with moi as materialized (select auth.uid() as uid, app.espace() as esp, app.mes_baux() as baux),
  relations as materialized (
    select v.client_id x from public.visits v where v.owner_id = (select esp from moi)
    union select d.client_id from public.deals d where d.owner_id = (select esp from moi)
    union select b.client_id from public.billing_docs b where b.owner_id = (select esp from moi)
    union select v.owner_id from public.visits v where v.client_id = (select uid from moi)
    union select l.owner_id from public.leases l where l.id = any ((select baux from moi)::uuid[])
    union select p.id from public.profiles p where p.lease_ids && (select coalesce(array_agg(l.id), '{}') from public.leases l where l.owner_id = (select esp from moi))
    union select unnest(c.participants) from public.conversations c where c.participants @> array[(select uid from moi)]
    union select unnest(c.participants) from public.conversations c where c.participants @> array[(select esp from moi)]
    union select r.proprio_id from public.agency_link_requests r where r.agence_id = (select esp from moi)
    union select o.compte_id from public.owner_records o where o.owner_id = (select esp from moi)
    union select o.owner_id from public.owner_records o where o.compte_id = (select uid from moi)
    union select p.id from public.profiles p where p.parent_id = (select esp from moi)
    union select esp from moi
  )
  select p.id, p.role, p.status, p.first_name,
         case when p.role in ('owner','agency','admin') or (select uid from moi) is not null then p.last_name else left(p.last_name, 1) end,
         p.agency_name, p.agency_desc, case when p.role = 'agency' then p.address end,
         p.avatar_url, p.verif_level, p.hours,
         case when (select uid from moi) is not null then p.phone end,
         case when (select uid from moi) is not null and (p.role in ('owner','agency') or p.id in (select x from relations)) then p.email end,
         p.parent_id, p.created_at
  from public.profiles p
  where p.status = 'actif'
    and ((p.role in ('owner','agency') and p.parent_id is null)
         or ((select uid from moi) is not null and p.id in (select x from relations where x is not null)))
$$;

-- ---------------------------------------------------------------------------
-- 4. Rappels quotidiens : jointures indexables, agrégats calculés une fois
-- ---------------------------------------------------------------------------
create or replace function app.generer_rappels(jour date default (now() at time zone 'Africa/Dakar')::date)
returns table (categorie text, nombre integer)
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  -- Contrats arrivés à échéance → « expiré » (+ journal de l'espace)
  with expires as (
    update public.contracts c set status = 'expiré', updated_at = now()
     where c.status = 'actif' and c."end" is not null and c."end" < jour
    returning c.owner_id, c.ref)
  , j as (insert into public.audit_log (owner_id, who, action, detail)
          select owner_id, 'DEUKSIL', 'Contrat expiré', ref from expires returning 1)
  select count(*) into n from j;
  categorie := 'contrats expirés'; nombre := n; return next;

  categorie := 'baux reconduits'; nombre := app.reconduire_baux(jour); return next;

  -- Loyers : bientôt dus (J-3 à J) ou en retard, au bailleur et au locataire
  with echeances as (
    select r.id, r.owner_id, l.id as bail, l.tenant,
           make_date(left(r.month, 4)::int, right(r.month, 2)::int,
                     least(l.due_day, extract(day from (date_trunc('month', to_date(r.month, 'YYYY-MM')) + interval '1 month - 1 day'))::int)) as du,
           (array['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'])[right(r.month, 2)::int] || ' ' || left(r.month, 4) as mois
      from public.rents r join public.leases l on l.id = r.lease_id
     where r.paid_at is null
       and r.amount > coalesce((select sum(coalesce((p->>'amount')::numeric, 0)) from jsonb_array_elements(
             case when jsonb_typeof(r.payments) = 'array' then r.payments else '[]'::jsonb end) p), 0))
  , typees as (
    select e.*, case when e.du - jour between 0 and 3 then 'rd' when e.du < jour then 'rl' end as k from echeances e)
  , dest as (
    select t.k || '|' || t.id || '|O' as cle, t.owner_id as user_id,
           case t.k when 'rd' then format('Loyer de %s (%s) bientôt dû.', t.tenant, t.mois)
                    else format('Loyer en retard : %s, %s.', t.tenant, t.mois) end as texte, '#/manage/rents' as lien
      from typees t where t.k is not null
    union all
    select t.k || '|' || t.id || '|T', p.id,
           case t.k when 'rd' then format('Votre loyer (%s) est dû le %s.', t.mois, extract(day from t.du))
                    else format('Votre loyer (%s) est en retard.', t.mois) end, '#/tenant/rents'
      from typees t
      join lateral (select q.id from public.profiles q where q.lease_id = t.bail and q.role in ('tenant', 'client')
                    union select q.id from public.profiles q where q.lease_ids @> array[t.bail] and q.role in ('tenant', 'client')) p on true
     where t.k is not null)
  , ins as (insert into public.notifications (user_id, text, link, key)
            select user_id, texte, lien, cle from dest
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'rappels de loyer'; nombre := n; return next;

  -- Factures émises, échues et non soldées (avoirs et encaissements déduits)
  with echues as (
    select d.id, d.owner_id, d.ref, app.total_facture(d) as total
      from public.billing_docs d
     where d.type = 'FAC' and d.due < jour and d.status not in ('annulée', 'annulee'))
  , avoirs as (
    select (a.extra->>'parentId')::uuid as parent, sum(app.total_facture(a)) as montant
      from public.billing_docs a
     where a.type = 'AV' and a.extra ? 'parentId' and (a.extra->>'parentId') ~ '^[0-9a-f-]{36}$'
     group by 1)
  , encaisse as (
    select p.doc_id, sum(p.amount) as montant from public.billing_payments p
     where p.doc_id in (select id from echues) group by 1)
  , factures as (
    select e.id, e.owner_id, e.ref, e.total - coalesce(av.montant, 0) - coalesce(en.montant, 0) as reste
      from echues e left join avoirs av on av.parent = e.id left join encaisse en on en.doc_id = e.id)
  , ins as (insert into public.notifications (user_id, text, link, key)
            select owner_id, format('Facture %s en retard de paiement.', ref), '#/manage/docs', 'fl|' || id
              from factures where reste > 0
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'factures en retard'; nombre := n; return next;

  -- Contrats qui expirent dans les 30 jours
  with ins as (insert into public.notifications (user_id, text, link, key)
            select c.owner_id, format('Le contrat %s expire dans %s jours.', coalesce(c.ref, ''), c."end" - jour), '#/manage/contracts', 'ce|' || c.id
              from public.contracts c
             where c.status = 'actif' and c."end" between jour and jour + 30
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'contrats bientôt échus'; nombre := n; return next;

  -- Documents du coffre expirés ou expirant dans les 30 jours
  with ins as (insert into public.notifications (user_id, text, link, key)
            select d.owner_id,
                   format('Document « %s » %s.', d.name, case when d.expiry < jour then 'expiré' else 'bientôt expiré' end),
                   '#/coffre', 'de|' || d.id || '|' || case when d.expiry < jour then 'x' else 'o' end
              from public.documents d
             where d.expiry is not null and d.expiry <= jour + 30
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'documents à renouveler'; nombre := n; return next;

  -- Visites du jour et du lendemain : à l'agent chargé (ou au titulaire de l'espace)
  with ins as (insert into public.notifications (user_id, text, link, key)
            select coalesce(v.agent_id, p.agent_id, v.owner_id),
                   format('%s à %s : visite de « %s » avec %s%s.',
                          case when v.date = jour then 'Aujourd''hui' else 'Demain' end, v.time, p.title,
                          coalesce(nullif(trim(coalesce(c.first_name, '') || ' ' || coalesce(c.last_name, '')), ''), v.client_name, 'un client'),
                          case when v.status = 'attente' then ' — encore à confirmer' else '' end),
                   case when o.role = 'agency' then '#/agency/visits' else '#/owner/visits' end,
                   case when v.date = jour then 'vj0|' else 'vj1|' end || v.id
              from public.visits v
              join public.properties p on p.id = v.property_id
              join public.profiles o on o.id = v.owner_id
              left join public.profiles c on c.id = v.client_id
             where v.status in ('attente', 'acceptee') and v.date in (jour, jour + 1)
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'rappels de visite'; nombre := n; return next;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Index — chacun est justifié dans docs/INDEX.md (requête visée, gain mesuré,
--    coût en écriture) et vérifié par supabase/tests-local/perf/verifier-index.js.
--    Colonnes de clés étrangères : sans index, la suppression d'un compte ou d'un
--    bien parcourt toute la table enfant (ON DELETE CASCADE / SET NULL / RESTRICT).
-- ---------------------------------------------------------------------------
-- Espaces : « owner_id = app.espace() » (politiques standard) + cascade à la suppression d'un compte
create index properties_owner_idx       on public.properties (owner_id);
create index leases_owner_idx           on public.leases (owner_id);
create index rents_owner_idx            on public.rents (owner_id);
create index visits_owner_date_idx      on public.visits (owner_id, date);
create index billing_payments_owner_idx on public.billing_payments (owner_id);
create index documents_owner_idx        on public.documents (owner_id);
create index tickets_owner_idx          on public.tickets (owner_id);
create index expenses_owner_idx         on public.expenses (owner_id);
create index contracts_owner_idx        on public.contracts (owner_id);
create index deals_owner_idx            on public.deals (owner_id);
create index owner_records_owner_idx    on public.owner_records (owner_id);
create index mandates_owner_idx         on public.mandates (owner_id);
create index sale_mandates_owner_idx    on public.sale_mandates (owner_id);
create index owner_transfers_owner_idx  on public.owner_transfers (owner_id);
create index fees_owner_idx             on public.fees (owner_id);
create index providers_owner_idx        on public.providers (owner_id);
create index client_requests_owner_idx  on public.client_requests (owner_id);
create index audit_log_owner_date_idx   on public.audit_log (owner_id, created_at);
-- Lectures « les miennes » d'un utilisateur
create index notifications_user_date_idx on public.notifications (user_id, created_at);
create index visits_client_idx          on public.visits (client_id) where client_id is not null;
create index saved_searches_user_idx    on public.saved_searches (user_id);
create index activity_log_actor_idx     on public.activity_log (actor_id);
create index reports_reporter_idx       on public.reports (reporter_id);
create index tickets_tenant_idx         on public.tickets (tenant_id) where tenant_id is not null;
create index billing_docs_client_idx    on public.billing_docs (client_id) where client_id is not null;
create index billing_payments_client_idx on public.billing_payments (client_id) where client_id is not null;
create index deals_client_idx           on public.deals (client_id) where client_id is not null;
create index contracts_client_idx       on public.contracts (client_id) where client_id is not null;
create index fees_agent_idx             on public.fees (agent_id) where agent_id is not null;
create index client_requests_agent_idx  on public.client_requests (agent_id) where agent_id is not null;
create index fees_apporteur_idx         on public.fees (apporteur_id) where apporteur_id is not null;
create index mandates_mandant_idx       on public.mandates (owner_id2) where owner_id2 is not null;
create index sale_mandates_mandant_idx  on public.sale_mandates (owner_id2) where owner_id2 is not null;
create index owner_transfers_mandant_idx on public.owner_transfers (owner_id2) where owner_id2 is not null;
create index agency_link_agence_idx     on public.agency_link_requests (agence_id);
-- Messagerie
create index conversations_participants_gin on public.conversations using gin (participants);
create index conversation_messages_conv_idx on public.conversation_messages (conversation_id, created_at);
create index conversation_messages_sender_idx on public.conversation_messages (sender_id);
create index lease_messages_lease_idx   on public.lease_messages (lease_id, created_at);
-- Comptes rattachés (équipe, locataires, mandants) : politiques de profiles, annuaire, rappels
create index profiles_parent_idx        on public.profiles (parent_id) where parent_id is not null;
create index profiles_owner_ref_idx     on public.profiles (owner_ref) where owner_ref is not null;
create index profiles_mandant_of_idx    on public.profiles (mandant_of) where mandant_of is not null;
create index profiles_lease_idx         on public.profiles (lease_id) where lease_id is not null;
create index profiles_lease_ids_gin     on public.profiles using gin (lease_ids);
create index owner_records_compte_idx   on public.owner_records (compte_id) where compte_id is not null;
-- Biens : mandant, agent, contrôle des baux (ON DELETE RESTRICT), favoris
create index properties_client_owner_idx on public.properties (client_owner_id) where client_owner_id is not null;
create index properties_agent_idx       on public.properties (agent_id) where agent_id is not null;
create index properties_publiees_date_idx on public.properties (created_at) where listing_status = 'publiee';
create index leases_property_idx        on public.leases (property_id);
create index rents_property_idx         on public.rents (property_id) where property_id is not null;
create index billing_docs_property_idx  on public.billing_docs (property_id) where property_id is not null;
create index expenses_property_idx      on public.expenses (property_id) where property_id is not null;
create index tickets_property_idx       on public.tickets (property_id) where property_id is not null;
create index favorites_property_idx     on public.favorites (property_id);
-- Facturation : encaissements d'une facture (états, rappels)
create index billing_payments_doc_idx   on public.billing_payments (doc_id) where doc_id is not null;
-- Rappels : documents à échéance, visites du jour
create index documents_expiry_idx       on public.documents (expiry) where expiry is not null;
create index visits_a_venir_idx         on public.visits (date) where status in ('attente', 'acceptee');
create index rents_impayes_idx          on public.rents (lease_id) where paid_at is null;
