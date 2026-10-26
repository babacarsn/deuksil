/* ==========================================================================
   MODULE : storage.js — accès aux données, enregistrées dans Supabase.

   L'interface garde son contrat historique (DB.getData / addItem / updateItem /
   deleteItem / findItem / filterItems, synchrones) : les écrans lisent une
   copie en mémoire des lignes que la base leur autorise (RLS), et chaque
   écriture est
     1. appliquée tout de suite en mémoire (l'écran se met à jour),
     2. envoyée à Supabase dans la foulée (une file, dans l'ordre),
     3. annulée si Supabase la refuse : la table est relue depuis la base et
        un message explique le refus. La base reste la seule référence.
   Champs → colonnes : ownerId ↔ owner_id (camelCase ↔ snake_case), types
   d'après js/02c-schema.js ; un champ sans colonne va dans « extra » (jsonb).
   Fichiers (data:) : envoyés dans Supabase Storage avant l'écriture de la ligne.
   ========================================================================== */
const SB = (() => {
  const C = typeof DEUKSIL_CONFIG !== 'undefined' ? DEUKSIL_CONFIG : {};
  if (!window.supabase || !C.supabaseUrl || !C.supabaseAnonKey) return null;
  return supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
    auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'deuksil-auth'},
    global: {headers: {'x-client-info': 'deuksil-web'}}
  });
})();

/* Collection de l'interface → table Supabase. Les autres clés restent en mémoire. */
const TABLE_DE = {
  users: 'profiles', properties: 'properties', favorites: 'favorites', visits: 'visits', messages: 'conversations',
  notifications: 'notifications', searches: 'saved_searches', activity: 'activity_log', documents: 'documents',
  leases: 'leases', rents: 'rents', tickets: 'tickets', deals: 'deals', docs: 'billing_docs', fpay: 'billing_payments',
  expenses: 'expenses', contracts: 'contracts', providers: 'providers', units: 'units', owners: 'owner_records',
  mandates: 'mandates', mventes: 'sale_mandates', transfers: 'owner_transfers', fees: 'fees', edl: 'inspections',
  tmsgs: 'lease_messages', demandes: 'client_requests', demandesLien: 'agency_link_requests', reports: 'reports',
  audit: 'audit_log', contacts: 'contact_messages'
};
/* Ordre d'écriture : les tables « parents » avant celles qui les référencent. */
const ORDRE_ECRITURE = ['profiles', 'owner_records', 'properties', 'units', 'leases', 'rents', 'lease_messages',
  'inspections', 'providers', 'documents', 'tickets', 'expenses', 'deals', 'billing_docs', 'billing_payments', 'contracts', 'mandates',
  'sale_mandates', 'owner_transfers', 'fees', 'favorites', 'saved_searches', 'visits', 'client_requests', 'conversations',
  'notifications', 'agency_link_requests', 'reports', 'audit_log', 'activity_log', 'contact_messages'];
/* Champs de l'interface qui ne sont jamais envoyés (secrets, anciens champs locaux, champs calculés). */
const CHAMPS_LOCAUX = new Set(['password', 'pwHash', 'registrationPaid', 'plan', 'emailVerifie', 'emailVerifieLe',
  'emailVerifiePar', 'member', 'perms_', 'dataUrl', '_id', 'fin']);
/* Champs renommés (interface → colonne). */
const SB_ALIAS = {profiles: {avatarPhoto: 'avatar_url'}};
const SB_ALIAS_INV = Object.fromEntries(Object.entries(SB_ALIAS).map(([t, m]) => [t, Object.fromEntries(Object.entries(m).map(([a, b]) => [b, a]))]));

const versColonne = (t, f) => (SB_ALIAS[t] && SB_ALIAS[t][f]) || f.replace(/[A-Z]/g, c => '_' + c.toLowerCase());
const versChamp = (t, c) => (SB_ALIAS_INV[t] && SB_ALIAS_INV[t][c]) || c.replace(/_([a-z0-9])/g, (m, x) => x.toUpperCase());

