-- =============================================================================
-- DEUKSIL — Migration 0300 : comptes, fonctions de droits, déclencheurs d'intégrité
-- =============================================================================

-- --- Réglages de sécurité (modifiables par SQL uniquement) ---------------------
create table app.reglages (
  cle    text primary key,
  valeur text not null
);
insert into app.reglages values
  ('admin_mfa_obligatoire', 'non')   -- passer à 'oui' une fois la double authentification activée pour les admins
on conflict do nothing;
revoke all on app.reglages from anon, authenticated;

-- --- Fonctions de droits (SECURITY DEFINER : lisent profiles sans repasser par RLS) ---
-- Toutes fixent search_path = '' et qualifient chaque objet : pas de détournement
-- possible par un objet homonyme.

create or replace function app.est_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'actif'
      and ((select valeur from app.reglages where cle = 'admin_mfa_obligatoire') <> 'oui'
           or coalesce(auth.jwt() ->> 'aal', '') = 'aal2'))
$$;

-- Espace (compte titulaire) pour lequel l'utilisateur agit : lui-même, ou le compte
-- parent pour un membre d'équipe. NULL si le compte (ou son parent) est suspendu.
create or replace function app.espace() returns uuid
language sql stable security definer set search_path = '' as $$
  select case
    when p.status <> 'actif' then null
    when p.parent_id is null then p.id
    else (select q.id from public.profiles q where q.id = p.parent_id and q.status = 'actif')
  end
  from public.profiles p where p.id = auth.uid()
$$;

create or replace function app.est_titulaire() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.parent_id is null and p.status = 'actif')
$$;

-- Rôle de membre d'équipe ('manager' ou 'agent'), NULL pour un titulaire.
create or replace function app.role_membre() returns text
language sql stable security definer set search_path = '' as $$
  select case when p.parent_id is not null then p.role end from public.profiles p where p.id = auth.uid()
$$;

-- Permission d'un membre (le titulaire a toutes les permissions de son espace).
create or replace function app.a_droit(permission text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'actif'
      and (p.parent_id is null or permission = any (p.perms)))
$$;

-- Baux auxquels l'utilisateur a accès comme locataire.
create or replace function app.mes_baux() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select array(select distinct x from unnest(p.lease_ids || case when p.lease_id is null then '{}'::uuid[] else array[p.lease_id] end) x)
     from public.profiles p where p.id = auth.uid() and p.status = 'actif'), '{}')
$$;

-- Biens loués par l'utilisateur (locataire).
create or replace function app.biens_locataire() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct l.property_id), '{}') from public.leases l where l.id = any (app.mes_baux())
$$;

-- Fiches « propriétaire mandant » rattachées au compte de l'utilisateur.
create or replace function app.mes_fiches() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(o.id), '{}') from public.owner_records o
  where o.compte_id = auth.uid() and coalesce(o.lien, '') = 'accepte' and o.status <> 'close'
$$;

-- Biens confiés à une agence par l'utilisateur (mandant).
create or replace function app.biens_mandant() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(p.id), '{}') from public.properties p where p.client_owner_id = any (app.mes_fiches())
$$;

-- Biens qu'un client suit au titre d'une vente ou d'une visite (même retirés de la vente).
create or replace function app.biens_client() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(distinct x), '{}') from (
    select d.property_id x from public.deals d where d.client_id = auth.uid()
    union select v.property_id from public.visits v where v.client_id = auth.uid()
  ) s where x is not null
$$;

create or replace function app.compte_actif(id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = compte_actif.id and p.status = 'actif')
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to anon, authenticated, service_role;

-- --- Création du profil à l'inscription ---------------------------------------------
-- user_metadata (fourni par le navigateur, NON fiable) : nom, téléphone, CNI, agence,
--   et un rôle limité à client / owner / agency.
-- app_metadata (écrit uniquement côté serveur avec la clé service_role, par la
--   fonction Edge « creer-acces ») : rôle de membre, parent, permissions, baux…
create or replace function app.creer_profil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  u jsonb := coalesce(new.raw_user_meta_data, '{}');
  a jsonb := coalesce(new.raw_app_meta_data, '{}');
  role_demande text := coalesce(a ->> 'deuksil_role', u ->> 'role', 'client');
  serveur boolean := a ? 'deuksil_role';
  prenom text := coalesce(nullif(u ->> 'first_name', ''), nullif(u ->> 'given_name', ''), split_part(coalesce(u ->> 'full_name', u ->> 'name', ''), ' ', 1));
  nom text := coalesce(nullif(u ->> 'last_name', ''), nullif(u ->> 'family_name', ''),
                       nullif(substr(coalesce(u ->> 'full_name', u ->> 'name', ''), length(split_part(coalesce(u ->> 'full_name', u ->> 'name', ''), ' ', 1)) + 2), ''), '');
