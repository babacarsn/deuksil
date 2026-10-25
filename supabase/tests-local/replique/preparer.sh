#!/bin/bash
# Base de TEST neuve : migrations + jeu de données de test (mot de passe commun MOT_DE_PASSE_TEST).
set -e
ICI=$(cd "$(dirname "$0")" && pwd); set -a; . "$ICI/env"; set +a
PROJET=$(cd "$ICI/../../.." && pwd); cd "$PROJET"
bash "$ICI/reinitialiser.sh"
export DATABASE_URL=postgres://postgres@127.0.0.1:$PG_PORT/postgres SUPABASE_URL=http://127.0.0.1:54321
node supabase/outils/generer-schema-front.js
SUPABASE_SERVICE_ROLE_KEY=$(node -p "require('$ICI/keys.json').service") MOT_DE_PASSE=$MOT_DE_PASSE_TEST \
  node supabase/outils/importer-json.js ${JEU:-supabase/tests-local/jeu-de-test.json} supabase/tests-local/comptes-test.json 2>&1 | tail -3
