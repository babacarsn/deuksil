# DEUKSIL — Base de données PostgreSQL

État au 2 novembre 2026, après les migrations `20261022000100` à `20261102000100`. Les chiffres viennent du catalogue de la réplique locale (`pg_class`, `pg_policies`, `pg_trigger`).

Documents liés : justification des 58 index de performance dans [INDEX.md](INDEX.md), mesures dans [PERFORMANCES.md](PERFORMANCES.md), audit de sécurité dans [AUDIT_SECURITE.md](AUDIT_SECURITE.md).

## 1. Schémas

| Schéma | Exposé par l'API | Contenu |
|---|---|---|
| `public` | oui (PostgREST) | 32 tables métier, 11 fonctions appelables (`rpc/…`) |
| `app` | **non** | 53 fonctions utilisées par la RLS et les déclencheurs ; tables privées `app.reglages` et `app.fichiers_a_supprimer` |
| `storage` | par l'API Storage | `objects`, `buckets` ; politiques DEUKSIL (§5) |
| `auth` | par Supabase Auth | comptes ; déclencheurs DEUKSIL de création de profil |

## 2. Tables

Colonnes, clés étrangères, index (y compris clés primaires et uniques), politiques RLS et déclencheurs, par table :

| Table | Col. | FK | Index | RLS | Décl. | Rôle |
|---|---:|---:|---:|---:|---:|---|
| profiles | 36 | 7 | 8 | 2 | 3 | comptes (rôle, espace, droits, CNI) |
| properties | 37 | 4 | 5 | 8 | 4 | biens et annonces ; `photos`, `photos_meta` |
| units | 14 | 3 | 2 | 6 | 2 | lots d'un immeuble |
| leases | 28 | 3 | 4 | 7 | 2 | baux |
| rents | 16 | 3 | 5 | 7 | 2 | échéances de loyer |
| lease_messages | 10 | 3 | 2 | 8 | 3 | échanges bailleur / locataire |
| inspections | 7 | 2 | 2 | 6 | 2 | états des lieux |
| tickets | 18 | 5 | 5 | 7 | 4 | travaux |
| providers | 8 | 1 | 2 | 5 | 1 | prestataires |
| expenses | 14 | 4 | 4 | 6 | 2 | dépenses |
| visits | 18 | 5 | 5 | 7 | 3 | visites |
| client_requests | 18 | 3 | 3 | 6 | 1 | demandes de clients |
| deals | 23 | 4 | 3 | 6 | 1 | ventes |
| contracts | 20 | 5 | 4 | 6 | 2 | contrats |
| mandates / sale_mandates | 14 / 17 | 2 / 3 | 4 / 4 | 6 / 6 | 2 / 3 | mandats de gestion / de vente |
| owner_records | 19 | 2 | 3 | 6 | 1 | fiches des propriétaires mandants |
| owner_transfers | 20 | 2 | 4 | 6 | 2 | reversements |
| fees | 25 | 6 | 7 | 6 | 2 | honoraires |
| billing_docs / billing_payments | 20 / 14 | 4 / 4 | 4 / 5 | 7 / 6 | 2 / 2 | factures / encaissements |
| documents | 17 | 3 | 3 | 6 | 1 | coffre (fichiers privés) |
| conversations / conversation_messages | 8 / 9 | 2 / 2 | 2 / 3 | 3 / 3 | 2 / 2 | messagerie |
| notifications | 9 | 2 | 3 | 4 | 1 | notifications |
| favorites / saved_searches | 5 / 7 | 2 / 1 | 3 / 2 | 3 / 4 | 1 / 1 | favoris, alertes |
| agency_link_requests | 9 | 3 | 3 | 3 | 2 | rattachement propriétaire ↔ agence |
| reports | 11 | 3 | 3 | 3 | 2 | signalements |
| audit_log / activity_log | 9 / 5 | 2 / 1 | 2 / 2 | 2 / 2 | 2 / 1 | journaux |
| contact_messages | 10 | 1 | 3 | 3 | 3 | formulaire de contact (visiteurs compris) |

Conventions :
- clés primaires UUID, générées par le navigateur pour un affichage immédiat, acceptées telles quelles ;
- `created_at` / `updated_at` (déclencheur `app.maj_horodatage`) ;
- les champs sans colonne vont dans `extra jsonb` ;
- l'interface lit les types depuis `js/02c-schema.js`, généré par `supabase/outils/generer-schema-front.js` : à relancer après toute migration qui touche une colonne.

