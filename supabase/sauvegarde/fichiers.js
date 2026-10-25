// Export / import des fichiers de Supabase Storage (photos, avatars, documents).
// Les fichiers ne sont PAS dans l'export de la base : ce script les copie à part.
//   node fichiers.js exporter <dossier>     (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY du projet SOURCE)
//   node fichiers.js importer <dossier>     (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY du projet CIBLE)
// La clé service_role est lue dans l'environnement : ne jamais l'écrire dans un fichier.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const {createClient} = require('@supabase/supabase-js');
const [, , action, dossier] = process.argv;
const URL_SB = process.env.SUPABASE_URL, CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!['exporter', 'importer'].includes(action) || !dossier || !URL_SB || !CLE) {
  console.error('Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node fichiers.js exporter|importer <dossier>'); process.exit(2);
}
const sb = createClient(URL_SB, CLE, {auth: {persistSession: false, autoRefreshToken: false}});
const COMPARTIMENTS = (process.env.COMPARTIMENTS || 'photos,avatars,documents').split(',');
const racine = path.join(dossier, 'fichiers'), sha = b => crypto.createHash('sha256').update(b).digest('hex');

async function lister(bucket, prefixe = '') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const {data, error} = await sb.storage.from(bucket).list(prefixe, {limit: 100, offset, sortBy: {column: 'name', order: 'asc'}});
    if (error) throw new Error(`liste ${bucket}/${prefixe} : ${error.message}`);
    for (const x of data) {
      const p = prefixe ? `${prefixe}/${x.name}` : x.name;
      if (x.id === null) out.push(...await lister(bucket, p)); else out.push({chemin: p, type: (x.metadata || {}).mimetype || 'application/octet-stream'});
    }
    if (data.length < 100) return out;
  }
}

(async () => {
  if (action === 'exporter') {
    const manifeste = [];
    for (const b of COMPARTIMENTS) {
      const L = await lister(b);
      for (const f of L) {
        const {data, error} = await sb.storage.from(b).download(f.chemin);
        if (error) throw new Error(`téléchargement ${b}/${f.chemin} : ${error.message}`);
        const buf = Buffer.from(await data.arrayBuffer()), cible = path.join(racine, b, f.chemin);
        fs.mkdirSync(path.dirname(cible), {recursive: true}); fs.writeFileSync(cible, buf);
        manifeste.push({compartiment: b, chemin: f.chemin, type: f.type, octets: buf.length, sha256: sha(buf)});
      }
      console.log(`${b} : ${L.length} fichier(s)`);
    }
    fs.mkdirSync(racine, {recursive: true});
    fs.writeFileSync(path.join(racine, 'manifeste.json'), JSON.stringify(manifeste, null, 1));
    console.log(`manifeste : ${manifeste.length} fichier(s)`);
  } else {
    const manifeste = JSON.parse(fs.readFileSync(path.join(racine, 'manifeste.json')));
    let n = 0;
    for (const f of manifeste) {
      const buf = fs.readFileSync(path.join(racine, f.compartiment, f.chemin));
      if (sha(buf) !== f.sha256) throw new Error(`fichier altéré : ${f.compartiment}/${f.chemin}`);
      const {error} = await sb.storage.from(f.compartiment).upload(f.chemin, buf, {contentType: f.type, upsert: true});
      if (error) throw new Error(`dépôt ${f.compartiment}/${f.chemin} : ${error.message}`);
      n++;
    }
    console.log(`${n}/${manifeste.length} fichier(s) restauré(s), empreintes vérifiées`);
  }
})().catch(e => { console.error('ÉCHEC : ' + e.message); process.exit(1); });
