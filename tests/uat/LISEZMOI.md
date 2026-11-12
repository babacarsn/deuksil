# Recette utilisateur (UAT) — branche `test`

**Adresse de test** (republiée par Vercel à chaque envoi sur la branche `test`) :
https://deuksil-git-test-babacarsns-projects.vercel.app

## Ordre
1. **Personne Supabase** : suivre `README_CONFIGURATION_SUPABASE.md` (à la racine du dépôt) : migrations du 12 novembre, `gerer-acces`, adresse de test autorisée.
2. **Créer les comptes de test** dans l'ordre du fichier `00` : chacun son e-mail et sa CNI (13 chiffres, différente).
3. **Tester** avec les fichiers `01` à `09` (un par type de compte), sur ordinateur ET téléphone, **dans l'ordre des numéros** : les tests sont rangés par étape (01, 02…) et certains préparent les suivants (la CNI avant de publier, le bail avant l'accès du locataire, l'agent créé avant sa connexion). Ordre conseillé des fichiers : 01 → 04 → 05 → 06 → 09 → 03 → 02 → 07 → 08.
4. **Corrections** : l'équipe technique corrige sur la branche `test` (l'adresse de test se met à jour) et remplit la colonne « Réponse équipe technique ».
5. **Publication** : quand l'onglet « Synthèse » de chaque fichier affiche « PRÊT », on fusionne `test` dans `main` (Pull Request) : le site en ligne est mis à jour.

| Fichier | Compte |
|---|---|
| `00_Comptes_de_test.xlsx` | Comptes à créer + prérequis Supabase |
| `01_UAT_Visiteur_Public.xlsx` | Visiteur, inscription, connexion |
| `02_UAT_Client.xlsx` | Client |
| `03_UAT_Locataire.xlsx` | Locataire |
| `04_UAT_Proprietaire.xlsx` | Propriétaire (et son équipe) |
| `05_UAT_Agence.xlsx` | Agence (équipe, mandants, locataires) |
| `06_UAT_Agent.xlsx` | Agent |
| `07_UAT_Administration.xlsx` | Administration |
| `08_UAT_Tous_les_espaces.xlsx` | Menus, comptes, assistant, photos, PDF, sécurité, appareils |
| `09_UAT_Proprietaire_Mandant.xlsx` | Propriétaire mandant (biens confiés à une agence) |

La branche `test` utilise la **même base Supabase** que le site en ligne : nommez les données de test « TEST … » et supprimez-les après.

Pour travailler sur une copie de l'Excel sans conflit Git : copiez le fichier hors du dépôt avant de le remplir (ou un fichier par testeur, ex. `05_UAT_Agence_Kobar.xlsx`).