/* Valeur de l'interface → valeur pour PostgreSQL. */
function versBase(type, v) {
  if (type === 'text!') return v == null ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (v === '' || v === undefined) return null;     // « vide » de l'interface = NULL en base
  if (type === 'text') return typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v);
  switch (type) {
    case 'uuid': return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v)) ? v : null;
    case 'int': { const n = Math.round(+v); return Number.isFinite(n) ? n : null; }
    case 'num': { const n = +v; return Number.isFinite(n) ? n : null; }
    case 'bool': return !!v;
    case 'date': case 'ts': return v === null ? null : String(v);
    case 'uuid[]': return (Array.isArray(v) ? v : [v]).filter(x => versBase('uuid', x));
    case 'text[]': return (Array.isArray(v) ? v : [v]).filter(x => x != null && x !== '').map(String);
    default: return v;
  }
}
/* Ligne PostgreSQL → objet de l'interface. */
function versInterface(t, ligne) {
  const o = {}, S = DEUKSIL_SCHEMA[t] || {};
  for (const [c, v] of Object.entries(ligne)) {
    if (c === 'extra') continue;
    const ty = S[c] || '';
    o[versChamp(t, c)] = v == null ? (/^(text!?|uuid)$/.test(ty) ? '' : /\[\]$/.test(ty) ? [] : null) : v;
  }
  if (ligne.extra && typeof ligne.extra === 'object') for (const [k, v] of Object.entries(ligne.extra)) if (!(k in o)) o[k] = v;
  return o;
}
/* Objet (ou différence) de l'interface → colonnes. */
function versLigne(t, obj, seulement) {
  const S = DEUKSIL_SCHEMA[t] || {}, ligne = {}, extra = {};
  let extraTouche = false;
  for (const [f, v] of Object.entries(obj)) {
    if (CHAMPS_LOCAUX.has(f) || v === undefined) continue;
    const c = versColonne(t, f), ty = S[c];
    if (ty && ty.startsWith('lecture:')) continue;
    if (c === 'created_at' && !v) continue;
    if (c === 'updated_at') continue;
    if (ty) ligne[c] = versBase(ty, v);
    else if ('extra' in S && typeof v !== 'function') { extra[f] = v; extraTouche = true; }
  }
  if (extraTouche || (!seulement && 'extra' in S)) ligne.extra = extra;
  return ligne;
}

/* --- Mémoire locale ----------------------------------------------------------- */
const MEM = {};            // clé DB.K → tableau d'objets
const MEM_JSON = {};       // clé DB.K → copie JSON (getData renvoie une copie, comme avant)
const cleTable = k => { const nom = Object.keys(DB.K).find(n => DB.K[n] === k); return nom && TABLE_DE[nom]; };
const ecrireMem = (k, liste) => { MEM[k] = liste; delete MEM_JSON[k]; };
const lireMem = k => MEM[k] || [];

/* --- File d'écriture ------------------------------------------------------------ */
const FILE = [];           // {op:'insert'|'update'|'delete', k, table, id, avant, apres}
let FLUSH = Promise.resolve(), flushPrevu = false;
function planifier(op) {
  FILE.push(op);
  if (!flushPrevu) { flushPrevu = true; queueMicrotask(() => { flushPrevu = false; FLUSH = FLUSH.then(vider).catch(e => console.error(e)); }); }
}

const MESSAGES_ERREUR = {
  '42501': 'Action non autorisée pour votre compte.', '23505': 'Cet élément existe déjà.',
  '23503': 'Élément lié introuvable : rechargez la page.', '23514': 'Une valeur saisie n\'est pas acceptée.',
  '23502': 'Un champ obligatoire est manquant.', '22P02': 'Une valeur saisie n\'a pas le bon format.', 'PGRST301': 'Votre session a expiré : reconnectez-vous.'
};
function messageErreur(e) {
  if (!e) return 'Erreur inconnue.';
  if (e.code === 'P0001' || (e.code === '42501' && e.message && /[éèàù]/.test(e.message))) return e.message;
  if (/row-level security/i.test(e.message || '')) return MESSAGES_ERREUR['42501'];
  if (/Failed to fetch|NetworkError|network/i.test(e.message || '')) return 'Connexion impossible : la modification n\'a pas été enregistrée. Vérifiez votre connexion.';
  return MESSAGES_ERREUR[e.code] || e.message || 'Enregistrement refusé par le serveur.';
}
let dernierToastErreur = 0;
function signalerErreur(e, contexte) {
  console.warn('[DEUKSIL] écriture refusée', contexte, e);
  DB.erreurs.push({t: Date.now(), contexte, code: e && e.code, message: e && e.message});
  if (Date.now() - dernierToastErreur > 1500 && typeof toast === 'function') { dernierToastErreur = Date.now(); toast(messageErreur(e), 'bad'); }
}

