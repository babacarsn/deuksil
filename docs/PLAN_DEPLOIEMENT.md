# DEUKSIL — Plan de déploiement (mise à jour du 2 novembre 2026)

Paquet : `DEUKSIL_MAJ_PHOTOS_PERF.zip` (dossier `MISE_EN_LIGNE/`). Ordre obligatoire : **base, puis fonction de nettoyage, puis site**. Le site précédent fonctionne avec la base mise à jour ; l'inverse n'est pas vrai.

Faire chaque étape d'abord sur un **projet Supabase de test** (copie de la configuration, données fictives), puis en production.

## 0. Avant de commencer

| Vérification | Comment |
|---|---|
| Sauvegarde de la base et des fichiers de production | `supabase/sauvegarde/sauvegarder.sh` (README_SUPABASE.md §17) ; garder le dossier chiffré, hors Git |
| Accès | CLI Supabase connectée au projet (`supabase link`), compte GitHub de publication, accès Vercel |
| Créneau | hors heures de forte activité ; prévoir 30 minutes pour les étapes 1 à 5 |

## 1. Base de données (5 minutes)

```
supabase db push
```

Variante sans CLI : SQL Editor → coller `20261102000100_photos.sql` → Run.

| Contrôle après coup | Attendu |
|---|---|
| `select count(*) from information_schema.columns where table_name = 'properties' and column_name = 'photos_meta';` | 1 |
| `select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage';` | 5 politiques DEUKSIL, dont « lecture de ses photos » |
| Annonces existantes | toujours visibles, photos comprises |

**Retour arrière** : bloc commenté en fin de migration. Aucune donnée d'annonce n'est perdue, seule `photos_meta` disparaît.

## 2. Fonction de nettoyage (10 minutes)

```
supabase secrets set DEUKSIL_CLE_NETTOYAGE=<32 caractères aléatoires ou plus, à garder dans un gestionnaire de mots de passe>
supabase functions deploy nettoyer-fichiers --no-verify-jwt
```

**Simulation** (rien n'est modifié) :

```
curl -X POST https://<projet>.supabase.co/functions/v1/nettoyer-fichiers \
  -H "x-deuksil-cle: <clé>" -H "content-type: application/json" -d '{"simulation": true}'
```

Lire `orphelins_candidats` dans la réponse. Le premier vrai passage supprimera aussi les fichiers devenus inutiles avant cette mise à jour : c'est voulu, et c'est définitif. Ne le lancer qu'après avoir vérifié la sauvegarde de l'étape 0.

**Planification**, une fois la simulation lue : appel horaire, même requête sans `simulation`, via Supabase → Integrations → Cron (pg_cron + pg_net) ou tout planificateur HTTP. Le secret reste côté serveur (Vault).

## 3. Site (5 minutes)

Le site du paquet est **déjà versionné** : `index.html` porte les empreintes `?v=`.

1. Double-cliquer `LANCER_MISE_EN_LIGNE.bat` (branche `main`, Vercel republie).
2. Double-cliquer `LANCER_MISE_A_JOUR_EQUIPE.bat` (projet complet sur `supabase-integration`).

Nouveau fichier publié : `vercel.json` (cache et en-têtes de sécurité). Contrôle :

```
curl -sI https://deuksil.com/ | grep -i "x-frame-options\|strict-transport"
curl -sI "https://deuksil.com/js/03-storage.js?v=<empreinte lue dans index.html>" | grep -i cache-control
```

Attendu : `X-Frame-Options: DENY`, `Strict-Transport-Security`, puis `max-age=31536000, immutable` sur le fichier versionné.

**Règle permanente pour l'équipe** : après toute modification d'un fichier `js/` ou `css/`, lancer `node outils/versionner-site.js` avant de publier. `node outils/versionner-site.js --verifier` échoue si une empreinte est périmée. Sinon, les visiteurs garderaient l'ancien fichier en cache.

## 3 bis. Assistant de l'espace (10 minutes, facultatif)

À faire seulement avec une clé Gemini **à facturation activée**. Sans cette étape, l'assistant garde son fonctionnement actuel. Détail : [ASSISTANT_IA.md](ASSISTANT_IA.md) §3.

```
supabase functions deploy assistant-ia
supabase secrets set GEMINI_PAYANT=oui        # GEMINI_API_KEY déjà en place
```

Recette :

1. Se connecter avec un compte propriétaire de test.
2. Ouvrir l'assistant et demander « Quels loyers sont impayés ? ». Comparer la réponse avec l'écran Gestion → Loyers.
3. Demander une facture, puis vérifier qu'elle n'apparaît qu'après « Confirmer ».
4. Ne pas définir `GEMINI_URL`.

## 4. Recette (15 minutes, téléphone **et** ordinateur)

| # | Action | Attendu |
|---|---|---|
| 1 | Ajouter un bien → étape Photos → choisir 3 photos du téléphone | Barres de progression, puis « Envoyée » |
| 2 | iPhone : photo de la galerie (HEIC) | Acceptée, ou motif clair sous la photo |
| 3 | Étoile sur la 3e photo, puis « Enregistrer le brouillon » | Retour à la liste ; la 3e photo est la couverture |
| 4 | Mes biens → Modifier | Le formulaire s'ouvre (avant : « Cette adresse n'existe pas ») |
| 5 | Retirer une photo, enregistrer, publier, ouvrir la fiche | Toutes les photos ; visionneuse en grand |
| 6 | Changer la photo de profil | Enregistrée |
| 7 | Visiteur, téléphone en 4G : ouvrir deuksil.com | Accueil rapide ; « Rechercher » affiche toutes les annonces |
| 8 | Recharger la page | Presque aucun téléchargement (outils du navigateur → Réseau : fichiers js/css « from cache ») |
| 9 | Simulation de nettoyage | `photos_manquantes` vide ; la photo retirée au point 5 figure dans `file_a_traiter` |

## 5. Surveillance pendant une semaine

- Rapport de nettoyage (simulation), une fois par jour : `file_en_echec` = 0, `photos_manquantes` = [].
- Supabase → Storage : volume en hausse d'environ 180 Ko par photo nouvelle (3 tailles), en baisse au fil des nettoyages.
- Messages d'erreur signalés par les utilisateurs (formulaire de contact).

## 6. Retour arrière du site

Republier le paquet précédent (`DEUKSIL_MAJ_CNI.zip`) avec `LANCER_MISE_EN_LIGNE.bat`. Il fonctionne avec la base migrée. Les photos envoyées entre-temps restent affichées, en taille unique.
