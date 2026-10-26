// =============================================================================
// Import d'un export JSON du stockage navigateur de l'ancienne version (localStorage)
// dans une base Supabase. Sert à :
//   * remplir une base de TEST ou de DÉVELOPPEMENT avec un jeu de données connu ;
//   * migrer, si nécessaire, les données d'un utilisateur pilote (export de son navigateur).
// NE JAMAIS lancer sur la production avec le jeu de démonstration.
//
// Usage :
//   DATABASE_URL=postgres://postgres:…@db.<ref>.supabase.co:5432/postgres \
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
//   MOT_DE_PASSE=… node supabase/outils/importer-json.js export.json comptes-test.json
// Les comptes sont créés avec MOT_DE_PASSE ; la correspondance CNI → e-mail est
// écrite dans comptes-test.json (pour les tests automatisés).
// =============================================================================
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const {Client} = require('pg');
const {createClient} = require('@supabase/supabase-js');

const [,, source, sortie] = process.argv;
if (!source) { console.error('Usage : node importer-json.js export.json [comptes.json]'); process.exit(1); }
const MDP = process.env.MOT_DE_PASSE;
if (!MDP || MDP.length < 8) { console.error('MOT_DE_PASSE (8 caractères minimum) est requis.'); process.exit(1); }
const S = JSON.parse(fs.readFileSync(path.join(__dirname, '../../js/02c-schema.js'), 'utf8').match(/DEUKSIL_SCHEMA = (\{.*\});/s)[1]);
const TABLE_DE = {users: 'profiles', properties: 'properties', favorites: 'favorites', visits: 'visits', messages: 'conversations',
  notifications: 'notifications', searches: 'saved_searches', activity: 'activity_log', documents: 'documents', leases: 'leases',
  rents: 'rents', tickets: 'tickets', deals: 'deals', docs: 'billing_docs', fpay: 'billing_payments', expenses: 'expenses',
  contracts: 'contracts', providers: 'providers', units: 'units', owners: 'owner_records', mandates: 'mandates', mventes: 'sale_mandates',
  transfers: 'owner_transfers', fees: 'fees', edl: 'inspections', tmsgs: 'lease_messages', demandes: 'client_requests',
  demandes_lien: 'agency_link_requests', reports: 'reports',
  audit: 'audit_log', contacts: 'contact_messages'};
const ORDRE = ['owner_records', 'properties', 'units', 'leases', 'rents', 'lease_messages', 'inspections', 'providers',
  'documents', 'tickets', 'expenses', 'deals', 'billing_docs', 'billing_payments', 'contracts', 'mandates', 'sale_mandates', 'owner_transfers',
  'fees', 'favorites', 'saved_searches', 'visits', 'client_requests', 'conversations', 'notifications', 'agency_link_requests', 'reports',
  'audit_log', 'activity_log', 'contact_messages'];
const IGNORES = new Set(['password', 'pwHash', 'registrationPaid', 'demo', 'demandesDemo', 'plan', 'emailVerifie', 'emailVerifieLe', 'emailVerifiePar', 'dataUrl']);
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const brut = JSON.parse(fs.readFileSync(source, 'utf8'));
const lire = k => { try { const v = typeof brut[k] === 'string' ? JSON.parse(brut[k]) : brut[k]; return Array.isArray(v) ? v : []; } catch (e) { return []; } };
const collections = {};
for (const nom of Object.keys(TABLE_DE)) collections[nom] = lire('deuksil_' + nom);