begin
  if not serveur and role_demande not in ('client', 'owner', 'agency') then role_demande := 'client'; end if;
  if serveur and role_demande not in ('client','owner','agency','tenant','manager','agent') then
    raise exception 'Rôle non autorisé : %', role_demande;
  end if;
  insert into public.profiles (id, role, email, first_name, last_name, phone, cni, agency_name, address, ninea, rccm,
                               avatar_url, cgu_acceptees_le, parent_id, perms, titre, owner_ref, mandant_of, owner_rec,
                               lease_id, lease_ids, mdp_provisoire)
  values (
    new.id, role_demande, lower(new.email),
    left(coalesce(prenom, ''), 80), left(coalesce(nom, ''), 80),
    nullif(left(u ->> 'phone', 30), ''),
    case when (u ->> 'cni') ~ '^\d{13}$' then u ->> 'cni' end,
    case when role_demande = 'agency' then nullif(left(u ->> 'agency_name', 120), '') end,
    nullif(left(u ->> 'address', 300), ''),
    case when role_demande = 'agency' then nullif(left(u ->> 'ninea', 40), '') end,
    case when role_demande = 'agency' then nullif(left(u ->> 'rccm', 60), '') end,
    nullif(coalesce(u ->> 'avatar_url', u ->> 'picture'), ''),
    case when (u ->> 'cgu') = 'true' then now() end,
    case when serveur then (a ->> 'parent_id')::uuid end,
    case when serveur and a ? 'perms' then array(select jsonb_array_elements_text(a -> 'perms')) else '{}' end,
    case when serveur then a ->> 'titre' end,
    case when serveur then (a ->> 'owner_ref')::uuid end,
    case when serveur then (a ->> 'mandant_of')::uuid end,
    case when serveur then (a ->> 'owner_rec')::uuid end,
    case when serveur then (a ->> 'lease_id')::uuid end,
    case when serveur and a ? 'lease_ids' then array(select jsonb_array_elements_text(a -> 'lease_ids'))::uuid[] else '{}' end,
    serveur and coalesce((a ->> 'mdp_provisoire')::boolean, false)
  );
  return new;
end $$;
create trigger creer_profil after insert on auth.users for each row execute function app.creer_profil();

-- L'API d'administration d'Auth écrit app_metadata APRÈS la création de la ligne :
-- les attributs posés par le serveur (fonction Edge « creer-acces ») sont donc
-- appliqués aussi lors de cette mise à jour. app_metadata n'est modifiable
-- qu'avec la clé service_role : jamais depuis un navigateur.
create or replace function app.appliquer_meta_serveur() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := coalesce(new.raw_app_meta_data, '{}');
begin
  if not (a ? 'deuksil_role') or a is not distinct from coalesce(old.raw_app_meta_data, '{}') then return new; end if;
  if (a ->> 'deuksil_role') not in ('client','owner','agency','tenant','manager','agent') then
    raise exception 'Rôle non autorisé : %', a ->> 'deuksil_role';
  end if;
  update public.profiles set
    role           = a ->> 'deuksil_role',
    parent_id      = (a ->> 'parent_id')::uuid,
    perms          = case when a ? 'perms' then array(select jsonb_array_elements_text(a -> 'perms')) else '{}' end,
    titre          = coalesce(a ->> 'titre', titre),
    owner_ref      = coalesce((a ->> 'owner_ref')::uuid, owner_ref),
    mandant_of     = coalesce((a ->> 'mandant_of')::uuid, mandant_of),
    owner_rec      = coalesce((a ->> 'owner_rec')::uuid, owner_rec),
    lease_id       = coalesce((a ->> 'lease_id')::uuid, lease_id),
    lease_ids      = case when a ? 'lease_ids' then array(select jsonb_array_elements_text(a -> 'lease_ids'))::uuid[] else lease_ids end,
    mdp_provisoire = coalesce((a ->> 'mdp_provisoire')::boolean, mdp_provisoire)
  where id = new.id;
  return new;
