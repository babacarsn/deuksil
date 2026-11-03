// =============================================================================
// Fonction Edge « nettoyer-fichiers » — suppression des fichiers devenus inutiles.
//
// La base tient la file des fichiers à supprimer (migration 20261102000100_photos.sql) :
// photo retirée d'une annonce, bien supprimé, photo de profil remplacée, fichiers
// déposés puis jamais enregistrés (après un délai de grâce). Cette fonction les
// supprime par l'API Storage : supprimer des lignes de storage.objects en SQL
// laisserait les fichiers physiques en place.
//
// Appel réservé à la planification (ou à un administrateur technique) : en-tête
// « x-deuksil-cle » égal au secret DEUKSIL_CLE_NETTOYAGE. La clé service_role
// n'existe que dans cette fonction (variable fournie par Supabase).
//
//   { "simulation": true }   → rapport seul, rien n'est écrit ni supprimé
//   { "delai_heures": 24 }   → délai de grâce des fichiers jamais enregistrés
// Chaque fichier est revérifié par la base juste avant sa suppression : un fichier
// de nouveau référencé est conservé.
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CLE = Deno.env.get('DEUKSIL_CLE_NETTOYAGE') || '';
const LOT = 200, LOTS_MAX = 25;

const repondre = (code: number, corps: unknown) =>
  new Response(JSON.stringify(corps), { status: code, headers: { 'Content-Type': 'application/json' } });

// Comparaison à durée constante du secret.
function egal(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return repondre(405, { message: 'Méthode non autorisée.' });
  if (CLE.length < 32) return repondre(503, { message: 'DEUKSIL_CLE_NETTOYAGE absent ou trop court (32 caractères minimum).' });
  if (!egal(req.headers.get('x-deuksil-cle') || '', CLE)) return repondre(401, { message: 'Accès refusé.' });

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* corps vide accepté */ }
  const delai = Math.max(1, Math.min(24 * 30, Number(b.delai_heures) || 24));
  const sb = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  if (b.simulation === true) {
    const { data, error } = await sb.rpc('nettoyage_rapport', { delai_heures: delai });
    if (error) return repondre(500, { message: error.message });
    return repondre(200, { simulation: true, rapport: data });
  }

  const { data: ajoutes, error: e1 } = await sb.rpc('nettoyage_preparer', { delai_heures: delai });
  if (e1) return repondre(500, { message: e1.message });

  let supprimes = 0, echecs = 0;
  for (let n = 0; n < LOTS_MAX; n++) {
    const { data: lot, error: e2 } = await sb.rpc('nettoyage_lot', { limite: LOT });
    if (e2) return repondre(500, { message: e2.message, supprimes, echecs });
    if (!lot || !lot.length) break;
    const faits: number[] = [], rates: { id: number; erreur: string }[] = [];
    const parBucket = new Map<string, { id: number; chemin: string }[]>();
    for (const f of lot as { id: number; bucket: string; chemin: string }[]) {
      if (!parBucket.has(f.bucket)) parBucket.set(f.bucket, []);
      parBucket.get(f.bucket)!.push(f);
    }
    for (const [bucket, liste] of parBucket) {
      // Un fichier déjà absent n'est pas une erreur : remove() ne le renvoie simplement pas.
      const { error } = await sb.storage.from(bucket).remove(liste.map((f) => f.chemin));
      if (error) liste.forEach((f) => rates.push({ id: f.id, erreur: error.message }));
      else liste.forEach((f) => faits.push(f.id));
    }
    const { error: e3 } = await sb.rpc('nettoyage_fin', { faits, echecs: rates });
    if (e3) return repondre(500, { message: e3.message, supprimes, echecs });
    supprimes += faits.length; echecs += rates.length;
    if (lot.length < LOT || rates.length === lot.length) break;
  }
  const { data: rapport } = await sb.rpc('nettoyage_rapport', { delai_heures: delai });
  return repondre(200, { mis_en_file: ajoutes, supprimes, echecs, rapport });
});
