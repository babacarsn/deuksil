-- =============================================================================
-- CNI : messages justes et refus explicites (recette du 11-12 novembre 2026)
--
-- Constat en recette : « on ne peut pas publier, on nous dit que la CNI n'est
-- pas renseignée alors qu'on l'a renseignée ».
--   1. Le refus de publication renvoyait vers « Mon profil », écran qui n'existe
--      pas dans le menu de l'agence ni de l'agent ; il ne disait pas non plus
--      qu'un agent ou un gestionnaire dépend de la CNI du TITULAIRE du compte.
--   2. Enregistrer une CNI déjà utilisée par un autre compte (fréquent en test :
--      le même numéro saisi sur plusieurs comptes) échouait sur l'index unique
--      avec une erreur technique (« duplicate key… », affichée « Cet élément
--      existe déjà. ») : la CNI disparaissait sans explication.
--
-- Cette migration :
--   - garde la règle (CNI du titulaire de l'espace exigée pour publier) ;
--   - donne un message clair, différent pour le titulaire et pour un membre ;
--   - refuse une CNI déjà utilisée avec un message clair, AVANT l'index unique ;
--   - expose public.cni_espace_renseignee() pour que le site interroge la base.
-- Rien n'est supprimé : aucune table, colonne ou donnée. Rejouable sans risque.
-- Retour arrière : rejouer 20261028000100_cni_avant_publication.sql
-- (et « drop trigger if exists verifier_cni_unique on public.profiles; »).
-- =============================================================================

-- --- 1. Publication : même règle, message juste ---------------------------------
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
    -- Mise en ligne par un utilisateur : le titulaire de l'espace doit avoir une CNI.
    if current_user in ('authenticated', 'anon') and not app.est_admin()
       and not app.espace_a_une_cni() then
      if app.role_membre() is not null then
        raise exception 'CNI manquante : le titulaire du compte doit renseigner son numéro de CNI dans Paramètres avant que l''équipe puisse publier.' using errcode = '42501';
      end if;
      raise exception 'CNI manquante : renseignez votre numéro de CNI (13 chiffres) dans Paramètres avant de publier une annonce.' using errcode = '42501';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;

-- --- 2. CNI déjà utilisée : refus clair avant l'index unique ---------------------
-- SECURITY DEFINER : la RLS cache les autres profils, il faut les voir pour comparer.
-- L'index unique (profiles_cni_unique) dit déjà si un numéro existe : rien de plus
-- n'est révélé, seul le message change.
create or replace function app.verifier_cni_unique() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.cni is not null and new.cni is distinct from old.cni and new.doublon_de is null
     and exists (select 1 from public.profiles p
                 where p.cni = new.cni and p.id <> new.id and p.doublon_de is null) then
    raise exception 'Ce numéro de CNI est déjà utilisé par un autre compte DEUKSIL. Vérifiez-le ; si c''est bien le vôtre, contactez DEUKSIL.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function app.verifier_cni_unique() from public;

drop trigger if exists verifier_cni_unique on public.profiles;
create trigger verifier_cni_unique before update of cni on public.profiles
  for each row execute function app.verifier_cni_unique();

-- --- 3. Le site peut demander à la base si la CNI de l'espace est enregistrée ----
-- Ne renvoie qu'un booléen, et seulement pour l'espace de l'utilisateur connecté.
create or replace function public.cni_espace_renseignee() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.espace_a_une_cni()
$$;
revoke all on function public.cni_espace_renseignee() from public;
grant execute on function public.cni_espace_renseignee() to authenticated;

-- --- 4. (FACULTATIF, désactivé) Une même personne : un compte par type -----------
-- Aujourd'hui une CNI ne sert qu'à UN compte. Une personne qui a un compte
-- propriétaire ET dirige une agence ne peut donc pas renseigner sa CNI sur les deux.
-- Si DEUKSIL décide de l'autoriser (une CNI par type de compte), décommenter :
--
-- drop index if exists public.profiles_cni_unique;
-- create unique index profiles_cni_unique on public.profiles (cni, role)
--   where cni is not null and doublon_de is null;
-- -- et, dans app.verifier_cni_unique(), ajouter « and p.role = new.role ».