end $$;
create trigger appliquer_meta_serveur after update of raw_app_meta_data on auth.users for each row execute function app.appliquer_meta_serveur();

-- L'adresse e-mail suit celle du compte d'authentification.
create or replace function app.suivre_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = lower(new.email) where id = new.id;
  end if;
  return new;
end $$;
create trigger suivre_email after update of email on auth.users for each row execute function app.suivre_email();

-- --- Protection des colonnes sensibles d'un profil ----------------------------------
-- La RLS dit QUI peut modifier une ligne ; ce déclencheur dit QUELLES colonnes.
-- SECURITY INVOKER volontairement : current_user y vaut le rôle de l'appelant.
-- Une modification faite par une fonction de confiance (SECURITY DEFINER, ex.
-- public.changer_type_compte) ou par le serveur n'est pas filtrée ici.
create or replace function app.proteger_profil() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  modifiees text[];
  permises text[];
  moi uuid := auth.uid();
  espace uuid := app.espace();
begin
  if current_user not in ('authenticated', 'anon') or moi is null then return new; end if;   -- serveur, fonction de confiance
  select coalesce(array_agg(k), '{}') into modifiees
  from jsonb_object_keys(to_jsonb(new)) k
  where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k and k <> 'updated_at';
  if cardinality(modifiees) = 0 then return new; end if;

  if app.est_admin() then
    -- L'administration modère (statut, vérification, doublons) mais ne crée pas d'autres admins.
    if new.role is distinct from old.role and 'admin' in (new.role, old.role) then
      raise exception 'Le rôle administrateur se gère uniquement côté serveur.' using errcode = '42501';
    end if;
    return new;
  end if;

  permises := array['first_name','last_name','phone','address','agency_name','agency_desc','ninea','rccm',
                    'avatar_url','hours','notif_prefs','regles','doc_info','extra','cgu_acceptees_le'];
  if new.id = moi then
    -- Son propre profil. mdp_provisoire peut seulement repasser à false.
    if 'mdp_provisoire' = any (modifiees) and new.mdp_provisoire = false then permises := array_append(permises, 'mdp_provisoire'); end if;
    if 'cni' = any (modifiees) and old.cni is null then permises := array_append(permises, 'cni'); end if;
  elsif old.parent_id is not null and old.parent_id = espace and app.est_titulaire() then
    -- Le titulaire gère son équipe.
    permises := array['first_name','last_name','phone','perms','status','titre','extra','statut_le','statut_par'];
    if 'role' = any (modifiees) and new.role in ('manager','agent') and old.role in ('manager','agent') then permises := array_append(permises, 'role'); end if;
  elsif espace is not null and (old.owner_ref = espace or old.mandant_of = espace) and app.est_titulaire() then
    -- Bailleur ou agence qui a ouvert ce compte (locataire, mandant).
    permises := array['first_name','last_name','phone','lease_id','lease_ids','owner_rec','status','extra','mdp_provisoire'];
  else
    raise exception 'Modification de ce profil non autorisée.' using errcode = '42501';
  end if;

  if not (modifiees <@ permises) then
    raise exception 'Champs non modifiables : %', array_to_string(array(select unnest(modifiees) except select unnest(permises)), ', ')
      using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_profil before update on public.profiles for each row execute function app.proteger_profil();

-- --- Cohérence de l'espace propriétaire ----------------------------------------------
-- owner_id d'une donnée liée à un bien ou à un bail est TOUJOURS celui du bien / du
-- bail : un navigateur ne peut pas rattacher une visite ou un ticket à un autre espace.
create or replace function app.aligner_sur_bien() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.property_id is not null then
    select p.owner_id into new.owner_id from public.properties p where p.id = new.property_id;
    if new.owner_id is null then raise exception 'Bien introuvable.' using errcode = '23503'; end if;
  end if;
  return new;
end $$;
create or replace function app.aligner_sur_bail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select l.owner_id into new.owner_id from public.leases l where l.id = new.lease_id;
  if new.owner_id is null then raise exception 'Bail introuvable.' using errcode = '23503'; end if;
  return new;
