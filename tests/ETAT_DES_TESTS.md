# État des tests navigateur (22 octobre 2026, version Supabase)

## Suites maintenues — dans `tests/`

| Script | Résultat sur la base de test |
|---|---|
| `formulaires.js` (réécrit pour Supabase) | 27/27 |
| `acces-comptes.js` | 14/14 |
| `sonde-pages.js` | 9 profils, aucune erreur JS ni requête refusée |
| `ecritures-auto.js` | aucune écriture sans action de l'utilisateur |
| `xss-sonde.js` | aucune exécution |

## Scripts des versions précédentes — dans `tests/historique/`

Écrits pour la version de démonstration (données dans le navigateur). Beaucoup lisent **tous les comptes depuis le navigateur d'un visiteur** pour choisir un compte de test, ce que la RLS interdit désormais (comportement voulu). Ils ont été exécutés tels quels contre la base de test ; résultat brut ci-dessous. Ils doivent être adaptés (choisir les comptes dans `supabase/tests-local/comptes-test.json`, `require('../harnais.js')`) avant d'être réutilisés. L'ancien `formulaires.js` (formulaires sans serveur) a été remplacé.

| Script | Code de sortie | Dernière ligne |
|---|---|---|
| `agence-metier.js` | 1 | Node.js v22.22.0 |
| `agent-pratiques.js` | 1 | Node.js v22.22.0 |
| `agent.js` | 1 | Node.js v22.22.0 |
| `anim-diag.js` | 1 | Node.js v22.22.0 |
| `anim-fixes.js` | 0 | pages vérifiées 108 erreurs JS [] |
| `anim-logout.js` | 1 | Node.js v22.22.0 |
| `audit-agence.js` | 0 |         → ERREUR page.evaluate: TypeError: Cannot read properties of null (reading 'id') |
| `audit-boutons.js` | 1 | Node.js v22.22.0 |
| `audit-global.js` | 0 | problèmes 2 variantes icône message 2 |
| `audit-liens.js` | 124 | Node.js v22.22.0 |
| `audit-proprietaire.js` | 0 |         → aucun serveur : toutes les données de tous les comptes sont dans le localStorage du navigateur, lisi |
| `barres-fixes.js` | 1 | Node.js v22.22.0 |
| `bouton-haut.js` | 1 | Node.js v22.22.0 |
| `cartes.js` | 0 | 8/8 |
| `confier-client.js` | 1 | Node.js v22.22.0 |
| `defilement.js` | 1 | Node.js v22.22.0 |
| `demo.js` | 1 | Node.js v22.22.0 |
| `design-montants.js` | 1 | Node.js v22.22.0 |
| `design-tuiles.js` | 0 | sans icône : 0 [] |
| `empreinte.js` | 0 | 52/56 éléments identiques erreurs JS [] |
| `espace-menu.js` | 1 | Node.js v22.22.0 |
| `espace-parcours.js` | 1 | Node.js v22.22.0 |
| `finalisation.js` | 1 | Node.js v22.22.0 |
| `finitions.js` | 1 | Node.js v22.22.0 |
| `groupe-a.js` | 1 | Node.js v22.22.0 |
| `liens-precis.js` | 0 | 25/25 erreurs JS [] |
| `maj-pwa.js` | 1 | Node.js v22.22.0 |
| `mdp-oeil.js` | 1 | 18/20 erreurs JS [] |
| `membres-acces.js` | 0 | membres 0 · accès anormaux : aucun [] |
| `messagerie-acteurs.js` | 1 | Node.js v22.22.0 |
| `recette-p2.js` | 1 | Node.js v22.22.0 |
| `recherche.js` | 1 | Node.js v22.22.0 |
| `regression.js` | 1 | Node.js v22.22.0 |
| `securite.js` | 1 | Node.js v22.22.0 |
| `suggestions.js` | 1 | Node.js v22.22.0 |
| `tableaux.js` | 1 | Node.js v22.22.0 |
| `temoignages-faq.js` | 1 | Node.js v22.22.0 |
| `visiteur.js` | 1 | Node.js v22.22.0 |
