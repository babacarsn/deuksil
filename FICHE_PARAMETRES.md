# Fiche des paramètres de configuration

Tous les réglages à faire, au même endroit : d'où vient chaque valeur, où elle va, et si elle est **secrète**.

* Colonne « Valeur » : remplir **uniquement** les valeurs **publiques** (cette fiche peut circuler dans l'équipe).

* Une valeur **SECRÈTE** ne s'écrit **jamais** ici, ni dans Git, ni dans un message : seulement dans le tableau de bord Supabase, dans `supabase secrets set`, ou dans le fichier `.env` local (ignoré par Git). Noter seulement *où* elle est rangée (ex. « coffre de l'équipe »).

Remplir une fiche pour le projet de **test** et une autre pour la **production**.

Projet : ☐ test ☐ production  Rempli par : ________________  Date : ____ / ____ / ______

---

## A. Projet Supabase (étape 3)

| # | Paramètre | Où le trouver | Où il va | Secret ? | Valeur / emplacement |
|---|---|---|---|---|---|
| A1 | Nom du projet | à choisir (`deuksil-test`, `deuksil-prod`) | Dashboard | non | |
| A2 | Référence du projet (`ref`) | Project Settings → General | `supabase link --project-ref` | non | |
| A3 | Région | choisie à la création | `js/00-config.js` → `editeur.regionDonnees` | non | |
| A4 | URL du projet `https://<ref>.supabase.co` | Project Settings → API | `.env` `SUPABASE_URL`, `js/00-config.js` `supabaseUrl` | non | |
| A5 | Clé **anon / publishable** | Project Settings → API | `.env` `SUPABASE_ANON_KEY`, `js/00-config.js` `supabaseAnonKey` | non (publique par conception) | |
| A6 | Clé **service_role** | Project Settings → API | `.env` local uniquement (outils, tests, sauvegarde) | **SECRÈTE** | rangée : |
| A7 | Mot de passe de la base | choisi à la création | `.env` `DATABASE_URL` | **SECRET** | rangé : |
| A8 | Chaîne de connexion `DATABASE_URL` | Project Settings → Database | `.env` | **SECRÈTE** (contient le mot de passe) | rangée : |

## B. API (étape 4)

| # | Paramètre | Valeur attendue | Où | Fait |
|---|---|---|---|---|
| B1 | Schémas exposés | `public` uniquement | Settings → API / Data API | ☐ |
| B2 | Max rows | `1000` | Settings → API | ☐ |

## C. Authentification (étape 4)

| # | Paramètre | Valeur attendue / à remplir | Où | Secret ? | Fait |
|---|---|---|---|---|---|
| C1 | Site URL | adresse du site : ________________ | Authentication → URL Configuration | non | ☐ |
| C2 | Redirect URLs | `<adresse du site>/**` : ________________ | idem | non | ☐ |
| C3 | Confirmation d'e-mail | activée | Authentication → Providers → Email | non | ☐ |
| C4 | Longueur minimale du mot de passe | 8, lettres + chiffres | Authentication → Policies / Providers | non | ☐ |
| C5 | Durée du code (OTP) | 900 s | Providers → Email | non | ☐ |
| C6 | Inscriptions anonymes | désactivées | Authentication → Settings | non | ☐ |
| C7 | Modèle « Confirm signup » | contenu de `supabase/templates/confirmation.html` ; objet « Confirmez votre adresse DEUKSIL » | Authentication → Email Templates | non | ☐ |
| C8 | Modèle « Reset password » | contenu de `supabase/templates/recovery.html` ; objet « Votre code DEUKSIL » | idem | non | ☐ |

## D. Envoi des e-mails — SMTP (étape 4)

| # | Paramètre | Où le trouver | Où il va | Secret ? | Valeur / emplacement |
|---|---|---|---|---|---|
| D1 | Fournisseur SMTP | à choisir | — | non | |
| D2 | Serveur (host) et port | fournisseur SMTP | Authentication → SMTP Settings | non | |
| D3 | Utilisateur SMTP | fournisseur SMTP | idem | non | |
| D4 | Mot de passe SMTP | fournisseur SMTP | idem | **SECRET** | rangé : |
| D5 | Adresse d'expédition | ex. `noreply@votre-domaine.sn` | idem | non | |
| D6 | Nom d'expéditeur | `DEUKSIL` | idem | non | ☐ |

## E. Connexion Google (facultative)

