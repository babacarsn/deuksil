#!/bin/bash
# Démarre la réplique locale : PostgreSQL, SMTP de capture, Supabase Auth, PostgREST,
# fonction Edge, passerelle (http://127.0.0.1:54321). Base de TEST uniquement.
set -e
ICI=$(cd "$(dirname "$0")" && pwd); set -a; . "$ICI/env"; set +a
R=$REPLIQUE_DIR/run; mkdir -p "$R/storage"
[ -f "$ICI/keys.json" ] || node "$ICI/generer-cles.js"
# substitution des ${VARIABLES} des modèles (sans dépendre d'envsubst)
remplir() { node -e 'const fs=require("fs");process.stdout.write(fs.readFileSync(process.argv[1],"utf8").replace(/\$\{(\w+)\}/g,(m,k)=>process.env[k]??m))' "$1"; }
remplir "$ICI/postgrest.conf.modele" > "$R/postgrest.conf"
remplir "$ICI/auth.env.modele" > "$R/auth.env"
"$PG_BIN/pg_isready" -h 127.0.0.1 -p "$PG_PORT" -q || "$PG_BIN/pg_ctl" -D "$REPLIQUE_DIR/pgdata" -o "-p $PG_PORT" -l "$R/pg.log" start >/dev/null
pkill -f "python3 .*replique/smtp[.]py" || true; pkill -f "^$AUTH_BIN serve" || true; pkill -f "^$POSTGREST_BIN " || true
pkill -f "node .*replique/passerelle[.]js" || true; pkill -f "run .*replique/fonction-locale[.]ts" || true; sleep 1
REPLIQUE_DIR=$REPLIQUE_DIR nohup python3 "$ICI/smtp.py" > "$R/smtp.log" 2>&1 &
REPLIQUE_DIR=$REPLIQUE_DIR nohup node "$ICI/passerelle.js" > "$R/passerelle.log" 2>&1 &
(set -a; . "$R/auth.env"; set +a; nohup "$AUTH_BIN" serve > "$R/auth.log" 2>&1 &)
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=$(node -p "require('$ICI/keys.json').anon") \
SUPABASE_SERVICE_ROLE_KEY=$(node -p "require('$ICI/keys.json').service") \
  nohup "$DENO_BIN" run --allow-net --allow-env --allow-read --allow-sys "$ICI/fonction-locale.ts" > "$R/fonctions.log" 2>&1 &
nohup "$POSTGREST_BIN" "$R/postgrest.conf" > "$R/postgrest.log" 2>&1 &
for i in $(seq 1 30); do curl -s 127.0.0.1:54321/auth/v1/health >/dev/null && curl -s 127.0.0.1:3000/ >/dev/null && break; sleep 0.5; done
curl -s 127.0.0.1:54321/auth/v1/health; echo; curl -s -o /dev/null -w "rest %{http_code}\n" 127.0.0.1:54321/rest/v1/
