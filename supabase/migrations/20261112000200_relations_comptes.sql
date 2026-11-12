-- =============================================================================
-- Relations entre comptes : le propriétaire mandant voit enfin ses biens.
--
-- Constat (audit du 12 novembre 2026) : quand une agence ouvre l'accès d'un
-- propriétaire mandant (bouton « Ouvrir l'accès », fonction gerer-acces), le
-- compte est créé avec owner_rec (sa fiche) et mandant_of (l'agence), mais la
-- fiche owner_records n'est jamais reliée au compte (compte_id vide, lien vide).
-- Or tout ce que voit un mandant passe par app.mes_fiches(), qui exige
-- compte_id = le compte ET lien = 'accepte'. Résultat : le mandant se connectait
-- sur un espace vide (ni biens, ni baux, ni mandats, ni relevés).
--
-- Cette migration :
--   1. relie automatiquement la fiche au compte à sa création par l'agence
--      (déclencheur sur public.profiles) ;
--   2. répare les mandants déjà créés.
-- Sécurité : owner_rec et mandant_of ne sont posés que par le serveur
-- (app_metadata, fonction gerer-acces, qui a vérifié que la fiche appartient à
-- l'agence) ; on vérifie en plus ici que la fiche appartient bien à l'agence
-- (owner_id = mandant_of) et qu'elle n'est pas déjà reliée à un autre compte.
-- Rien n'est supprimé. Rejouable sans risque.
-- Retour arrière : drop trigger if exists lier_fiche_mandant on public.profiles;
-- =============================================================================

create or replace function app.lier_fiche_mandant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_rec is not null and new.mandant_of is not null
     and (tg_op = 'INSERT' or new.owner_rec is distinct from old.owner_rec) then
    update public.owner_records o
       set compte_id = new.id,
           lien = 'accepte',
           lien_le = coalesce(o.lien_le, now()),
           email = coalesce(nullif(o.email, ''), new.email)
     where o.id = new.owner_rec
       and o.owner_id = new.mandant_of
       and (o.compte_id is null or o.compte_id = new.id);
  end if;
  return new;
end $$;
revoke all on function app.lier_fiche_mandant() from public;

drop trigger if exists lier_fiche_mandant on public.profiles;
create trigger lier_fiche_mandant after insert or update of owner_rec on public.profiles
  for each row execute function app.lier_fiche_mandant();

-- Réparation : mandants déjà créés dont la fiche n'est pas reliée.
update public.owner_records o
   set compte_id = p.id,
       lien = 'accepte',
       lien_le = coalesce(o.lien_le, now()),
       email = coalesce(nullif(o.email, ''), p.email)
  from public.profiles p
 where p.owner_rec = o.id
   and p.mandant_of = o.owner_id
   and (o.compte_id is null or o.compte_id = p.id)
   and coalesce(o.lien, '') <> 'accepte';
