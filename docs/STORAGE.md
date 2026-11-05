# DEUKSIL — Supabase Storage

État au 2 novembre 2026 (migrations `20261022000600_stockage` et `20261102000100_photos`).

## 1. Compartiments

| Compartiment | Public | Taille max | Types acceptés | Organisation |
|---|---|---|---|---|
| `photos` | oui (URL publique) | 5 Mo | image/jpeg, image/png, image/webp | `<espace>/<bien>/<photo>/<s\|m\|l>.<webp\|jpg>` ; anciens fichiers `<espace>/<bien>/<uuid>.jpg` |
| `avatars` | oui | 2 Mo | image/jpeg, image/png, image/webp | `<utilisateur>/<uuid>.jpg` |
| `documents` | **non** (URL signées 6 h) | 10 Mo | PDF, images, Word, Excel, texte | `<espace>/<document>/<nom>`, `conv/<conversation>/…`, `bail/<bail>/…` |

`<espace>` est le compte titulaire : propriétaire ou agence. Un membre d'équipe dépose dans le dossier de son titulaire.

## 2. Qui peut faire quoi (politiques de `storage.objects`)

Toutes les décisions passent par `app.dossier_autorise(bucket, chemin, ecriture)`, qui lit les droits dans la base. Rien ne vient du navigateur.

| Politique | Opération | Condition |
|---|---|---|
| lecture des fichiers privés | SELECT | `documents` : son espace avec le droit « documents », une conversation dont on est participant, ses baux ; l'administrateur en lecture |
| **lecture de ses photos** (nouvelle) | SELECT | `photos` et `avatars` : son propre dossier (même règle que le dépôt) |
| dépôt | INSERT | règle `dossier_autorise` du compartiment |
| remplacement | UPDATE | `dossier_autorise` **et** fichier non référencé |
| suppression | DELETE | `dossier_autorise` **et** fichier non référencé |

Règle du compartiment `photos` :
1. le 1er dossier est l'espace de l'utilisateur, avec le droit « biens » ;
2. le 2e dossier est un bien de cet espace, ou un identifiant qui n'existe pas encore : bien en cours de création ;
3. un **agent** n'écrit que pour les biens qui lui sont attribués (`agent_id`).

Pourquoi la lecture de ses photos est nécessaire :
- dans PostgreSQL, un DELETE qui lit des colonnes ne voit que les lignes autorisées en lecture ;
- sans cette politique, `remove()` répondait « réussi » sans rien supprimer (constaté sur la réplique) ;
- l'interface dépose toujours avec `x-upsert: false`, car un dépôt avec remplacement exigerait la lecture et le remplacement, ce qui a longtemps bloqué tout envoi de photo.

## 3. Cycle de vie d'une photo

```
sélection ─▶ dépôt des variantes (navigateur, x-upsert: false)
   │             │
   │             ├─ retirée avant enregistrement ─▶ supprimée tout de suite par le navigateur
   │             └─ jamais enregistrée (onglet fermé) ─▶ « orpheline » après 24 h ─▶ file
   ▼
enregistrement du bien (photos + photos_meta, une seule écriture)
   │
   ├─ retirée, remplacée ─▶ déclencheur photos_retirees ─▶ file
   └─ bien ou compte supprimé ─▶ déclencheur photos_retirees ─▶ file
                                            │
                    fonction Edge nettoyer-fichiers (planifiée, clé service)
                    revérifie « encore référencé ? » puis supprime par l'API Storage
```

Photos de profil :
- une photo remplacée, ou le compte supprimé, met l'ancien fichier en file (déclencheur `avatar_retire`) ;
- même traitement ensuite.

Compartiment `documents` : il n'est **pas** concerné par le nettoyage automatique. Ses fichiers sont des pièces justificatives, à ne pas effacer sans règle de conservation décidée par DEUKSIL.

## 4. Nettoyage

| Réglage | Valeur | Où |
|---|---|---|
| Délai de grâce des dépôts jamais enregistrés | 24 h (paramètre `delai_heures`, de 1 à 720) | corps de l'appel |
| Taille d'un lot | 200 fichiers, 25 lots par appel au plus | `supabase/functions/nettoyer-fichiers/index.ts` |
| Nouvelles tentatives d'un fichier | 5 | `public.nettoyage_lot` |
| Fréquence conseillée | toutes les heures | planification (Supabase Cron) |
| Secret | `DEUKSIL_CLE_NETTOYAGE`, 32 caractères au moins | `supabase secrets set` |

Le mode simulation (`{"simulation": true}`) ne modifie rien. Il renvoie :
- le nombre de fichiers en file et en échec ;
- les orphelins candidats ;
- jusqu'à 200 fichiers référencés mais absents (`photos_manquantes`).

Ces derniers ne sont jamais « réparés » automatiquement : à examiner au cas par cas.

## 5. Cache

Les fichiers de photos ont des noms uniques et ne changent jamais. Ils sont déposés avec `cache-control: max-age=31536000` : un navigateur ne les retélécharge pas.

## 6. Points à vérifier sur le projet hébergé

La réplique émule Storage en appliquant les mêmes politiques RLS. Sur le projet Supabase de test, vérifier :
1. un dépôt de photo par un propriétaire ;
2. un refus pour le bien d'un autre ;
3. une suppression d'un fichier non enregistré ;
4. un refus de suppression d'un fichier utilisé.

Les cas S1 à S4 de [TESTS.md](TESTS.md) décrivent la manipulation.