end $$;
create trigger aligner_espace before insert or update of property_id, owner_id on public.visits for each row execute function app.aligner_sur_bien();
create trigger aligner_espace before insert or update of property_id, owner_id on public.reports for each row execute function app.aligner_sur_bien();
create trigger aligner_espace before insert or update of property_id, owner_id on public.tickets for each row execute function app.aligner_sur_bien();
create trigger aligner_espace before insert or update of lease_id, owner_id on public.rents for each row execute function app.aligner_sur_bail();
create trigger aligner_espace before insert or update of lease_id, owner_id on public.lease_messages for each row execute function app.aligner_sur_bail();
create trigger aligner_espace before insert or update of lease_id, owner_id on public.inspections for each row execute function app.aligner_sur_bail();

-- Un bail, une unité, un mandat de vente portent sur un bien de leur propre espace.
create or replace function app.verifier_bien_de_l_espace() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.property_id is not null and not exists (
       select 1 from public.properties p where p.id = new.property_id and p.owner_id = new.owner_id) then
    raise exception 'Ce bien n''appartient pas à cet espace.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger verifier_bien before insert or update of property_id, owner_id on public.leases for each row execute function app.verifier_bien_de_l_espace();
create trigger verifier_bien before insert or update of property_id, owner_id on public.units for each row execute function app.verifier_bien_de_l_espace();
create trigger verifier_bien before insert or update of property_id, owner_id on public.sale_mandates for each row execute function app.verifier_bien_de_l_espace();

-- Un ticket ouvert par un locataire porte sur SON logement.
create or replace function app.verifier_ticket_locataire() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return new; end if;   -- serveur (clé service_role, migration) : pas d'utilisateur
  if new.owner_id is distinct from app.espace() and not app.est_admin() then
    if new.tenant_id is distinct from auth.uid() or not (new.property_id = any (app.biens_locataire())) then
      raise exception 'Signalement possible uniquement pour votre logement.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger verifier_locataire before insert on public.tickets for each row execute function app.verifier_ticket_locataire();

-- Pas deux visites à la même heure sur le même bien (hors visites annulées ou refusées).
create unique index visits_creneau_unique on public.visits (property_id, date, time)
  where status not in ('annulee','annulée','refusee','refusée');

-- Pas deux baux actifs qui se chevauchent sur le même logement (bien ou unité).
alter table public.leases add column fin date generated always as ((start + make_interval(months => months))::date) stored;
alter table public.leases add constraint baux_sans_chevauchement exclude using gist (
  property_id with =, (coalesce(unit_id, '00000000-0000-0000-0000-000000000000'::uuid)) with =,
  daterange(start, fin, '[)') with &&) where (status = 'actif');

-- Une transition de statut d'annonce : seul l'admin peut sortir une annonce de « refusee ».
create or replace function app.controler_annonce() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and current_user in ('authenticated', 'anon') and not app.est_admin() then
    if new.verif_level is distinct from old.verif_level then
      raise exception 'Le niveau de vérification est attribué par DEUKSIL.' using errcode = '42501';
    end if;
    if new.owner_id is distinct from old.owner_id then
      raise exception 'Un bien ne change pas d''espace.' using errcode = '42501';
    end if;
    if new.views < old.views or new.contacts < old.contacts then
      new.views := old.views; new.contacts := old.contacts;   -- compteurs : uniquement via public.compter_vue()
    end if;
  end if;
  if tg_op = 'INSERT' and current_user in ('authenticated', 'anon') and not app.est_admin() then
    new.verif_level := null; new.views := 0; new.contacts := 0;
  end if;
  if new.listing_status = 'publiee' and (tg_op = 'INSERT' or old.listing_status is distinct from 'publiee') then
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
create trigger controler_annonce before insert or update on public.properties for each row execute function app.controler_annonce();

-- Journal d'audit en écriture seule : ni modification ni suppression, même par l'espace.
create or replace function app.journal_immuable() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Le journal ne peut pas être modifié.' using errcode = '42501';
end $$;
create trigger journal_immuable before update or delete on public.audit_log for each row
  when (current_user in ('authenticated','anon')) execute function app.journal_immuable();

-- Messages : un destinataire ne peut que marquer « lu » ; l'auteur ne réécrit pas l'historique.
create or replace function app.proteger_message() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if new.text is distinct from old.text or new.sender_id is distinct from old.sender_id
     or new.conversation_id is distinct from old.conversation_id or new.pj is distinct from old.pj then
    raise exception 'Un message envoyé ne peut pas être modifié.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger proteger_message before update on public.conversation_messages for each row execute function app.proteger_message();