async function vider() {
  if (!FILE.length || !SB) { FILE.length = 0; return; }
  const ops = FILE.splice(0, FILE.length), aRelire = new Set();
  // Regroupe : par table, dans l'ordre des dépendances ; plusieurs changements d'une même ligne n'en font qu'un.
  const parLigne = new Map();
  for (const o of ops) {
    const cle = o.table + ':' + o.id, prec = parLigne.get(cle);
    if (!prec) { parLigne.set(cle, o); continue; }
    if (prec.op === 'insert' && o.op === 'update') prec.apres = o.apres;
    else if (prec.op === 'insert' && o.op === 'delete') parLigne.delete(cle);
    else if (prec.op === 'update' && o.op === 'update') prec.apres = o.apres;
    else parLigne.set(cle, o);
  }
  const liste = [...parLigne.values()].sort((a, b) => (a.op === 'delete') - (b.op === 'delete') ||
    (ORDRE_ECRITURE.indexOf(a.table) - ORDRE_ECRITURE.indexOf(b.table)) * (a.op === 'delete' ? -1 : 1));
  const reessayer = [];
  for (const o of liste) {
    try { await envoyer(o); }
    catch (e) {
      if (e && e.code === '23503' && o.op !== 'delete') { reessayer.push(o); continue; }
      signalerErreur(e, o.table + ' ' + o.op); aRelire.add(o.k);
    }
  }
  for (const o of reessayer) { try { await envoyer(o); } catch (e) { signalerErreur(e, o.table + ' ' + o.op); aRelire.add(o.k); } }
  if (aRelire.size) { await Promise.all([...aRelire].map(k => DB.relire(k))); if (typeof render === 'function' && DB.pret) render(); }
}

/* Tables dont la base attribue le numéro de pièce (déclencheur app.numeroter). */
const NUMEROTEES = ['billing_docs', 'billing_payments', 'expenses', 'tickets', 'contracts', 'mandates', 'sale_mandates', 'owner_transfers', 'fees'];
/* Envoi d'une opération. Les tables à traitement particulier passent par ADAPTATEURS. */
async function envoyer(o) {
  const A = ADAPTATEURS[o.table];
  if (A && A[o.op]) { const fait = await A[o.op](o); if (fait !== false) return; }
  if (o.op === 'insert') {
    const ligne = versLigne(o.table, await preparerFichiers(o.table, o.apres, o.k));
    if (NUMEROTEES.includes(o.table)) {
      // la base attribue le numéro définitif (PREFIXE-AAAA-NNNNN) : on reprend le sien
      const {data, error} = await SB.from(o.table).insert(ligne).select(o.table === 'billing_payments' ? 'ref, rec' : 'ref').maybeSingle(); if (error) throw error;
      const m = data && lireMem(o.k).find(x => x.id === o.id);
      if (m && (m.ref !== data.ref || (data.rec && m.rec !== data.rec))) { m.ref = data.ref; if (data.rec) m.rec = data.rec; delete MEM_JSON[o.k]; if (typeof render === 'function' && DB.pret) render(); }
      return;
    }
    const {error} = await SB.from(o.table).insert(ligne); if (error) throw error;
  } else if (o.op === 'update') {
    const diff = difference(o.avant, o.apres); if (!Object.keys(diff).length) return;
    const apres = await preparerFichiers(o.table, o.apres, o.k), d2 = {};
    for (const f of Object.keys(diff)) d2[f] = apres[f];
    const ligne = versLigne(o.table, d2, true);
    if (ligne.extra) ligne.extra = versLigne(o.table, apres).extra;   // extra est réécrit en entier
    if (!Object.keys(ligne).length) return;
    const {error} = await SB.from(o.table).update(ligne).eq('id', o.id); if (error) throw error;
  } else if (o.op === 'delete') {
    const {error} = await SB.from(o.table).delete().eq('id', o.id); if (error) throw error;
  }
}
function difference(a, b) {
  const d = {}; a = a || {};
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d[k] = b[k];
  return d;
}

