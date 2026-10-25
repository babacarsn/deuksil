-- =============================================================================
-- DEUKSIL — Migration 0400 : Row Level Security
--
-- Principe : RLS activée sur TOUTES les tables publiques ; aucun accès sans
-- politique explicite. Politiques distinctes SELECT / INSERT / UPDATE / DELETE.
-- Les fonctions app.* sont appelées sous la forme (select app.f()) pour être
-- évaluées une seule fois par requête (initPlan) et non à chaque ligne.
-- =============================================================================

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Défense en profondeur : le rôle anonyme n'a de droits que là où c'est voulu.
revoke all on all tables in schema public from anon;
grant select on public.properties to anon;
grant insert on public.contact_messages to anon;

-- --- Politiques standard d'un « espace » (propriétaire ou agence + son équipe) ------
-- lecture / création / modification : membres de l'espace ayant la permission ;
-- suppression : idem, sauf pour un simple agent.
create or replace function app.politiques_espace(tbl text, perm text) returns void
language plpgsql set search_path = '' as $$
declare cond text := format('owner_id = (select app.espace()) and (select app.a_droit(%L))', perm);
begin
  execute format('create policy "espace : lecture" on public.%I for select to authenticated using (%s)', tbl, cond);
  execute format('create policy "espace : création" on public.%I for insert to authenticated with check (%s)', tbl, cond);
  execute format('create policy "espace : modification" on public.%I for update to authenticated using (%s) with check (%s)', tbl, cond, cond);
  execute format('create policy "espace : suppression" on public.%I for delete to authenticated using (%s and (select app.role_membre()) is distinct from %L)', tbl, cond, 'agent');
  execute format('create policy "admin : lecture" on public.%I for select to authenticated using ((select app.est_admin()))', tbl);
end $$;

select app.politiques_espace(t, p) from (values
  ('properties','biens'), ('units','gestion'), ('visits','visites'), ('client_requests','visites'),
  ('leases','gestion'), ('rents','gestion'), ('lease_messages','gestion'), ('inspections','gestion'),
  ('providers','gestion'), ('tickets','gestion'), ('deals','gestion'), ('contracts','gestion'),
  ('billing_docs','finances'), ('billing_payments','finances'), ('expenses','finances'),
  ('owner_records','gestion'), ('mandates','gestion'), ('sale_mandates','gestion'), ('owner_transfers','finances'),
  ('fees','finances'), ('documents','documents')
) as v(t, p);

