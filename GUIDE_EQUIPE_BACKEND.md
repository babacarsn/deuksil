# DEUKSIL — Guide de mise en service pour l'équipe backend

À suivre **dans l'ordre**. Chaque étape indique : le but, les fichiers, les commandes, et le contrôle qui dit « c'est bon, on passe à la suivante ». Le détail de chaque réglage est dans `README_SUPABASE.md` (numéros de section entre crochets, ex. [§3.3]).

> **Règle n° 1** : tout se fait d'abord sur un projet Supabase **de test**. La production ne vient qu'à l'étape 12.
> **Règle n° 2** : la clé `service_role`, le mot de passe de la base, les secrets Google et SMTP ne vont **jamais** dans le code, dans Git ou dans un message. Ils se saisissent dans le tableau de bord Supabase ou dans un `.env` local (ignoré par Git).

---

## Étape 0 — Ce que contient l'archive

| Élément | À quoi il sert | Utilisé à l'étape |
|---|---|---|
| `GUIDE_EQUIPE_BACKEND.md` | ce guide | toutes |
| `README_SUPABASE.md` | référence complète (19 sections) | toutes |
| `supabase/migrations/` (8 fichiers `.sql`) | structure de la base, sécurité (RLS), fonctions, index | 5 |
| `supabase/functions/gerer-acces/` | fonction serveur : création des comptes ouverts par un tiers | 7 |
| `supabase/config.toml` | réglages Supabase (local + référence) | 3, 4 |
| `supabase/templates/` | modèles des e-mails (code à 6 chiffres) | 4 |
| `.env.example` | liste des variables, sans valeur | 2 |
| `js/00-config.js` | seul fichier à renseigner côté site | 8 |
| `supabase/outils/` | génération du schéma pour l'interface ; import du jeu de **test** | 9 |
| `supabase/tests-local/` | tests de sécurité, jeu de test, mesures de performance, réplique locale | 9, 11 |
| `tests/` | tests navigateur | 9 |
| `supabase/sauvegarde/` | sauvegarde et restauration (base + fichiers) | 10, 14 |
| `docs/AUDIT_SECURITE.md`, `docs/PERFORMANCES.md`, `docs/INDEX.md` | rapports | 1 |

## Étape 1 — Lire (≈ 1 h)

1. Ce guide en entier.

2. `README_SUPABASE.md` §1 (architecture), §8 (RLS), §10 (secrets), §19 (checklist).

3. `docs/AUDIT_SECURITE.md` §8 (risques restants) : décisions à prendre avec le responsable produit.

**Contrôle** : l'équipe sait où va chaque secret et sait que la base décide des droits (jamais le navigateur).

## Étape 2 — Installer les outils

| Outil | Commande de vérification |
|---|---|
| Supabase CLI | `supabase --version` |
| PostgreSQL client (psql, pg_dump) **≥ version du serveur Supabase** | `psql --version` |
| Node.js 18+ | `node --version` |
| Playwright + Chromium (tests) | `npx playwright --version` |
| (facultatif) Docker, pour `supabase start` | `docker --version` |

Copier `.env.example` en `.env` (jamais commité) et le remplir au fur et à mesure.

**Contrôle** : toutes les commandes répondent.

## Étape 3 — Créer le projet Supabase de TEST

1. Dashboard Supabase → *New project* : nom `deuksil-test`, région proche des utilisateurs, mot de passe de base fort (gestionnaire de secrets).

