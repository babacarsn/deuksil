#!/bin/bash
# Rejoue toutes les migrations sur une base PostgreSQL 16 VIERGE puis les scénarios CNI.
# Prérequis : un serveur PostgreSQL local (pas Supabase) joignable en « psql -h /tmp -p 54399 -U postgres ».
# Exemple :  initdb -D /tmp/pg -A trust -U postgres && pg_ctl -D /tmp/pg -o "-p 54399 -k /tmp" start
#            bash supabase/tests-cni/rejouer.sh
# Ne JAMAIS le lancer sur le projet Supabase de production : il crée des comptes de test.
set -e
D=$(cd "$(dirname "$0")" && pwd); M="$D/../migrations"
psql -h /tmp -p 54399 -U postgres -q -c "drop database if exists dk;" -c "create database dk;"
psql -h /tmp -p 54399 -U postgres -d dk -q -v ON_ERROR_STOP=1 -f "$D/00_faux_supabase.sql"
for f in $(ls "$M"/*.sql | sort); do
  sed -e 's/create extension if not exists pg_cron with schema pg_catalog;/-- pg_cron simulé/' "$f" \
    | psql -h /tmp -p 54399 -U postgres -d dk -q -v ON_ERROR_STOP=1 >/dev/null && echo "migration OK  $(basename "$f")"
done
bash "$D/scenarios.sh"
