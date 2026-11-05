#!/bin/bash
# =============================================================================
# DEUKSIL — Sauvegarde complète d'un projet Supabase : données de la base
# (comptes compris) + fichiers du Storage + comptages + empreintes.
#
#   DATABASE_URL=postgresql://postgres:…@db.<ref>.supabase.co:5432/postgres \
#   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
#   ./sauvegarder.sh [dossier]
#
# Prérequis : pg_dump et psql de version ≥ celle du serveur (select version();),
# Node.js 18+ et « npm install » dans ce dossier.
# Le dossier produit contient des DONNÉES PERSONNELLES : le chiffrer et le
# stocker hors du projet (jamais dans Git). Le script ne modifie rien.
# =============================================================================
set -euo pipefail
ICI=$(cd "$(dirname "$0")" && pwd)
: "${DATABASE_URL:?DATABASE_URL manquant}" "${SUPABASE_URL:?SUPABASE_URL manquant}" "${SUPABASE_SERVICE_ROLE_KEY:?SUPABASE_SERVICE_ROLE_KEY manquant}"
D=${1:-"$ICI/sauvegardes/$(date -u +%Y%m%d-%H%M)"}
mkdir -p "$D"; chmod 700 "$D"
echo "Sauvegarde dans $D"

# 1. Données (format SQL, sans le schéma : la structure vient des migrations)
pg_dump "$DATABASE_URL" --data-only --no-owner --no-privileges \
  -t 'auth.users' -t 'auth.identities' -t 'public.*' -t 'app.reglages' -f "$D/donnees.sql"
# 2. Structure, pour référence et comparaison (la restauration rejoue les migrations)
pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges -n public -n app -f "$D/structure.sql"
# 3. Comptages et contexte
psql "$DATABASE_URL" -At -F'|' -v ON_ERROR_STOP=1 -f "$ICI/comptages.sql" > "$D/comptages.txt"
{ echo "date_utc=$(date -u +%FT%TZ)"; echo "source=$(echo "$SUPABASE_URL" | sed 's#https\?://##')";
  echo "serveur=$(psql "$DATABASE_URL" -Atc 'show server_version')";
  echo "migrations=$(ls "$ICI/../migrations" | tr '\n' ' ')"; } > "$D/contexte.txt"
# 4. Fichiers du Storage
node "$ICI/fichiers.js" exporter "$D"
# 5. Empreintes de contrôle
(cd "$D" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
echo "Terminé : $(wc -l < "$D/comptages.txt") tables comptées, $(du -sh "$D" | cut -f1)."
echo "À faire : chiffrer et copier ce dossier hors du projet (ex. gpg -c, coffre de stockage)."
