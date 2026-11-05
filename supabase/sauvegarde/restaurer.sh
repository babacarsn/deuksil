#!/bin/bash
# =============================================================================
# DEUKSIL — Restauration d'une sauvegarde dans un projet Supabase NEUF.
#
# Ne JAMAIS viser la production en service : le script refuse une base qui
# contient déjà des comptes. Préparer la cible d'abord :
#   supabase link --project-ref <ref-cible> && supabase db push   (8 migrations)
# puis :
#   DATABASE_URL_CIBLE=postgresql://postgres:…@db.<ref-cible>.supabase.co:5432/postgres \
#   SUPABASE_URL=https://<ref-cible>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<clé de la CIBLE> \
#   CONFIRMER=oui ./restaurer.sh <dossier-de-sauvegarde>
# =============================================================================
set -euo pipefail
ICI=$(cd "$(dirname "$0")" && pwd)
D=${1:?Indiquer le dossier de sauvegarde}
: "${DATABASE_URL_CIBLE:?DATABASE_URL_CIBLE manquant}" "${SUPABASE_URL:?SUPABASE_URL (cible) manquant}" "${SUPABASE_SERVICE_ROLE_KEY:?clé service_role de la cible manquante}"
[ "${CONFIRMER:-}" = oui ] || { echo "Refus : ajouter CONFIRMER=oui après avoir vérifié que la cible est un projet NEUF."; exit 1; }
P="psql $DATABASE_URL_CIBLE -v ON_ERROR_STOP=1 -q"

# 0. Contrôles : sauvegarde intacte, cible migrée et vide
(cd "$D" && sha256sum --quiet -c SHA256SUMS) || { echo "Refus : sauvegarde altérée (SHA256SUMS)."; exit 1; }
[ "$($P -Atc "select to_regclass('public.profiles') is not null")" = t ] || { echo "Refus : migrations absentes sur la cible (supabase db push)."; exit 1; }
[ "$($P -Atc "select (select count(*) from auth.users) + (select count(*) from public.profiles)")" = 0 ] || { echo "Refus : la cible contient déjà des comptes."; exit 1; }

# 1. Données, en une transaction, déclencheurs suspendus (les lignes sont déjà cohérentes)
$P --single-transaction <<SQL
set session_replication_role = replica;
truncate app.reglages;
\i $D/donnees.sql
SQL
echo "Données restaurées."
# 2. Fichiers du Storage (empreintes vérifiées)
node "$ICI/fichiers.js" importer "$D"
# 3. Vérification : mêmes comptages qu'à la sauvegarde
psql "$DATABASE_URL_CIBLE" -At -F'|' -v ON_ERROR_STOP=1 -f "$ICI/comptages.sql" > "$D/comptages-restauration.txt"
if diff -u "$D/comptages.txt" "$D/comptages-restauration.txt"; then echo "VÉRIFICATION OK : mêmes comptages qu'à la sauvegarde."
else echo "ÉCARTS ci-dessus : ne pas basculer avant de les comprendre."; exit 1; fi
echo "Contrôles manuels restants : connexion d'un compte, lecture d'un document privé, photos des annonces."