/* --- Fichiers : data: → Supabase Storage ------------------------------------------ */
const estDataUrl = v => typeof v === 'string' && v.startsWith('data:');
function dataUrlVersBlob(d) {
  const [tete, b64] = d.split(','), mime = (tete.match(/^data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], {type: mime});
}
const nomPropre = n => String(n || 'fichier').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
async function deposer(bucket, chemin, dataUrl) {
  const blob = dataUrlVersBlob(dataUrl);
  const {error} = await SB.storage.from(bucket).upload(chemin, blob, {contentType: blob.type, upsert: true});
  if (error) { error.code = error.code || '42501'; throw error; }
  return bucket === 'documents' ? 'sb://documents/' + chemin : SB.storage.from(bucket).getPublicUrl(chemin).data.publicUrl;
}
/* Remplace les data: d'un objet par des références de fichiers déposés. */
async function preparerFichiers(table, obj, k) {
  const o = {...obj};
  if (table === 'properties' && Array.isArray(o.photos) && o.photos.some(estDataUrl)) {
    o.photos = await Promise.all(o.photos.map((p, i) => estDataUrl(p) ? deposer('photos', `${o.ownerId}/${o.id}/${uid()}.jpg`, p) : p));
    const m = lireMem(k).find(x => x.id === o.id); if (m) { m.photos = o.photos; delete MEM_JSON[k]; }
  }
  if (table === 'profiles' && estDataUrl(o.avatarPhoto)) {
    o.avatarPhoto = await deposer('avatars', `${o.id}/${uid()}.jpg`, o.avatarPhoto);
    const m = lireMem(k).find(x => x.id === o.id); if (m) { m.avatarPhoto = o.avatarPhoto; delete MEM_JSON[k]; }
  }
  if (table === 'documents' && estDataUrl(obj.dataUrl)) {
    o.storagePath = (await deposer('documents', `${o.ownerId}/${o.id}/${nomPropre(o.name)}`, obj.dataUrl)).replace('sb://documents/', '');
    o.sizeBytes = Math.round(obj.dataUrl.length * 0.75);
  }
  if (table === 'tickets' && estDataUrl(o.photo)) {
    const bail = lireMem(DB.K.leases).find(l => l.propertyId === o.propertyId && (o.tenantId ? true : l.ownerId === o.ownerId));
    o.photo = await deposer('documents', bail ? `bail/${bail.id}/ticket-${o.id}.jpg` : `${o.ownerId}/tickets/${o.id}.jpg`, o.photo);
  }
  if (table === 'lease_messages' && Array.isArray(o.pj)) o.pj = await deposerPieces(o.pj, `bail/${o.leaseId}/${o.id}`);
  return o;
}
async function deposerPieces(pj, dossier) {
  return Promise.all(pj.map(async (a, i) => {
    if (!a || !estDataUrl(a.dataUrl)) { const {dataUrl, ...r} = a || {}; return r; }
    const ref = await deposer('documents', `${dossier}-${i}-${nomPropre(a.name)}`, a.dataUrl);
    const {dataUrl, ...r} = a; return {...r, path: ref.replace('sb://documents/', '')};
  }));
}
/* URL signées (6 h) pour les fichiers privés lus à l'écran. */
async function signer(chemins) {
  const out = {}; const L = [...new Set(chemins.filter(Boolean))];
  for (let i = 0; i < L.length; i += 100) {
    const {data, error} = await SB.storage.from('documents').createSignedUrls(L.slice(i, i + 100), 6 * 3600);
    if (error) { console.warn('[DEUKSIL] URL signées', error); continue; }
    (data || []).forEach(x => { if (x.signedURL || x.signedUrl) out[x.path] = x.signedUrl || x.signedURL; });
  }
  return out;
}

