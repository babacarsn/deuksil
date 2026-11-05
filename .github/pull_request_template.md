## Ce que cette Pull Request change

## Cocher avant de demander la fusion
- [ ] Testé sur l'adresse de prévisualisation Vercel (téléphone et ordinateur)
- [ ] J'ai lancé `node outils/versionner-site.js` après tout changement dans `js/` ou `css/`
- [ ] Si une colonne ou une table change : migration ajoutée dans `supabase/migrations/` ET `node supabase/outils/generer-schema-front.js` lancé
- [ ] Si la base change : appliquée et testée sur le projet Supabase de TEST
- [ ] Aucun secret (clé, mot de passe) dans les fichiers

## Après la fusion (personne Supabase)
- [ ] `supabase db push` (si migration)
- [ ] `supabase functions deploy <fonction> --no-verify-jwt` (si fonction modifiée)
