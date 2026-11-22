/* Banc d'essai DEUKSIL : le site servi en local, Supabase simulé par Playwright.
   Usage (module) : const B = require('./banc'); const {page} = await B.ouvrir({qui:'agence', hash:'#/agency/dashboard'}); */
const {chromium} = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const RACINE = process.env.REPO || path.join(__dirname, '../..');

let serveur = null, port = 0;
function demarrerServeur() {
  if (serveur) return Promise.resolve(port);
  const types = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json', '.jpg': 'image/jpeg', '.webp': 'image/webp'};
  serveur = http.createServer((q, r) => {
    let f = decodeURIComponent(q.url.split('?')[0]); if (f === '/') f = '/index.html';
    const p = path.join(RACINE, f);
    if (!p.startsWith(RACINE) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { r.writeHead(404); return r.end('404'); }
    r.writeHead(200, {'Content-Type': types[path.extname(p)] || 'application/octet-stream'}); fs.createReadStream(p).pipe(r);
  });
  return new Promise(ok => serveur.listen(0, () => { port = serveur.address().port; ok(port); }));
}

const ID = {
  agence: 'a0000000-0000-4000-8000-00000000000a', agent: 'a0000000-0000-4000-8000-0000000000a1', mandant: 'a0000000-0000-4000-8000-0000000000a3',
  locataire: 'a0000000-0000-4000-8000-0000000000a4', client: 'a0000000-0000-4000-8000-0000000000c1', proprio: 'a0000000-0000-4000-8000-0000000000b1',
  admin: 'a0000000-0000-4000-8000-0000000000ad', gestionnaire: 'a0000000-0000-4000-8000-0000000000b2',
  fiche: 'f0000000-0000-4000-8000-0000000000f1', p1: 'c0000000-0000-4000-8000-000000000001', p2: 'c0000000-0000-4000-8000-000000000002',
  p3: 'c0000000-0000-4000-8000-000000000003', bail: 'd0000000-0000-4000-8000-000000000001', mandat: 'e0000000-0000-4000-8000-000000000001'
};
const T0 = '2026-09-01T10:00:00Z';
const prof = o => Object.assign({status: 'actif', perms: [], lease_ids: [], mdp_provisoire: false, created_at: T0, updated_at: T0, extra: {}, notif_prefs: {}, regles: {}, doc_info: {}}, o);
const PHOTO = 'img/logo-d-bleu.png';
function donnees() {
  return {
    profiles: [
      prof({id: ID.agence, role: 'agency', first_name: 'Kobar', last_name: 'Baye', email: 'agence@test.sn', phone: '771819518', agency_name: 'innovadev', cni: '1234567899021', ninea: '009876543', rccm: 'SN-DKR-2026-B-123', address: 'Rue 10, Point E, Dakar'}),
      prof({id: ID.agent, role: 'agent', first_name: 'TEST', last_name: 'Agent', email: 'agent@test.sn', phone: '770000001', parent_id: ID.agence, perms: ['biens', 'visites', 'messages'], mdp_provisoire: false}),
      prof({id: ID.mandant, role: 'owner', first_name: 'Ibrahima', last_name: 'Mandant', email: 'mandant@test.sn', phone: '770000003', mandant_of: ID.agence, owner_rec: ID.fiche, mdp_provisoire: false}),
      prof({id: ID.locataire, role: 'tenant', first_name: 'TEST', last_name: 'Locataire', email: 'locataire@test.sn', phone: '770000004', owner_ref: ID.agence, lease_id: ID.bail, lease_ids: [ID.bail]}),
      prof({id: ID.client, role: 'client', first_name: 'Teste', last_name: 'Client', email: 'client@test.sn', phone: '770000005'}),
      prof({id: ID.proprio, role: 'owner', first_name: 'Ibrahima', last_name: 'Proprio', email: 'proprio@test.sn', phone: '770000006', cni: '1111111111112'}),
      prof({id: ID.gestionnaire, role: 'manager', first_name: 'Awa', last_name: 'Gestion', email: 'gestion@test.sn', phone: '770000007', parent_id: ID.proprio, perms: ['finances'], mdp_provisoire: true}),
      prof({id: ID.admin, role: 'admin', first_name: 'Admin', last_name: 'DEUKSIL', email: 'admin@test.sn'})
    ],
    owner_records: [{id: ID.fiche, owner_id: ID.agence, compte_id: ID.mandant, name: 'Ibrahima Mandant', phone: '770000003', email: 'mandant@test.sn', rate: 8, lien: 'accepte', status: 'actif', extra: {}, created_at: T0, updated_at: T0}],
    properties: [
      {id: ID.p1, owner_id: ID.agence, agent_id: ID.agent, client_owner_id: ID.fiche, title: 'TEST F3 Almadies', type: 'appartement', transaction: 'location', price: 350000, region: 'Dakar', city: 'Dakar', commune: 'Ngor', quartier: 'Almadies', surface: 90, rooms: 3, baths: 2, status: 'loue', listing_status: 'publiee', description: 'Bel appartement F3 lumineux, proche de la mer.', amenities: ['Climatisation', 'Gardien'], photos: [PHOTO, PHOTO, PHOTO, PHOTO], views: 0, contacts: 0, verif_level: 'none', published_at: T0, extra: {}, created_at: T0, updated_at: T0},
      {id: ID.p2, owner_id: ID.agence, title: 'TEST UAT Studio Plateau', type: 'studio', transaction: 'location', price: 150000, region: 'Dakar', city: 'Dakar', commune: 'Plateau', quartier: 'Plateau', surface: 30, rooms: 1, baths: 1, status: 'disponible', listing_status: 'publiee', description: 'Studio meublé.', amenities: [], photos: [PHOTO], views: 3, contacts: 0, published_at: T0, extra: {}, created_at: T0, updated_at: T0},
      {id: ID.p3, owner_id: ID.proprio, title: 'Villa TEST Mermoz', type: 'villa', transaction: 'vente', price: 95000000, region: 'Dakar', city: 'Dakar', commune: 'Mermoz', quartier: 'Mermoz', surface: 300, rooms: 0, baths: 0, status: 'disponible', listing_status: 'publiee', description: 'Villa à vendre.', amenities: [], photos: [PHOTO, PHOTO], views: 0, contacts: 0, verif_level: 'none', published_at: T0, extra: {}, created_at: T0, updated_at: T0}
    ],
    leases: [{id: ID.bail, owner_id: ID.agence, property_id: ID.p1, tenant: 'TEST Locataire', phone: '770000004', rent: 350000, deposit: 700000, start: '2026-09-01', months: 12, due_day: 5, status: 'actif', renewals: [], revisions: [], retenues: [], extra: {}, created_at: T0, updated_at: T0}],
    rents: [
      {id: 'r0000000-0000-4000-8000-000000000009', owner_id: ID.agence, lease_id: ID.bail, property_id: null, month: '2026-09', amount: 350000, paid_at: '2026-09-05', method: 'Wave', payments: [{date: '2026-09-05', amount: 350000, method: 'Wave'}], reminders: 0, extra: {}, created_at: T0, updated_at: T0},
      {id: 'r0000000-0000-4000-8000-000000000010', owner_id: ID.agence, lease_id: ID.bail, property_id: null, month: '2026-10', amount: 350000, paid_at: null, payments: [{date: '2026-11-03', amount: 150000, method: 'Espèces'}], reminders: 0, extra: {}, created_at: T0, updated_at: T0},
      {id: 'r0000000-0000-4000-8000-000000000011', owner_id: ID.agence, lease_id: ID.bail, property_id: null, month: '2026-11', amount: 350000, paid_at: null, payments: [], reminders: 0, extra: {}, created_at: T0, updated_at: T0}
    ],
    expenses: [{id: 'x0000000-0000-4000-8000-000000000001', owner_id: ID.agence, property_id: ID.p1, ref: 'DEP-2026-00001', supplier: 'Plombier', cat: 'réparation', method: 'Espèces', amount: 70000, date: '2026-11-02', extra: {}, created_at: T0, updated_at: T0}],
    mandates: [{id: ID.mandat, owner_id: ID.agence, owner_id2: ID.fiche, ref: 'MDT-2026-00001', rate: 10, start: '2026-09-01', end: '2027-08-31', properties: [ID.p1], services: ['Encaissement des loyers'], status: 'actif', extra: {}, created_at: T0, updated_at: T0}],
    billing_docs: [{id: 'b0000000-0000-4000-8000-000000000001', owner_id: ID.agence, type: 'DEV', ref: 'DEV-2026-00001', client: 'Client Tiers', property_id: null, items: [{label: 'Honoraires', qty: 1, price: 67500}], discount: 0, tax: 18, status: 'envoyé', due: '2026-12-31', extra: {}, created_at: T0, updated_at: T0}],
    contact_messages: [], favorites: [], saved_searches: [], visits: [], conversations: [], notifications: [], lease_messages: [], inspections: [], tickets: [],
    deals: [], billing_payments: [], contracts: [], reports: [], agency_link_requests: [], documents: [], sale_mandates: [], owner_transfers: [], units: [],
    fees: [], providers: [], client_requests: [], audit_log: [], activity_log: [], conversation_messages: []
  };
}
/* Ce que la RLS laisse voir (approximation suffisante pour l'interface). */
function visible(D, table, uid, options) {
  const L = D[table] || [];
  if (!uid) return table === 'properties' ? L.filter(p => p.listing_status === 'publiee') : table === 'profiles' ? [] : [];
  const moi = D.profiles.find(p => p.id === uid) || {}, esp = moi.parent_id || uid;
  if (moi.role === 'admin') return L;
  if (table === 'profiles') return L.filter(p => [uid, esp].includes(p.id) || [p.parent_id, p.owner_ref, p.mandant_of].includes(esp));
  if (table === 'properties') return L.filter(p => p.listing_status === 'publiee' || p.owner_id === esp || (moi.owner_rec && p.client_owner_id === moi.owner_rec) || (moi.lease_ids || []).some(b => (D.leases.find(l => l.id === b) || {}).property_id === p.id));
  if (moi.role === 'tenant') {
    if (table === 'leases') return L.filter(l => (moi.lease_ids || []).includes(l.id));
    if (table === 'rents') return L.filter(r => (moi.lease_ids || []).includes(r.lease_id));
    return L.filter(x => x.user_id === uid || x.tenant_id === uid || (x.lease_id && (moi.lease_ids || []).includes(x.lease_id)));
  }
  if (moi.owner_rec) {
    const biens = D.properties.filter(p => p.client_owner_id === moi.owner_rec).map(p => p.id);
    if (table === 'owner_records') return L.filter(o => o.compte_id === uid);
    if (['mandates', 'owner_transfers', 'sale_mandates'].includes(table)) return L.filter(m => m.owner_id2 === moi.owner_rec);
    if (table === 'rents' && options.rentsSansBien) return L.filter(r => biens.includes(r.property_id));
    if (table === 'rents') return L.filter(r => biens.includes(r.property_id || (D.leases.find(l => l.id === r.lease_id) || {}).property_id));
    if (['leases', 'expenses', 'billing_docs', 'units'].includes(table)) return L.filter(x => biens.includes(x.property_id));
  }
  return L.filter(x => x.owner_id === esp || x.user_id === uid || (x.participants || []).includes(uid));
}
function jwt(uid) {
  const b = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b({alg: 'HS256', typ: 'JWT'})}.${b({sub: uid, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 36000, aal: 'aal1'})}.c2ln`;
}
function filtrer(rows, sp) {
  for (const [k, v] of sp.entries()) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const m = /^(eq|neq|in|is)\.(.*)$/.exec(v); if (!m) continue;
    if (m[1] === 'eq') rows = rows.filter(r => String(r[k]) === m[2]);
    if (m[1] === 'neq') rows = rows.filter(r => String(r[k]) !== m[2]);
    if (m[1] === 'in') { const s = m[2].replace(/^\(|\)$/g, '').split(',').map(x => x.replace(/"/g, '')); rows = rows.filter(r => s.includes(String(r[k]))); }
    if (m[1] === 'is') rows = rows.filter(r => m[2] === 'null' ? r[k] == null : true);
  }
  return rows;
}
async function ouvrir(o = {}) {
  await demarrerServeur();
  const D = o.donnees || donnees(); if (o.preparer) o.preparer(D, ID);
  const uid = o.qui ? ID[o.qui] : null;
  const journal = [], fonctions = o.fonctions || {};
  const navig = o.navigateur || await chromium.launch();
  const ctx = await navig.newContext({viewport: o.mobile ? {width: 375, height: 760} : {width: 1360, height: 900}, deviceScaleFactor: 1, serviceWorkers: 'block'});
  if (uid) {
    const u = D.profiles.find(p => p.id === uid);
    const session = {access_token: jwt(uid), refresh_token: 'rt-' + uid, token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000,
      user: {id: uid, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: {}, user_metadata: {}, created_at: T0}};
    await ctx.addInitScript(s => { try { localStorage.setItem('deuksil-auth', s); } catch (e) {} }, JSON.stringify(session));
  }
  await ctx.route(/supabase\.co\//, async route => {
    const req = route.request(), url = new URL(req.url()), p = url.pathname, meth = req.method();
    const corps = () => { try { return JSON.parse(req.postData() || 'null'); } catch (e) { return null; } };
    const rep = (status, body, h = {}) => route.fulfill({status, contentType: 'application/json', headers: {'access-control-allow-origin': '*', ...h}, body: body === undefined ? '' : JSON.stringify(body)});
    journal.push(`${meth} ${p}${url.search ? '?' + decodeURIComponent(url.search).slice(1, 140) : ''}`);
    if (meth === 'OPTIONS') return route.fulfill({status: 200, headers: {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}});
    if (p.startsWith('/auth/v1/')) {
      if (p.endsWith('/logout')) return o.logout403 ? rep(403, {code: 403, msg: 'Session not found', error_code: 'session_not_found'}) : rep(204);
      if (p.endsWith('/user')) return rep(200, {id: uid, aud: 'authenticated', email: 'x@test.sn', app_metadata: {}, user_metadata: {}});
      if (p.endsWith('/token')) return o.refreshKo ? rep(400, {error: 'invalid_grant', error_description: 'Invalid Refresh Token'}) : rep(200, {access_token: jwt(uid), refresh_token: 'rt2', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: {id: uid}});
      if (p.endsWith('/signup')) { const b = corps() || {}; const deja = D.profiles.some(x => x.email === b.email); return rep(200, deja ? {id: 'f1f1f1f1-0000-4000-8000-000000000000', aud: 'authenticated', email: b.email, identities: [], user_metadata: {}} : {id: 'f2f2f2f2-0000-4000-8000-000000000000', email: b.email, identities: [{id: 'i'}], user_metadata: {}}); }
      return rep(200, {});
    }
    if (p.startsWith('/functions/v1/')) {
      const nom = p.split('/').pop(), f = fonctions[nom];
      if (typeof f === 'function') { const [s, b] = f(corps(), journal); return rep(s, b); }
      return rep(200, nom === 'assistant-ia' ? {text: 'Réponse de test de l\'assistant.'} : {id: (corps() || {}).id, motDePasse: 'Abcd-Efgh-Jk7'});
    }
    if (p.startsWith('/storage/v1/')) {
      if (p.includes('/object/sign/')) return rep(200, (corps() && corps().paths || []).map(x => ({path: x, signedURL: '/img/logo-d-bleu.png'})));
      return rep(200, {Key: 'ok'});
    }
    const m = /\/rest\/v1\/(rpc\/)?([\w]+)/.exec(p); if (!m) return rep(404, {});
    if (m[1]) {
      const n = m[2];
      if (n === 'annuaire') return rep(200, D.profiles.filter(x => ['owner', 'agency'].includes(x.role)).map(x => ({id: x.id, role: x.role, first_name: x.first_name, last_name: x.last_name, agency_name: x.agency_name, verif_level: x.verif_level, avatar_url: null})));
      if (n === 'chiffres_publics') return rep(200, [{biens: D.properties.filter(x => x.listing_status === 'publiee').length, villes: 1, agences: 1, proprietaires: 2}]);
      if (n === 'envoyer_contact') { const b = corps(); D.contact_messages.push({id: 'cm' + Date.now(), name: b.p_nom, email: b.p_email, phone: b.p_tel, subject: b.p_sujet, message: b.p_message, statut: 'nouveau', created_at: new Date().toISOString()}); return rep(200, 'cm-ok'); }
      return rep(200, o.rpc && o.rpc[n] !== undefined ? o.rpc[n] : null);
    }
    const t = m[2];
    if (meth === 'GET' || meth === 'HEAD') {
      let rows = filtrer(visible(D, t, uid, o), url.searchParams);
      const one = /vnd\.pgrst\.object/.test(req.headers()['accept'] || '');
      if (one) return rows.length ? rep(200, rows[0]) : rep(406, {code: 'PGRST116', message: 'no rows'});
      return rep(200, rows, {'content-range': `0-${Math.max(0, rows.length - 1)}/${rows.length}`});
    }
    const b = corps();
    if (meth === 'POST') {
      const L = Array.isArray(b) ? b : [b]; L.forEach(x => { x.id = x.id || 'n' + Math.random().toString(16).slice(2, 10) + '-0000-4000-8000-000000000000'; x.created_at = x.created_at || new Date().toISOString(); const i = (D[t] = D[t] || []).findIndex(y => y.id === x.id); if (i >= 0) D[t][i] = {...D[t][i], ...x}; else D[t].push(x); });
      return rep(201, L);
    }
    if (meth === 'PATCH') { const rows = filtrer(D[t] || [], url.searchParams); rows.forEach(r => Object.assign(r, b)); return rep(200, rows); }
    if (meth === 'DELETE') { const rows = filtrer(D[t] || [], url.searchParams); D[t] = (D[t] || []).filter(r => !rows.includes(r)); return rep(200, rows); }
    return rep(200, []);
  });
  const page = await ctx.newPage();
  const erreurs = [];
  page.on('pageerror', e => erreurs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') erreurs.push('console: ' + m.text().slice(0, 300)); });
  await page.goto(`http://localhost:${port}/${o.hash || '#/'}`);
  await page.waitForFunction(() => window.DB && DB.pret, null, {timeout: 20000}).catch(() => erreurs.push('DB.pret jamais vrai'));
  await page.waitForTimeout(o.attente || 900);
  return {page, ctx, navig, D, ID, journal, erreurs, fermer: async () => { await ctx.close(); if (!o.navigateur) await navig.close(); }};
}
const texte = page => page.evaluate(() => document.querySelector('#app').innerText);
module.exports = {ouvrir, ID, donnees, texte, arreter: () => serveur && serveur.close()};
