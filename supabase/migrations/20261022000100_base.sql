-- =============================================================================
-- DEUKSIL — Migration 0100 : extensions, schéma privé « app », fonctions utilitaires
-- À exécuter en premier. Idempotente autant que possible.
-- =============================================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- Schéma privé : il n'est PAS exposé par l'API (Settings → API → Exposed schemas
-- ne doit contenir que « public »). Les fonctions utilisées par les politiques RLS
-- y vivent pour ne pas être appelables comme RPC.
create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

-- Horodatage automatique de updated_at.
create or replace function app.maj_horodatage() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Recherche sans accents (immutable pour pouvoir l'indexer).
create or replace function app.sans_accents(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;
