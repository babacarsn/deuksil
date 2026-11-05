# DEUKSIL — Backend (Supabase)

Responsabilités de l'équipe backend et changements du 2 novembre 2026. Mise en service pas à pas : [PLAN_DEPLOIEMENT.md](PLAN_DEPLOIEMENT.md).

## 1. Responsabilités

| Domaine | Fichiers |
|---|---|
| Schéma, contraintes, migrations | `supabase/migrations/*.sql` ([DATABASE.md](DATABASE.md)) |
| Droits (RLS, fonctions `app.*`) | migrations 0300, 0400, 0800, 0900 photos |
| Storage (compartiments, politiques) | migrations 0600 et 20261102000100 ([STORAGE.md](STORAGE.md)) |
| Fonctions Edge | `supabase/functions/gerer-acces`, `assistant-ia`, `nettoyer-fichiers` |
| Secrets | `supabase secrets set …` (jamais dans Git ni dans le navigateur) |
| Sauvegarde, restauration | `supabase/sauvegarde/` |
| Tests de sécurité | `supabase/tests-local/securite-rls.test.js`, `tests/photos.js` (S1–S8, C1–C3) |

## 2. Changements du 2 novembre 2026

### Migration `20261102000100_photos.sql`

Additive, aucune donnée modifiée. Retour arrière en fin de fichier.

1. `properties.photos_meta` (jsonb, ≤ 20 entrées) : description de chaque photo.
2. Déclencheur `controler_photos` :
   - 20 photos au plus ;
   - forme des **nouvelles** URL et dossier du bien ;
   - description alignée sur `photos`.
3. Politiques Storage :
   - 2e dossier = bien de l'espace ;
   - agent limité à ses biens ;
   - lecture de ses propres fichiers (nécessaire aux suppressions) ;
   - remplacement et suppression refusés pour un fichier encore référencé.
4. File `app.fichiers_a_supprimer`, alimentée par les déclencheurs `photos_retirees` et `avatar_retire`.
5. Fonctions `public.nettoyage_preparer`, `nettoyage_lot`, `nettoyage_fin` et `nettoyage_rapport`, exécutables par `service_role` seulement.

### Fonction Edge `nettoyer-fichiers`

- Appel `POST` avec l'en-tête `x-deuksil-cle`, qui doit être égal au secret `DEUKSIL_CLE_NETTOYAGE` (32 caractères au moins, comparaison à durée constante).
- `{"simulation": true}` → rapport seul.
- Sinon :
  - met en file les dépôts jamais enregistrés depuis plus de `delai_heures` (24 par défaut) ;
  - supprime les fichiers de la file par l'API Storage, par lots de 200, 25 lots au plus par appel ;
  - chaque fichier est revérifié juste avant sa suppression.
- `verify_jwt = false` (`supabase/config.toml`) : l'appel vient d'une planification, sans jeton utilisateur ; le secret le remplace.
- Testée localement sous Deno contre la réplique (C1 à C3, [TESTS.md](TESTS.md)).

### Contrôles revérifiés côté serveur

| Règle de l'interface | Contrôle en base |
|---|---|
| 20 photos au plus | contrainte `cardinality(photos) <= 20` + `photos_meta` ≤ 20 + déclencheur |
| Fichier image, ≤ 5 Mo | compartiment `photos` (types et taille) |
| Dépôt dans le dossier de son bien | `app.dossier_autorise` |
| Agent : ses biens seulement | `app.dossier_autorise` (Storage) + RLS de `properties` (existante) |
| Pas de suppression d'une photo affichée | `app.fichier_reference` dans les politiques de remplacement et de suppression |
| URL de photo sûre | `controler_photos` (caractères, schéma, dossier) |

## 3. Requêtes et performances

- Les politiques et index de la migration 0800 sont inchangés. Leur justification et leurs mesures restent dans [INDEX.md](INDEX.md) et [PERFORMANCES.md](PERFORMANCES.md).
- `app.fichier_reference` lit le bien ou le profil par sa **clé primaire**, tirée du chemin du fichier : aucun parcours de table, ni dans les politiques Storage, ni dans le nettoyage.
- `nettoyage_preparer` parcourt `storage.objects` des compartiments `photos` et `avatars`, limité par `created_at` et à 5 000 lignes par appel.
- **Limite PostgREST de 1 000 lignes par appel** (`db-max-rows`, valeur par défaut de Supabase) :
  - l'annuaire (`rpc/annuaire`) était tronqué au-delà de 1 000 propriétaires et agences ;
  - constaté sur le jeu synthétique : 1 809 comptes, 1 000 renvoyés ;
  - l'interface le lit désormais par pages ([FRONTEND.md](FRONTEND.md) §3) ;
  - aucune modification serveur n'est nécessaire.

## 4. À faire par l'équipe backend

1. Appliquer la migration sur un **projet de test**, puis en production (voir [PLAN_DEPLOIEMENT.md](PLAN_DEPLOIEMENT.md)).
2. Déployer `nettoyer-fichiers`, poser le secret, lancer une **simulation**, lire le rapport, puis planifier l'appel toutes les heures.
3. Rejouer à la main, sur le projet de test, les cas Storage S1 à S4 et S8 de [TESTS.md](TESTS.md) : la réplique émule Storage.
4. Surveiller dans le rapport `file_en_echec` et `photos_manquantes`.
