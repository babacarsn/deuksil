# DEUKSIL

Plateforme immobilière et logiciel de gestion locative pour le Sénégal : annonces, visites, messagerie, baux et loyers, facturation, documents, espaces propriétaire, agence (avec équipe), locataire, propriétaire mandant, client et administration.

* **Interface** : HTML / CSS / JavaScript sans framework (`index.html`, `css/`, `js/`), application web installable (PWA).
* **Serveur** : [Supabase](https://supabase.com) — authentification, base PostgreSQL protégée par la RLS, stockage des fichiers, une fonction Edge.

## Démarrer

1. Suivre **[README_CONFIGURATION.md](README_CONFIGURATION.md)** : configuration complète, de bout en bout (référence technique détaillée : [README_SUPABASE.md](README_SUPABASE.md)).
2. Renseigner `js/00-config.js` (adresse du projet et clé publique *anon* — jamais la clé `service_role`).
3. Publier les fichiers sur un hébergement HTTPS.

Sans configuration, l'application affiche « Configuration incomplète » : elle ne contient aucune donnée ni aucun compte de démonstration.

## Documents

| | |
|---|---|
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
| [docs/historique/](docs/historique/) | documentation des versions de démonstration (obsolète) |

## Structure

```
index.html, sw.js, manifest.webmanifest
css/                  feuilles de style
js/00-config.js       réglages publics du déploiement
js/03-storage.js      accès aux données (Supabase)
js/NN-*.js            modules de l'interface, chargés dans l'ordre par index.html
js/vendor/            supabase-js (copie locale)
supabase/migrations/  schéma, RLS, fonctions, index (versionnés)
supabase/functions/   fonction Edge « gerer-acces »
supabase/outils/      génération du schéma pour l'interface, import d'un jeu de test
supabase/tests-local/ tests de sécurité, données de test, mesures de performance, réplique locale
supabase/sauvegarde/  sauvegarde et restauration (base + fichiers)
tests/                tests navigateur (Playwright)
```
