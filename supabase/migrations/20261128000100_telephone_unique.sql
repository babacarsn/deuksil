-- =============================================================================
-- DEUKSIL — Migration du 28 novembre 2026 : un numéro de téléphone = un compte
--
-- Deux comptes ne peuvent plus avoir le même numéro de téléphone. Le numéro est
-- comparé sous sa forme courte (9 derniers chiffres) : « 77 123 45 67 »,
-- « 771234567 » et « +221 77 123 45 67 » sont le même numéro.
-- * Déclencheur : refus clair à l'inscription, à la création d'un accès par une
--   agence ou un propriétaire, et à la modification du profil.
-- * public.telephone_libre(tel) : le site vérifie le numéro avant d'envoyer
--   l'inscription (même principe que pour la CNI : rien de plus n'est révélé que
--   ce que dirait le refus).
-- Les doublons qui existent déjà ne sont pas modifiés (voir le contrôle à la fin
-- du fichier A_FAIRE) ; ils ne bloquent pas la migration.
-- Rejouable sans risque.
-- =============================================================================

create or replace function app.tel_court(t text) returns text
language sql immutable set search_path = '' as $$
  select case when length(regexp_replace(coalesce(t, ''), '\D', '', 'g')) >= 9
              then right(regexp_replace(t, '\D', '', 'g'), 9) end
$$;

create index if not exists profiles_tel_court on public.profiles (app.tel_court(phone)) where phone is not null;

create or replace function app.verifier_tel_unique() returns trigger
language plpgsql security definer set search_path = '' as $$
declare court text := app.tel_court(new.phone);
begin
  if court is null or new.doublon_de is not null then return new; end if;
  if tg_op = 'UPDATE' and court is not distinct from app.tel_court(old.phone) then return new; end if;
  perform pg_advisory_xact_lock(hashtext('tel:' || court));
  if exists (select 1 from public.profiles p
             where app.tel_court(p.phone) = court and p.id <> new.id and p.doublon_de is null) then
    raise exception 'Ce numéro de téléphone est déjà utilisé par un autre compte DEUKSIL. Utilisez un autre numéro, ou connectez-vous au compte existant.'
      using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function app.verifier_tel_unique() from public;

drop trigger if exists verifier_tel_unique on public.profiles;
create trigger verifier_tel_unique before insert or update of phone on public.profiles
  for each row execute function app.verifier_tel_unique();

-- Le numéro est-il libre ? (son propre numéro compte comme libre)
create or replace function public.telephone_libre(tel text) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.tel_court(tel) is null or not exists (
    select 1 from public.profiles p
    where app.tel_court(p.phone) = app.tel_court(tel) and p.doublon_de is null
      and p.id is distinct from auth.uid())
$$;
revoke all on function public.telephone_libre(text) from public;
grant execute on function public.telephone_libre(text) to anon, authenticated;
