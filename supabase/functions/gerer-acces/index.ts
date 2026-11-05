// =============================================================================
// Fonction Edge « gerer-acces » — comptes ouverts par un tiers.
//
// Un propriétaire ou une agence ouvre un accès à son équipe (gestionnaire,
// agent), à un locataire ou à un propriétaire mandant. Créer un compte
// d'authentification exige la clé service_role : elle n'existe QUE dans cette
// fonction (variable d'environnement fournie par Supabase), jamais dans le
// navigateur. Chaque demande est vérifiée ici :
//   * l'appelant est connecté (son jeton est contrôlé par Supabase Auth) ;
//   * il est titulaire actif de son espace ;
//   * le compte demandé lui est bien rattaché (son équipe, ses baux, ses fiches).
// Actions : creer, mot-de-passe (mot de passe provisoire perdu), supprimer
// (un compte rattaché, ou son propre compte).
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL_SB = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ORIGINES = (Deno.env.get('DEUKSIL_ORIGINES') || '*').split(',').map((s) => s.trim());

const PERMS = ['biens', 'visites', 'messages', 'gestion', 'finances', 'documents'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i;

function entetes(req: Request) {
  const o = req.headers.get('origin') || '';
  const permise = ORIGINES.includes('*') ? '*' : (ORIGINES.includes(o) ? o : ORIGINES[0]);
  return { 'Access-Control-Allow-Origin': permise, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
           'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
}
const repondre = (req: Request, code: number, corps: unknown) => new Response(JSON.stringify(corps), { status: code, headers: entetes(req) });
const refus = (req: Request, code: number, message: string) => repondre(req, code, { message });

function motDePasseAleatoire() {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', a = new Uint32Array(12);
  crypto.getRandomValues(a);
  const s = [...a].map((x) => A[x % A.length]).join('');
  return s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8) + '7';
}
const assezFort = (p: unknown) => typeof p === 'string' && p.length >= 8 && /[a-zA-Z]/.test(p) && /\d/.test(p) && !['demo123', 'admin123'].includes(p);
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const uuidOuNull = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: entetes(req) });
  if (req.method !== 'POST') return refus(req, 405, 'Méthode non autorisée.');

  // 1. Qui appelle ? (jeton vérifié par Supabase Auth, pas décodé à la main)
  const jeton = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jeton) return refus(req, 401, 'Connexion requise.');
  const admin = createClient(URL_SB, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: qui, error: errQui } = await admin.auth.getUser(jeton);
  if (errQui || !qui?.user) return refus(req, 401, 'Session invalide ou expirée.');
  const { data: moi } = await admin.from('profiles').select('id, role, status, parent_id').eq('id', qui.user.id).maybeSingle();
  if (!moi || moi.status !== 'actif') return refus(req, 403, 'Compte inactif.');
  const estAdmin = moi.role === 'admin';

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return refus(req, 400, 'Requête illisible.'); }
  const action = b.action;

  // Suppression de SON propre compte (bouton « Supprimer mon compte ») : toutes ses
  // données suivent par les clés étrangères (ON DELETE CASCADE). Un administrateur
  // ne supprime pas son propre compte (il resterait sans administration).
  if (action === 'supprimer' && b.id === moi.id) {
    if (estAdmin) return refus(req, 403, 'Un compte administrateur ne peut pas être supprimé depuis l\'application.');
    const { error } = await admin.auth.admin.deleteUser(moi.id);
    if (error) return refus(req, 400, 'Suppression impossible : ' + error.message);
    return repondre(req, 200, { id: moi.id });
  }

  if (!estAdmin && (moi.parent_id || !['owner', 'agency'].includes(moi.role))) {
    return refus(req, 403, 'Seul le titulaire d\'un compte propriétaire ou agence peut ouvrir des accès.');
  }

  // Le compte visé est-il rattaché à l'appelant ?
  async function compteRattache(id: string) {
    const { data: c } = await admin.from('profiles').select('id, role, parent_id, owner_ref, mandant_of, mdp_provisoire').eq('id', id).maybeSingle();
    if (!c) return null;
    if (c.role === 'admin') return null;
    if (estAdmin || c.parent_id === moi!.id || c.owner_ref === moi!.id || c.mandant_of === moi!.id) return c;
    return null;
  }

  if (action === 'creer') {
    const id = uuidOuNull(b.id) || crypto.randomUUID();
    const email = texte(b.email, 254).toLowerCase();
    if (!EMAIL.test(email)) return refus(req, 400, 'Une adresse e-mail valide est nécessaire pour ouvrir un accès.');
    const role = texte(b.role, 20);
    const meta: Record<string, unknown> = { deuksil_role: role, mdp_provisoire: true, cree_par: moi.id };

    if (role === 'manager' || role === 'agent') {
      if (b.parentId !== moi.id) return refus(req, 403, 'Un membre d\'équipe se rattache à votre propre compte.');
      const perms = Array.isArray(b.perms) ? (b.perms as unknown[]).filter((p) => typeof p === 'string' && PERMS.includes(p)) : [];
      Object.assign(meta, { parent_id: moi.id, perms, titre: texte(b.titre, 80) || null });
    } else if (role === 'tenant' || (role === 'client' && (b.leaseIds || b.leaseId))) {
      const baux = [...new Set([...(Array.isArray(b.leaseIds) ? b.leaseIds : []), b.leaseId].map(uuidOuNull).filter(Boolean))] as string[];
      if (!baux.length) return refus(req, 400, 'Indiquez le bail du locataire.');
      const { data: L } = await admin.from('leases').select('id').in('id', baux).eq('owner_id', moi.id);
      if ((L || []).length !== baux.length) return refus(req, 403, 'Ce bail n\'appartient pas à votre compte.');
      Object.assign(meta, { owner_ref: moi.id, lease_id: baux[0], lease_ids: baux });
    } else if (role === 'owner' && b.ownerRec) {
      if (moi.role !== 'agency' && !estAdmin) return refus(req, 403, 'Seule une agence ouvre un accès à un propriétaire mandant.');
      const fiche = uuidOuNull(b.ownerRec);
      const { data: F } = await admin.from('owner_records').select('id').eq('id', fiche).eq('owner_id', moi.id).maybeSingle();
      if (!F) return refus(req, 403, 'Cette fiche propriétaire n\'appartient pas à votre agence.');
      Object.assign(meta, { mandant_of: moi.id, owner_rec: fiche });
    } else {
      return refus(req, 400, 'Type d\'accès non autorisé.');
    }

    const motDePasse = assezFort(b.password) ? (b.password as string) : motDePasseAleatoire();
    const cni = typeof b.cni === 'string' && /^\d{13}$/.test(b.cni) ? b.cni : undefined;
    const { data: cree, error } = await admin.auth.admin.createUser({
      id, email, password: motDePasse, email_confirm: true,
      user_metadata: { first_name: texte(b.firstName, 80), last_name: texte(b.lastName, 80), phone: texte(b.phone, 30), cni },
      app_metadata: meta,
    });
    if (error) {
      const deja = /already|exists|registered|duplicate/i.test(error.message);
      return refus(req, deja ? 409 : 400, deja ? 'Un compte existe déjà avec cette adresse e-mail ou ce numéro de CNI.' : 'Création du compte impossible : ' + error.message);
    }
    await admin.from('audit_log').insert({ owner_id: moi.id, actor_id: moi.id, who: 'gerer-acces', action: 'Accès créé', detail: `${role} · ${email}` });
    return repondre(req, 200, { id: cree.user!.id, motDePasse });
  }

  if (action === 'mot-de-passe') {
    const c = await compteRattache(String(b.id || ''));
    if (!c) return refus(req, 403, 'Ce compte n\'est pas rattaché au vôtre.');
    if (!c.mdp_provisoire && !estAdmin) return refus(req, 403, 'Cette personne a choisi son mot de passe : elle seule peut le changer (« Mot de passe oublié »).');
    const motDePasse = assezFort(b.password) ? (b.password as string) : motDePasseAleatoire();
    const { error } = await admin.auth.admin.updateUserById(c.id, { password: motDePasse, app_metadata: { mdp_provisoire: true } });
    if (error) return refus(req, 400, 'Changement impossible : ' + error.message);
    await admin.from('profiles').update({ mdp_provisoire: true }).eq('id', c.id);
    return repondre(req, 200, { id: c.id, motDePasse });
  }

  if (action === 'supprimer') {
    const c = await compteRattache(String(b.id || ''));
    if (!c) return refus(req, 403, 'Ce compte n\'est pas rattaché au vôtre.');
    const { error } = await admin.auth.admin.deleteUser(c.id);
    if (error) return refus(req, 400, 'Suppression impossible : ' + error.message);
    await admin.from('audit_log').insert({ owner_id: moi.id, actor_id: moi.id, who: 'gerer-acces', action: 'Accès supprimé', detail: c.id });
    return repondre(req, 200, { id: c.id });
  }

  return refus(req, 400, 'Action inconnue.');
});
