# DEUKSIL — Mesures de performance (avant / après la migration 0800)

Mesures du 22 octobre 2026. **Tout chiffre de ce document vient d'une exécution réelle** (`EXPLAIN (ANALYZE, BUFFERS)`) ; les fichiers bruts sont dans `supabase/tests-local/perf/`.

## Méthode

* **Environnement** : PostgreSQL 16.15 local (réplique de test), conteneur partagé. Les durées varient d'une exécution à l'autre (jusqu'à ±50 % sur les requêtes de quelques millisecondes) : comparer les **ordres de grandeur**. Sur Supabase hébergé (autre matériel, PostgreSQL 15/17), les valeurs absolues seront différentes.
* **Données** : `donnees-synthetiques.sql` — jeu déterministe d'environ 1 million de lignes (comptes, biens, baux, loyers, visites, messages, factures…), **identique avant et après**. Ce ne sont pas des données réelles : la répartition (nombre de biens par espace, etc.) est une hypothèse.
* **Requêtes** : celles de l'interface (`select … order by created_at limit 1000`, appels RPC), exécutées **comme PostgREST** : rôle `authenticated` ou `anon` et claims JWT de l'utilisateur — la RLS est donc appliquée. Les requêtes qui écrivent sont annulées (`ROLLBACK`).
* **Statistique** : médiane de 5 passages après un passage de chauffe (2 passages pour les rappels quotidiens).
* **Avant** = migrations 0100 à 0700 ; **après** = 0100 à 0800. Script : `node supabase/tests-local/perf/mesurer.js avant|apres` ; enchaînement complet : base neuve, données, mesure, pour chaque état.

### Volumes de test (après)

| Table | Lignes |
|---|---:|
| notifications | 200 041 |
| rents | 144 125 |
| conversation_messages | 120 012 |
| audit_log | 100 005 |
| favorites | 50 004 |
| visits | 42 008 |
| profiles | 34 429 |
| properties | 30 052 |
| billing_docs | 30 005 |
| billing_payments | 23 915 |
| conversations | 20 002 |
| documents | 20 000 |
| leases | 12 011 |
| tickets | 10 003 |

## Résultats

| Requête (rôle, RLS active) | Lignes | Avant (ms) | Après (ms) | Rapport | Plan après |
|---|---:|---:|---:|---:|---|
| Catalogue public (annonces publiées) | 1000 | 183.7 | 4.7 | ÷39 | index properties_publiees_date_idx |
| Annuaire public (rpc annuaire) | 1809 | 1 297.1 | 12.2 | ÷107 | — |
| Propriétaire : annuaire (rpc annuaire) | 1809 | 21 120.5 | 14.8 | ÷1424 | — |
| Client : annuaire (rpc annuaire) | 1810 | 20 678.2 | 15.9 | ÷1300 | — |
| Propriétaire : ses biens | 1000 | 491.6 | 27.0 | ÷18 | parcours séq. properties |
| Propriétaire : ses baux | 0 | 280.2 | 1.5 | ÷188 | index leases_property_idx, leases_owner_idx |
| Propriétaire : ses loyers | 0 | 263.3 | 1.5 | ÷181 | index rents_property_idx, rents_lease_id_month_key, rents_owner_idx |
| Propriétaire : ses visites | 0 | 6.7 | 0.9 | ÷7.7 | index visits_owner_date_idx, visits_client_idx |
| Propriétaire : ses notifications | 111 | 18.7 | 0.6 | ÷31 | index notifications_user_date_idx |
| Propriétaire : conversations | 0 | 5.8 | 0.8 | ÷7.4 | index conversations_participants_gin |
| Propriétaire : messages des conversations | 0 | 179.5 | 1.6 | ÷116 | index conversation_messages_conv_idx |
| Propriétaire : profils visibles | 1 | 10.1 | 12.8 | ×1.3 | parcours séq. profiles |
| Agence : factures | 16 | 248.4 | 2.2 | ÷111 | index billing_docs_property_idx, billing_docs_owner_id_ref_key, billing_docs_client_idx |
| Agence : encaissements | 14 | 5.4 | 1.6 | ÷3.4 | index billing_payments_owner_idx, billing_payments_client_idx |
| Agence : documents | 11 | 2.9 | 1.7 | ÷1.7 | index documents_owner_idx |
| Agence : tickets | 64 | 2.7 | 2.6 | ≈ | index tickets_tenant_idx, tickets_property_idx, tickets_owner_idx |
| Agence : journal d'audit | 55 | 11.6 | 1.6 | ÷7.1 | index audit_log_owner_date_idx |
| Agent : biens de l'agence | 1000 | 516.7 | 29.8 | ÷17 | parcours séq. properties |
| Agent : visites de l'agence | 200 | 5.7 | 1.5 | ÷3.7 | index visits_owner_date_idx, visits_client_idx |
| Locataire : ses loyers | 12 | 272.8 | 1.6 | ÷174 | index rents_property_idx, rents_lease_id_month_key, rents_owner_idx |
| Locataire : son bail | 1 | 254.2 | 1.6 | ÷157 | index leases_property_idx, leases_owner_idx |
| Locataire : tickets | 1 | 2.8 | 2.0 | ÷1.4 | index tickets_tenant_idx, tickets_property_idx, tickets_owner_idx |
| Client : ses visites | 3 | 5.3 | 1.4 | ÷3.9 | index visits_owner_date_idx, visits_client_idx |
| Client : ses favoris | 3 | 0.2 | 0.1 | ≈ | index favorites_user_id_property_id_key |
| Client : ses notifications | 10 | 36.9 | 0.4 | ÷95 | index notifications_user_date_idx |
| Client : conversations | 1 | 5.2 | 0.7 | ÷7.7 | index conversations_participants_gin |
| Client : messages | 6 | 183.0 | 1.8 | ÷100 | index conversation_messages_conv_idx |
| Client : notifier un propriétaire contacté | 1 | 31.4 | 9.9 | ÷3.2 | — |
| Administrateur : biens (tous) | 1000 | 490.7 | 32.9 | ÷15 | parcours séq. properties |
| Administrateur : loyers (tous) | 1000 | 326.5 | 71.6 | ÷4.6 | index rents_property_idx, rents_lease_id_month_key, rents_owner_idx |
| Administrateur : messages (tous) | 1000 | 276.6 | 74.4 | ÷3.7 | index conversation_messages_conv_idx |
| Rappels quotidiens (app.generer_rappels) | 7 | 77 849.6 | 3 550.4 | ÷22 | — |
| Suppression d'un bien (cascade) | 0 | 6.4 | 0.7 | ÷9.4 | index properties_owner_idx, leases_property_idx |
| Suppression d'un compte client (cascade) | 0 | 181.3 | 129.7 | ÷1.4 | — |

« Lignes » = lignes renvoyées (plusieurs comptes de test n'ont aucune ligne dans une table : la mesure porte alors sur le coût du filtrage, qui était justement le problème). « Plan après » = index utilisés (hors clés primaires) ou tables parcourues entièrement.

## Causes identifiées et corrections (migration 0800)

| Constat (avant) | Effet mesuré | Correction |
|---|---|---|
| `app.biens_mandant()` et `app.biens_locataire()` appelaient `app.mes_fiches()` / `app.mes_baux()` **pour chaque ligne** parcourue | ≈ 250 ms ajoutées à toute lecture de biens, baux, loyers, factures — même sans aucune ligne visible | ensemble calculé une seule fois (`(select …)`), sortie immédiate si vide, index `properties_client_owner_idx` |
| Politique des annonces publiques : `app.compte_actif(owner_id)` exécutée par ligne | catalogue 184 ms | `not (owner_id = any(app.comptes_inactifs()))` évalué une fois + index partiel des annonces publiées |
| `x = any(participants)` (non indexable) dans les politiques de messagerie | tous les messages parcourus à chaque lecture | `participants @> array[…]` + index GIN ; messages filtrés par la liste des conversations visibles |
| Un bras `OR est_admin()` dans les politiques de lecture empêche toute combinaison d'index | parcours complet de chaque table pour chaque utilisateur | lecture administrateur exprimée par un intervalle sur `owner_id` (indexable) ; résultat identique |
| `public.annuaire()` : relations calculées avec des prédicats non indexables et des fonctions par ligne | ≈ 21 s connecté, 1,3 s anonyme, **à chaque chargement de page** | relations calculées une fois, recherches indexées |
| `app.generer_rappels()` : jointure `OU` sur deux colonnes de `profiles`, deux sous-requêtes corrélées par facture | ≈ 78 s | deux recherches indexées (`lease_id`, GIN `lease_ids`), agrégats calculés une fois |
| Colonnes de clés étrangères et de RLS sans index | suppressions en cascade et filtres par espace en parcours complet | 58 index (docs/INDEX.md) |

## Ce qui reste

* **Rappels quotidiens ≈ 3,5 s** : la première exécution sur ce jeu crée ≈ 50 000 notifications (insertion réelle) ; les suivantes ne créent que les nouvelles. Acceptable pour une tâche quotidienne.
* **Lecture des biens par un compte connecté ≈ 27–33 ms** : la politique « annonces publiées » rend visible tout le catalogue public ; le parcours est normal.
* **Profils** (`profiles`, 34 000 lignes) : parcours complet ≈ 10 ms (politique à plusieurs bras dont un non indexable) ; à revoir si le nombre de comptes croît d'un ordre de grandeur.
* **Volume transféré** : l'interface charge, à la connexion, **toutes** les lignes que la RLS lui donne, dont le catalogue public entier (24 000 annonces publiées dans ce jeu, soit 24 pages de 1 000). C'est la limite principale de l'architecture actuelle à forte croissance ; la piste est une recherche paginée côté serveur pour le catalogue. Non modifiée ici (changement d'architecture de l'interface).
* **Suppression d'un compte** ≈ 130 ms (cascade sur 20 tables) : ponctuel.

## Coût en écriture des index

`cout-ecriture.sql` insère 20 000 lignes dans `rents` et `notifications`, avec puis sans les index ajoutés (index supprimés dans une transaction annulée), deux fois :

| Insertion de 20 000 lignes | sans index (ms) | avec index (ms) |
|---|---|---|
| `rents` (3 index ajoutés) | 834 · 813 | 1 116 · 928 |
| `notifications` (1 index ajouté) | 286 · 348 | 386 · 300 |

Soit, sur `rents`, environ +15 à +35 % (≈ 5 à 14 µs par ligne) ; sur `notifications`, une différence inférieure à la variation entre deux exécutions. Taille de l'ensemble des index `*_idx` / `*_gin` sur ce jeu : ≈ 43 Mo (`notifications_user_date_idx` : 14 Mo).

## Rejouer

```bash
psql -1 -f supabase/tests-local/perf/donnees-synthetiques.sql      # base de TEST
node supabase/tests-local/perf/mesurer.js apres
node supabase/tests-local/perf/verifier-index.js
psql -f supabase/tests-local/perf/cout-ecriture.sql
```

---

# Chargement de l'application (3 novembre 2026)

Mesures **dans un navigateur réel** (Chromium), et non plus requête par requête. Script : `supabase/tests-local/perf/chargement.js`. Résultats bruts : `supabase/tests-local/perf/resultats/chargement-avant.json` et `chargement-apres.json`.

## Méthode

| | |
|---|---|
| **Données** | `donnees-synthetiques.sql` (≈ 1 million de lignes, 30 052 biens dont 24 051 publiés). Pour approcher de vraies annonces, chaque bien publié a reçu une description d'environ 540 caractères et 8 adresses de photos. Les fichiers photo n'existent pas : les images ne sont pas comptées. Les descriptions répétitives se compressent mieux que de vrais textes, donc les octets mesurés sont plutôt **optimistes**. |
| **Serveur** | Réplique locale, passerelle en mode `HEBERGEMENT=1` : compression gzip comme Vercel et Supabase, en-têtes de cache de Vercel avec ETag / 304, règles de `vercel.json`. |
| **Réseau** | « Mobile ralenti » : 1,6 Mbit/s en réception, 750 kbit/s en envoi, 150 ms de latence (émulation Chromium). « Local » : sans limite. |
| **Écran** | 390 × 844. Premier écran : données prêtes et page dessinée (`#app` rempli, plus de squelette). Catalogue complet : toutes les annonces en mémoire. |
| **Statistique** | Après : médiane de 3 passages. Avant : **1 passage**, car chaque passage durait plusieurs minutes et deux redémarrages du conteneur de test ont interrompu la série. |
| **Limites** | Un seul poste, processeur de serveur et non de téléphone : les durées sur un téléphone d'entrée de gamme seront plus longues, dans les deux cas. |

## Résultats

| Scénario | Avant : premier écran | Après : premier écran | Après : catalogue complet | Octets transférés avant → après | Requêtes avant → après |
|---|---:|---:|---:|---:|---:|
| Visiteur, mobile ralenti, accueil | **246,6 s** | **7,8 s** | 10,2 s | 1 270 → 668 Ko | 263 → 157 |
| Visiteur, mobile ralenti, lien direct vers une fiche ancienne | 26,6 s | 7,8 s | 9,9 s | 1 270 → 669 Ko | 258 → 153 |
| Visiteur, visite répétée, mobile ralenti | non mesurable¹ | **1,5 s** | 4,1 s | — → 51 Ko | — → 157, dont 149 depuis le cache |
| Propriétaire (local) | non mesuré² | 7,0 s | — | 65 Ko³ | 199 |
| Agence (local) | non mesuré² | 6,6 s | — | 59 Ko³ | 187 |
| Administrateur (local) | non mesurable⁴ | non mesurable⁴ | — | — | — |

1. L'onglet restait bloqué par le rendu : la navigation suivante n'aboutissait pas en 30 s.
2. Les profils CPU ci-dessous montrent l'effet des corrections sur ces écrans.
3. Le navigateur a déjà les fichiers du site en cache, car la connexion a eu lieu juste avant : les octets sont surtout des données.
4. **Non résolu.** L'administrateur charge toutes les tables (≈ 1 million de lignes avec ce jeu) ; l'écran ne s'affichait pas après 15 minutes, avant comme après. Il faudrait des écrans d'administration paginés côté serveur : lot à part.

## Causes trouvées (profil CPU du navigateur) et corrections

| Constat | Mesure | Correction |
|---|---|---|
| `DB.findItem` recopiait **chaque élément** avant de le tester ; `ownerSubscriptionActive` l'appelait pour chaque annonce (24 051 × jusqu'à 1 000 comptes) | 215 s sur 230 s de chargement de l'accueil visiteur dans ce seul code | le prédicat lit la mémoire, seul le résultat est copié (`js/03-storage.js`) ; `ownerSubscriptionActive` lit sans copie |
| `published()` recopiait tout le catalogue à chaque appel, plusieurs fois par écran ; `listable` relisait toutes les unités et tous les baux pour chaque annonce | 6,5 s sur 14,4 s pour un propriétaire après la 1re correction | résultat gardé tant que biens, unités, baux et comptes n'ont pas changé ; lectures sans copie (`js/14-ai.js`) → 7,0 s |
| L'annuaire public était tronqué par PostgREST à 1 000 lignes | 1 000 renvoyées sur 1 809 propriétaires et agences | lecture par pages |
| Lecture des tables page après page | — | pages lues 4 par 4 en parallèle, tri complété par `id` |
| Le visiteur attendait tout le catalogue avant le premier écran | — | catalogue progressif : 48 annonces, puis le reste en arrière-plan |
| Fichiers du site revalidés à chaque ouverture (service worker en `no-cache`), et vérification des mises à jour sur une centaine de fichiers | 263 requêtes à la première visite | fichiers versionnés en cache un an, service worker adapté, détection par `index.html` seul |

## Ce qui reste

- **Administration** : pagination côté serveur des listes (journaux, loyers, messages, notifications) pour les gros volumes.
- **Visiteur** : une recherche paginée côté serveur éviterait de télécharger tout le catalogue en arrière-plan (10 s sur mobile ralenti avec 24 000 annonces).
- **Code** : 1,4 Mo de JavaScript non minifié, environ 306 Ko après compression brotli. La minification exigerait une étape de construction, qui n'a pas été introduite.