// Identifiants : ancien identifiant texte → UUID stable (même entrée, même UUID).
const ids = new Map();
const versUuid = v => RE_UUID.test(v) ? v : (() => { const h = crypto.createHash('sha1').update('deuksil:' + v).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${(8 + parseInt(h[16], 16) % 4).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`; })();
for (const L of Object.values(collections)) for (const x of L) if (x && x.id) ids.set(x.id, versUuid(x.id));
const mapId = v => (v && ids.get(v)) || (RE_UUID.test(v || '') ? v : null);

const snake = f => f === 'avatarPhoto' ? 'avatar_url' : f.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
function convertir(t, v, ty) {
  if (ty === 'text!') return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (v === '' || v === undefined || v === null) return null;
  if (ty === 'text') return typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (ty === 'uuid') return mapId(String(v));
  if (ty === 'uuid[]') return (Array.isArray(v) ? v : [v]).map(x => mapId(String(x))).filter(Boolean);
  if (ty === 'text[]') return (Array.isArray(v) ? v : [v]).filter(x => x != null && x !== '').map(String);
  if (ty === 'int') return Number.isFinite(Math.round(+v)) ? Math.round(+v) : null;
  if (ty === 'num') return Number.isFinite(+v) ? +v : null;
  if (ty === 'bool') return !!v;
  if (ty === 'json') return JSON.stringify(v);
  return v;
}
function ligne(t, o) {
  const cols = S[t], r = {}, extra = {};
  for (const [f, v] of Object.entries(o)) {
    if (IGNORES.has(f)) continue;
    const c = snake(f), ty = cols[c];
    if (ty && ty.startsWith('lecture:')) continue;
    if (ty) r[c] = convertir(t, v, ty); else extra[f] = v;
  }
  r.id = mapId(o.id);
  if ('extra' in cols) r.extra = JSON.stringify(extra);
  return r;
}

(async () => {
  const db = new Client({connectionString: process.env.DATABASE_URL}); await db.connect();
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth: {persistSession: false}});
  const comptes = [];

  // 1. Comptes d'authentification (le déclencheur crée chaque profil).
  const emails = new Set();
  for (const u of collections.users) {
    let email = String(u.email || '').trim().toLowerCase();
    // Jeu de test : les adresses sont ramenées au domaine réservé « deuksil.test »
    // (aucune adresse réelle d'un tiers dans une base de test). CONSERVER_EMAILS=1
    // pour la reprise des données d'un utilisateur pilote, avec son accord.
    if (email && process.env.CONSERVER_EMAILS !== '1') email = email.split('@')[0].replace(/[^a-z0-9._-]/g, '') + '@deuksil.test';
    if (!email || emails.has(email)) email = `compte.${(u.cni || u.id).toString().replace(/\W/g, '')}@deuksil.test`;
    emails.add(email);
    const {error} = await sb.auth.admin.createUser({id: mapId(u.id), email, password: MDP, email_confirm: true,
      user_metadata: {first_name: u.firstName || '', last_name: u.lastName || ''}});
    if (error && !/already/i.test(error.message)) { console.error('Compte', u.id, error.message); continue; }
    comptes.push({cni: u.cni || '', email, role: u.role, id: mapId(u.id), ancien: u.id});
  }

  // 2. Données : transaction unique, contrôles de clés étrangères différés à la fin.
  await db.query('begin');
  await db.query("set local session_replication_role = 'replica'");
  const rejets = [];
  const sur = async (quoi, sql, vals) => {   // une ligne refusée (contrainte) n'annule pas tout l'import
    await db.query('savepoint l');
    try { await db.query(sql, vals); await db.query('release savepoint l'); return true; }
    catch (e) { await db.query('rollback to savepoint l'); rejets.push(quoi + ' : ' + e.message); return false; }
  };
  const inserer = async (t, r) => {
    const c = Object.keys(r);
    return sur(t + ' ' + r.id, `insert into public.${t} (${c.map(x => '"' + x + '"').join(',')}) values (${c.map((_, i) => '$' + (i + 1)).join(',')}) on conflict (id) do nothing`, c.map(x => r[x]));
  };
  // Profils : mise à jour des colonnes (le profil existe déjà).
  for (const u of collections.users) {
    const r = ligne('profiles', u); delete r.id;
    r.email = comptes.find(x => x.ancien === u.id)?.email;
    if (!['client', 'owner', 'agency', 'admin', 'tenant', 'manager', 'agent'].includes(r.role)) r.role = 'client';
    if (r.role === 'manager' || r.role === 'agent') { if (!r.parent_id) r.role = 'client'; } else r.parent_id = null;
    if (r.cni && !/^\d{13}$/.test(r.cni)) r.cni = null;
    const c = Object.keys(r);
    await sur('profil ' + u.id, `update public.profiles set ${c.map((x, i) => `"${x}" = $${i + 1}`).join(', ')} where id = $${c.length + 1}`, [...c.map(x => r[x]), mapId(u.id)]);
  }
  let n = 0; const numeros = {};
  for (const t of ORDRE) {
    const nom = Object.keys(TABLE_DE).find(k => TABLE_DE[k] === t), L = collections[nom] || [];
    for (const o of L) {
      if (t === 'conversations') {
        await inserer('conversations', ligne('conversations', {...o, items: undefined}));
        for (const [i, m] of (o.items || []).entries()) {
          await inserer('conversation_messages', {id: versUuid(o.id + ':' + i), conversation_id: mapId(o.id), sender_id: mapId(m.senderId),
            text: m.text || '', created_at: m.at || o.createdAt, read_at: m.read ? (m.at || o.createdAt) : null, extra: '{}'});
        }
      } else if (t === 'documents') {
        const r = ligne('documents', o);
        if (o.dataUrl && o.dataUrl.startsWith('data:')) {
          const chemin = `${r.owner_id}/${r.id}/${String(o.name || 'fichier').replace(/[^\w.-]+/g, '-')}`;
          const [tete, b64] = o.dataUrl.split(','); const mime = (tete.match(/^data:([^;]+)/) || [])[1] || 'application/pdf';
          const {error} = await sb.storage.from('documents').upload(chemin, Buffer.from(b64, 'base64'), {contentType: mime, upsert: true});
          if (error) { console.warn('Fichier', o.name, error.message); continue; }
          r.storage_path = chemin; r.mime = mime;
        } else if (!r.pj_src) { r.pj_src = 'import'; }
        await inserer('documents', r);
      } else {
        const r = ligne(t, o);
        if ('owner_id' in S[t] && !r.owner_id && r.lease_id) r.owner_id = (await db.query('select owner_id from public.leases where id = $1', [r.lease_id])).rows[0]?.owner_id || null;
        if ('owner_id' in S[t] && !r.owner_id && r.property_id) r.owner_id = (await db.query('select owner_id from public.properties where id = $1', [r.property_id])).rows[0]?.owner_id || null;
        /* Les interventions de l'ancienne version recevaient leur numéro à l'affichage :
           sans lui, on le pose ici (les déclencheurs de numérotation sont coupés pendant l'import). */
        if (t === 'tickets' && !r.ref && r.owner_id) {
          numeros[r.owner_id] = (numeros[r.owner_id] || 0) + 1;
          r.ref = `MNT-${new Date().getFullYear()}-${String(numeros[r.owner_id]).padStart(5, '0')}`;
        }
        await inserer(t, r);
      }
      n++;
    }
  }
  // Contrôle d'intégrité : aucune clé étrangère orpheline.
  const fk = await db.query(`select conrelid::regclass t, a.attname c, confrelid::regclass p, af.attname pc
    from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1]
    join pg_attribute af on af.attrelid = k.confrelid and af.attnum = k.confkey[1]
    where k.contype = 'f' and k.connamespace = 'public'::regnamespace`);
  let orphelins = 0;
  for (const f of fk.rows) {
    const r = await db.query(`select count(*)::int n from ${f.t} x where x."${f.c}" is not null and not exists (select 1 from ${f.p} y where y."${f.pc}" = x."${f.c}")`);
    if (r.rows[0].n) {
      console.warn(`Références orphelines ${f.t}.${f.c} → ${f.p} : ${r.rows[0].n} (mises à NULL)`);
      const nullable = (await db.query(`select is_nullable from information_schema.columns where table_schema='public' and table_name=$1 and column_name=$2`, [String(f.t).replace('public.', ''), f.c])).rows[0].is_nullable === 'YES';
      if (nullable) await db.query(`update ${f.t} x set "${f.c}" = null where x."${f.c}" is not null and not exists (select 1 from ${f.p} y where y."${f.pc}" = x."${f.c}")`);
      else { await db.query(`delete from ${f.t} x where not exists (select 1 from ${f.p} y where y."${f.pc}" = x."${f.c}")`); }
      orphelins += r.rows[0].n;
    }
  }
  await db.query('commit');
  await db.query("notify pgrst, 'reload schema'");
  rejets.forEach(r => console.warn('Rejeté —', r));
  console.log(`${comptes.length} comptes, ${n - rejets.length} lignes importées, ${rejets.length} rejetées, ${orphelins} références orphelines corrigées.`);
  if (sortie) fs.writeFileSync(sortie, JSON.stringify(comptes, null, 1));
  await db.end();
})().catch(e => { console.error(e); process.exit(1); });