-- Un simple agent ne modifie que les biens qui lui sont attribués (règle P3 de l'interface).
drop policy "espace : modification" on public.properties;
create policy "espace : modification" on public.properties for update to authenticated
  using (owner_id = (select app.espace()) and (select app.a_droit('biens'))
         and ((select app.role_membre()) is distinct from 'agent' or agent_id = (select auth.uid())))
  with check (owner_id = (select app.espace()) and (select app.a_droit('biens')));
-- … et ne supprime aucun bien ; un gestionnaire non plus (réservé au titulaire).
drop policy "espace : suppression" on public.properties;
create policy "espace : suppression" on public.properties for delete to authenticated
  using (owner_id = (select app.espace()) and (select app.est_titulaire()));

-- --- profiles -------------------------------------------------------------------------
create policy "profil : lecture" on public.profiles for select to authenticated using (
  id = (select auth.uid())
  or (parent_id is not null and parent_id = (select app.espace()))                 -- mon équipe
  or id = (select app.espace())                                                    -- mon compte titulaire
  or owner_ref = (select app.espace()) or mandant_of = (select app.espace())       -- comptes que j'ai ouverts
  or (select app.est_admin()));
create policy "profil : modification" on public.profiles for update to authenticated
  using (id = (select auth.uid())
         or (parent_id is not null and parent_id = (select app.espace()) and (select app.est_titulaire()))
         or ((owner_ref = (select app.espace()) or mandant_of = (select app.espace())) and (select app.est_titulaire()))
         or (select app.est_admin()))
  with check (true);   -- colonnes contrôlées par app.proteger_profil()
-- Pas d'INSERT (déclencheur sur auth.users) ni de DELETE (fonction serveur).

-- --- properties : annonces publiques et tiers concernés ------------------------------
create policy "annonce publiée : lecture" on public.properties for select to anon, authenticated
  using (listing_status = 'publiee' and (select app.compte_actif(owner_id)));
create policy "locataire, mandant, client : lecture" on public.properties for select to authenticated
  using (id = any ((select app.biens_locataire())::uuid[]) or id = any ((select app.biens_mandant())::uuid[]) or id = any ((select app.biens_client())::uuid[]));
create policy "admin : modération" on public.properties for update to authenticated
  using ((select app.est_admin())) with check ((select app.est_admin()));

-- --- units : mandant ------------------------------------------------------------------
create policy "mandant : lecture" on public.units for select to authenticated
  using (property_id = any ((select app.biens_mandant())::uuid[]));

-- --- favorites, saved_searches : propriétaire de la ligne ------------------------------
create policy "favori : lecture" on public.favorites for select to authenticated using (user_id = (select auth.uid()));
create policy "favori : création" on public.favorites for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favori : suppression" on public.favorites for delete to authenticated using (user_id = (select auth.uid()));
create policy "recherche : lecture" on public.saved_searches for select to authenticated using (user_id = (select auth.uid()));
create policy "recherche : création" on public.saved_searches for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recherche : modification" on public.saved_searches for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recherche : suppression" on public.saved_searches for delete to authenticated using (user_id = (select auth.uid()));

-- --- visits : le client demandeur -------------------------------------------------------
create policy "client : lecture" on public.visits for select to authenticated using (client_id = (select auth.uid()));
create policy "client : demande" on public.visits for insert to authenticated with check (
  client_id = (select auth.uid())
  and exists (select 1 from public.properties p where p.id = property_id and p.listing_status = 'publiee'));
create policy "client : modification" on public.visits for update to authenticated
  using (client_id = (select auth.uid())) with check (client_id = (select auth.uid()));

-- --- client_requests : l'agent qui suit la demande --------------------------------------
create policy "agent : lecture" on public.client_requests for select to authenticated using (agent_id = (select auth.uid()));

-- --- Messagerie --------------------------------------------------------------------------
create policy "conversation : lecture" on public.conversations for select to authenticated using (
  (select auth.uid()) = any (participants)
  or ((select app.espace()) = any (participants) and (select app.a_droit('messages')))
  or (select app.est_admin()));
create policy "conversation : création" on public.conversations for insert to authenticated with check (
  (select auth.uid()) = any (participants)
  or ((select app.espace()) = any (participants) and (select app.a_droit('messages'))));
create policy "conversation : modification" on public.conversations for update to authenticated
  using ((select auth.uid()) = any (participants) or ((select app.espace()) = any (participants) and (select app.a_droit('messages'))))
  with check ((select auth.uid()) = any (participants) or ((select app.espace()) = any (participants) and (select app.a_droit('messages'))));

create policy "message : lecture" on public.conversation_messages for select to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id));      -- hérite de la RLS des conversations
create policy "message : envoi" on public.conversation_messages for insert to authenticated with check (
  (sender_id = (select auth.uid()) or (sender_id = (select app.espace()) and (select app.a_droit('messages'))))
  and exists (select 1 from public.conversations c where c.id = conversation_id and sender_id = any (c.participants)));
create policy "message : lu" on public.conversation_messages for update to authenticated
  using (exists (select 1 from public.conversations c where c.id = conversation_id))
  with check (exists (select 1 from public.conversations c where c.id = conversation_id));

-- --- notifications : les siennes (et celles de son espace) ; création par public.notifier() ---
create policy "notification : lecture" on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) or user_id = (select app.espace()));
create policy "notification : pour soi" on public.notifications for insert to authenticated
  with check (user_id = (select auth.uid()) or user_id = (select app.espace()));
create policy "notification : marquer lue" on public.notifications for update to authenticated
  using (user_id = (select auth.uid()) or user_id = (select app.espace()))
  with check (user_id = (select auth.uid()) or user_id = (select app.espace()));
create policy "notification : suppression" on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()) or user_id = (select app.espace()));

-- --- Locataire ---------------------------------------------------------------------------
create policy "locataire : lecture" on public.leases for select to authenticated using (id = any ((select app.mes_baux())::uuid[]));
create policy "locataire : lecture" on public.rents for select to authenticated using (lease_id = any ((select app.mes_baux())::uuid[]));
create policy "locataire : lecture" on public.inspections for select to authenticated using (lease_id = any ((select app.mes_baux())::uuid[]));
create policy "locataire : lecture" on public.lease_messages for select to authenticated using (lease_id = any ((select app.mes_baux())::uuid[]));
create policy "locataire : envoi" on public.lease_messages for insert to authenticated
  with check (lease_id = any ((select app.mes_baux())::uuid[]) and author_id = (select auth.uid()));
create policy "locataire : marquer lu" on public.lease_messages for update to authenticated
  using (lease_id = any ((select app.mes_baux())::uuid[])) with check (lease_id = any ((select app.mes_baux())::uuid[]));
create policy "locataire : lecture" on public.tickets for select to authenticated
  using (tenant_id = (select auth.uid()) or property_id = any ((select app.biens_locataire())::uuid[]));
