# Tutoriels vidéo de la page Aide

Les vidéos de `videos/guides/` (MP4 + affiche JPG) sont **tournées sur l'application elle-même** : le site est servi en local, Supabase est simulé (`tests/banc/banc.js`, données fictives), et un script joue chaque scénario avec un curseur animé et des sous-titres. Aucune donnée réelle n'est utilisée ni modifiée.

| Fichier | Rôle |
|---|---|
| `js/99q-aide.js` | toujours chargé (≈ 3 Ko) : bouton « Aide » dans les menus, chargement de la page à la demande |
| `js/aide-page.js`, `css/06-aide.css` | chargés **seulement** à la première visite de « Aide » : catalogue `GUIDES` (titres, étapes, espaces), page et lecteur |
| `tests/videos/tourner.js` | les scénarios : un par vidéo (même identifiant que dans `GUIDES`) |
| `tests/videos/studio.js` | le « studio » : curseur, sous-titres, cartons de titre, assemblage ffmpeg |

## Retourner une ou plusieurs vidéos

À faire quand un écran change (un bouton renommé, un formulaire modifié…).

```bash
npm i -g playwright && npx playwright install chromium     # une fois
# ffmpeg doit être installé (ffmpeg -version)
NODE_PATH=$(npm root -g) node tests/videos/tourner.js publier devis-facture   # seulement celles-ci
NODE_PATH=$(npm root -g) node tests/videos/tourner.js                         # toutes (≈ 20 min)
```

Chaque vidéo : 1280×720, 30 images/s, H.264, environ 1 Mo pour une minute ; vignette JPEG de 640 px (≈ 20 Ko). Ensuite : `node outils/versionner-site.js`, commit, et envoi sur `test`.

**Poids pour l'utilisateur** : les autres pages ne chargent que 3 Ko pour l'aide ; la page Aide charge 19 Ko de code et les vignettes de son espace (≈ 200 Ko) ; une vidéo n'est téléchargée que lorsqu'on ouvre son tutoriel.

## Ajouter un tutoriel

1. Ajouter une entrée dans `GUIDES` (`js/aide-page.js`) : `id`, `pour` (espaces), `titre`, `resume`, `duree`, `etapes`, `lien`.
2. Ajouter le scénario du même `id` dans `SCENES` (`tests/videos/tourner.js`). Gestes disponibles : `clic`, `saisir`, `choisir`, `cocher`, `legende`, `defiler`, `defilerVers`, `aller`, `fermer`, `siPresent`, `affiche` (image de couverture).
3. Le tourner, regarder la vidéo, publier.

Sans vidéo (fichier absent), la page Aide affiche quand même le tutoriel avec ses étapes écrites.
