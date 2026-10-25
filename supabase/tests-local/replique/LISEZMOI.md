# Réplique locale de Supabase (tests uniquement)

Pile minimale qui a servi aux tests de cette version quand Docker et la CLI Supabase n'étaient pas disponibles. **Préférez `supabase start`** (CLI officielle, Docker) quand c'est possible : elle reproduit fidèlement Storage et l'Edge Runtime, ce que cette réplique ne fait pas.

| Composant | Rôle | Remarque |
|---|---|---|
| PostgreSQL 15+ | base | `00_supabase_base.sql` crée les rôles `anon`, `authenticated`, `service_role`, `authenticator`, `supabase_auth_admin`, le schéma `extensions` et un schéma `storage` **simplifié** |
| Supabase Auth (GoTrue) | comptes, jetons | binaire officiel ; ses propres migrations créent le schéma `auth` |
| PostgREST 12 | `/rest/v1` | même rôle de connexion qu'un projet Supabase (`authenticator`) |
| Deno 2 | fonction Edge `gerer-acces` | code inchangé, lancé par `fonction-locale.ts` |
| `passerelle.js` (Node) | port 54321 : relaie `/auth/v1`, `/rest/v1`, `/functions/v1/gerer-acces` ; **émule** `/storage/v1` (droits vérifiés par les politiques RLS de `storage.objects`, URL signées par jeton) ; sert le site avec une configuration locale | l'émulation Storage n'est pas le service Storage de Supabase |
| `smtp.py` | capture des e-mails (aucun envoi réel) | |

## Installation (une fois)

```bash
cp env.exemple env                         # adapter les chemins
npm install                                # pg, jsonwebtoken, @supabase/supabase-js
initdb -D "$REPLIQUE_DIR/pgdata" -U postgres --auth=trust
pg_ctl -D "$REPLIQUE_DIR/pgdata" -o "-p 54322" start
psql -h 127.0.0.1 -p 54322 -U postgres -f 00_supabase_base.sql
node generer-cles.js                       # clés anon / service_role LOCALES (secret public par défaut)
./demarrer.sh                              # Auth applique ses migrations au premier démarrage
```

## Utilisation

```bash
./demarrer.sh      # démarre la pile ; site sur http://127.0.0.1:54321
./preparer.sh      # base neuve : migrations + jeu de test (comptes : mot de passe MOT_DE_PASSE_TEST)
```

Puis les tests (README_SUPABASE.md §14), avec `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_ANON_KEY=$(node -p "require('./keys.json').anon")`.

## Limites

* Storage émulé (pas de transformation d'images, pas de limites de débit, URL signées simplifiées).
* Pas de pg_cron : `app.generer_rappels()` s'appelle à la main.
* Les scripts de ce dossier sont des copies paramétrées de ceux qui ont tourné pendant l'audit (chemins remplacés par des variables).