/* --- Tables à traitement particulier ---------------------------------------------- */
const moiId = () => DB.session && DB.session.user ? DB.session.user.id : null;
async function fonction(nom, corps) {
  const {data, error} = await SB.functions.invoke(nom, {body: corps});
  if (error) {
    let msg = error.message; try { const j = await error.context.json(); msg = j.message || msg; } catch (e) {}
    const err = new Error(msg); err.code = 'P0001'; throw err;
  }
  return data;
}
/* Appel d'une fonction serveur (Edge Function) depuis les modules de l'interface. */
const appelerFonction = (nom, corps) => fonction(nom, corps);
const ADAPTATEURS = {
  /* Comptes : création et suppression par la fonction serveur « gerer-acces » ;
     mot de passe par Supabase Auth ; le reste du profil par la table. */
  profiles: {
    async insert(o) {
      const u = o.apres;
      const r = await fonction('gerer-acces', {action: 'creer', id: u.id, email: u.email, password: u.password, role: u.role,
        firstName: u.firstName, lastName: u.lastName, phone: u.phone, cni: u.cni, parentId: u.parentId, perms: u.perms, titre: u.titre,
        leaseId: u.leaseId, leaseIds: u.leaseIds, ownerRef: u.ownerRef, mandantOf: u.mandantOf, ownerRec: u.ownerRec});
      if (r && r.motDePasse && typeof montrerMotDePasseProvisoire === 'function') montrerMotDePasseProvisoire(u, r.motDePasse);
    },
    async update(o) {
      if (typeof o.apres.password === 'string' && o.apres.password && o.apres.password !== (o.avant || {}).password) {
        if (o.id === moiId()) { const {error} = await SB.auth.updateUser({password: o.apres.password}); if (error) { error.code = 'P0001'; throw error; } }
        else await fonction('gerer-acces', {action: 'mot-de-passe', id: o.id, password: o.apres.password});
        const m = lireMem(o.k).find(x => x.id === o.id); if (m) delete m.password;
      }
      return false;   // puis mise à jour normale des autres champs
    },
    async delete(o) { await fonction('gerer-acces', {action: 'supprimer', id: o.id}); }
  },
  /* Notifications vers un autre compte : fonction notifier() (relation vérifiée par la base). */
  notifications: {
    async insert(o) {
      const n = o.apres, moi = moiId(), espace = DB.espaceId();
      if (n.userId === moi || n.userId === espace) return false;
      if (n.userId === 'user_admin' || n.userId === 'admins') {
        const {error} = await SB.rpc('notifier_admins', {texte: n.text, lien: n.link || null}); if (error) throw error;
      } else {
        const {error} = await SB.rpc('notifier', {dest: n.userId, texte: n.text, lien: n.link || null, cle: n.key || null}); if (error) throw error;
      }
      ecrireMem(o.k, lireMem(o.k).filter(x => x.id !== n.id));   // la notification appartient au destinataire
    }
  },
  /* Vues et contacts d'une annonce d'un autre : compteur côté serveur. */
  properties: {
    async update(o) {
      const d = difference(o.avant, o.apres), champs = Object.keys(d);
      if (champs.length && champs.every(c => c === 'views' || c === 'contacts') && o.apres.ownerId !== DB.espaceId()) {
        for (const c of champs) { const {error} = await SB.rpc('compter', {bien: o.id, champ: c}); if (error) throw error; }
        return;
      }
      return false;
    }
  },
  /* Conversations : une ligne par message (conversation_messages). */
  conversations: {
    async insert(o) {
      const c = o.apres, {error} = await SB.from('conversations').insert(versLigne('conversations', {...c, items: undefined}));
      if (error) throw error;
      await envoyerMessages(o.k, c, []);
    },
    async update(o) {
      const d = difference({...o.avant, items: null}, {...o.apres, items: null}); delete d.items;
      if (Object.keys(d).length) { const {error} = await SB.from('conversations').update(versLigne('conversations', d, true)).eq('id', o.id); if (error) throw error; }
      await envoyerMessages(o.k, o.apres, (o.avant || {}).items || []);
    }
  }
};
async function envoyerMessages(k, conv, anciens) {
  const items = conv.items || [], connus = new Map(anciens.filter(m => m._id).map(m => [m._id, m]));
  const nouveaux = items.filter(m => !m._id);
  if (nouveaux.length) {
    const lignes = await Promise.all(nouveaux.map(async m => {
      const id = uid();
      const pj = Array.isArray(m.pj) ? await deposerPieces(m.pj, `conv/${conv.id}/${id}`) : null;
      return {id, conversation_id: conv.id, sender_id: m.senderId, text: m.text || '', pj, created_at: m.at || now(), read_at: m.read ? now() : null};
    }));
    const {error} = await SB.from('conversation_messages').insert(lignes); if (error) throw error;
    // On mémorise l'identifiant de chaque message envoyé.
    const c = lireMem(k).find(x => x.id === conv.id);
    if (c) { let i = 0; c.items.forEach(m => { if (!m._id && lignes[i]) { m._id = lignes[i].id; i++; } }); delete MEM_JSON[k]; }
  }
  const lus = items.filter(m => m._id && m.read && connus.has(m._id) && !connus.get(m._id).read).map(m => m._id);
  if (lus.length) { const {error} = await SB.from('conversation_messages').update({read_at: now()}).in('id', lus); if (error) throw error; }
}

