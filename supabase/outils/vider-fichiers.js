// DEUKSIL — vide les compartiments Storage (photos, avatars, documents) par l'API Storage.
// IRRÉVERSIBLE : exporter d'abord les fichiers (supabase/sauvegarde/fichiers.js exporter).
//   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… CONFIRMER=oui node supabase/outils/vider-fichiers.js
// La clé service_role est lue dans l'environnement : ne jamais l'écrire dans un fichier.
const {createClient} = require('@supabase/supabase-js');
const URL_SB = process.env.SUPABASE_URL, CLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_SB || !CLE || process.env.CONFIRMER !== 'oui') {
  console.error('Usage : SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… CONFIRMER=oui node supabase/outils/vider-fichiers.js'); process.exit(2);
}
const sb = createClient(URL_SB, CLE, {auth: {persistSession: false, autoRefreshToken: false}});
const COMPARTIMENTS = (process.env.COMPARTIMENTS || 'photos,avatars,documents').split(',');
async function lister(bucket, prefixe = '') {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const {data, error} = await sb.storage.from(bucket).list(prefixe, {limit: 100, offset});
    if (error) throw new Error(`liste ${bucket}/${prefixe} : ${error.message}`);
    for (const x of data) { const p = prefixe ? `${prefixe}/${x.name}` : x.name; if (x.id === null) out.push(...await lister(bucket, p)); else out.push(p); }
    if (data.length < 100) return out;
  }
}
(async () => {
  for (const b of COMPARTIMENTS) {
    const L = await lister(b);
    for (let i = 0; i < L.length; i += 100) { const {error} = await sb.storage.from(b).remove(L.slice(i, i + 100)); if (error) throw new Error(`${b} : ${error.message}`); }
    console.log(`${b} : ${L.length} fichier(s) supprimé(s)`);
  }
})().catch(e => { console.error(e.message); process.exit(1); });
