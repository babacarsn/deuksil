# Banc d'essai de l'interface (sans Supabase)

Le site est servi en local et Supabase est **simulé** par Playwright (données de test dans `banc.js` : agence, agent, mandant, locataire, client, propriétaire, administrateur). Rien n'est envoyé au vrai Supabase.

```bash
npm i -g playwright && npx playwright install chromium   # une fois
NODE_PATH=$(npm root -g) node tests/banc/voir.js mandant '#/mandant/releves'
NODE_PATH=$(npm root -g) node tests/banc/voir.js visiteur '#/search' --png recherche --full
NODE_PATH=$(npm root -g) node tests/banc/voir.js agence '#/manage/docs' --js "document.querySelector('[data-action=g2-ok]').click()"
```
Options : `--mobile` (375 px), `--png nom` (capture), `--js "code"` (action dans la page), `--logout403`, `--refresh-ko`, `--sans-bien` (loyers sans bien, comme avant la migration du 22 novembre), `--journal` (appels au faux Supabase).
