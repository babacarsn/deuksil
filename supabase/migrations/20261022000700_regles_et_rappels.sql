-- =============================================================================
-- DEUKSIL — Migration 0700 : règles métier côté base, numérotation, rappels
--
-- 1. Verrous de colonnes pour les tiers (client, locataire, propriétaire mandant)
--    qui peuvent écrire sur des lignes d'un espace qui n'est pas le leur.
-- 2. Numérotation des pièces (factures, paiements, dépenses, tickets…) attribuée
--    par la base, sans doublon même avec plusieurs membres d'équipe simultanés.
-- 3. Rappels automatiques (loyers, factures, contrats, documents, visites) et
--    expiration des contrats : calculés par la base une fois par jour, au lieu
--    d'être écrits par le navigateur de chaque utilisateur à chaque page.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Verrous de colonnes
--    Les fonctions de contrôle sont « security invoker » : current_user y vaut
--    authenticated/anon pour un appel du navigateur (dans une fonction « definer »
--    il vaudrait le propriétaire de la fonction et le contrôle serait sauté).
-- ---------------------------------------------------------------------------
-- Vrai si l'appelant agit comme membre de l'espace propriétaire de la ligne.
create or replace function app.dans_l_espace(proprietaire uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select proprietaire is not distinct from app.espace() or app.est_admin()
$$;
grant execute on function app.dans_l_espace(uuid) to authenticated;

-- 1a. Visites : un client DEMANDE une visite ; il ne fixe ni le statut, ni l'agent,
--     ni le compte-rendu. Il ne modifie pas une visite (politique supprimée).
create or replace function app.controler_visite() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') or app.dans_l_espace(new.owner_id) then return new; end if;
  new.status := 'attente'; new.agent_id := null; new.planifiee_par := null; new.cr := null; new.note := null;
  new.source := coalesce(new.source, 'site');
  return new;
end $$;
-- s'exécute après aligner_espace (ordre alphabétique des déclencheurs) : owner_id est déjà celui du bien
create trigger controler_visite before insert on public.visits for each row execute function app.controler_visite();
drop policy if exists "client : modification" on public.visits;

-- 1b. Messages de bail : le locataire écrit en son nom et ne peut que marquer « lu »
--     les messages reçus ; personne ne réécrit un message envoyé.
create or replace function app.controler_message_bail() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    new.author_id := auth.uid();
    new."from" := case when app.dans_l_espace(new.owner_id) then 'owner' else 'tenant' end;
    new.read := false;
    return new;
  end if;
  if new.text is distinct from old.text or new."from" is distinct from old."from" or new.author_id is distinct from old.author_id
     or new.lease_id is distinct from old.lease_id or new.pj is distinct from old.pj then
    raise exception 'Un message envoyé ne peut pas être modifié.' using errcode = '42501';
  end if;
  -- on ne marque « lu » que les messages de l'autre partie
  if new.read is distinct from old.read and (old."from" = 'owner') = app.dans_l_espace(old.owner_id) then
    raise exception 'Seul le destinataire marque un message comme lu.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger controler_message before insert or update on public.lease_messages for each row execute function app.controler_message_bail();

-- 1c. Factures : le propriétaire mandant les consulte ; l'accord sur un devis est
--     enregistré par l'agence (interface « Accord reçu »). La politique d'écriture
--     du mandant, inutilisée, permettait de modifier montants et lignes : supprimée.
drop policy if exists "mandant : décision" on public.billing_docs;

-- 1d. Demandes de gestion propriétaire → agence : transitions de statut contrôlées.
create or replace function app.controler_demande_lien() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare cote_agence boolean;
begin
  if current_user not in ('authenticated', 'anon') or app.est_admin() then return new; end if;
  if new.proprio_id is distinct from old.proprio_id or new.agence_id is distinct from old.agence_id
     or new.message is distinct from old.message or new.created_at is distinct from old.created_at then
    raise exception 'Une demande envoyée ne peut pas être modifiée.' using errcode = '42501';
  end if;
  if new.statut is not distinct from old.statut then
    if new.fiche_id is distinct from old.fiche_id or new.repondu_le is distinct from old.repondu_le then
      raise exception 'Réponse déjà enregistrée.' using errcode = '42501';
    end if;
    return new;
  end if;
  if old.statut <> 'attente' then raise exception 'Cette demande est déjà traitée.' using errcode = '42501'; end if;
  cote_agence := old.agence_id = app.espace() and app.a_droit('gestion');
  if cote_agence and new.statut in ('acceptee', 'refusee') then
    if new.fiche_id is not null and not exists (select 1 from public.owner_records f where f.id = new.fiche_id and f.owner_id = old.agence_id) then
      raise exception 'Fiche propriétaire inconnue.' using errcode = '42501';
    end if;
    new.repondu_le := now();
  elsif old.proprio_id = auth.uid() and new.statut = 'annulee' then
    new.fiche_id := old.fiche_id; new.repondu_le := now();
  else
    raise exception 'Changement de statut non autorisé.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger controler_demande before update on public.agency_link_requests for each row execute function app.controler_demande_lien();

-- 1e. Conversations : la liste des participants est fixée à la création.
create or replace function app.controler_conversation() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    if cardinality(new.participants) not between 2 and 4 or array_position(new.participants, null) is not null then
      raise exception 'Une conversation réunit de 2 à 4 participants.' using errcode = '23514';
    end if;
  elsif new.participants is distinct from old.participants and not app.est_admin() then
    raise exception 'Les participants d''une conversation ne changent pas.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger controler_conversation before insert or update on public.conversations for each row execute function app.controler_conversation();

-- 1f. Demande de gestion : l'agence visée doit être un compte agence titulaire actif.
--     La vérification passe par une fonction « definer » : sous la RLS de profiles,
--     un propriétaire ne voit pas le profil de l'agence et la demande était refusée.
create or replace function app.est_agence_active(agence uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles a where a.id = agence and a.role = 'agency' and a.status = 'actif' and a.parent_id is null)
$$;
grant execute on function app.est_agence_active(uuid) to authenticated;
drop policy "lien : demande" on public.agency_link_requests;
create policy "lien : demande" on public.agency_link_requests for insert to authenticated
  with check (proprio_id = (select auth.uid()) and statut = 'attente' and app.est_agence_active(agence_id));

-- ---------------------------------------------------------------------------
-- 2. Numérotation des pièces : PREFIXE-AAAA-NNNNN, séquence par espace et par an.
--    Le navigateur propose un numéro (affichage immédiat) ; la base le garde s'il
--    est libre et bien formé (PREFIXE-AAAA-N), sinon attribue le suivant : un
--    navigateur ne peut ni créer de doublon ni imposer une référence fantaisiste. Un verrou consultatif par
--    (table, espace, préfixe, année) sérialise les créations concurrentes.
-- ---------------------------------------------------------------------------
create or replace function app.numeroter() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  prefixe text := tg_argv[0];
  annee text := to_char(now() at time zone 'Africa/Dakar', 'YYYY');
  motif text := '^' || prefixe || '-' || annee || '-(\d+)$';
  prochain integer; existe boolean;
begin
  if tg_table_name = 'billing_docs' then prefixe := new.type; motif := '^' || prefixe || '-' || annee || '-(\d+)$'; end if;
  perform pg_advisory_xact_lock(hashtext(tg_table_name || ':' || new.owner_id || ':' || prefixe || ':' || annee));
  -- un numéro bien formé (quelle que soit l'année : reprise d'historique) et libre est gardé
  if new.ref is not null and new.ref ~ ('^' || prefixe || '-\d{4}-\d+$') then
    execute format('select exists (select 1 from public.%I where owner_id = $1 and ref = $2)', tg_table_name)
      into existe using new.owner_id, new.ref;
    if not existe then return new; end if;
  end if;
  execute format('select coalesce(max((substring(ref from %L))::integer), 0) + 1 from public.%I where owner_id = $1 and ref ~ %L',
                 motif, tg_table_name, motif) into prochain using new.owner_id;
  new.ref := prefixe || '-' || annee || '-' || lpad(prochain::text, 5, '0');
  if tg_table_name = 'billing_payments' then new.rec := replace(new.ref, 'PAY-', 'REC-'); end if;
  return new;
end $$;

create trigger numeroter before insert on public.billing_docs     for each row execute function app.numeroter('TYPE');
create trigger numeroter before insert on public.billing_payments for each row execute function app.numeroter('PAY');
create trigger numeroter before insert on public.expenses         for each row execute function app.numeroter('DEP');
create trigger numeroter before insert on public.tickets          for each row execute function app.numeroter('MNT');
create trigger numeroter before insert on public.contracts        for each row execute function app.numeroter('CTR');
create trigger numeroter before insert on public.mandates         for each row execute function app.numeroter('MDT');
create trigger numeroter before insert on public.sale_mandates    for each row execute function app.numeroter('MDV');
create trigger numeroter before insert on public.owner_transfers  for each row execute function app.numeroter('REV');
create trigger numeroter before insert on public.fees             for each row execute function app.numeroter('HON');

-- Unicité des numéros (une référence vide reste possible pour les lignes reprises sans numéro).
create unique index billing_payments_ref_unique on public.billing_payments (owner_id, ref) where ref ~ '^PAY-\d{4}-\d+$';
create unique index expenses_ref_unique        on public.expenses (owner_id, ref)        where ref ~ '^DEP-\d{4}-\d+$';
create unique index tickets_ref_unique         on public.tickets (owner_id, ref)         where ref ~ '^MNT-\d{4}-\d+$';
create unique index contracts_ref_unique       on public.contracts (owner_id, ref)       where ref ~ '^CTR-\d{4}-\d+$';
create unique index mandates_ref_unique        on public.mandates (owner_id, ref)        where ref ~ '^MDT-\d{4}-\d+$';
create unique index sale_mandates_ref_unique   on public.sale_mandates (owner_id, ref)   where ref ~ '^MDV-\d{4}-\d+$';
create unique index owner_transfers_ref_unique on public.owner_transfers (owner_id, ref) where ref ~ '^REV-\d{4}-\d+$';
create unique index fees_ref_unique            on public.fees (owner_id, ref)            where ref ~ '^HON-\d{4}-\d+$';

-- ---------------------------------------------------------------------------
-- 3. Rappels automatiques et expiration des contrats
--    Une notification par événement (clé unique user_id + key : relancer la
--    fonction ne crée pas de doublon). Les clés reprennent celles de l'interface.
-- ---------------------------------------------------------------------------
create or replace function app.total_facture(d public.billing_docs) returns bigint
language sql immutable set search_path = '' as $$
  select round(coalesce((select sum(coalesce((i->>'qty')::numeric, 0) * coalesce((i->>'price')::numeric, 0))
                         from jsonb_array_elements(case when jsonb_typeof(d.items) = 'array' then d.items else '[]'::jsonb end) i), 0)
               * (1 - d.discount / 100) * (1 + d.tax / 100))::bigint
$$;

-- Reconduction tacite (réglage « reconductionTacite » du bailleur, désactivé par défaut) :
-- un bail actif échu sans préavis est prolongé de sa durée initiale (12 mois au plus),
-- ses échéances sont créées, les parties prévenues, l'opération journalisée. Un bail
-- qui chevaucherait un autre bail actif du même logement n'est pas reconduit.
create or replace function app.reconduire_baux(jour date) returns integer
language plpgsql security definer set search_path = '' as $$
declare l record; k integer; n integer := 0; loc uuid;
begin
  for l in select b.* from public.leases b join public.profiles o on o.id = b.owner_id
            where b.status = 'actif' and b.preavis is null and b.fin <= jour
              and coalesce((o.regles ->> 'reconductionTacite')::boolean, false)
            for update of b skip locked loop
    k := least(12, greatest(1, coalesce(l.duree_initiale, l.months, 12)));
    begin
      update public.leases set months = months + k, duree_initiale = coalesce(duree_initiale, months),
             reconductions = coalesce(reconductions, '[]'::jsonb) || jsonb_build_object('le', jour, 'depuis', l.fin, 'mois', k), updated_at = now()
       where id = l.id;
      insert into public.rents (owner_id, lease_id, property_id, month, amount)
      select l.owner_id, l.id, l.property_id, to_char(l.start + make_interval(months => i), 'YYYY-MM'), l.rent
        from generate_series(l.months, l.months + k - 1) i
      on conflict (lease_id, month) do nothing;
      insert into public.audit_log (owner_id, who, action, detail)
      values (l.owner_id, 'DEUKSIL', 'Bail reconduit tacitement', format('%s · %s mois à partir du %s', l.tenant, k, to_char(l.fin, 'DD/MM/YYYY')));
      insert into public.notifications (user_id, text, link, key)
      values (l.owner_id, format('Bail de %s reconduit tacitement pour %s mois (échu le %s, sans préavis).', l.tenant, k, to_char(l.fin, 'DD/MM/YYYY')),
              '#/manage/leases', 'rb|' || l.id || '|' || (l.months + k))
      on conflict (user_id, key) where key is not null do nothing;
      for loc in select p.id from public.profiles p where p.lease_id = l.id or l.id = any (p.lease_ids) loop
        insert into public.notifications (user_id, text, link, key)
        values (loc, format('Votre bail est reconduit pour %s mois aux mêmes conditions (loyer %s FCFA).', k, replace(to_char(l.rent, 'FM999,999,999,999'), ',', ' ')),
                '#/tenant/rents', 'rb|' || l.id || '|' || (l.months + k) || '|T')
        on conflict (user_id, key) where key is not null do nothing;
      end loop;
      n := n + 1;
    exception when exclusion_violation then
      insert into public.notifications (user_id, text, link, key)
      values (l.owner_id, format('Le bail de %s n''a pas pu être reconduit : un autre bail occupe ce logement.', l.tenant), '#/manage/leases', 'rbx|' || l.id || '|' || l.months)
      on conflict (user_id, key) where key is not null do nothing;
    end;
  end loop;
  return n;
end $$;

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
      from typees t join public.profiles p on (p.lease_id = t.bail or t.bail = any (p.lease_ids)) and p.role in ('tenant', 'client')
     where t.k is not null)
  , ins as (insert into public.notifications (user_id, text, link, key)
            select user_id, texte, lien, cle from dest
            on conflict (user_id, key) where key is not null do nothing returning 1)
  select count(*) into n from ins;
  categorie := 'rappels de loyer'; nombre := n; return next;

  -- Factures émises, échues et non soldées (avoirs et encaissements déduits)
  with factures as (
    select d.id, d.owner_id, d.ref,
           app.total_facture(d)
           - coalesce((select sum(app.total_facture(a)) from public.billing_docs a
                        where a.owner_id = d.owner_id and a.type = 'AV' and a.extra->>'parentId' = d.id::text), 0)
           - coalesce((select sum(p.amount) from public.billing_payments p where p.doc_id = d.id), 0) as reste
      from public.billing_docs d
     where d.type = 'FAC' and d.due < jour and d.status not in ('annulée', 'annulee'))
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
revoke all on function app.generer_rappels(date) from public, anon, authenticated;
revoke all on function app.reconduire_baux(date) from public, anon, authenticated;
grant execute on function app.generer_rappels(date) to service_role;

