# DEUKSIL — Travailler à deux sur le même projet

## Principe
- `main` = la version qui marche. Vercel la publie ; personne n'y pousse directement.
- Chacun travaille sur sa branche (`backend/sujet`, `site/sujet`), puis ouvre une **Pull Request** vers `main`.
- Vercel crée une adresse de test pour chaque Pull Request. On teste, puis on fusionne.
- Le contrôle automatique GitHub refuse la fusion si les empreintes (`versionner-site.js`), la syntaxe JS ou la détection de secrets échouent.

## Ce que publie Vercel
Seulement `index.html`, `css/`, `js/`, `img/`, `manifest.webmanifest`, `sw.js`, `vercel.json` (réglé dans `vercel.json` : `buildCommand` + `outputDirectory`). `supabase/`, `docs/`, `tests/`, `outils/` ne sont jamais en ligne.

## Fusionner ne déploie pas Supabase
La fusion met à jour le code et le site. La base, les fonctions et les secrets Supabase se déploient à la main, par la personne Supabase :
1. Avant la fusion si le site en a besoin : `supabase db push` (sur le projet de TEST d'abord).
2. Après la fusion : `supabase functions deploy <fonction> --no-verify-jwt` pour une fonction modifiée.
Ordre : base → fonction → site. On AJOUTE des colonnes avant d'en retirer.

## Quand le code doit suivre Supabase
| Changement | À faire dans la même Pull Request |
|---|---|
| Colonne ou table ajoutée / retirée / renommée | migration SQL + `DATABASE_URL=… node supabase/outils/generer-schema-front.js` + `node outils/versionner-site.js` |
| Nouveau champ visible à l'écran | travail du développeur du site |
| Fonction modifiée | le code `supabase/functions/…` dans la Pull Request |

Une migration déjà appliquée ne se modifie jamais : on en ajoute une nouvelle.

## Routine
1. `git checkout main && git pull` puis `git checkout -b backend/mon-sujet`
2. Travail, commits, `git push -u origin backend/mon-sujet`
3. Ouvrir la Pull Request, cocher le modèle, attendre l'adresse de test Vercel
4. Testeur : valider ; fusion (« Squash and merge » ou « Merge »)
5. Personne Supabase : déploiements Supabase éventuels
6. Avant le travail suivant : `git checkout main && git pull`

## Conflits
`js/02c-schema.js`, `index.html` et `sw.js` sont générés. En cas de conflit : garder n'importe quelle version, puis relancer `node supabase/outils/generer-schema-front.js` (pour le schéma) et `node outils/versionner-site.js`.

## Secrets
Jamais dans Git : clé Gemini, `service_role`, mot de passe de base, secrets Google et SMTP. Ils vivent dans Supabase (Secrets) et dans un gestionnaire de mots de passe partagé. `js/00-config.js` ne contient que l'adresse du projet et la clé publique.