2. Noter dans `.env` : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` (Project Settings → API / Database).

3. Lier le dépôt : `supabase link --project-ref <ref-test>`.

**Contrôle** : `supabase projects list` montre le projet lié.

## Étape 4 — Régler l'API et l'authentification [§3.2, §3.3]

Dans le tableau de bord du projet de test :

* **API** : schémas exposés = `public` **uniquement** ; *Max rows* = 1000.

* **Authentication** : Site URL et Redirect URLs (adresse où le site de test sera servi) ; confirmation d'e-mail **activée** ; mots de passe 8 caractères, lettres + chiffres ; OTP 900 s ; inscriptions anonymes désactivées.

* **E-mails** : SMTP personnalisé (le SMTP intégré est limité) ; coller `supabase/templates/confirmation.html` et `recovery.html` dans les modèles « Confirm signup » et « Reset password ».

* **Google** : laisser désactivé pour le test (ou suivre [§3.3]).

**Contrôle** : une inscription manuelle de test reçoit bien un e-mail avec un code à 6 chiffres.

## Étape 5 — Appliquer les migrations [§12]

```bash
supabase db push            # applique les 8 migrations dans l'ordre
```
Contrôles dans l'éditeur SQL :
```sql
select count(*) from pg_tables where schemaname = 'public';                       -- 32
select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;   -- 0
select count(*) from pg_policies where schemaname = 'public';                     -- 166
select id, public from storage.buckets order by id;   -- avatars t, documents f, photos t
```
Si une migration échoue : lire le message, corriger **dans une nouvelle migration** si la précédente est déjà passée, ne jamais modifier une migration appliquée.

**Contrôle** : les quatre résultats ci-dessus.

## Étape 6 — Activer les tâches quotidiennes (pg_cron) [§3.4]

1. Dashboard → Integrations → Cron (ou Database → Extensions → `pg_cron`).

2. Si la migration 0700 n'a pas pu planifier la tâche (message `NOTICE` pendant le `db push`) :
   ```sql
   select cron.schedule('deuksil-rappels', '0 7 * * *', 'select app.generer_rappels()');
   ```

3. Essai immédiat : `select * from app.generer_rappels();` (deux fois : la seconde ne crée rien).

**Contrôle** : `select jobname, schedule, active from cron.job;` montre `deuksil-rappels` actif.

## Étape 7 — Déployer la fonction serveur [§3.6]

```bash
supabase functions deploy gerer-acces
supabase secrets set DEUKSIL_ORIGINES=<adresse du site de test>
```
**Contrôle** : `curl -i -X POST https://<ref>.supabase.co/functions/v1/gerer-acces` répond **401** (connexion requise) — c'est le comportement attendu.

## Étape 8 — Brancher le site [§3.7, §11]

1. `js/00-config.js` : `supabaseUrl`, `supabaseAnonKey` (clé **anon**), `siteUrl`, `googleActif: false`.

2. Si le projet a un domaine personnalisé : l'ajouter à `connect-src` dans la balise CSP d'`index.html`.

3. Servir les fichiers en HTTPS (hébergement statique) à l'adresse déclarée à l'étape 4.

**Contrôle** : la page d'accueil s'ouvre sans « Configuration incomplète » ; inscription → code reçu → connexion → déconnexion fonctionnent.

## Étape 9 — Tests sur le projet de TEST [§14]

1. Jeu de test (projet de **test** uniquement) :
   ```bash
   DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… MOT_DE_PASSE=<mot de passe de test> \
     node supabase/outils/importer-json.js supabase/tests-local/jeu-de-test.json supabase/tests-local/comptes-test.json
   ```

