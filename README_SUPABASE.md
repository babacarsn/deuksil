# DEUKSIL — Supabase : configuration, sécurité, performances, déploiement

Version du 22 octobre 2026. Ce document est la référence pour mettre DEUKSIL en service sur Supabase et le maintenir. Il distingue toujours ce qui a été **exécuté et vérifié** (sur une base de test) de ce qui **reste à faire** sur votre projet hébergé.

Documents liés :

| Fichier | Contenu |
|---|---|
| `docs/AUDIT_SECURITE.md` | constats, corrections, tests de sécurité et risques résiduels |
| `docs/INDEX.md` | chaque index : table, colonnes, type, requête visée, raison, coût, vérification |
| `docs/PERFORMANCES.md` | mesures avant / après (EXPLAIN ANALYZE, données synthétiques) |
| `supabase/migrations/` | les 8 migrations versionnées, à appliquer dans l'ordre |
| `supabase/functions/gerer-acces/` | fonction Edge (création de comptes par un tiers) |
| `supabase/tests-local/` | tests de sécurité, données de test, mesures de performance, réplique locale |
| `tests/` | tests navigateur (Playwright) |
| `.env.example`, `supabase/config.toml` | modèles de configuration, sans secret |

---

## Sommaire

1. [Architecture](#1-architecture) · 2. [Prérequis](#2-prérequis) · 3. [Configuration Supabase](#3-configuration-supabase) · 4. [Schéma](#4-schéma-de-base-de-données) · 5. [Tables et relations](#5-tables-et-relations) · 6. [Scripts SQL](#6-scripts-sql) · 7. [Index](#7-index-et-justification) · 8. [RLS](#8-politiques-rls) · 9. [Injections](#9-protection-contre-les-injections) · 10. [Secrets](#10-gestion-des-secrets) · 11. [Connexion front / serveur](#11-connexion-frontend--serveur) · 12. [Migrations](#12-migrations) · 13. [Suppression du mode démo](#13-suppression-du-mode-démo) · 14. [Tests](#14-procédures-de-test) · 15. [Performances](#15-mesures-de-performance) · 16. [Déploiement](#16-déploiement) · 17. [Sauvegardes](#17-sauvegardes-et-restauration) · 18. [Erreurs fréquentes](#18-erreurs-fréquentes) · 19. [Checklist](#19-checklist-finale)

---

## 1. Architecture

```
Navigateur (HTML/CSS/JS, sans framework)                  Supabase (projet hébergé)
┌──────────────────────────────────────────┐   HTTPS    ┌─────────────────────────────────────────┐
│ js/00-config.js  URL + clé anon (publique)│──────────▶│ Auth (GoTrue) : comptes, sessions, OTP  │
│ js/03-storage.js API DB synchrone :       │           │ PostgREST /rest/v1 : tables + RPC       │
│   cache mémoire chargé à la connexion     │           │   ↳ PostgreSQL : RLS sur TOUTES les     │
│   (seulement les lignes que la RLS donne) │           │     tables, déclencheurs, fonctions     │
│   + file d'écritures ordonnée vers la base│           │ Storage : photos, avatars (publics),    │
│   (mise à jour optimiste, annulée si refus)│          │   documents (privé, URL signées 6 h)    │
│ js/08-auth.js, 76-demarrage.js : session  │           │ Edge Function « gerer-acces »           │
└──────────────────────────────────────────┘           │   (seule détentrice de service_role)    │
                                                        │ pg_cron : app.generer_rappels() 07:00   │
                                                        └─────────────────────────────────────────┘
```

Principes :

* **La base décide.** Le navigateur n'est jamais cru sur parole : la RLS dit *qui* voit et modifie *quelles lignes* ; des déclencheurs disent *quelles colonnes* et imposent les règles métier (espace d'une ligne, statut initial d'une visite, auteur d'un message, numéro de pièce, chevauchement de baux…).
* **Schéma privé `app`** (non exposé par l'API) : fonctions d'appartenance utilisées par les politiques (`app.espace()`, `app.a_droit()`, `app.mes_baux()`…), règles et tâches planifiées. Schéma `public` : tables et quelques RPC contrôlées.
* **Comptes ouverts par un tiers** (équipe, locataire, mandant) : uniquement par la fonction Edge `gerer-acces`, qui vérifie l'appelant puis utilise la clé `service_role` côté serveur.
* **Tâches automatiques** (rappels, expiration des contrats, reconduction tacite) : dans la base, une fois par jour, pas dans chaque navigateur.
* L'interface a gardé son API historique `DB.getData / addItem / updateItem…` (synchrone) : `js/03-storage.js` la sert depuis un cache mémoire rempli à la connexion et pousse chaque modification vers Supabase. `js/02c-schema.js` (généré) décrit les colonnes ; un champ inconnu de l'interface va dans la colonne `extra` (jsonb).

## 2. Prérequis

| Outil | Usage | Version de référence |
|---|---|---|
| Compte et projet Supabase | hébergement | offre gratuite suffisante pour démarrer (voir §17 pour les sauvegardes) |
| Supabase CLI | migrations, fonction Edge, base locale | version récente (`supabase --version`) |
| Docker | base locale `supabase start` (facultatif) | — |
| Node.js ≥ 18 | outils `supabase/outils`, tests | 22 utilisé ici |
| Playwright + Chromium | tests navigateur | `npm i -D playwright` |
| psql (client PostgreSQL) | scripts de mesure, vérifications | 15+ |
| Un fournisseur SMTP | e-mails d'authentification en production | au choix |
| Un hébergement de fichiers statiques (HTTPS) | le site lui-même | au choix |

> Environnement utilisé pour **cette** mission : Docker et la CLI n'étaient pas disponibles ; les tests ont tourné sur une réplique locale (PostgreSQL 16.15, Supabase Auth v2.164.0, PostgREST 12.2.3, Deno 2.1.4, Storage émulé) décrite dans `supabase/tests-local/replique/LISEZMOI.md`. **`supabase/config.toml` n'a donc pas été exécuté par la CLI** : à valider par un `supabase start`.

## 3. Configuration Supabase

### 3.1 Projet
1. Créer le projet (Dashboard → New project). Région : la plus proche des utilisateurs disponible dans la liste (ex. Europe de l'Ouest) ; la noter dans `js/00-config.js` → `editeur.regionDonnees`.
2. Mot de passe de la base : fort, conservé dans un gestionnaire de secrets (jamais dans Git).

### 3.2 API (Project Settings → API / Data API)
* **Exposed schemas : `public` uniquement** (jamais `app`).
* **Max rows : 1000** (l'interface lit par pages de 1000).
* Récupérer `Project URL` et la clé **anon / publishable** → `js/00-config.js`. Ne jamais copier la clé `service_role`.

### 3.3 Authentication
| Réglage | Valeur |
|---|---|
| Site URL | adresse publique du site, ex. `https://www.votre-domaine.sn` |
| Redirect URLs | `https://www.votre-domaine.sn/**` (et l'URL de préproduction) |
| Email provider | activé ; **Confirm email : activé** |
| Minimum password length | 8 ; exigence lettres + chiffres |
| Secure email change | activé (double confirmation) |
| SMTP | **SMTP personnalisé** (le service d'envoi intégré de Supabase est limité et réservé aux essais) |
| Modèles d'e-mail | « Confirm signup » et « Reset password » : coller `supabase/templates/confirmation.html` et `recovery.html` (code à 6 chiffres `{{ .Token }}`) ; objets « Confirmez votre adresse DEUKSIL », « Votre code DEUKSIL » |
| OTP expiry | 900 s |
| Rate limits | garder les valeurs par défaut, ajuster après observation |
| Anonymous sign-ins | désactivé |
| MFA | activer TOTP pour les administrateurs, puis `update app.reglages set valeur = 'oui' where cle = 'admin_mfa_obligatoire';` |

**Google (facultatif)** : Google Cloud → Identifiants → ID client OAuth « Application Web » ; URI de redirection autorisée : `https://<ref>.supabase.co/auth/v1/callback`. Supabase → Authentication → Providers → Google : ID et secret. Puis `googleActif: true` dans `js/00-config.js`.

### 3.4 Base de données
* Appliquer les migrations (§12).
* **pg_cron** : Dashboard → Integrations → Cron (ou Database → Extensions → `pg_cron`). La migration 0700 planifie `app.generer_rappels()` à 07:00 UTC (= Dakar) si l'extension est disponible ; sinon elle l'indique (`NOTICE`) et il faut lancer, une fois activée :
  ```sql
  select cron.schedule('deuksil-rappels', '0 7 * * *', 'select app.generer_rappels()');
  ```
  Vérifier : `select jobname, schedule, active from cron.job;` puis le lendemain `select status, return_message from cron.job_run_details order by start_time desc limit 5;`.

### 3.5 Storage
Les compartiments sont créés par la migration 0600 : `photos` (public, 5 Mo, images), `avatars` (public, 2 Mo), `documents` (**privé**, 10 Mo, PDF/images/Office/texte). Ne pas les rendre publics à la main.

### 3.6 Fonction Edge
```bash
supabase functions deploy gerer-acces            # verify_jwt = true (config.toml)
supabase secrets set DEUKSIL_ORIGINES=https://www.votre-domaine.sn
```
`SUPABASE_URL`, `SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` sont fournis par Supabase à la fonction : ne pas les définir à la main.

### 3.7 Site
`js/00-config.js` : `supabaseUrl`, `supabaseAnonKey`, `siteUrl`, `googleActif`, bloc `editeur` (mentions légales). Si vous utilisez un domaine personnalisé pour Supabase, l'ajouter à `connect-src` dans la balise CSP d'`index.html`.

## 4. Schéma de base de données

* **32 tables** dans `public`, toutes avec RLS activée ; **166 politiques** (`public`) + 4 sur `storage.objects` ; **61 déclencheurs** ; **43 fonctions** dans `app` ; 7 fonctions RPC dans `public` (`annuaire`, `notifier`, `notifier_admins`, `compter`, `changer_type_compte`, `chiffres_publics`, `rattacher_locataire`).
* Notion d'**espace** : toute donnée de gestion porte `owner_id` = le compte titulaire (propriétaire ou agence). Un membre d'équipe agit pour l'espace de son `parent_id`, selon ses permissions (`biens`, `visites`, `messages`, `gestion`, `finances`, `documents`).
* Rôles (`profiles.role`) : `client`, `owner`, `agency`, `admin`, `tenant`, `manager`, `agent`. Un **mandant** est un `owner` avec `mandant_of` / `owner_rec`.
* Montants en **bigint** (francs CFA, sans décimales) ; dates métier en `date` ; horodatages en `timestamptz` ; `updated_at` tenu par déclencheur.
* Champs propres à l'interface sans colonne dédiée : `extra jsonb`.

## 5. Tables et relations

| Domaine | Tables | Relations principales |
|---|---|---|
| Comptes | `profiles` | `id` → `auth.users` (cascade) ; `parent_id` → `profiles` (équipe) ; `owner_ref`, `mandant_of` (comptes ouverts par un tiers) ; `owner_rec` → `owner_records` |
| Annonces | `properties`, `units`, `favorites`, `saved_searches`, `reports` | `properties.owner_id` → espace ; `agent_id`, `apporteur_id` → `profiles` ; `units.property_id` ; `favorites (user_id, property_id)` unique |
| Visites, clients | `visits`, `client_requests` | `visits.property_id` (cascade), `client_id`, `agent_id` ; créneau unique par bien |
| Messagerie | `conversations`, `conversation_messages`, `notifications` | `participants uuid[]` ; un message par ligne (`conversation_id` cascade) ; notification unique par `(user_id, key)` |
| Gestion locative | `leases`, `rents`, `lease_messages`, `inspections`, `tickets`, `providers` | `leases.property_id` (RESTRICT), `unit_id` ; **pas deux baux actifs qui se chevauchent** (contrainte d'exclusion GiST) ; `rents (lease_id, month)` unique |
| Ventes | `deals`, `sale_mandates` | `deals.client_id`, `property_id` |
| Finance | `billing_docs`, `billing_payments`, `expenses`, `contracts`, `fees` | `billing_docs (owner_id, ref)` unique ; `billing_payments.doc_id` (cascade) ; un honoraire par bail / par vente |
| Agence ↔ propriétaires | `owner_records`, `mandates`, `owner_transfers`, `agency_link_requests` | `owner_id2` → fiche du mandant ; une seule demande en attente par couple |
| Documents | `documents` | fichier dans le compartiment privé `documents` (`storage_path`) |
| Journaux | `audit_log` (écriture seule), `activity_log`, `contact_messages` | — |

Le détail colonne par colonne est dans `supabase/migrations/20261022000200_tables.sql` (commenté) et, sous forme machine, dans `js/02c-schema.js` (généré par `supabase/outils/generer-schema-front.js`).

## 6. Scripts SQL

| Migration | Contenu |
|---|---|
| `0100_base` | extensions (`pgcrypto`, `btree_gist`, `pg_trgm`, `unaccent` dans `extensions`), schéma privé `app`, utilitaires |
| `0200_tables` | les 32 tables, contraintes `check`, clés étrangères, unicités |
| `0300_comptes_et_droits` | fonctions d'appartenance (`app.espace()`…), création du profil à l'inscription, protection des colonnes de `profiles`, cohérence d'espace, contrainte anti-chevauchement des baux, contrôle des annonces, journal immuable |
| `0400_rls` | RLS sur toutes les tables, politiques SELECT / INSERT / UPDATE / DELETE distinctes |
| `0500_fonctions_api` | RPC : annuaire, notifications, compteurs, changement de type de compte, chiffres publics, contrôle du formulaire de contact |
| `0600_stockage` | compartiments et politiques de `storage.objects` |
| `0700_regles_et_rappels` | verrous de colonnes des tiers, numérotation des pièces, rappels quotidiens, reconduction tacite, `rattacher_locataire`, planification pg_cron |
| `0800_performances` | réécriture des fonctions et politiques coûteuses, 58 index justifiés |

Autres scripts : `supabase/tests-local/perf/donnees-synthetiques.sql` (≈ 1 million de lignes de **test**), `cout-ecriture.sql` (coût des index en écriture), `supabase/tests-local/replique/00_supabase_base.sql` (rôles et schémas minimum de la réplique — **jamais sur un vrai projet**).

## 7. Index et justification

58 index (migration 0800), plus les unicités métier des migrations précédentes. Chaque index est documenté dans **`docs/INDEX.md`** : table et colonnes, type (B-tree, partiel, composite, GIN), requête visée, raison, gain mesuré, coût en écriture, vérification (`supabase/tests-local/perf/verifier-index.js` : l'index est-il **choisi** par le planificateur avec les volumes de test, ou seulement **utilisable** sur une petite table).

Points clés :
* index sur toutes les colonnes filtrées par la RLS (`owner_id`, `user_id`, `client_id`, `tenant_id`…) et sur les clés étrangères utilisées par les suppressions en cascade ;
* GIN sur `conversations.participants` et `profiles.lease_ids` (recherches « contient ») ;
* index partiels là où seule une fraction des lignes est interrogée (annonces publiées, loyers impayés, documents à échéance, visites à venir) ;
* coût en écriture mesuré : environ +15 à +35 % sur une insertion de masse dans `rents` (3 index), dans le bruit de mesure sur `notifications` ; ≈ 43 Mo d'index pour ≈ 1 million de lignes de test (`supabase/tests-local/perf/cout-ecriture.resultat.txt`).

## 8. Politiques RLS

* RLS **activée sur les 32 tables** ; le rôle `anon` n'a de droits que sur `properties` (lecture des annonces publiées) et `contact_messages` (envoi).
* Politiques **séparées** par opération (SELECT, INSERT, UPDATE, DELETE) et par acteur. Exemples :

| Table | Lecture | Écriture |
|---|---|---|
| tables d'espace (baux, loyers, factures…) | `owner_id = app.espace()` et permission du membre ; tiers concernés (locataire : ses baux ; mandant : ses biens ; client : ses dossiers) ; admin | membres de l'espace ayant la permission ; suppression interdite à un simple agent |
| `properties` | annonces publiées d'un compte actif ; espace ; locataire / mandant / client concernés | espace (un agent ne modifie que ses biens) ; suppression : titulaire seulement |
| `profiles` | soi, son équipe, son titulaire, les comptes qu'on a ouverts, admin | colonnes filtrées par `app.proteger_profil` ; pas d'INSERT (déclencheur sur `auth.users`), pas de DELETE (fonction Edge) |
| `visits` | espace, client demandeur | client : création seulement (statut imposé `attente`) |
| `conversations` / messages | participants (ou leur espace avec la permission `messages`), admin | participants ; participants figés ; messages immuables |
| `notifications` | les siennes | pour soi ; pour un autre **uniquement** par `public.notifier()` (relation vérifiée, 60/min) |
| `audit_log` | espace (permission finances), admin | insertion par l'espace en son nom ; ni modification ni suppression |

* Les fonctions d'appartenance sont `SECURITY DEFINER`, `search_path = ''`, appelées sous la forme `(select app.f())` pour être évaluées **une fois par requête**.
* Testées avec de vrais comptes : `supabase/tests-local/securite-rls.test.js` (**65/65** sur la réplique locale ; voir §14).

## 9. Protection contre les injections

* **SQL** : aucune requête SQL n'est construite par l'application ; PostgREST et les RPC reçoivent des paramètres typés. Seul SQL dynamique : `app.numeroter()` (`format('%I')` sur un nom de table interne, valeurs liées). Fonctions `SECURITY DEFINER` à `search_path` vide. Tests d'injection : docs/AUDIT_SECURITE.md §4.
* **Données fournies par le navigateur** : `owner_id` recalculé depuis le bien / le bail, statut et auteur imposés, numéros attribués par la base, compteurs modifiables seulement par `+1` (`public.compter`), rôle et permissions jamais pris dans `user_metadata`.
* **XSS** : échappement systématique à l'affichage (`esc()`), sonde XSS stockée (0 exécution), **CSP** `script-src 'self'` sans gestionnaire inline.
* **Fichiers** : taille et type contrôlés par le compartiment ; chemin vérifié par `app.dossier_autorise()` (le premier dossier désigne l'espace, la conversation ou le bail).

## 10. Gestion des secrets

| Secret | Où | Jamais |
|---|---|---|
| clé anon / publishable | `js/00-config.js` (publique par conception) | — |
| clé `service_role` | environnement de la fonction Edge (fourni par Supabase) ; outils locaux sur base de test | navigateur, Git, captures d'écran, tickets |
| mot de passe de la base, `DATABASE_URL` | gestionnaire de secrets ; `.env` local | Git |
| secret OAuth Google, SMTP | tableau de bord Supabase | Git, navigateur |
| `DEUKSIL_ORIGINES` | `supabase secrets set` | — |

`.gitignore` exclut `.env*` (sauf `.env.example`), les clés de la réplique locale, les résultats de tests. **Si une clé `service_role` a fuité** : Project Settings → API → régénérer les clés (JWT secret) — toutes les sessions sont alors invalidées —, redéployer la fonction Edge, mettre à jour `js/00-config.js` avec la nouvelle clé anon.

## 11. Connexion frontend / serveur

* `index.html` charge `js/vendor/supabase-js-2.45.4.min.js` (copie locale, pas de CDN) puis `js/00-config.js`.
* `js/03-storage.js` crée le client (`createClient(supabaseUrl, supabaseAnonKey)`), charge les tables utiles au rôle (`tablesALire`), par pages de 1000, et écrit dans l'ordre des dépendances. Une écriture refusée (RLS, contrainte) est **annulée à l'écran** et un message clair est affiché (`messageErreur`).
* Cas particuliers (`ADAPTATEURS`) : comptes → fonction Edge `gerer-acces` ; notification pour un autre compte → `rpc('notifier')` ; vues / contacts d'une annonce d'autrui → `rpc('compter')` ; tables numérotées → relecture du numéro attribué par la base ; fichiers `data:` → Storage.
* Session : `js/08-auth.js` (connexion e-mail + mot de passe, déconnexion), `js/76-demarrage.js` (`onAuthStateChange` ; les rechargements sont différés pour ne pas bloquer le verrou de supabase-js).
* Serveur : la seule logique hors base est la fonction Edge `gerer-acces` (actions `creer`, `mot-de-passe`, `supprimer`), qui vérifie le jeton de l'appelant (`auth.getUser`), son statut de titulaire et le rattachement du compte visé.

## 12. Migrations

* Nommage `AAAAMMJJHHMMSS_sujet.sql`, appliquées **dans l'ordre**, chacune dans une transaction.
* **Ne jamais modifier une migration déjà appliquée en production** : créer la suivante (`supabase migration new sujet`).
* Base locale : `supabase start` puis `supabase db reset` (rejoue tout). Projet : `supabase link --project-ref <ref>` puis `supabase db push` (applique les migrations manquantes, consignées dans `supabase_migrations.schema_migrations`).
* Après une modification du schéma : `node supabase/outils/generer-schema-front.js` (régénère `js/02c-schema.js`) et relancer les tests (§14).
* Suppression de colonne, de table ou de données : **jamais sans validation préalable** et sauvegarde vérifiée (§17) ; préférer deux temps (cesser d'utiliser, puis supprimer dans une migration ultérieure).
* PostgREST recharge son cache de schéma automatiquement sur Supabase ; en local : `notify pgrst, 'reload schema';`.

## 13. Suppression du mode démo

Retiré de l'application (détail dans l'historique `docs/historique/`) :

| Élément de démonstration | Remplacé par |
|---|---|
| stockage `localStorage`, comptes et mots de passe locaux (`demo123`, `admin123`), jeu de données préchargé (`05-seed`, `77-jeu-de-test`, `97-demo`, `56-vie`, `87-noms`, `51-uatfix`) | Supabase (Auth + base) ; aucune donnée préchargée ; états vides explicites |
| paiements simulés (PayDunya, `09-payments`, `10-paydunya`) | aucun paiement dans l'application |
| photos « de démonstration » attribuées aux annonces sans photo | illustration neutre ; seules les photos déposées sont affichées |
| statistiques et avis fictifs de l'accueil | chiffres réels (`rpc chiffres_publics`) ; pas d'avis inventés |
| notifications « par e-mail (simulation) » | mention retirée |
| rappels, expirations, reconductions écrits par le navigateur | `app.generer_rappels()` / `app.reconduire_baux()` (pg_cron) |
| **création automatique de comptes** locataires / mandants avec des adresses inventées et `demo123` | ouverture d'accès explicite avec l'adresse réelle, mot de passe provisoire aléatoire, changement à la 1re connexion |
| équipe « agents » non enregistrée (page historique) et page « Commissions (simulation) » | équipe réelle (`profiles.parent_id`) et honoraires réels (`fees`) |
| formulaires « CNI fictive », mots de passe de 6 caractères | e-mail obligatoire (identifiant), CNI facultative, 8 caractères |
| numéros de pièce calculés par le navigateur | `app.numeroter()` |

Contrôle : `tests/ecritures-auto.js` (plus aucune écriture sans action de l'utilisateur, hormis « marquer comme lu ») ; recherche textuelle « démo / fictif / simulation » dans `js/` : il ne reste que des commentaires et la liste des mots de passe interdits.

Le jeu de données de **test** (`supabase/tests-local/jeu-de-test.json`, adresses `@deuksil.test`) sert uniquement aux tests : **ne jamais l'importer en production** avec `supabase/outils/importer-json.js`.

## 14. Procédures de test

> Toujours sur une base de **test** (locale ou projet Supabase dédié). Les scripts refusent une URL non locale sauf `DEUKSIL_TEST_AUTORISE=1`.

1. **Base de test** — au choix :
   * `supabase start` + `supabase db reset`, puis servir le site sur une URL autorisée ; ou
   * la réplique locale : `supabase/tests-local/replique/` (`demarrer.sh`, `preparer.sh`), qui sert aussi le site sur `http://127.0.0.1:54321`.
2. **Jeu de test** : `node supabase/outils/importer-json.js supabase/tests-local/jeu-de-test.json supabase/tests-local/comptes-test.json` (variables `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MOT_DE_PASSE` de la base de **test**).
3. **Sécurité API (multi-comptes)** : `SUPABASE_URL=… SUPABASE_ANON_KEY=… MOT_DE_PASSE_TEST=… node supabase/tests-local/securite-rls.test.js` → résultats dans `supabase/tests-local/resultats/securite-rls.json`.
4. **Navigateur** (`APP_URL`, `MOT_DE_PASSE_TEST`, `MAILS` = capture des e-mails de la base de test) : `node tests/formulaires.js`, `node tests/acces-comptes.js`, `node tests/sonde-pages.js`, `node tests/ecritures-auto.js`, `node tests/xss-sonde.js` (modifie les données : base de test reconstruite ensuite).
5. **Rappels** : `select * from app.generer_rappels();` deux fois de suite → la seconde exécution ne crée rien.
6. **Performances** : §15.

Résultats obtenus le 22/10/2026 sur la réplique locale :

| Suite | Résultat |
|---|---|
| sécurité API, 11 comptes réels, 8 rôles + anonyme | 65/65 |
| ouverture d'accès / rattachement / 1re connexion | 14/14 |
| formulaires réels (inscription + code e-mail, connexion, mot de passe oublié, agence, 20 photos, contact) | 27/27 |
| pages de menu des 9 profils (erreurs JS, requêtes refusées) | aucune |
| XSS stockée (49 colonnes, ≈ 119 pages) | 0 exécution |
| CSP (6 profils) | 0 violation |
| rappels exécutés deux fois | 2e passage : 0 création |

Les anciens scripts de test (version de démonstration) sont rangés dans `tests/historique/` ; leur état est dans `tests/ETAT_DES_TESTS.md`.

**À refaire sur un projet Supabase de test avant la production** (Storage et Edge n'ont été testés qu'en émulation locale).

## 15. Mesures de performance

Méthode : ≈ 1 million de lignes **synthétiques** (`donnees-synthetiques.sql`), chaque requête exécutée **comme PostgREST** (rôle `authenticated` ou `anon` + claims JWT, donc avec la RLS), `EXPLAIN (ANALYZE, BUFFERS)`, médiane de 5 passages après un passage de chauffe, mêmes données avant / après. Script : `supabase/tests-local/perf/mesurer.js` ; résultats bruts : `resultats-avant.json`, `resultats-apres.json` ; analyse : **`docs/PERFORMANCES.md`**.

Principaux constats corrigés par la migration 0800 (médianes avant → après, mêmes données) :

| Requête | Avant | Après |
|---|---|---|
| annuaire (appelé à chaque chargement, compte connecté) | ≈ 21 s | ≈ 15 ms |
| loyers d'un locataire / d'un propriétaire | ≈ 270 ms | ≈ 1,5 ms |
| messages d'un client | ≈ 183 ms | ≈ 1,8 ms |
| factures d'une agence | ≈ 248 ms | ≈ 2,2 ms |
| catalogue public (1 000 annonces) | ≈ 184 ms | ≈ 4,7 ms |
| rappels quotidiens (tâche serveur) | ≈ 78 s | ≈ 3,5 s |

Causes : fonctions d'appartenance réévaluées pour chaque ligne, prédicats non indexables (`= any(participants)`, `OR est_admin()`), index manquants. Tableau complet (34 requêtes) dans `docs/PERFORMANCES.md`. Ils ont été obtenus sur un conteneur partagé : comparer les ordres de grandeur, pas les millisecondes.

## 16. Déploiement

1. **Préproduction** : projet Supabase distinct, même procédure que la production ; y jouer §14.
2. Production :
   1. créer le projet et appliquer §3 (API, Auth, SMTP, modèles, Storage) ;
   2. `supabase link --project-ref <ref>` puis `supabase db push` ;
   3. activer pg_cron et vérifier la tâche `deuksil-rappels` (§3.4) ;
   4. `supabase functions deploy gerer-acces` + `supabase secrets set DEUKSIL_ORIGINES=…` ;
   5. renseigner `js/00-config.js` ;
   6. publier les fichiers statiques sur un hébergement HTTPS avec les en-têtes : `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` (ou CSP `frame-ancestors 'none'`), `Referrer-Policy: strict-origin-when-cross-origin` ; `sw.js` servi depuis la racine ;
   7. créer le premier administrateur : inscription normale (confirmation de l'adresse), puis dans l'éditeur SQL du tableau de bord (rôle `postgres`, le seul autorisé à attribuer ce rôle — l'application et la fonction Edge le refusent) :
      ```sql
      update public.profiles set role = 'admin' where email = 'adresse@votre-domaine.sn';
      ```
      puis activer sa MFA (§3.3) ;
   8. contrôle : inscription, confirmation par code, connexion, publication d'un bien avec photo, visite, message, document privé (URL signée), déconnexion.
3. Mises à jour : nouvelle migration → préproduction → tests → production ; fonction Edge redéployée si modifiée ; `js/02c-schema.js` régénéré.

## 17. Sauvegardes et restauration

* **Sauvegardes Supabase** : ce qui est inclus (fréquence, durée de conservation, restauration à un instant précis « PITR ») dépend de l'offre et évolue : le vérifier dans Dashboard → Database → Backups et dans la documentation [Database Backups](https://supabase.com/docs/guides/platform/backups). Choisir l'offre selon le besoin réel (perte de données acceptable, délai de remise en service), pas par défaut. Dans tous les cas, garder ses **propres exports** :
* **Export autonome** — scripts fournis dans `supabase/sauvegarde/` (voir aussi `GUIDE_EQUIPE_BACKEND.md`, étape 9) :
  ```bash
  cd supabase/sauvegarde && npm install
  DATABASE_URL=… SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… ./sauvegarder.sh
  ```
  Le dossier produit contient : `donnees.sql` (données, comptes compris), `structure.sql` (référence), `fichiers/` (photos, avatars, documents + `manifeste.json` avec empreintes), `comptages.txt`, `contexte.txt`, `SHA256SUMS`. Il contient des **données personnelles** : le chiffrer (`gpg -c`) et le conserver hors du projet. `pg_dump` doit être de version ≥ celle du serveur.
* **Restauration** — sur un projet **neuf** uniquement (le script refuse une base qui contient déjà des comptes) : appliquer les 8 migrations (`supabase db push`), puis
  ```bash
  DATABASE_URL_CIBLE=… SUPABASE_URL=<cible> SUPABASE_SERVICE_ROLE_KEY=<clé de la cible> CONFIRMER=oui ./restaurer.sh <dossier>
  ```
  Le script vérifie les empreintes, charge les données en une transaction (déclencheurs suspendus : `session_replication_role = replica`), redépose les fichiers, puis compare les comptages à ceux de la sauvegarde.
* **Testé sur la réplique locale le 22/10/2026** : sauvegarde (29 comptes, 34 tables, 3 fichiers), base remise à zéro, restauration → comptages identiques, connexion d'un compte restauré, document privé lisible par son propriétaire et refusé à un autre compte, suite de sécurité 65/65. **Non testé sur Supabase hébergé** : à faire une fois (le rôle `postgres` d'un projet Supabase doit pouvoir poser `session_replication_role` ; c'est la méthode du guide de migration Supabase, à confirmer sur votre projet).
* **Tester la restauration** au moins une fois avant l'ouverture et après chaque évolution importante du schéma.

## 18. Erreurs fréquentes

| Message / code | Cause probable | Correction |
|---|---|---|
| « Configuration incomplète » au chargement | `js/00-config.js` vide | renseigner URL et clé anon |
| `PGRST202 Could not find the function … in the schema cache` | fonction absente (migration non appliquée) ou cache non rechargé | `supabase db push` ; en local `notify pgrst, 'reload schema'` |
| `42501 new row violates row-level security policy` | écriture hors de l'espace / sans permission ; ou INSERT avec `return=representation` d'une ligne que la politique SELECT ne montre pas | vérifier le rôle et les permissions ; écrire sans `select()` si la ligne n'est pas lisible |
| `42501 Champs non modifiables : …` | `app.proteger_profil` refuse une colonne | normal : passer par la fonction prévue (gerer-acces, changer_type_compte…) |
| `23P01 conflicting key value violates exclusion constraint "baux_sans_chevauchement"` | deux baux actifs qui se chevauchent sur un logement | terminer l'ancien bail ou corriger les dates |
| `23505 duplicate key` | doublon (favori, créneau de visite, numéro saisi) | message affiché à l'utilisateur ; recharger |
| `JWT expired` / `PGRST301` | session expirée | reconnexion (supabase-js rafraîchit normalement) |
| Fonction Edge : erreur CORS | `DEUKSIL_ORIGINES` ne contient pas l'adresse du site | `supabase secrets set DEUKSIL_ORIGINES=…` |
| E-mails non reçus | SMTP intégré limité / non configuré | SMTP personnalisé (§3.3) |
| Connexion Google : « redirect_uri_mismatch » | URI de redirection Google ≠ `https://<ref>.supabase.co/auth/v1/callback` | corriger dans Google Cloud |
| Rappels absents | pg_cron non activé ou tâche absente | §3.4 |
| `malformed array literal` dans une fonction | concaténation `text[] || 'texte'` | `array_append` (corrigé dans `app.proteger_profil`) |

## 19. Checklist finale

- [ ] Projet de **préproduction** créé ; §14 joué et vert sur ce projet
- [ ] Exposed schemas = `public` ; Max rows = 1000
- [ ] Auth : confirmation e-mail, 8 caractères, SMTP personnalisé, modèles collés, Site URL et Redirect URLs
- [ ] Google configuré ou `googleActif: false`
- [ ] 8 migrations appliquées (`select version from supabase_migrations.schema_migrations`)
- [ ] `select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;` → 0
- [ ] pg_cron actif, tâche `deuksil-rappels` planifiée et exécutée une fois
- [ ] Fonction `gerer-acces` déployée, `DEUKSIL_ORIGINES` défini
- [ ] `js/00-config.js` renseigné (URL, clé **anon**, siteUrl, éditeur) — aucune clé `service_role` dans le dépôt (`grep -r service_role js/` → rien)
- [ ] En-têtes HTTP de sécurité sur l'hébergement ; CSP adaptée si domaine personnalisé
- [ ] Premier administrateur créé, MFA activée, `admin_mfa_obligatoire = 'oui'`
- [ ] Sauvegarde exportée **et restauration testée** sur un projet neuf
- [ ] Aucune donnée de test en production (`select count(*) from profiles where email like '%@deuksil.test'` → 0)
- [ ] Mentions légales complétées (`editeur` dans `js/00-config.js`)