/* --- Lecture ------------------------------------------------------------------------ */
async function toutesLesLignes(table, requete) {
  const PAGE = 1000, out = [];
  for (let de = 0; ; de += PAGE) {
    const {data, error} = await requete().range(de, de + PAGE - 1);
    if (error) throw error;
    out.push(...data); if (data.length < PAGE) break;
  }
  return out;
}
const COLONNES_LUES = t => Object.keys(DEUKSIL_SCHEMA[t] || {}).map(c => c === 'end' || c === 'from' ? `"${c}"` : c).join(',');
const LECTEURS = {
  async profiles(k) {
    const [moi, annu] = await Promise.all([
      moiId() ? toutesLesLignes('profiles', () => SB.from('profiles').select(COLONNES_LUES('profiles')).order('created_at')) : [],
      SB.rpc('annuaire').then(r => { if (r.error) throw r.error; return r.data || []; })
    ]);
    const vus = new Set(moi.map(x => x.id));
    return [...moi, ...annu.filter(x => !vus.has(x.id))].map(r => versInterface('profiles', r));
  },
  async conversations(k) {
    const [convs, msgs] = await Promise.all([
      toutesLesLignes('conversations', () => SB.from('conversations').select(COLONNES_LUES('conversations')).order('created_at')),
      toutesLesLignes('conversation_messages', () => SB.from('conversation_messages').select('id,conversation_id,sender_id,text,pj,read_at,created_at').order('created_at'))
    ]);
    const signes = await signer(msgs.flatMap(m => (m.pj || []).map(a => a.path)));
    const par = {}; msgs.forEach(m => (par[m.conversation_id] = par[m.conversation_id] || []).push({
      _id: m.id, senderId: m.sender_id, text: m.text, at: m.created_at, read: !!m.read_at,
      ...(m.pj ? {pj: m.pj.map(a => ({...a, dataUrl: signes[a.path] || ''}))} : {})}));
    return convs.map(c => ({...versInterface('conversations', c), items: par[c.id] || []}));
  },
  async documents(k) {
    const L = await toutesLesLignes('documents', () => SB.from('documents').select(COLONNES_LUES('documents')).order('created_at'));
    const signes = await signer(L.map(d => d.storage_path));
    return L.map(d => ({...versInterface('documents', d), dataUrl: d.storage_path ? (signes[d.storage_path] || '') : ''}));
  },
  async lease_messages(k) {
    const L = await toutesLesLignes('lease_messages', () => SB.from('lease_messages').select(COLONNES_LUES('lease_messages')).order('created_at'));
    const signes = await signer(L.flatMap(m => (m.pj || []).map(a => a.path)));
    return L.map(m => ({...versInterface('lease_messages', m), ...(m.pj ? {pj: m.pj.map(a => ({...a, dataUrl: signes[a.path] || ''}))} : {})}));
  },
  async tickets(k) {
    const L = await toutesLesLignes('tickets', () => SB.from('tickets').select(COLONNES_LUES('tickets')).order('created_at'));
    const signes = await signer(L.map(t => t.photo && t.photo.startsWith('sb://documents/') ? t.photo.slice(15) : null));
    return L.map(t => ({...versInterface('tickets', t), photo: t.photo && t.photo.startsWith('sb://documents/') ? (signes[t.photo.slice(15)] || '') : (t.photo || '')}));
  }
};
/* Tables lues selon le profil (moins d'appels réseau ; la RLS reste la vraie barrière). */
const TABLES_PUBLIQUES = ['profiles', 'properties'];
const TABLES_CLIENT = ['favorites', 'saved_searches', 'visits', 'conversations', 'notifications', 'leases', 'rents', 'lease_messages',
  'inspections', 'tickets', 'deals', 'billing_docs', 'billing_payments', 'contracts', 'reports', 'agency_link_requests', 'documents',
  'owner_records', 'mandates', 'sale_mandates', 'owner_transfers', 'units', 'expenses'];
