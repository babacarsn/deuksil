# DEUKSIL

Plateforme immobilière et logiciel de gestion locative pour le Sénégal : annonces, visites, messagerie, baux et loyers, facturation, documents, espaces propriétaire, agence (avec équipe), locataire, propriétaire mandant, client et administration.

* **Interface** : HTML / CSS / JavaScript sans framework (`index.html`, `css/`, `js/`), application web installable (PWA).
* **Serveur** : [Supabase](https://supabase.com) — authentification, base PostgreSQL protégée par la RLS, stockage des fichiers, deux fonctions Edge (`gerer-acces`, `assistant-ia`).

## Démarrer

1. Suivre **[README_CONFIGURATION.md](README_CONFIGURATION.md)** : configuration complète, de bout en bout (référence technique détaillée : [README_SUPABASE.md](README_SUPABASE.md)).
2. Renseigner `js/00-config.js` (adresse du projet et clé publique *anon* — jamais la clé `service_role`).
3. Publier les fichiers sur un hébergement HTTPS.

Sans configuration, l'application affiche « Configuration incomplète » : elle ne contient aucune donnée ni aucun compte de démonstration.

## Documents

| | |
|---|---|
| [README_CONFIGURATION_SUPABASE.md](README_CONFIGURATION_SUPABASE.md) | **Supabase : ce qu'il faut configurer pour les modifications des 11 et 12 novembre (migrations, gerer-acces, adresse de test, contrôles)** |
| [README_DEPLOIEMENT.md](README_DEPLOIEMENT.md) | **déploiement, collaboration à deux et toutes les vérifications (à lire en premier pour l'équipe)** |
| [README_SUPABASE_GEMINI.md](README_SUPABASE_GEMINI.md) | **mise en ligne : réglages Supabase et Gemini, assistant IA, premier administrateur** |
| [README_CONFIGURATION.md](README_CONFIGURATION.md) | **configuration complète de bout en bout : le seul fichier nécessaire** |
| [00_COMMENCER_ICI.md](00_COMMENCER_ICI.md) | **point d'entrée : quoi ouvrir, dans quel ordre** |
| [DEUKSIL_Dossier_Configuration.pdf](DEUKSIL_Dossier_Configuration.pdf) | guide + fiche des paramètres + recette + checklist, en un PDF à imprimer |
| [EXPLICATION_DES_DOSSIERS.md](EXPLICATION_DES_DOSSIERS.md) | à quoi sert chaque dossier et comment l'utiliser |
| [FICHE_PARAMETRES.md](FICHE_PARAMETRES.md) | tous les réglages : origine, destination, secret ou non |
| [GUIDE_EQUIPE_BACKEND.md](GUIDE_EQUIPE_BACKEND.md) | **mise en service pas à pas, dans l'ordre** |
| [README_SUPABASE.md](README_SUPABASE.md) | configuration et exploitation Supabase |
| [docs/AUDIT_SECURITE.md](docs/AUDIT_SECURITE.md) | audit de sécurité et tests |
| [docs/INDEX.md](docs/INDEX.md) | justification des index |
| [docs/PERFORMANCES.md](docs/PERFORMANCES.md) | mesures avant / après |
| [docs/ASSISTANT_IA.md](docs/ASSISTANT_IA.md) | assistant de l'espace : lecture des données, actions confirmées, mise en service |
| [docs/IMAGES.md](docs/IMAGES.md) | photos des biens : variantes, envoi, Storage, nettoyage, mise en service |
| [AUDIT_COMPLET.md](AUDIT_COMPLET.md) | audit du 2 novembre 2026 (images, Storage, PostgreSQL, performance) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [FRONTEND](docs/FRONTEND.md) · [BACKEND](docs/BACKEND.md) | architecture et responsabilités des équipes |
| [docs/DATABASE.md](docs/DATABASE.md) · [STORAGE](docs/STORAGE.md) · [SECURITY](docs/SECURITY.md) | base, fichiers, règles de sécurité |
| [docs/CONTRACT_FRONTEND_BACKEND.md](docs/CONTRACT_FRONTEND_BACKEND.md) | contrat technique des photos |
| [docs/TESTS.md](docs/TESTS.md) · [docs/PLAN_DEPLOIEMENT.md](docs/PLAN_DEPLOIEMENT.md) | tests et résultats ; mise en production |
| [DEMO/index.html](DEMO/index.html) | démonstration du système de photos (indépendante, à ouvrir dans un navigateur) |
| [CHANGELOG.md](CHANGELOG.md) | historique des modifications |

## Structure

```
index.html, sw.js, manifest.webmanifest
css/                  feuilles de style
js/00-config.js       réglages publics du déploiement
js/03-storage.js      accès aux données (Supabase)
js/NN-*.js            modules de l'interface, chargés dans l'ordre par index.html
js/vendor/            supabase-js (copie locale)
supabase/migrations/  schéma, RLS, fonctions, index (versionnés)
supabase/functions/   fonctions Edge « gerer-acces », « assistant-ia », « nettoyer-fichiers »
supabase/outils/      génération du schéma pour l'interface, import d'un jeu de test
supabase/tests-local/ tests de sécurité, données de test, mesures de performance, réplique locale
supabase/sauvegarde/  sauvegarde et restauration (base + fichiers)
tests/                tests navigateur (Playwright)
outils/               versionner-site.js : empreintes ?v= avant chaque publication
DEMO/                 démonstration du système de photos (non publiée avec le site)
vercel.json           cache des fichiers versionnés, en-têtes de sécurité
```