## 3. Photos des biens (migration 20261102000100)

| Objet | Rôle |
|---|---|
| `properties.photos text[]` | URL publiques de la variante `m`, couverture en tête ; ≤ 20 (contrainte existante) |
| `properties.photos_meta jsonb` | description de chaque photo, même ordre ; ≤ 20 (contrainte `properties_photos_meta_forme`) ; forme exacte dans [CONTRACT_FRONTEND_BACKEND.md](CONTRACT_FRONTEND_BACKEND.md) §4 |
| déclencheur `controler_photos` (avant insertion / modification de `photos`, `photos_meta`) | forme des URL, dossier du bien, cohérence avec la description ; seules les nouvelles valeurs |
| déclencheur `photos_retirees` (après modification ou suppression) | fichiers retirés → `app.fichiers_a_supprimer` |
| déclencheur `avatar_retire` (`profiles`) | ancienne photo de profil → file |
| `app.fichiers_a_supprimer` | file de suppression ; unique (`bucket`, `chemin`) ; index partiel sur les lignes à traiter ; aucun droit pour `anon` et `authenticated` |
| `app.fichier_reference(bucket, chemin)` | « ce fichier est-il encore utilisé ? » par clé primaire (bien ou profil), sans parcours de table |
| `public.nettoyage_*` | 4 fonctions réservées à `service_role` (fonction Edge de nettoyage) |

Pourquoi une colonne `jsonb` et non une table `property_photos` (proposée dans l'audit) :
- les photos et leur description sont écrites dans **la même ligne**, donc dans la même transaction que le bien. Aucun état intermédiaire possible : bien enregistré mais photos absentes, ou l'inverse ;
- `properties.photos` reste la seule liste lue par la dizaine d'écrans existants ;
- la RLS des biens s'applique telle quelle.

Contrepartie : il n'y a pas de clé étrangère par photo. Le déclencheur `controler_photos` et `app.fichier_reference` en tiennent lieu.

## 4. Transactions, concurrence, doublons

- **Transactions.** Une écriture de l'interface = une requête PostgREST = une transaction. Bien + photos + description : une seule requête. Les opérations à plusieurs tables passent par des fonctions SQL (par exemple `rattacher_locataire`) ou par l'ordre des dépendances (`ORDRE_ECRITURE`, `js/03-storage.js`).
- **Doublons.**
  - L'identifiant est fixé par le navigateur : une nouvelle tentative de la même écriture ne crée pas de doublon (erreur 23505).
  - Les fichiers ont des noms UUID et sont déposés sans remplacement.
  - Contraintes d'unicité métier : `rents (lease_id, month)`, `favorites (user_id, property_id)`, numéros de pièces…
- **Concurrence.**
  - Le dernier écrit l'emporte sur une même ligne : il n'y a pas de contrôle de version.
  - Les compteurs (`views`, `contacts`) passent par `public.compter` : incrément atomique, sans réécriture par l'interface.
  - Les numéros de pièces sont attribués par la base (`app.numeroter`).

## 5. Storage

Compartiments `photos` (public, 5 Mo), `avatars` (public, 2 Mo), `documents` (privé, 10 Mo, URL signées 6 h). Règles détaillées dans [STORAGE.md](STORAGE.md).

## 6. Migrations

| Fichier | Contenu | Destructif |
|---|---|---|
| 20261022000100_base | extensions, schéma `app`, utilitaires | non |
| 20261022000200_tables | tables, contraintes | non |
| 20261022000300_comptes_et_droits | profils, espaces, droits | non |
| 20261022000400_rls | RLS sur toutes les tables | non |
| 20261022000500_fonctions_api | fonctions appelables | non |
| 20261022000600_stockage | compartiments, politiques Storage | non |
| 20261022000700_regles_et_rappels | règles métier, rappels | non |
| 20261022000800_performances | politiques réécrites, 58 index | non |
| 20261028000100_cni_avant_publication | CNI exigée à la publication | non |
| **20261102000100_photos** | photos (§3), Storage resserré, nettoyage | **non** : additive, retour arrière en fin de fichier |

Application :
- projet hébergé : `supabase db push` ;
- réplique locale : `supabase/tests-local/replique/preparer.sh` rejoue toutes les migrations sur une base vide puis importe le jeu de test.

Vérifié le 2 novembre 2026 : les 10 migrations s'appliquent sur une base vide sans erreur.
