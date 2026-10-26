# DEUKSIL — Commencer ici

Ce dossier contient **tout** ce qu'il faut pour configurer et mettre en service DEUKSIL sur Supabase.

> **Mise en ligne (Supabase + Gemini, site `https://deuksil.vercel.app`) : `README_SUPABASE_GEMINI.md`.**
>
> **Pour configurer, un seul fichier suffit : `README_CONFIGURATION.md`** — toutes les commandes et tous les réglages, de bout en bout, dans l'ordre. Les documents ci-dessous sont des compléments.

Documents complémentaires :

| Ordre | Document | Pour quoi faire | Durée |
|---|---|---|---|
| 1 | **`00_COMMENCER_ICI.md`** (ce fichier) | savoir quoi ouvrir | 2 min |
| 2 | **`EXPLICATION_DES_DOSSIERS.md`** | comprendre chaque dossier : ce qu'il contient, quand et comment l'utiliser (commandes complètes, fichier `.env`) | 20 min |
| 2 bis | **`GUIDE_EQUIPE_BACKEND.md`** | **les étapes 0 à 14, dans l'ordre**, avec commandes et contrôles | lecture 30 min |
| 3 | **`FICHE_PARAMETRES.md`** | noter chaque réglage (où le trouver, où le mettre, secret ou non) — à remplir pendant le guide | au fil de l'eau |
| 4 | **`tests/RECETTE_MANUELLE_FORMULAIRES.md`** | fiche à cocher (36 points) à l'étape 9 | 15 min |
| 5 | `README_SUPABASE.md` | référence détaillée (le guide y renvoie : « [§3.3] » = section 3.3) | au besoin |
| 6 | `docs/AUDIT_SECURITE.md` · `docs/PERFORMANCES.md` · `docs/INDEX.md` | rapports de sécurité, de performance, justification des index | au besoin |

Le fichier **`DEUKSIL_Dossier_Configuration.pdf`** regroupe ces documents (commencer ici, explication des dossiers, guide, fiche des paramètres, recette) et la checklist finale en un seul PDF à imprimer.

## Le parcours en une ligne

**Projet de test** → réglages → migrations → tâche quotidienne → fonction serveur → site → tests + recette → sauvegarde/restauration d'essai → **projet de production** → checklist → mise en ligne.

## Où se trouve quoi

```
00_COMMENCER_ICI.md              ← vous êtes ici
EXPLICATION_DES_DOSSIERS.md      à quoi sert chaque dossier, comment l'utiliser
GUIDE_EQUIPE_BACKEND.md          étapes 0 à 14
FICHE_PARAMETRES.md              tous les réglages à faire
DEUKSIL_Dossier_Configuration.pdf  les documents ci-dessus en un PDF
README_SUPABASE.md               référence complète
.env.example                     variables à copier en .env (jamais commité)

supabase/
  migrations/      8 scripts SQL de la base            → étape 5
  functions/       fonctions serveur gerer-acces et assistant-ia → étape 7
  templates/       modèles des e-mails                 → étape 4
  config.toml      réglages Supabase                   → étapes 3-4
  outils/          import du jeu de TEST, schéma       → étape 9
  sauvegarde/      sauvegarder.sh, restaurer.sh        → étapes 10 et 14
  outils/          …, vider-projet.sql / vider-fichiers.js / verifier-projet-vide.sql (remise à zéro)
  (tests-local/    dans DEUKSIL_OUTILS_DE_TEST.zip : tests de sécurité, jeu de test, mesures → étapes 9 et 11)

tests/
  RECETTE_MANUELLE_FORMULAIRES.md  fiche à cocher      → étape 9
  (*.js            dans DEUKSIL_OUTILS_DE_TEST.zip : tests navigateur → étape 9)

js/00-config.js    le seul fichier du site à renseigner → étape 8
index.html, css/, js/, img/   le site lui-même
docs/              rapports (sécurité, performances, index)
```

## Trois règles

1. **D'abord un projet de test**, jamais de manipulation directe en production.

2. **Aucun secret** (clé `service_role`, mot de passe de base, secrets Google et SMTP) dans le code, dans Git, dans un message ou dans la fiche des paramètres.

3. **Un contrôle par étape** : on ne passe pas à l'étape suivante tant que le contrôle indiqué n'est pas bon.

## Ce qui n'est pas encore fait

* Recherche des annonces côté serveur (à prévoir avant une forte croissance).

* Validation sur Supabase hébergé : Storage, fonction serveur, `config.toml` et restauration n'ont été testés que sur une réplique locale — les étapes 7, 9 et 10 du guide les valident.