create policy "locataire : signalement" on public.tickets for insert to authenticated
  with check (tenant_id = (select auth.uid()));          -- logement vérifié par app.verifier_ticket_locataire()

-- --- Mandant (propriétaire dont l'agence gère les biens) -----------------------------------
create policy "mandant : lecture" on public.owner_records for select to authenticated using (compte_id = (select auth.uid()));
create policy "mandant : lecture" on public.mandates for select to authenticated using (owner_id2 = any ((select app.mes_fiches())::uuid[]));
create policy "mandant : lecture" on public.sale_mandates for select to authenticated using (owner_id2 = any ((select app.mes_fiches())::uuid[]));
create policy "mandant : lecture" on public.owner_transfers for select to authenticated using (owner_id2 = any ((select app.mes_fiches())::uuid[]));
create policy "mandant : lecture" on public.leases for select to authenticated using (property_id = any ((select app.biens_mandant())::uuid[]));
create policy "mandant : lecture" on public.rents for select to authenticated using (property_id = any ((select app.biens_mandant())::uuid[]));
create policy "mandant : lecture" on public.expenses for select to authenticated using (property_id = any ((select app.biens_mandant())::uuid[]));
create policy "mandant : lecture" on public.billing_docs for select to authenticated using (property_id = any ((select app.biens_mandant())::uuid[]));
create policy "mandant : décision" on public.billing_docs for update to authenticated
  using (property_id = any ((select app.biens_mandant())::uuid[])) with check (property_id = any ((select app.biens_mandant())::uuid[]));

-- --- Client (acheteur) ---------------------------------------------------------------------
create policy "client : lecture" on public.deals for select to authenticated using (client_id = (select auth.uid()));
create policy "client : lecture" on public.billing_docs for select to authenticated using (client_id = (select auth.uid()));
create policy "client : lecture" on public.billing_payments for select to authenticated using (client_id = (select auth.uid()));
create policy "client : lecture" on public.contracts for select to authenticated using (client_id = (select auth.uid()));

-- --- Agent : ses commissions -----------------------------------------------------------------
create policy "agent : commissions" on public.fees for select to authenticated
  using (agent_id = (select auth.uid()) or apporteur_id = (select auth.uid()));

-- --- Demandes de gestion propriétaire → agence -----------------------------------------------
create policy "lien : lecture" on public.agency_link_requests for select to authenticated
  using (proprio_id = (select auth.uid()) or (agence_id = (select app.espace()) and (select app.a_droit('gestion'))) or (select app.est_admin()));
create policy "lien : demande" on public.agency_link_requests for insert to authenticated
  with check (proprio_id = (select auth.uid()) and statut = 'attente'
              and exists (select 1 from public.profiles a where a.id = agence_id and a.role = 'agency' and a.status = 'actif' and a.parent_id is null));
create policy "lien : réponse" on public.agency_link_requests for update to authenticated
  using (proprio_id = (select auth.uid()) or (agence_id = (select app.espace()) and (select app.a_droit('gestion'))))
  with check (proprio_id = (select auth.uid()) or (agence_id = (select app.espace()) and (select app.a_droit('gestion'))));

-- --- Signalements ------------------------------------------------------------------------------
create policy "signalement : lecture" on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select app.est_admin()));
create policy "signalement : création" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "signalement : traitement" on public.reports for update to authenticated
  using ((select app.est_admin())) with check ((select app.est_admin()));

-- --- Journaux ------------------------------------------------------------------------------------
create policy "activité : écriture" on public.activity_log for insert to authenticated with check (actor_id = (select auth.uid()));
create policy "activité : lecture" on public.activity_log for select to authenticated
  using (actor_id = (select auth.uid()) or (select app.est_admin()));
create policy "audit : écriture" on public.audit_log for insert to authenticated
  with check (owner_id = (select app.espace()) and actor_id = (select auth.uid()));
create policy "audit : lecture" on public.audit_log for select to authenticated
  using ((owner_id = (select app.espace()) and (select app.a_droit('finances'))) or (select app.est_admin()));

-- --- Contact ---------------------------------------------------------------------------------------
create policy "contact : envoi" on public.contact_messages for insert to anon, authenticated
  with check (statut = 'nouveau' and (user_id is null or user_id = (select auth.uid())));
create policy "contact : lecture admin" on public.contact_messages for select to authenticated using ((select app.est_admin()));
create policy "contact : traitement admin" on public.contact_messages for update to authenticated
  using ((select app.est_admin())) with check ((select app.est_admin()));

-- Le journal d'audit n'a pas de politique UPDATE/DELETE : écriture seule.
drop function app.politiques_espace(text, text);
