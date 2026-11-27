-- =============================================================================
-- DEUKSIL — Migration du 27 novembre 2026 : corrections du retest
--
-- 1. Messages de contact et signalements « à 0 » dans l'administration
--    (retest VIS-18). Les messages sont bien enregistrés (accusé reçu), mais la
--    base les cache à l'administrateur quand app.est_admin() est faux, sans
--    erreur : l'écran affiche 0. Cas le plus probable : la ligne de réglage
--    « admin_mfa_obligatoire » absente (NULL <> 'oui' n'est pas vrai), ou
--    réglée à 'oui' sans double authentification.
--    → app.est_admin() traite un réglage absent comme 'non' ;
--    → public.diagnostic_admin() : le site affiche à l'administrateur la raison
--      exacte quand la base ne le reconnaît pas (au lieu d'un « 0 » muet).
-- 2. Alertes : aucune notification quand une annonce correspondante est
--    publiée (retest CLI-18). La notification était créée par le navigateur
--    de celui qui valide l'annonce, qui ne peut pas lire les alertes des
--    autres. → la base prévient elle-même chaque client concerné, une seule
--      fois par annonce et par alerte, à la publication.
-- 3. Bien loué resté « En discussion » et toujours visible (retest VIS-01,
--    CLI-02, AGT-06). → un bail actif met le bien en « loué » (déclencheur),
--      et les biens qui ont déjà un bail actif sont réparés.
-- 4. Loyer « non reçu » pour un bail terminé avant l'échéance (retest
--    PRO-05). → les échéances jamais dues (aucun versement, échéance le jour
--      de la fin du bail ou après) des baux terminés sont retirées.
--
-- Rejouable sans risque. Ne supprime que les échéances de loyer jamais dues
-- décrites au point 4 (aucun versement enregistré).
-- =============================================================================

-- --- 1. Administrateur : réglage absent = double authentification non exigée -------
create or replace function app.est_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'actif'
      and (coalesce((select valeur from app.reglages where cle = 'admin_mfa_obligatoire'), 'non') <> 'oui'
           or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'))
$$;
insert into app.reglages (cle, valeur) values ('admin_mfa_obligatoire', 'non') on conflict (cle) do nothing;

-- Ce que la base pense du compte connecté (ses propres informations seulement).
create or replace function public.diagnostic_admin() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'connecte', auth.uid() is not null,
    'role', (select p.role from public.profiles p where p.id = auth.uid()),
    'statut', (select p.status from public.profiles p where p.id = auth.uid()),
    'mfa_exigee', coalesce((select valeur from app.reglages where cle = 'admin_mfa_obligatoire'), 'non') = 'oui',
    'aal', coalesce(auth.jwt() ->> 'aal', ''),
    'est_admin', app.est_admin())
$$;
revoke all on function public.diagnostic_admin() from public;
grant execute on function public.diagnostic_admin() to authenticated;

-- --- 2. Alertes : la base prévient les clients à la publication -------------------
-- Mêmes critères que la recherche du site (searchState) ; un critère vide ne filtre pas.
create or replace function app.nombre(v text) returns numeric
language sql immutable set search_path = '' as $$
  select case when v ~ '^\s*\d+(\.\d+)?\s*$' then trim(v)::numeric end
$$;
create or replace function app.alerte_correspond(c jsonb, p public.properties) returns boolean
language sql stable set search_path = '' as $$
  select (coalesce(c ->> 'transaction', '') = '' or p.transaction = c ->> 'transaction' or (c ->> 'transaction' = 'vente' and p.transaction = 'terrain'))
     and (coalesce(c ->> 'type', '') = '' or p.type = c ->> 'type')
     and (coalesce(c ->> 'region', '') = '' or p.region = c ->> 'region')
     and (coalesce(c ->> 'city', '') = '' or p.city = c ->> 'city')
     and (coalesce(c ->> 'quartier', '') = '' or p.quartier = c ->> 'quartier')
     and (app.nombre(c ->> 'min') is null or app.nombre(c ->> 'min') = 0 or p.price >= app.nombre(c ->> 'min'))
     and (app.nombre(c ->> 'max') is null or app.nombre(c ->> 'max') = 0 or p.price <= app.nombre(c ->> 'max'))
     and (app.nombre(c ->> 'rooms') is null or app.nombre(c ->> 'rooms') = 0 or coalesce(p.rooms, 0) >= app.nombre(c ->> 'rooms'))
     and (app.nombre(c ->> 'baths') is null or app.nombre(c ->> 'baths') = 0 or coalesce(p.baths, 0) >= app.nombre(c ->> 'baths'))
     and (app.nombre(c ->> 'surface') is null or app.nombre(c ->> 'surface') = 0 or coalesce(p.surface, 0) >= app.nombre(c ->> 'surface'))
     and (coalesce(c ->> 'furnished', 'false') <> 'true' or p.furnished)
     and (coalesce(c ->> 'parking', 'false') <> 'true' or p.parking)
$$;
create or replace function app.prevenir_alertes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.listing_status is distinct from 'publiee' then return new; end if;
  if tg_op = 'UPDATE' and old.listing_status = 'publiee' then return new; end if;   -- seulement à la publication
  if new.status in ('loue', 'vendu', 'archive', 'maintenance') then return new; end if;
  insert into public.notifications (user_id, text, link, key)
  select s.user_id,
         left(format('Nouvelle annonce pour votre alerte « %s » : %s', s.name, new.title), 1000),
         '#/property/' || new.id,
         left('alerte:' || s.id || ':' || new.id, 120)
    from public.saved_searches s
    join public.profiles pr on pr.id = s.user_id and pr.status = 'actif'
   where s.user_id <> new.owner_id
     and coalesce(pr.parent_id, pr.id) <> new.owner_id          -- pas l'équipe de l'annonceur
     and app.alerte_correspond(s.criteria, new)
  on conflict (user_id, key) where key is not null do nothing;
  return new;
end $$;
drop trigger if exists prevenir_alertes on public.properties;
create trigger prevenir_alertes after insert or update of listing_status on public.properties
  for each row execute function app.prevenir_alertes();

-- --- 3. Un bail actif met le bien en « loué » --------------------------------------
-- Seulement pour un bail sur le bien entier (sans unité) ; un bien vendu ou archivé
-- garde son statut. La remise en location après un départ reste décidée par le
-- bailleur (fin de bail, « libération à confirmer »).
create or replace function app.bien_loue_par_bail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'actif' and new.unit_id is null and new.property_id is not null then
    update public.properties set status = 'loue'
     where id = new.property_id and status not in ('loue', 'vendu', 'archive');
  end if;
  return new;
end $$;
drop trigger if exists bien_loue_par_bail on public.leases;
create trigger bien_loue_par_bail after insert or update of status, property_id, unit_id on public.leases
  for each row execute function app.bien_loue_par_bail();

-- Réparation : biens qui ont un bail actif mais sont restés « disponible », « en discussion »…
update public.properties p set status = 'loue'
 where p.status not in ('loue', 'vendu', 'archive')
   and exists (select 1 from public.leases l where l.property_id = p.id and l.unit_id is null and l.status = 'actif');

-- --- 4. Échéances jamais dues des baux terminés -------------------------------------
-- Échéance d'un loyer : le jour d'échéance du mois, ou le début du bail s'il est plus tard.
-- Un bail terminé ce jour-là ou avant ne doit pas ce loyer.
delete from public.rents r
 using public.leases l
 where l.id = r.lease_id
   and l.status <> 'actif' and l.ended_at is not null
   and r.paid_at is null
   and jsonb_typeof(r.payments) = 'array' and jsonb_array_length(r.payments) = 0
   and greatest(to_date(r.month || '-' || lpad(least(greatest(l.due_day, 1), 28)::text, 2, '0'), 'YYYY-MM-DD'), l.start)
       >= (l.ended_at at time zone 'Africa/Dakar')::date;
