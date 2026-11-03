// Versionne les fichiers du site avant chaque publication : dans index.html, chaque
// js/… et css/… reçoit « ?v=<empreinte du contenu> ». Le navigateur peut alors garder ces
// fichiers en cache un an (vercel.json) : une nouvelle version a une autre adresse, donc
// elle est toujours téléchargée, et une version inchangée ne l'est plus jamais deux fois.
//   node outils/versionner-site.js            → met à jour index.html (et sw.js)
//   node outils/versionner-site.js --verifier → code de sortie 1 si une empreinte est périmée
// Aucune dépendance. À lancer après toute modification d'un fichier js/ ou css/.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const RACINE = path.resolve(process.argv.find(a => a.startsWith('--racine='))?.slice(9) || path.join(__dirname, '..'));
const verifier = process.argv.includes('--verifier');
const index = path.join(RACINE, 'index.html');
const empreinte = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(RACINE, f))).digest('hex').slice(0, 10);

let html = fs.readFileSync(index, 'utf8'), perimes = [], n = 0;
html = html.replace(/(src|href)="((?:js|css)\/[^"?#]+\.(?:js|css))(?:\?v=([0-9a-f]+))?"/g, (m, attr, f, v) => {
  if (!fs.existsSync(path.join(RACINE, f))) throw new Error('fichier absent : ' + f);
  const e = empreinte(f); n++;
  if (v !== e) perimes.push(f);
  return `${attr}="${f}?v=${e}"`;
});
// Le service worker change de version quand l'ensemble change : il est alors réinstallé.
const sw = path.join(RACINE, 'sw.js');
const ensemble = crypto.createHash('sha256').update(html).digest('hex').slice(0, 10);
let swTexte = fs.readFileSync(sw, 'utf8');
const swNouveau = swTexte.replace(/const VERSION = '[^']*';/, `const VERSION = 'deuksil-sw-${ensemble}';`);

if (verifier) {
  const swPerime = swNouveau !== swTexte;
  if (perimes.length || swPerime) {
    console.error(`Empreintes périmées (${perimes.length}) : ${perimes.join(', ') || '—'}${swPerime ? ' ; version du service worker' : ''}`);
    console.error('Lancer : node outils/versionner-site.js'); process.exit(1);
  }
  console.log(`${n} fichiers versionnés, empreintes à jour.`); process.exit(0);
}
fs.writeFileSync(index, html); fs.writeFileSync(sw, swNouveau);
console.log(`${n} fichiers versionnés (${perimes.length} modifiés depuis la dernière fois) ; service worker deuksil-sw-${ensemble}.`);
