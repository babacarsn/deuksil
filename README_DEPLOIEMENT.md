# DEUKSIL — Déploiement, collaboration et vérifications

Ce document est le mode d'emploi pour l'équipe : **qui fait quoi, dans quel ordre, et comment vérifier que tout marche**. À placer à la racine du dépôt (`README_DEPLOIEMENT.md`), par Pull Request.

Dernière mise à jour : 5 novembre 2026.

---

## 1. Vue d'ensemble

| Lieu | Contient | Se met à jour |
|---|---|---|
| **GitHub**, branche `main` | Le code : site, `supabase/` (migrations, fonctions), documentation | Par Pull Request uniquement |
| **Vercel** | Le site en ligne (`https://deuksil.vercel.app`) | **Automatiquement** à chaque fusion dans `main` |
| **Supabase** (projet `fqrmulupzaqmvjoybela`) | Base de données, fonctions serveur, secrets | **À la main**, par la personne Supabase |

**À retenir : fusionner dans `main` ne déploie PAS Supabase.** La base, les fonctions et les secrets se déploient séparément (voir §6).

**Ce que Vercel publie** : seulement `index.html`, `css/`, `js/`, `img/`, `manifest.webmanifest`, `sw.js`, `vercel.json` (réglé dans `vercel.json` : `buildCommand` + `outputDirectory`). `supabase/`, `docs/`, `tests/`, `outils/` ne sont jamais en ligne.

---

## 2. Règles d'équipe

1. Une seule branche permanente : **`main`** (la version qui marche). Personne n'y pousse directement.
2. Tout changement passe par une branche courte (`site/sujet` ou `backend/sujet`) puis une **Pull Request** vers `main`.
3. Vercel crée une adresse de test pour chaque Pull Request. **On teste avant de fusionner.**
4. Le contrôle automatique GitHub (`.github/workflows/controle.yml`) doit être vert.
5. Après la fusion, la branche est supprimée.
6. Les secrets ne vont **jamais** dans Git (§5).

### Réglages GitHub à activer (propriétaire du dépôt, une fois)
- [ ] Settings → Branches → règle sur `main` : *Require a pull request before merging* et *Require status checks to pass* (choisir le contrôle « Controle »)
- [ ] Settings → General → *Automatically delete head branches*
- [ ] Settings → Actions → autoriser les GitHub Actions
- [ ] Les deux personnes ont le droit d'écriture sur le dépôt

---

## 3. Routine de travail

```bash
git checkout main && git pull
git checkout -b backend/mon-sujet        # ou site/mon-sujet
# ... travail ...
node outils/versionner-site.js            # OBLIGATOIRE après tout changement dans js/ ou css/
git add -A && git commit -m "Description claire"
git push -u origin backend/mon-sujet
# Ouvrir la Pull Request sur GitHub, cocher le modèle, tester l'adresse Vercel, fusionner
```

### Quand le code doit suivre Supabase

| Changement Supabase | À faire dans la **même** Pull Request |
|---|---|
| Colonne ou table ajoutée / retirée / renommée | Migration SQL dans `supabase/migrations/` **+** `DATABASE_URL=… node supabase/outils/generer-schema-front.js` (régénère `js/02c-schema.js`) **+** `node outils/versionner-site.js` |
| Nouveau champ visible à l'écran | Travail du développeur du site (`js/`) |
| Fonction modifiée (`supabase/functions/…`) | Le code de la fonction dans la Pull Request, puis déploiement (§6) |
| Règles de sécurité (RLS), index | Migration SQL seulement |

