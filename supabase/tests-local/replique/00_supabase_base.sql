-- Reproduction locale minimale de l'environnement Supabase (rôles, schémas,
-- privilèges par défaut, extensions, schéma storage simplifié).
-- NE PAS exécuter sur un vrai projet Supabase : tout cela y existe déjà.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit password 'authpass';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login createrole noinherit password 'authadmin';
create role supabase_storage_admin login createrole noinherit password 'storageadmin';
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_stat_statements with schema extensions;
grant usage on schema extensions to anon, authenticated, service_role, supabase_auth_admin;
alter database postgres set search_path = "$user", public, extensions;
create schema auth authorization supabase_auth_admin;
grant usage on schema auth to anon, authenticated, service_role, postgres;
alter role supabase_auth_admin set search_path = auth;
grant create on database postgres to supabase_auth_admin;
-- Privilèges par défaut identiques à Supabase : les tables publiques sont
-- accessibles aux rôles de l'API ; c'est la RLS qui protège les lignes.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
-- Storage simplifié (structure et fonctions utilisées par les politiques).
create schema storage authorization supabase_storage_admin;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text not null unique, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default extensions.gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (bucket_id, name));
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
create or replace function storage.foldername(name text) returns text[] language sql immutable as
$$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
grant execute on function storage.foldername(text) to anon, authenticated, service_role;