-- Planification quotidienne (07:00 à Dakar = 07:00 UTC) si pg_cron est disponible.
-- Sur Supabase : Dashboard → Integrations → Cron (extension pg_cron), puis cette
-- migration (ou la commande ci-dessous dans l'éditeur SQL). Sans pg_cron, appeler
-- la fonction une fois par jour depuis un planificateur externe :
--   select * from app.generer_rappels();
do $$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron indisponible : planifier « select app.generer_rappels() » une fois par jour.';
    return;
  end if;
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron non activable par cette migration (%) : l''activer dans le tableau de bord, puis exécuter cron.schedule ci-dessous.', sqlerrm;
    return;
  end;
  perform cron.unschedule(jobid) from cron.job where jobname = 'deuksil-rappels';
  perform cron.schedule('deuksil-rappels', '0 7 * * *', 'select app.generer_rappels()');
end $$;

-- ---------------------------------------------------------------------------
-- 4. Rattacher un bail au compte EXISTANT d'une personne (pas de second compte).
--    Appelée par le bailleur ou l'agence titulaire avec l'identifiant ou l'e-mail
--    de la personne. Refus si la personne n'est pas en relation avec l'espace
--    (visite demandée, conversation, déjà locataire) : un bailleur ne peut pas
--    s'approprier le profil de n'importe quel compte en devinant son identifiant.
--    Résultat : 'rattache', ou 'inconnu' si aucun compte n'a cet e-mail (le
--    navigateur crée alors l'accès par la fonction serveur « gerer-acces »).
-- ---------------------------------------------------------------------------
create or replace function public.rattacher_locataire(bail uuid, compte uuid default null, courriel text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare l public.leases; c public.profiles; esp uuid := app.espace();
begin
  if auth.uid() is null or not app.est_titulaire() then
    raise exception 'Seul le titulaire du compte rattache un locataire.' using errcode = '42501';
  end if;
  select * into l from public.leases where id = bail and owner_id = esp;
  if l.id is null then raise exception 'Ce bail n''appartient pas à votre compte.' using errcode = '42501'; end if;
  if compte is not null then select * into c from public.profiles where id = compte;
  else select * into c from public.profiles where email = lower(trim(courriel)); end if;
  if c.id is null then return 'inconnu'; end if;   -- pas de compte : le navigateur ouvre l'accès par « gerer-acces »
  if c.role not in ('client', 'tenant') or c.parent_id is not null or c.id = esp then
    raise exception 'Ce compte n''est pas un compte client : il ne peut pas porter un bail.' using errcode = '42501';
  end if;
  if c.lease_id = l.id or l.id = any (c.lease_ids) then return 'rattache'; end if;
  if not (c.owner_ref = esp
          or exists (select 1 from public.visits v where v.owner_id = esp and v.client_id = c.id)
          or exists (select 1 from public.conversations k where k.participants @> array[c.id] and k.participants @> array[esp])) then
    raise exception 'Cette personne a déjà un compte DEUKSIL. Pour lui rattacher ce bail, elle doit d''abord vous contacter depuis l''une de vos annonces (demande de visite ou message).'
      using errcode = '42501';
  end if;
  update public.profiles set role = 'tenant', owner_ref = esp, lease_id = l.id,
         lease_ids = array(select distinct x from unnest(coalesce(lease_ids, '{}') || l.id) x)
   where id = c.id;
  insert into public.audit_log (owner_id, who, action, detail) values (esp, 'DEUKSIL', 'Bail rattaché au compte du locataire', l.tenant);
  return 'rattache';
end $$;
revoke all on function public.rattacher_locataire(uuid, uuid, text) from public, anon;
grant execute on function public.rattacher_locataire(uuid, uuid, text) to authenticated;
