# Tutoriels vidéo de la page Aide

Les vidéos de `videos/guides/` (MP4 + affiche JPG) sont **tournées sur l'application elle-même** : le site est servi en local, Supabase est simulé (`tests/banc/banc.js`, données fictives), et un script joue chaque scénario avec un curseur animé et des sous-titres. Aucune donnée réelle n'est utilisée ni modifiée.

| Fichier | Rôle |
|---|---|
| `js/99q-aide.js` | page `#/aide`, bouton « Aide » dans les menus, catalogue `GUIDES` (titres, étapes écrites, espaces concernés) |
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

Chaque vidéo : 1280×720, 30 images/s, H.264, environ 1 Mo pour une minute. Puis `node outils/versionner-site.js`, commit, et envoi sur `test`.

## Ajouter un tutoriel

1. Ajouter une entrée dans `GUIDES` (`js/99q-aide.js`) : `id`, `pour` (espaces), `titre`, `resume`, `duree`, `etapes`, `lien`.
2. Ajouter le scénario du même `id` dans `SCENES` (`tests/videos/tourner.js`). Gestes disponibles : `clic`, `saisir`, `choisir`, `cocher`, `legende`, `defiler`, `defilerVers`, `aller`, `fermer`, `siPresent`, `affiche` (image de couverture).
3. Le tourner, regarder la vidéo, publier.

Sans vidéo (fichier absent), la page Aide affiche quand même le tutoriel avec ses étapes écrites.
