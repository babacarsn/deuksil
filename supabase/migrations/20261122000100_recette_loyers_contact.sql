-- =============================================================================
-- DEUKSIL — Migration du 22 novembre 2026 : corrections de la recette
--
-- 1. Relevé du mandant à 0 FCFA (recette AGE-23, bloquant)
--    Les loyers créés par le site (échéancier d'un bail) n'avaient pas de
--    property_id. Or le propriétaire mandant ne lit un loyer que si son bien
--    (property_id) lui est rattaché : il voyait les dépenses (qui portent le
--    bien) mais aucun loyer, d'où « Encaissé 0 FCFA, net -70 000 ».
--    → property_id d'un loyer = celui de son bail, toujours (déclencheur) ;
--    → réparation des loyers existants.
-- 2. Message de contact « envoyé » mais introuvable (recette VIS-18)
--    → public.envoyer_contact(...) : enregistre le message et renvoie son
--      identifiant ; le site n'affiche « Message envoyé » qu'avec cet accusé.
--
-- Rejouable sans risque. Ne supprime aucune donnée.
-- =============================================================================

-- --- 1. Loyers : le bien suit le bail --------------------------------------------
create or replace function app.loyer_suit_bail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select l.property_id into new.property_id from public.leases l where l.id = new.lease_id;
  return new;
end $$;
drop trigger if exists loyer_suit_bail on public.rents;
create trigger loyer_suit_bail before insert or update of lease_id, property_id on public.rents
  for each row execute function app.loyer_suit_bail();

-- Réparation : loyers sans bien, ou dont le bien ne correspond plus au bail.
update public.rents r set property_id = l.property_id
  from public.leases l
 where l.id = r.lease_id and r.property_id is distinct from l.property_id;

-- Le bien d'un bail qui change (rare) : ses loyers suivent.
create or replace function app.loyers_suivent_bail() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.property_id is distinct from old.property_id then
    update public.rents set property_id = new.property_id where lease_id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists loyers_suivent_bail on public.leases;
create trigger loyers_suivent_bail after update of property_id on public.leases
  for each row execute function app.loyers_suivent_bail();

-- --- 2. Formulaire de contact : enregistrement avec accusé -------------------------
-- Les contrôles restent ceux de la table (contraintes) et du déclencheur
-- app.controler_contact (limite d'envoi, statut, auteur).
create or replace function public.envoyer_contact(p_nom text, p_email text, p_tel text, p_sujet text, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v uuid;
begin
  insert into public.contact_messages (name, email, phone, subject, message)
  values (left(trim(p_nom), 120), lower(trim(p_email)), nullif(left(trim(coalesce(p_tel, '')), 30), ''), p_sujet, left(trim(p_message), 3000))
  returning id into v;
  return v;
end $$;
revoke all on function public.envoyer_contact(text, text, text, text, text) from public;
grant execute on function public.envoyer_contact(text, text, text, text, text) to anon, authenticated;