Règles d'or :
- Une migration déjà appliquée **ne se modifie jamais** : on en ajoute une nouvelle (nom `AAAAMMJJHHMMSS_sujet.sql`).
- On **ajoute** des colonnes avant d'en retirer : retirer ou renommer une colonne casse le site tant que le code n'est pas à jour.
- Ordre de déploiement quand tout change : **base → fonctions → site**. (Le site précédent fonctionne avec une base plus récente ; l'inverse est faux.)
- Tout se teste d'abord sur le projet Supabase de **test**, la production ensuite.

### Conflits fréquents
`js/02c-schema.js`, `index.html` et `sw.js` sont générés. En cas de conflit : garder n'importe quelle version, puis relancer `node supabase/outils/generer-schema-front.js` (pour le schéma) et `node outils/versionner-site.js`.

---

## 4. Vérifications (TOUTES)

### A. Avant d'ouvrir la Pull Request (développeur)
- [ ] `node outils/versionner-site.js --verifier` → doit afficher « empreintes à jour »
- [ ] `for f in js/*.js; do node --check "$f"; done` → aucune erreur (sous Windows : `Get-ChildItem js\*.js | ForEach-Object { node --check $_.FullName }`)
- [ ] Aucun secret dans les fichiers : `git grep -lE "AIza[0-9A-Za-z_-]{20,}|sb_secret_|eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}" -- . ":!.github" ":!README_DEPLOIEMENT.md"` → ne doit rien afficher (le README lui-même est exclu : il contient le motif de recherche)
- [ ] Si la base change : migration ajoutée + `generer-schema-front.js` relancé + appliquée et testée sur le projet de **test**
- [ ] `js/00-config.js` : seule l'adresse du projet et la clé **publique** (jamais `service_role`)

### B. Contrôle automatique GitHub (sur chaque Pull Request)
Il vérifie les empreintes, la syntaxe JavaScript et l'absence de clé secrète. S'il est rouge : lire le message, corriger, pousser de nouveau. **Ne pas fusionner tant qu'il est rouge.**

### C. Sur l'adresse de prévisualisation Vercel (testeur)
- [ ] La page d'accueil s'affiche (pas de page blanche ni de 404) — sinon le réglage Vercel n'a pas pris : ne pas fusionner, lire le journal de construction
- [ ] Ordinateur **et** téléphone
- [ ] Connexion / déconnexion
- [ ] Publier ou ouvrir un bien avec photos
- [ ] Assistant IA : voir §4.F (note sur les adresses de prévisualisation)
- [ ] Aucune erreur rouge dans la console du navigateur (F12)

### D. Juste après la fusion (production)
- [ ] Vercel → Deployments : le dernier déploiement de `main` est « Ready »
- [ ] Ouvrir `https://deuksil.vercel.app`, recharger en vidage de cache (Ctrl+Maj+R) ; sur téléphone, rouvrir l'application installée
- [ ] Connexion avec un compte réel, puis un parcours simple (voir un bien, envoyer un message)
- [ ] Ouvrir `https://deuksil.vercel.app/supabase/config.toml` → doit donner une erreur 404 (preuve que `supabase/` n'est pas publié)
- [ ] Assistant IA (§4.F)

### E. Supabase : base et sécurité (personne Supabase)
À lancer dans SQL Editor (projet de test d'abord, puis production) :

```sql
-- 1. Aucune table sans protection RLS : DOIT renvoyer 0
select count(*) from pg_tables where schemaname = 'public' and not rowsecurity;

-- 2. Nombre de tables et de politiques (référence du guide après les 8 premières migrations : 32 tables, 166 politiques ;
--    les migrations suivantes peuvent augmenter ces nombres : ce qui compte, c'est le point 1)
select count(*) from pg_tables where schemaname = 'public';
select count(*) from pg_policies where schemaname = 'public';

-- 3. Compartiments de fichiers : avatars = public, documents = PRIVÉ, photos = public
select id, public from storage.buckets order by id;

-- 4. Migration des photos appliquée : DOIT renvoyer 1
select count(*) from information_schema.columns
 where table_name = 'properties' and column_name = 'photos_meta';

-- 5. Politiques de stockage DEUKSIL présentes (5 attendues avec la migration photos)
select policyname from pg_policies where tablename = 'objects' and schemaname = 'storage';
```

Réglages du tableau de bord à contrôler :
- [ ] API : schémas exposés = `public` uniquement ; *Max rows* = 1000
- [ ] Authentication : *Site URL* = `https://deuksil.vercel.app` ; *Redirect URLs* contient cette adresse ; confirmation d'e-mail activée ; inscriptions anonymes désactivées
- [ ] E-mails : SMTP personnalisé configuré ; modèles `supabase/templates/confirmation.html` et `recovery.html` collés
- [ ] Une inscription de test reçoit bien un e-mail avec un code à 6 chiffres
- [ ] Sauvegarde récente de la base et des fichiers avant toute migration en production (`supabase/sauvegarde/`, voir `README_SUPABASE.md` §17)

### F. Assistant IA (offre Gemini gratuite)
Le mode actuel est un **assistant général** : il ne lit aucune donnée de l'espace de l'utilisateur et ne propose aucune action. C'est voulu avec l'offre gratuite.

Contrôles côté Supabase :
- [ ] Fonction déployée : Edge Functions → `assistant-ia` apparaît, statut actif
- [ ] Secret `GEMINI_API_KEY` présent (Edge Functions → Secrets)
- [ ] Secret `GEMINI_PAYANT` **absent** (tant que la facturation Gemini n'est pas activée)
- [ ] `GEMINI_URL` **non défini**

Test sur le site (connecté, puis déconnecté) :
- [ ] Question : « Comment publier un bien ? » → réponse en français, sans message d'avertissement sur les données
- [ ] Question : « Quels sont mes loyers impayés ? » → l'assistant explique où consulter l'information (il n'a pas accès aux données)
- [ ] Logs : Edge Functions → `assistant-ia` → Logs : pas d'erreur 4xx/5xx

> **Adresses de prévisualisation Vercel** : si `DEUKSIL_ORIGINES` est réglé sur l'adresse de production uniquement, l'assistant sera refusé depuis une adresse de prévisualisation (autre domaine). Soit on y ajoute temporairement l'adresse de test (liste séparée par des virgules), soit on teste l'assistant après la fusion.

Dépannage :

| Symptôme | Cause probable |
|---|---|
| « Assistant non configuré » (503) | `GEMINI_API_KEY` absente |
| « Assistant indisponible » (502) | Clé Gemini refusée, quota atteint ou service indisponible : voir les logs |
| « Trop de demandes » (429) | Quota gratuit de Gemini ou limite par minute atteinte |
| « Connectez-vous… » (401) | Session expirée ; sinon, ajouter le secret `DEUKSIL_CLE_PUBLIQUE` avec la clé `sb_publishable_…` |
| Aucune réponse du tout | Fonction non déployée sous le nom `assistant-ia`, ou origine refusée (CORS) |

### G. Sécurité (contrôle périodique, une fois par mois)
- [ ] Aucune clé `service_role` ni mot de passe de base dans le dépôt (relancer la commande du §4.A)
- [ ] Dépenses et quotas Gemini : plafond/alerte réglés dans la console Google
- [ ] `DEUKSIL_ORIGINES` règle l'origine autorisée pour les fonctions (voir §5)
- [ ] Liste des personnes ayant accès au dépôt, à Vercel et à Supabase à jour
- [ ] Test de restauration d'une sauvegarde (au moins chaque trimestre)

---

## 5. Secrets et variables

**Aucun de ces secrets ne va dans Git.** Ils se saisissent dans Supabase (Edge Functions → Secrets, ou `supabase secrets set NOM=valeur`) et se gardent dans un gestionnaire de mots de passe partagé.

| Nom | Rôle | Valeur / règle |
|---|---|---|
| `GEMINI_API_KEY` | Clé Gemini de l'assistant | Obligatoire pour l'assistant |
| `GEMINI_PAYANT` | Débloque les fonctions qui envoient des données personnelles à Gemini | **Ne pas créer** en offre gratuite. `oui` seulement si la facturation Gemini est activée |
| `GEMINI_MODEL` | Modèle utilisé | Facultatif (défaut : `gemini-flash-latest`) |
| `GEMINI_URL` | Adresse de l'API Gemini | **Ne pas définir** |
| `DEUKSIL_ORIGINES` | Sites autorisés à appeler les fonctions | Recommandé : `https://deuksil.vercel.app` (plusieurs : séparés par des virgules). Défaut : tous les sites |
| `DEUKSIL_CLE_PUBLIQUE` | Clé publique (`sb_publishable_…`) | Seulement si les connexions échouent en 401 |
| `DEUKSIL_IA_PAR_MINUTE` | Limite d'appels de l'assistant par minute | Facultatif (défaut : 40) |
| `DEUKSIL_CLE_NETTOYAGE` | Protège la fonction de nettoyage des fichiers | 32 caractères aléatoires ou plus |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Fournis automatiquement par Supabase aux fonctions | Ne rien faire |

Ce qui peut être dans le code : l'adresse du projet et la clé **publique** dans `js/00-config.js`.

---

## 6. Déployer Supabase (personne Supabase)

> Modifications des 11 et 12 novembre, étape par étape : **`README_CONFIGURATION_SUPABASE.md`**.

Prérequis : Supabase CLI connectée (`supabase login`), puis dans le dossier du dépôt :

```bash
supabase link --project-ref fqrmulupzaqmvjoybela
```

| Action | Commande |
|---|---|
| Appliquer les migrations | `supabase db push` |
| Déployer l'assistant | `supabase functions deploy assistant-ia --no-verify-jwt` |
| Déployer le nettoyage des fichiers | `supabase functions deploy nettoyer-fichiers --no-verify-jwt` |
| Déployer la gestion des accès | `supabase functions deploy gerer-acces` (**sans** `--no-verify-jwt` : elle exige une connexion, `verify_jwt = true`) |
| Poser un secret | `supabase secrets set NOM=valeur` |
| Voir les secrets (noms seulement) | `supabase secrets list` |

Ordre quand tout change : **1. base → 2. fonctions → 3. site (fusion de la Pull Request)**.

Après chaque déploiement, refaire les contrôles §4.E et §4.F.

---

## 7. Retour arrière

| Problème | Que faire |
|---|---|
| Le site publié est cassé | Vercel → Deployments → choisir le dernier déploiement qui marchait → *Promote to Production* |
| Une fusion pose problème | GitHub → la Pull Request fusionnée → *Revert*, puis fusionner la Pull Request d'annulation |
| Revenir à l'état d'avant le projet complet | Le repère `main-avant-projet-complet` (tag Git) |
| Une migration a échoué | Lire le message ; si elle est déjà passée, corriger **par une nouvelle migration**. Les migrations de `supabase/migrations/` indiquent un retour arrière en commentaire quand il existe |
| Une fonction est défectueuse | Redéployer la version précédente depuis un commit antérieur (`git checkout <commit> -- supabase/functions/...`, puis `supabase functions deploy ...`) |

---

## 8. Responsabilités

| Qui | Fait |
|---|---|
| **Responsable produit** | Décide, teste l'adresse de prévisualisation, valide la fusion |
| **Développeur du site** | `js/`, `css/`, `index.html`, génération des empreintes, relecture des Pull Requests Supabase qui touchent le code |
| **Personne Supabase** | Migrations, fonctions, secrets, réglages Supabase, sauvegardes, déploiements §6 |
| **Tous** | Jamais de secret dans Git ; une Pull Request par sujet ; ne pas fusionner si un contrôle est rouge |

---

## 9. Pour aller plus loin

| Document | Contenu |
|---|---|
| `docs/COLLABORATION.md` | Version courte du fonctionnement à deux |
| `GUIDE_EQUIPE_BACKEND.md` | Mise en service Supabase pas à pas |
| `README_SUPABASE.md` | Référence complète de la configuration Supabase |
| `README_SUPABASE_GEMINI.md` | Réglages Supabase et Gemini, assistant IA |
| `docs/CONTRACT_FRONTEND_BACKEND.md` | Règles des photos entre le site et la base |
| `CHANGELOG.md` | Historique des changements |

### Pour réactiver plus tard l'assistant avec lecture des données
1. Activer la facturation Gemini et fixer un budget d'alerte.
2. Poser le secret `GEMINI_PAYANT=oui` puis redéployer `assistant-ia`.
3. Remettre `iaGestionCoupee = false` dans `js/99h-ia-gestion.js` et `agentCoupe = false` dans `js/99m-ia-agent.js`, ainsi que les consignes d'origine de `aiChatRules` et `iaSuggestions` (historique Git : le commit « assistant IA général »).
4. `node outils/versionner-site.js`, Pull Request, tests §4.F.
