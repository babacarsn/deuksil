-- =============================================================================
-- CNI facultative à l'inscription, exigée avant de publier une annonce.
--
-- Avant : la CNI était demandée par le formulaire d'inscription (le déclencheur
-- de création de profil l'acceptait déjà absente : colonne « cni » nullable).
-- Désormais : l'inscription se fait sans CNI ; la mettre en ligne (passage de
-- listing_status à « publiee ») exige que le compte propriétaire de l'annonce
-- (owner_id = l'espace : propriétaire ou agence) ait une CNI enregistrée.
--
-- Rien n'est supprimé : aucune colonne, aucune donnée. Les annonces déjà en
-- ligne ne sont pas touchées (seule la transition vers « publiee » est contrôlée).
-- L'administration n'est pas concernée (modération).
-- La CNI s'ajoute depuis « Mon profil » : app.controler_profil autorise déjà
-- son propriétaire à la renseigner une seule fois (old.cni is null).
-- =============================================================================

-- L'espace de l'utilisateur connecté a-t-il une CNI ? (security definer : un agent
-- n'a pas forcément le droit de lire le profil de son agence ; ne renvoie qu'un booléen
-- et seulement pour son propre espace.)
create or replace function app.espace_a_une_cni() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = app.espace() and p.cni is not null)
$$;
revoke all on function app.espace_a_une_cni() from public;
grant execute on function app.espace_a_une_cni() to authenticated;

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
    -- Mise en ligne par un utilisateur : le compte de l'espace doit avoir une CNI.
    if current_user in ('authenticated', 'anon') and not app.est_admin()
       and not app.espace_a_une_cni() then
      raise exception 'Renseignez un numéro de CNI dans « Mon profil » avant de publier une annonce.' using errcode = '42501';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end $$;
