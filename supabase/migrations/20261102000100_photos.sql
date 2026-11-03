-- =============================================================================
-- DEUKSIL — Migration 0900 (2 novembre 2026) : photos des biens
--
--   1. properties.photos_meta : description de chaque photo (dossier, format,
--      dimensions et poids de chaque variante, poids d'origine). Même ordre que
--      properties.photos (la 1re est la couverture). properties.photos reste la
--      liste d'URL lue par l'interface : rien ne change pour les écrans existants.
--   2. Contrôle en base des photos (forme des URL, dossier du bien, cohérence
--      avec photos_meta, 20 au plus). Les photos déjà en base ne sont pas
--      revérifiées : seules les nouvelles valeurs le sont.
--   3. Storage resserré (compartiment photos) : le 2e dossier doit être un bien
--      de l'espace (ou un bien pas encore créé) ; un agent n'écrit que pour ses
--      biens ; un fichier encore référencé ne peut être ni remplacé ni supprimé
--      par un utilisateur.
--   4. Nettoyage : file des fichiers à supprimer (photo retirée, bien supprimé,
--      photo de profil remplacée, fichiers déposés jamais enregistrés), traitée
--      par la fonction Edge « nettoyer-fichiers » via l'API Storage. Supprimer
--      des lignes de storage.objects en SQL laisserait les fichiers : interdit ici.
--
-- Additive et réversible : voir le bloc « Retour arrière » en fin de fichier.
-- Aucune donnée existante n'est modifiée ni supprimée.
-- =============================================================================

-- --- 1. Description des photos --------------------------------------------------------
alter table public.properties add column if not exists photos_meta jsonb not null default '[]'::jsonb;
alter table public.properties drop constraint if exists properties_photos_meta_forme;
alter table public.properties add constraint properties_photos_meta_forme
  check (jsonb_typeof(photos_meta) = 'array' and jsonb_array_length(photos_meta) <= 20);
comment on column public.properties.photos_meta is
  'Une entrée par photo, dans l''ordre de photos : {id, dossier "<espace>/<bien>/<photo>", ext "webp"|"jpg", '
  'v: {s|m|l: {w, h, o, fichier?}}, src: {type, o, w, h}} ou {legacy: true} pour une photo antérieure.';

-- Chemin d'un fichier du compartiment photos à partir de son URL publique (NULL sinon).
create or replace function app.chemin_photo(url text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(substring(url from '/storage/v1/object/public/photos/([^?#]+)$'), '')
$$;
create or replace function app.chemin_avatar(url text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(substring(url from '/storage/v1/object/public/avatars/([^?#]+)$'), '')
$$;

-- Fichiers d'une entrée photos_meta (une variante peut réutiliser le fichier d'une autre).
create or replace function app.fichiers_meta(m jsonb) returns setof text
language sql immutable set search_path = '' as $$
  select distinct (m ->> 'dossier') || '/' || coalesce(m -> 'v' -> k ->> 'fichier', k) || '.' || (m ->> 'ext')
  from unnest(array['s', 'm', 'l']) k
  where m ? 'dossier' and m ? 'ext' and m -> 'v' ? k
$$;

-- --- 2. Contrôle des photos d'un bien ---------------------------------------------------
create or replace function app.controler_photos() returns trigger
language plpgsql set search_path = '' as $$
declare
  u text; ch text; i int; m jsonb; d text; attendu text;
  utilisateur boolean := current_user in ('authenticated', 'anon');
  dossiers text[] := '{}';
begin
  if tg_op = 'UPDATE' and new.photos is not distinct from old.photos and new.photos_meta is not distinct from old.photos_meta then
    return new;
  end if;
  if cardinality(new.photos) > 20 then
    raise exception 'Une annonce compte 20 photos au plus.' using errcode = '23514';
  end if;
  -- Forme des URL : seules les valeurs nouvelles sont contrôlées (les anciennes restent lisibles).
  foreach u in array new.photos loop
    if tg_op = 'UPDATE' and u = any (old.photos) then continue; end if;
    if u !~ '^https?://[^[:space:]"''<>`\\]+$' then
      raise exception 'Adresse de photo invalide.' using errcode = '22023';
    end if;
    if utilisateur then
      ch := app.chemin_photo(u);
      if ch is null or split_part(ch, '/', 1) <> new.owner_id::text or split_part(ch, '/', 2) <> new.id::text then
        raise exception 'Chaque photo doit être déposée dans le dossier de ce bien.' using errcode = '42501';
      end if;
    end if;
  end loop;
  -- Description : vide (photos antérieures) ou alignée sur photos, entrée par entrée.
  if jsonb_array_length(new.photos_meta) > 0 then
    if jsonb_array_length(new.photos_meta) <> cardinality(new.photos) then
      raise exception 'Description des photos incohérente (nombre).' using errcode = '23514';
    end if;
    for i in 0 .. jsonb_array_length(new.photos_meta) - 1 loop
      m := new.photos_meta -> i;
      if jsonb_typeof(m) <> 'object' then raise exception 'Description de photo invalide.' using errcode = '23514'; end if;
      continue when coalesce((m ->> 'legacy')::boolean, false);
      d := m ->> 'dossier';
      if d is null or d !~ ('^' || new.owner_id::text || '/' || new.id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
         or coalesce(m ->> 'ext', '') not in ('webp', 'jpg') or jsonb_typeof(m -> 'v') <> 'object' or not (m -> 'v' ? 'm') then
        raise exception 'Description de photo invalide.' using errcode = '23514';
      end if;
      if d = any (dossiers) then raise exception 'Photo en double.' using errcode = '23505'; end if;
      dossiers := dossiers || d;
      attendu := '/' || d || '/' || coalesce(m -> 'v' -> 'm' ->> 'fichier', 'm') || '.' || (m ->> 'ext');
      if right(new.photos[i + 1], length(attendu)) <> attendu then
        raise exception 'Description des photos incohérente (ordre).' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists controler_photos on public.properties;
create trigger controler_photos before insert or update of photos, photos_meta on public.properties
  for each row execute function app.controler_photos();

-- --- 3. Storage : droits sur les photos ----------------------------------------------
-- Un fichier est-il encore référencé par la base ? (lecture directe par la clé du bien
-- ou du profil, sans parcours de table)
create or replace function app.fichier_reference(bucket text, chemin text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare d text[] := string_to_array(chemin, '/'); bien uuid; prop record;
begin
  if bucket = 'photos' then
    begin bien := d[2]::uuid; exception when others then return false; end;
    select p.photos, p.photos_meta into prop from public.properties p where p.id = bien;
    if not found then return false; end if;
    return exists (select 1 from unnest(prop.photos) u where app.chemin_photo(u) = chemin)
        or exists (select 1 from jsonb_array_elements(prop.photos_meta) m, app.fichiers_meta(m) f where f = chemin);
  elsif bucket = 'avatars' then
    return exists (select 1 from public.profiles p where p.id = (case when d[1] ~ '^[0-9a-f-]{36}$' then d[1]::uuid end)
                   and app.chemin_avatar(p.avatar_url) = chemin);
  end if;
  return false;
end $$;
grant execute on function app.fichier_reference(text, text) to authenticated;

create or replace function app.dossier_autorise(bucket text, chemin text, ecriture boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare d text[] := storage.foldername(chemin); cible uuid; bien uuid; p_owner uuid; p_agent uuid;
begin
  if auth.uid() is null or cardinality(d) < 1 then return false; end if;
  begin
    cible := (case when d[1] in ('conv','bail') then d[2] else d[1] end)::uuid;
  exception when others then return false;   -- dossier qui n'est pas un identifiant
  end;
  if bucket = 'avatars' then return cible = auth.uid(); end if;
  if bucket = 'photos' then
    if cardinality(d) < 2 or cible is distinct from app.espace() or not app.a_droit('biens') then return false; end if;
    begin bien := d[2]::uuid; exception when others then return false; end;
    select p.owner_id, p.agent_id into p_owner, p_agent from public.properties p where p.id = bien;
    if found then
      if p_owner <> cible then return false; end if;                                  -- bien d'un autre espace
      if app.role_membre() = 'agent' and p_agent is distinct from auth.uid() then return false; end if;
    end if;
    return true;                                                                       -- bien existant de l'espace, ou bien en cours de création
  end if;
  if bucket = 'documents' then
    if d[1] = 'conv' then
      return exists (select 1 from public.conversations c where c.id = cible
                     and (auth.uid() = any (c.participants) or (app.espace() = any (c.participants) and app.a_droit('messages'))));
    elsif d[1] = 'bail' then
      return cible = any (app.mes_baux())
          or exists (select 1 from public.leases l where l.id = cible and l.owner_id = app.espace() and app.a_droit('gestion'));
    else
      return (cible = app.espace() and app.a_droit('documents')) or (not ecriture and app.est_admin());
    end if;
  end if;
  return false;
end $$;

-- Lecture (API) de ses propres photos et photos de profil. Les fichiers restent publics par
-- URL ; cette politique sert à la suppression : dans PostgreSQL, un DELETE qui lit des
-- colonnes (WHERE, RETURNING) n'atteint que les lignes visibles par une politique SELECT.
-- Sans elle, la suppression « réussit » sans rien supprimer (constaté sur la réplique).
drop policy if exists "deuksil : lecture de ses photos" on storage.objects;
create policy "deuksil : lecture de ses photos" on storage.objects for select to authenticated
  using (bucket_id in ('photos', 'avatars') and app.dossier_autorise(bucket_id, name, false));

-- Remplacer ou supprimer un fichier encore utilisé par une annonce ou un profil : refusé
-- (il disparaît par la file de nettoyage une fois retiré de la base).
drop policy if exists "deuksil : remplacement" on storage.objects;
create policy "deuksil : remplacement" on storage.objects for update to authenticated
  using (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true) and not app.fichier_reference(bucket_id, name))
  with check (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true));
drop policy if exists "deuksil : suppression" on storage.objects;
create policy "deuksil : suppression" on storage.objects for delete to authenticated
  using (bucket_id in ('photos','avatars','documents') and app.dossier_autorise(bucket_id, name, true) and not app.fichier_reference(bucket_id, name));

-- --- 4. File des fichiers à supprimer -----------------------------------------------------
create table if not exists app.fichiers_a_supprimer (
  id              bigint generated always as identity primary key,
  bucket          text not null check (bucket in ('photos', 'avatars')),
  chemin          text not null,
  raison          text not null,
  demande_le      timestamptz not null default now(),
  essais          integer not null default 0,
  derniere_erreur text,
  traite_le       timestamptz,
  unique (bucket, chemin)
);
create index if not exists fichiers_a_supprimer_a_traiter on app.fichiers_a_supprimer (demande_le) where traite_le is null;
revoke all on app.fichiers_a_supprimer from public, anon, authenticated;

create or replace function app.enfiler(bucket text, chemins text[], raison text) returns void
language sql security definer set search_path = '' as $$
  insert into app.fichiers_a_supprimer (bucket, chemin, raison)
  select bucket, c, raison from unnest(chemins) c where c is not null
  on conflict (bucket, chemin) do nothing   -- noms UUID : un fichier supprimé ne revient jamais
$$;
revoke all on function app.enfiler(text, text[], text) from public, anon, authenticated;

create or replace function app.fichiers_du_bien(photos text[], meta jsonb) returns text[]
language sql immutable set search_path = '' as $$
  select coalesce(array_agg(distinct f), '{}') from (
    select app.chemin_photo(u) f from unnest(photos) u
    union all select x from jsonb_array_elements(meta) m, app.fichiers_meta(m) x) t where f is not null
$$;

-- Photo retirée ou bien supprimé : ses fichiers passent dans la file.
create or replace function app.photos_retirees() returns trigger
language plpgsql security definer set search_path = '' as $$
declare avant text[] := app.fichiers_du_bien(old.photos, old.photos_meta);
        apres text[] := case when tg_op = 'DELETE' then '{}' else app.fichiers_du_bien(new.photos, new.photos_meta) end;
begin
  perform app.enfiler('photos', array(select x from unnest(avant) x except select y from unnest(apres) y),
                      case when tg_op = 'DELETE' then 'bien supprimé' else 'photo retirée' end);
  return null;
end $$;
drop trigger if exists photos_retirees on public.properties;
create trigger photos_retirees after update of photos, photos_meta or delete on public.properties
  for each row execute function app.photos_retirees();

-- Photo de profil remplacée ou compte supprimé.
create or replace function app.avatar_retire() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' or new.avatar_url is distinct from old.avatar_url then
    perform app.enfiler('avatars', array[app.chemin_avatar(old.avatar_url)], 'photo de profil remplacée');
  end if;
  return null;
end $$;
drop trigger if exists avatar_retire on public.profiles;
create trigger avatar_retire after update of avatar_url or delete on public.profiles
  for each row execute function app.avatar_retire();

-- --- 5. Fonctions réservées à la fonction Edge de nettoyage (clé service uniquement) ------
-- Fichiers déposés mais jamais enregistrés (formulaire abandonné, envoi interrompu) :
-- après le délai de grâce, s'ils ne sont référencés nulle part, ils passent dans la file.
create or replace function public.nettoyage_preparer(delai_heures integer default 24, limite integer default 5000) returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  insert into app.fichiers_a_supprimer (bucket, chemin, raison)
  select o.bucket_id, o.name, 'jamais enregistré' from storage.objects o
  where o.bucket_id in ('photos', 'avatars') and o.created_at < now() - make_interval(hours => greatest(delai_heures, 1))
    and not exists (select 1 from app.fichiers_a_supprimer f where f.bucket = o.bucket_id and f.chemin = o.name)
    and not app.fichier_reference(o.bucket_id, o.name)
  order by o.created_at limit limite
  on conflict (bucket, chemin) do nothing;
  get diagnostics n = row_count; return n;
end $$;

-- Lot à supprimer : relu au dernier moment (un fichier redevenu utile n'est jamais supprimé).
create or replace function public.nettoyage_lot(limite integer default 200)
returns table (id bigint, bucket text, chemin text)
language plpgsql security definer set search_path = '' as $$
begin
  update app.fichiers_a_supprimer f set traite_le = now(), derniere_erreur = 'encore référencé : conservé'
  where f.traite_le is null and app.fichier_reference(f.bucket, f.chemin);
  return query select f.id, f.bucket, f.chemin from app.fichiers_a_supprimer f
    where f.traite_le is null and f.essais < 5 order by f.demande_le limit limite;
end $$;

create or replace function public.nettoyage_fin(faits bigint[], echecs jsonb default '[]'::jsonb) returns void
language sql security definer set search_path = '' as $$
  update app.fichiers_a_supprimer set traite_le = now(), derniere_erreur = null where id = any (faits);
  update app.fichiers_a_supprimer f set essais = f.essais + 1, derniere_erreur = left(e ->> 'erreur', 500)
  from jsonb_array_elements(echecs) e where f.id = (e ->> 'id')::bigint;
$$;

-- Rapport (lecture seule) : file, candidats orphelins, fichiers manquants.
create or replace function public.nettoyage_rapport(delai_heures integer default 24) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'file_a_traiter', (select count(*) from app.fichiers_a_supprimer where traite_le is null),
    'file_en_echec', (select count(*) from app.fichiers_a_supprimer where traite_le is null and essais >= 5),
    'orphelins_candidats', (select count(*) from storage.objects o where o.bucket_id in ('photos', 'avatars')
        and o.created_at < now() - make_interval(hours => greatest(delai_heures, 1)) and not app.fichier_reference(o.bucket_id, o.name)),
    'photos_manquantes', coalesce((select jsonb_agg(jsonb_build_object('bien', x.id, 'fichier', x.f)) from (
        select p.id, f from public.properties p, unnest(app.fichiers_du_bien(p.photos, p.photos_meta)) f
        where not exists (select 1 from storage.objects o where o.bucket_id = 'photos' and o.name = f) limit 200) x), '[]'::jsonb))
$$;

revoke all on function public.nettoyage_preparer(integer, integer), public.nettoyage_lot(integer),
  public.nettoyage_fin(bigint[], jsonb), public.nettoyage_rapport(integer) from public, anon, authenticated;
grant execute on function public.nettoyage_preparer(integer, integer), public.nettoyage_lot(integer),
  public.nettoyage_fin(bigint[], jsonb), public.nettoyage_rapport(integer) to service_role;

-- =============================================================================
-- Retour arrière (à exécuter à la main si nécessaire ; aucune donnée d'annonce perdue,
-- photos_meta seule disparaît) :
--   drop trigger if exists photos_retirees on public.properties;
--   drop trigger if exists controler_photos on public.properties;
--   drop trigger if exists avatar_retire on public.profiles;
--   drop function if exists public.nettoyage_preparer(integer, integer), public.nettoyage_lot(integer),
--     public.nettoyage_fin(bigint[], jsonb), public.nettoyage_rapport(integer);
--   drop policy if exists "deuksil : lecture de ses photos" on storage.objects;
--   drop table if exists app.fichiers_a_supprimer;
--   alter table public.properties drop column if exists photos_meta;
--   puis réappliquer app.dossier_autorise et les politiques « remplacement » / « suppression »
--   de la migration 20261022000600_stockage.sql.
-- =============================================================================