2. Dans cet ordre (variables : `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MOT_DE_PASSE_TEST`, `APP_URL` = adresse du site de test, `DEUKSIL_TEST_AUTORISE=1` car le projet n'est pas local) :

| Ordre | Commande | Attendu |
|---|---|---|
| 1 | `node supabase/tests-local/securite-rls.test.js` | 65/65 |
| 2 | `node tests/acces-comptes.js` | 14/14 |
| 3 | `node tests/sonde-pages.js` | 9 profils « OK » |
| 4 | `node tests/ecritures-auto.js` | aucune ligne (pas d'écriture automatique) |
| 5 | **Recette manuelle des formulaires** : imprimer et suivre `tests/RECETTE_MANUELLE_FORMULAIRES.md` (≈ 15 min, 36 points à cocher, deux adresses e-mail de test) | 36/36 OK, fiche signée |
| 6 | `node tests/xss-sonde.js` (`DATABASE_URL` du test) — **modifie les données** : à lancer en dernier, ou sur un second projet de test | « Aucune exécution » |

Pourquoi à la main : les codes d'inscription et de mot de passe oublié arrivent par e-mail. Le test automatique `tests/formulaires.js` sait les lire uniquement sur la réplique locale ; sur un projet hébergé, une personne reçoit les e-mails et suit la fiche. On vérifie ainsi, en plus, que les e-mails partent vraiment.

3. Après `xss-sonde.js`, repartir d'une base propre (nouveau projet de test, ou `supabase db reset --linked` **sur le projet de test seulement**).

**Contrôle** : tous les résultats attendus. Un écart = s'arrêter et analyser (README_SUPABASE.md §18).

## Étape 10 — Sauvegarde et restauration (une fois, avant toute vraie donnée) [§17]

```bash
cd supabase/sauvegarde && npm install
# a) sauvegarder le projet de test
DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ./sauvegarder.sh
# b) créer un 2e projet vide « deuksil-restauration », y appliquer les migrations (étape 5)
# c) restaurer dedans
DATABASE_URL_CIBLE=… SUPABASE_URL=<restauration> SUPABASE_SERVICE_ROLE_KEY=<clé restauration> CONFIRMER=oui \
  ./restaurer.sh sauvegardes/<date>
```
**Contrôle** : « VÉRIFICATION OK : mêmes comptages », connexion d'un compte de test sur le projet restauré, document privé lisible par son propriétaire. Noter le temps total : c'est votre délai de remise en service. Supprimer ensuite le projet de restauration.

## Étape 11 — (facultatif) Mesures de performance

Sur la réplique locale ou un projet jetable, jamais en production : `supabase/tests-local/perf/` (README §15, docs/PERFORMANCES.md).

## Étape 12 — Projet de PRODUCTION

Refaire les étapes **3 à 8** sur un nouveau projet `deuksil-prod`, **sans** l'étape 9.1 (aucun jeu de test), puis :

1. Premier administrateur : inscription normale, puis dans l'éditeur SQL :
   `update public.profiles set role = 'admin' where email = '<adresse>';`

2. MFA de l'administrateur (TOTP), puis : `update app.reglages set valeur = 'oui' where cle = 'admin_mfa_obligatoire';`

3. En-têtes HTTP de l'hébergement : `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` [§16].

4. Mentions légales : bloc `editeur` de `js/00-config.js`.

## Étape 13 — Mise en ligne

Cocher **toute** la checklist `README_SUPABASE.md` §19. Puis parcours manuel : inscription, publication d'un bien avec photos, demande de visite, message, document privé, déconnexion.

## Étape 14 — Exploitation courante

| Fréquence | Action |
|---|---|
| chaque jour | vérifier `cron.job_run_details` (tâche `deuksil-rappels`) |
| chaque semaine (ou chaque jour) | `supabase/sauvegarde/sauvegarder.sh`, dossier chiffré et copié hors du projet |
| chaque trimestre | refaire une restauration d'essai (étape 10) |
| chaque mois | index inutilisés et requêtes lentes (docs/INDEX.md, « Suivi en production ») |
| à chaque évolution | nouvelle migration → projet de test → étape 9 → production ; `node supabase/outils/generer-schema-front.js` si le schéma change |

## Ce qui reste ouvert (à planifier)

1. **Recherche des annonces côté serveur** : aujourd'hui l'interface charge tout le catalogue public à l'ouverture ; à faire avant une forte croissance (docs/PERFORMANCES.md, « Ce qui reste »).

2. **Validations sur Supabase hébergé** : Storage, fonction Edge, `config.toml` et restauration (`session_replication_role`) n'ont été testés que sur la réplique locale — les étapes 7, 9 et 10 les valident.

3. Décisions produit listées dans `docs/AUDIT_SECURITE.md` §8 (annuaire, notifications, MFA, offre de sauvegarde).
