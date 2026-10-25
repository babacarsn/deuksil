#!/bin/bash
# Remet la base de TEST à zéro (schémas public/app, comptes) puis rejoue toutes les migrations.
set -e
ICI=$(cd "$(dirname "$0")" && pwd); set -a; . "$ICI/env"; set +a
PROJET=$(cd "$ICI/../../.." && pwd)
export PGOPTIONS="-c client_min_messages=warning"
P="psql -h 127.0.0.1 -p $PG_PORT -U postgres -v ON_ERROR_STOP=1 -q"
case "$(psql -h 127.0.0.1 -p $PG_PORT -U postgres -Atc 'select inet_server_addr()')" in 127.0.0.1|::1|"") ;; *) echo "Refus : base non locale."; exit 1;; esac
$P <<'SQL'
drop trigger if exists creer_profil on auth.users;
drop trigger if exists suivre_email on auth.users;
drop trigger if exists appliquer_meta_serveur on auth.users;
drop schema if exists app cascade;
drop schema if exists public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
truncate auth.users cascade;
delete from storage.objects; delete from storage.buckets;
SQL
for f in "$PROJET"/supabase/migrations/*.sql; do
  $P --single-transaction -f "$f" > /tmp/deuksil-migration.log 2>&1 || { echo "ÉCHEC $(basename "$f")"; grep -v NOTICE /tmp/deuksil-migration.log | head -5; exit 1; }
done
psql -h 127.0.0.1 -p $PG_PORT -U postgres -q -c "notify pgrst, 'reload schema'" >/dev/null
echo "migrations appliquées : $(ls "$PROJET"/supabase/migrations/*.sql | wc -l)"
