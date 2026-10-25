-- =============================================================================
-- DEUKSIL — Migration 0500 : fonctions appelables par l'application (RPC)
--
-- Chaque fonction SECURITY DEFINER :
--   * fixe search_path = '' et qualifie tous les objets ;
--   * vérifie elle-même l'identité (auth.uid()) et les droits ;
--   * n'utilise que des paramètres typés (aucun SQL dynamique) ;
--   * n'est exécutable que par les rôles qui en ont besoin.
-- =============================================================================

-- --- Annuaire : ce que chacun peut savoir des autres comptes ------------------------
-- Remplace la lecture directe de profiles pour les comptes « des autres » :
--   * tout le monde : propriétaires et agences actifs (nom, agence, vérification) ;
--   * connecté : leur téléphone et e-mail de contact, plus les personnes avec qui
--     on est en relation (clients de son espace, locataires, bailleur, équipe,
--     interlocuteurs de la messagerie).
-- Jamais : CNI, NINEA/RCCM, baux, permissions, données d'administration.
create or replace function public.annuaire()
returns table (id uuid, role text, status text, first_name text, last_name text, agency_name text, agency_desc text,
               address text, avatar_url text, verif_level text, hours text, phone text, email text, parent_id uuid, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with moi as (select auth.uid() as uid, app.espace() as esp),
  relations as (
    select v.client_id x from public.visits v, moi where v.owner_id = moi.esp
    union select d.client_id from public.deals d, moi where d.owner_id = moi.esp
    union select b.client_id from public.billing_docs b, moi where b.owner_id = moi.esp
    union select v.owner_id from public.visits v, moi where v.client_id = moi.uid
    union select l.owner_id from public.leases l where l.id = any (app.mes_baux())
    union select p.id from public.profiles p, moi where p.lease_ids && (select coalesce(array_agg(l.id), '{}') from public.leases l where l.owner_id = moi.esp)
    union select unnest(c.participants) from public.conversations c, moi where moi.uid = any (c.participants) or moi.esp = any (c.participants)
    union select r.proprio_id from public.agency_link_requests r, moi where r.agence_id = moi.esp
    union select o.compte_id from public.owner_records o, moi where o.owner_id = moi.esp
    union select o.owner_id from public.owner_records o, moi where o.compte_id = moi.uid
    union select p.id from public.profiles p, moi where p.parent_id = moi.esp
    union select moi.esp from moi
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
revoke all on function public.annuaire() from public;
grant execute on function public.annuaire() to anon, authenticated;

-- --- Notifications vers un autre compte -------------------------------------------------
alter table public.notifications add column sent_by uuid references public.profiles(id) on delete set null default auth.uid();

-- Deux comptes sont « en relation » s'ils partagent un dossier : équipe, bien visité,
-- bail, vente, facture, conversation, demande de gestion, mandat.
create or replace function app.en_relation(dest uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with moi as (select auth.uid() as uid, app.espace() as esp)
  select dest in (select uid from moi union select esp from moi)
    or exists (select 1 from public.profiles p, moi where p.id = dest and (p.parent_id = moi.esp or p.id = moi.esp or p.owner_ref = moi.esp or p.mandant_of = moi.esp))
    or exists (select 1 from public.profiles p where p.id = dest and p.role = 'admin')
    or exists (select 1 from public.visits v, moi where (v.owner_id = moi.esp and v.client_id = dest) or (v.client_id = moi.uid and v.owner_id = dest))
    or exists (select 1 from public.properties pr, moi where pr.owner_id = dest and pr.listing_status = 'publiee' and moi.uid is not null)
    or exists (select 1 from public.leases l where l.id = any (app.mes_baux()) and l.owner_id = dest)
    or exists (select 1 from public.profiles p, moi where p.id = dest and p.lease_ids && (select coalesce(array_agg(l.id), '{}') from public.leases l where l.owner_id = moi.esp))
    or exists (select 1 from public.deals d, moi where d.owner_id = moi.esp and d.client_id = dest)
    or exists (select 1 from public.billing_docs b, moi where b.owner_id = moi.esp and b.client_id = dest)
    or exists (select 1 from public.conversations c, moi where dest = any (c.participants) and (moi.uid = any (c.participants) or moi.esp = any (c.participants)))
    or exists (select 1 from public.agency_link_requests r, moi where (r.proprio_id = moi.uid and r.agence_id = dest) or (r.agence_id = moi.esp and r.proprio_id = dest))
    or exists (select 1 from public.owner_records o, moi where (o.owner_id = moi.esp and o.compte_id = dest) or (o.compte_id = moi.uid and o.owner_id = dest))
$$;

create or replace function public.notifier(dest uuid, texte text, lien text default null, cle text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare n uuid; recents int;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if dest is null or texte is null or length(texte) = 0 then return null; end if;
  if not app.en_relation(dest) then raise exception 'Destinataire non autorisé.' using errcode = '42501'; end if;
  select count(*) into recents from public.notifications where sent_by = auth.uid() and created_at > now() - interval '1 minute';
  if recents >= 60 then raise exception 'Trop de notifications envoyées. Réessayez dans une minute.' using errcode = '54000'; end if;
  insert into public.notifications (user_id, text, link, key, sent_by)
  values (dest, left(texte, 1000), case when lien ~ '^#/' then left(lien, 300) end, left(cle, 120), auth.uid())
  on conflict (user_id, key) where key is not null do nothing
  returning id into n;
  return n;
end $$;
revoke all on function public.notifier(uuid, text, text, text) from public;
grant execute on function public.notifier(uuid, text, text, text) to authenticated;

create or replace function public.notifier_admins(texte text, lien text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare k int; recents int;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select count(*) into recents from public.notifications where sent_by = auth.uid() and created_at > now() - interval '1 minute';
  if recents >= 60 then raise exception 'Trop de notifications envoyées.' using errcode = '54000'; end if;
  insert into public.notifications (user_id, text, link, sent_by)
  select p.id, left(texte, 1000), case when lien ~ '^#/' then left(lien, 300) end, auth.uid()
  from public.profiles p where p.role = 'admin' and p.status = 'actif';
  get diagnostics k = row_count;
  return k;
end $$;
revoke all on function public.notifier_admins(text, text) from public;
grant execute on function public.notifier_admins(text, text) to authenticated;

-- --- Compteurs d'une annonce (vues, contacts) --------------------------------------------
-- Le navigateur ne modifie jamais directement le bien d'un autre : il demande +1.
create or replace function public.compter(bien uuid, champ text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if champ = 'views' then
    update public.properties set views = views + 1
    where id = bien and listing_status = 'publiee' and owner_id is distinct from app.espace();
  elsif champ = 'contacts' then
    if auth.uid() is null then return; end if;
    update public.properties set contacts = contacts + 1
    where id = bien and listing_status = 'publiee' and owner_id is distinct from app.espace();
  else
    raise exception 'Compteur inconnu.' using errcode = '22023';
  end if;
end $$;
revoke all on function public.compter(uuid, text) from public;
grant execute on function public.compter(uuid, text) to anon, authenticated;

-- --- Type de compte : client ⇄ propriétaire ⇄ agence ------------------------------------
create or replace function public.changer_type_compte(nouveau text)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.status <> 'actif' then raise exception 'Compte introuvable ou suspendu.' using errcode = '42501'; end if;
  if nouveau not in ('client','owner','agency') or p.role not in ('client','owner','agency') or p.parent_id is not null then
    raise exception 'Changement de type de compte non autorisé.' using errcode = '42501';
  end if;
  if p.role in ('owner','agency') and nouveau <> p.role and (
       exists (select 1 from public.properties where owner_id = p.id)
    or exists (select 1 from public.leases where owner_id = p.id)
    or exists (select 1 from public.profiles where parent_id = p.id)) then
    raise exception 'Ce compte gère déjà des biens, des baux ou une équipe : il ne peut pas changer de type.' using errcode = '23514';
  end if;
  update public.profiles set role = nouveau where id = p.id;   -- passe le déclencheur en tant que propriétaire de la fonction
end $$;
revoke all on function public.changer_type_compte(text) from public;
grant execute on function public.changer_type_compte(text) to authenticated;

-- --- Pièce reçue par message : rangée dans le coffre du destinataire ---------------------
alter table public.documents alter column storage_path drop not null;
alter table public.documents add constraint documents_fichier_ou_piece check (storage_path is not null or pj_src is not null);
create policy "pièce reçue : dépôt chez le destinataire" on public.documents for insert to authenticated
  with check (storage_path is null and pj_src is not null
              and recu_de in ((select auth.uid()), (select app.espace()))
              and exists (select 1 from public.conversations c
                          where owner_id = any (c.participants)
                            and ((select auth.uid()) = any (c.participants) or (select app.espace()) = any (c.participants))));

-- --- Chiffres clés de la page d'accueil --------------------------------------------
-- Totaux réels, calculés par la base : un visiteur ne voit qu'une partie des lignes
-- (RLS) et ne peut donc pas les compter lui-même. Seuls des totaux sortent.
create or replace function public.chiffres_publics()
returns table (biens bigint, comptes bigint, visites bigint)
language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.properties where listing_status = 'publiee'),
         (select count(*) from public.profiles where status = 'actif' and role <> 'admin' and doublon_de is null),
         (select count(*) from public.visits where status in ('acceptee', 'terminee'))
$$;
revoke all on function public.chiffres_publics() from public;
grant execute on function public.chiffres_publics() to anon, authenticated;

-- --- Messages de contact : limite d'envoi et alerte de l'administration ---------------
-- Le formulaire est ouvert aux visiteurs : la base limite les envois (par adresse et
-- au total) pour qu'il ne serve pas à saturer la table ou les notifications.
create or replace function app.controler_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.contact_messages where email = new.email and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Vous avez déjà envoyé plusieurs messages : nous vous répondrons rapidement.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.contact_messages where created_at > now() - interval '10 minutes') >= 200 then
    raise exception 'Le service de contact est très sollicité : réessayez dans quelques minutes.' using errcode = 'P0001';
  end if;
  new.statut := 'nouveau';
  new.user_id := auth.uid();          -- jamais l'identifiant fourni par le navigateur
  return new;
end $$;
create trigger controler_contact before insert on public.contact_messages for each row execute function app.controler_contact();

create or replace function app.prevenir_admins_contact() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, text, link)
  select p.id, left(format('Contact · %s — %s (%s) : %s', new.subject, new.name, new.email, new.message), 1000), '#/admin/contacts'
  from public.profiles p where p.role = 'admin' and p.status = 'actif';
  return new;
end $$;
create trigger prevenir_admins after insert on public.contact_messages for each row execute function app.prevenir_admins_contact();
create index contact_messages_email_recent on public.contact_messages (email, created_at desc);
create index contact_messages_a_traiter on public.contact_messages (created_at desc) where statut = 'nouveau';