| # | Paramètre | Où le trouver | Où il va | Secret ? | Valeur / emplacement |
|---|---|---|---|---|---|
| E1 | Activer maintenant ? | décision | — | — | ☐ oui ☐ plus tard |
| E2 | URI de redirection à déclarer chez Google | `https://<ref>.supabase.co/auth/v1/callback` | Google Cloud → Identifiants | non | |
| E3 | ID client OAuth | Google Cloud | Authentication → Providers → Google | non | |
| E4 | Secret client OAuth | Google Cloud | idem | **SECRET** | rangé : |
| E5 | `googleActif` | `true` si activé, sinon `false` | `js/00-config.js` | non | |

## F. Base de données (étapes 5 et 6)

| # | Paramètre | Valeur attendue | Contrôle | Fait |
|---|---|---|---|---|
| F1 | Migrations appliquées | 8 (`supabase db push`) | 32 tables, 0 sans RLS, 166 politiques | ☐ |
| F2 | Extension pg_cron | activée | Integrations → Cron | ☐ |
| F3 | Tâche `deuksil-rappels` | `0 7 * * *` (07:00 UTC = Dakar) | `select * from cron.job;` | ☐ |

## G. Fonction serveur « gerer-acces » (étape 7)

| # | Paramètre | Valeur | Où | Secret ? | Fait |
|---|---|---|---|---|---|
| G1 | Déploiement | `supabase functions deploy gerer-acces` | CLI | — | ☐ |
| G2 | `DEUKSIL_ORIGINES` | adresse(s) du site, séparées par des virgules : ________________ | `supabase secrets set` | non | ☐ |
| G3 | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | **ne rien faire** : fournis automatiquement par Supabase | — | — | — |

## H. Site — `js/00-config.js` (étape 8)

| # | Champ | Valeur | Fait |
|---|---|---|---|
| H1 | `supabaseUrl` | = A4 | ☐ |
| H2 | `supabaseAnonKey` | = A5 (**jamais** la clé service_role) | ☐ |
| H3 | `siteUrl` | = C1 | ☐ |
| H4 | `googleActif` | = E5 | ☐ |
| H5 | `editeur.raisonSociale` | | ☐ |
| H6 | `editeur.formeJuridique` | | ☐ |
| H7 | `editeur.adresse` | | ☐ |
| H8 | `editeur.ninea` | | ☐ |
| H9 | `editeur.rccm` | | ☐ |
| H10 | `editeur.directeurPublication` | | ☐ |
| H11 | `editeur.email` | | ☐ |
| H12 | `editeur.hebergeurSite` | | ☐ |
| H13 | `editeur.regionDonnees` | = A3 | ☐ |
| H14 | CSP `connect-src` (`index.html`) | ajouter le domaine Supabase personnalisé s'il y en a un | ☐ |

## I. Hébergement du site (étape 12)

| # | Paramètre | Valeur | Fait |
|---|---|---|---|
| I1 | Hébergeur / adresse | ________________ | ☐ |
| I2 | HTTPS | obligatoire | ☐ |
| I3 | En-têtes | `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` | ☐ |

## J. Administration (étape 12, production)

| # | Paramètre | Valeur | Fait |
|---|---|---|---|
| J1 | E-mail du premier administrateur | ________________ | ☐ |
| J2 | Rôle `admin` attribué (éditeur SQL) | `update public.profiles set role = 'admin' where email = '…';` | ☐ |
| J3 | Double authentification (MFA) de l'administrateur | activée | ☐ |
| J4 | MFA obligatoire pour les admins | `update app.reglages set valeur = 'oui' where cle = 'admin_mfa_obligatoire';` | ☐ |

## K. Sauvegardes (étapes 10 et 14)

| # | Paramètre | Valeur / décision | Fait |
|---|---|---|---|
| K1 | Offre Supabase et sauvegardes incluses | vérifier Database → Backups : ________________ | ☐ |
| K2 | Fréquence de nos exports (`sauvegarder.sh`) | ☐ chaque jour ☐ chaque semaine | ☐ |
| K3 | Lieu de conservation (chiffré, hors du projet) | ________________ | ☐ |
| K4 | Clé de chiffrement des sauvegardes | **SECRÈTE** — rangée : | ☐ |
| K5 | Restauration d'essai réussie le | ____ / ____ / ______ — durée : ______ | ☐ |

## L. Tests (projet de test uniquement, étape 9)

| # | Paramètre | Valeur | Secret ? |
|---|---|---|---|
| L1 | `APP_URL` (site de test) | | non |
| L2 | `MOT_DE_PASSE_TEST` (comptes du jeu de test) | choisi par l'équipe | à garder dans l'équipe, jamais en production |
| L3 | `DEUKSIL_TEST_AUTORISE` | `1` (projet de test hébergé) | non |
| L4 | Adresses e-mail de recette (A client, B agence) | | non |