function tablesALire(role) {
  if (!moiId()) return TABLES_PUBLIQUES;
  if (['client', 'tenant'].includes(role)) return [...TABLES_PUBLIQUES, ...TABLES_CLIENT];
  return [...TABLES_PUBLIQUES, ...Object.values(TABLE_DE).filter(t => !TABLES_PUBLIQUES.includes(t) && t !== 'contact_messages' && t !== 'activity_log'),
    ...(role === 'admin' ? ['contact_messages', 'activity_log'] : [])];
}
async function lireTable(table) {
  if (LECTEURS[table]) return LECTEURS[table]();
  const ordre = DEUKSIL_SCHEMA[table] && DEUKSIL_SCHEMA[table].created_at ? 'created_at' : 'id';
  const L = await toutesLesLignes(table, () => SB.from(table).select(COLONNES_LUES(table)).order(ordre));
  return L.map(r => versInterface(table, r));
}

/* --- API historique ------------------------------------------------------------------ */
const DB = {
  K: {
    users: 'deuksil_users', properties: 'deuksil_properties', favorites: 'deuksil_favorites', visits: 'deuksil_visits',
    messages: 'deuksil_messages', notifications: 'deuksil_notifications', payments: 'deuksil_payments', subscriptions: 'deuksil_subscriptions',
    agents: 'deuksil_agents', searches: 'deuksil_searches', activity: 'deuksil_activity', documents: 'deuksil_documents',
    session: 'deuksil_current_user', seed: 'deuksil_seed_version', contacts: 'deuksil_contacts', demandesLien: 'deuksil_demandes_lien'
  },
  pret: false, session: null, erreurs: [], lastWriteOk: true,
  getData(k) {
    if (!(k in MEM_JSON)) MEM_JSON[k] = JSON.stringify(lireMem(k));
    return JSON.parse(MEM_JSON[k]);
  },
  setData(k, v) {
    const avant = new Map(lireMem(k).map(x => [x.id, x])), apres = Array.isArray(v) ? v : [];
    const table = cleTable(k);
    ecrireMem(k, JSON.parse(JSON.stringify(apres)));
    if (table) {
      const ids = new Set();
      for (const x of apres) {
        if (!x || !x.id) continue; ids.add(x.id);
        const a = avant.get(x.id);
        if (!a) planifier({op: 'insert', k, table, id: x.id, apres: JSON.parse(JSON.stringify(x))});
        else if (JSON.stringify(a) !== JSON.stringify(x)) planifier({op: 'update', k, table, id: x.id, avant: a, apres: JSON.parse(JSON.stringify(x))});
      }
      for (const [id, a] of avant) if (!ids.has(id)) planifier({op: 'delete', k, table, id, avant: a});
    }
    this.lastWriteOk = true; return true;
  },
  addItem(k, item) {
    item.id = item.id || uid();
    item.createdAt = item.createdAt || now(); item.updatedAt = now();
    const copie = JSON.parse(JSON.stringify(item));
    ecrireMem(k, [...lireMem(k), copie]);
    const table = cleTable(k); if (table) planifier({op: 'insert', k, table, id: item.id, apres: JSON.parse(JSON.stringify(item))});
    this.lastWriteOk = true; return item;
  },
  updateItem(k, id, patch) {
    const L = lireMem(k), i = L.findIndex(x => x.id === id);
    if (i < 0) return null;
    const avant = L[i], apres = {...avant, ...JSON.parse(JSON.stringify(patch)), updatedAt: now()};
    const copie = L.slice(); copie[i] = apres; ecrireMem(k, copie);
    const table = cleTable(k); if (table) planifier({op: 'update', k, table, id, avant, apres: JSON.parse(JSON.stringify(apres))});
    this.lastWriteOk = true; return JSON.parse(JSON.stringify(apres));
  },
  deleteItem(k, id) {
    const avant = lireMem(k).find(x => x.id === id); if (!avant) return;
    ecrireMem(k, lireMem(k).filter(x => x.id !== id));
    const table = cleTable(k); if (table) planifier({op: 'delete', k, table, id, avant});
  },
  findItem(k, fn) { const L = lireMem(k), f = typeof fn === 'function' ? fn : x => x.id === fn; const r = L.find(x => f(JSON.parse(JSON.stringify(x)))); return r ? JSON.parse(JSON.stringify(r)) : null; },
  filterItems(k, fn) { return this.getData(k).filter(fn); },
  reset() { Object.keys(MEM).forEach(k => ecrireMem(k, [])); },

  /* Identifiant de l'espace (compte titulaire) de l'utilisateur connecté. */
  espaceId() { const id = moiId(); if (!id) return null; const p = lireMem(DB.K.users).find(x => x.id === id); return p && p.parentId ? p.parentId : id; },
  /* Attendre que toutes les écritures en cours soient enregistrées. */
  async attendre() { while (FILE.length || flushPrevu) { await new Promise(r => setTimeout(r, 0)); await FLUSH; } await FLUSH; },
  /* Relire une collection depuis la base. */
  async relire(k) {
    const table = cleTable(k); if (!table || !SB) return;
    try { ecrireMem(k, await lireTable(table)); } catch (e) { console.warn('[DEUKSIL] lecture', table, e); }
  },
  /* Charger tout ce que l'utilisateur peut voir. */
  async charger() {
    if (!SB) throw new Error('Supabase non configuré');
    await DB.attendre();
    const {data} = await SB.auth.getSession(); DB.session = data.session;
    const role = DB.session ? ((await SB.from('profiles').select('role').eq('id', DB.session.user.id).maybeSingle()).data || {}).role : null;
    const tables = tablesALire(role);
    const [resultats] = await Promise.all([
      Promise.all(tables.map(t => lireTable(t).then(v => [t, v], e => { console.warn('[DEUKSIL] lecture', t, e); return [t, null]; }))),
      SB.rpc('chiffres_publics').then(r => { if (!r.error && r.data && r.data[0]) DB.chiffres = r.data[0]; }, () => {})
    ]);
    Object.entries(TABLE_DE).forEach(([nom, t]) => { if (!tables.includes(t)) ecrireMem(DB.K[nom], []); });
    for (const [t, v] of resultats) {
      const nom = Object.keys(TABLE_DE).find(n => TABLE_DE[n] === t);
      if (v) ecrireMem(DB.K[nom], v);
      else if (!MEM[DB.K[nom]]) ecrireMem(DB.K[nom], []);
    }
    DB.chargeLe = Date.now();
    return resultats.filter(r => !r[1]).map(r => r[0]);   // tables illisibles (erreur réseau)
  }
};
/* Toutes les collections connues ont une clé (les modules en ajoutent : DB.K.x = DB.K.x || …). */
Object.keys(TABLE_DE).forEach(n => { DB.K[n] = DB.K[n] || 'deuksil_' + n.replace(/[A-Z]/g, c => '_' + c.toLowerCase()); });
