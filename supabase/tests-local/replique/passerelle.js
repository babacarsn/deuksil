// Passerelle locale « façon Supabase » pour les tests :
//   /rest/v1/*    → PostgREST (127.0.0.1:3000)
//   /auth/v1/*    → Supabase Auth / GoTrue (127.0.0.1:9999)
//   /storage/v1/* → émulation minimale de Supabase Storage : fichiers sur disque,
//                   droits vérifiés PAR POSTGRES (politiques RLS de storage.objects)
//   /*            → l'application DEUKSIL (fichiers statiques), avec js/00-config.js
//                   remplacé par la configuration locale.
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const {Pool} = require('pg'), jwt = require('jsonwebtoken');
// Secret JWT de la réplique LOCALE (valeur publique par défaut des outils Supabase locaux) :
// ne sert qu'à signer des jetons de test, jamais pour un projet hébergé.
const SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const ICI = __dirname, R = process.env.REPLIQUE_DIR || path.join(ICI, '.run');
const KEYS = JSON.parse(fs.readFileSync(path.join(ICI, 'keys.json')));
const APP = process.env.APP || path.resolve(ICI, '../../..');
const FICHIERS = path.join(R, 'storage');
const PORT = +process.env.PORT || 54321;
const pool = new Pool({connectionString: 'postgres://postgres@127.0.0.1:54322/postgres', max: 10});
const STATS = {rest: 0, auth: 0, storage: 0, parChemin: {}};

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json'};
const CONFIG = `const DEUKSIL_CONFIG = {
  supabaseUrl: 'http://127.0.0.1:${PORT}',
  supabaseAnonKey: '${KEYS.anon}',
  googleActif: false,
  siteUrl: 'http://127.0.0.1:${PORT}'
};`;

function relayer(req, res, cible, prefixe) {
  const u = new URL(req.url, 'http://x'); const chemin = u.pathname.slice(prefixe.length) + u.search;
  const p = http.request({host: '127.0.0.1', port: cible, path: chemin || '/', method: req.method, headers: {...req.headers, host: '127.0.0.1:' + cible}}, r => {
    res.writeHead(r.statusCode, {...r.headers, 'access-control-allow-origin': '*'}); r.pipe(res);
  });
  p.on('error', e => { res.writeHead(502); res.end(String(e)); });
  req.pipe(p);
}
const corps = req => new Promise(ok => { const b = []; req.on('data', c => b.push(c)); req.on('end', () => ok(Buffer.concat(b))); });
const jsonRep = (res, code, o) => { res.writeHead(code, {'content-type': 'application/json', 'access-control-allow-origin': '*'}); res.end(JSON.stringify(o)); };

// Exécute fn(client) avec l'identité de l'appelant : rôle et claims du JWT, comme PostgREST.
async function enTantQue(req, fn) {
  const a = (req.headers.authorization || '').replace(/^Bearer /, '');
  let claims; try { claims = jwt.verify(a, SECRET); } catch (e) { const err = new Error('JWT invalide'); err.code = 401; throw err; }
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`, [claims.role, JSON.stringify(claims)]);
    const r = await fn(c, claims); await c.query('commit'); return r;
  } catch (e) { await c.query('rollback').catch(() => {}); throw e; } finally { c.release(); }
}
const fichier = (b, n) => path.join(FICHIERS, b, n);
const signer = (b, n, s) => jwt.sign({url: b + '/' + n}, SECRET, {expiresIn: s || 3600});

async function stockage(req, res) {
  STATS.storage++;
  const u = new URL(req.url, 'http://x'); const p = decodeURIComponent(u.pathname.replace(/^\/storage\/v1/, ''));
  if (req.method === 'OPTIONS') { res.writeHead(204, {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}); return res.end(); }
  try {
    let m;
    if (req.method === 'GET' && (m = p.match(/^\/object\/public\/([^/]+)\/(.+)$/))) {
      const b = await pool.query('select public from storage.buckets where id = $1', [m[1]]);
      if (!b.rows[0] || !b.rows[0].public || !fs.existsSync(fichier(m[1], m[2]))) return jsonRep(res, 404, {error: 'not_found'});
      res.writeHead(200, {'content-type': TYPES[path.extname(m[2])] || 'application/octet-stream', 'access-control-allow-origin': '*'}); return fs.createReadStream(fichier(m[1], m[2])).pipe(res);
    }
    if (req.method === 'GET' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      let t; try { t = jwt.verify(u.searchParams.get('token'), SECRET); } catch (e) { return jsonRep(res, 400, {error: 'InvalidSignature'}); }
      if (t.url !== m[1] + '/' + m[2] || !fs.existsSync(fichier(m[1], m[2]))) return jsonRep(res, 404, {error: 'not_found'});
      res.writeHead(200, {'access-control-allow-origin': '*'}); return fs.createReadStream(fichier(m[1], m[2])).pipe(res);
    }
    if (req.method === 'POST' && (m = p.match(/^\/object\/sign\/([^/]+)\/(.+)$/))) {
      const b = JSON.parse((await corps(req)).toString() || '{}');
      const vu = await enTantQue(req, c => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [m[1], m[2]]));
      if (!vu.rowCount) return jsonRep(res, 400, {statusCode: '404', error: 'not_found', message: 'Object not found'});
      return jsonRep(res, 200, {signedURL: `/object/sign/${m[1]}/${m[2]}?token=${signer(m[1], m[2], b.expiresIn)}`});
    }
    if (req.method === 'POST' && (m = p.match(/^\/object\/sign\/([^/]+)$/))) {
      const b = JSON.parse((await corps(req)).toString() || '{}');
      const vus = await enTantQue(req, c => c.query('select name from storage.objects where bucket_id = $1 and name = any($2)', [m[1], b.paths || []]));
      const ok = new Set(vus.rows.map(r => r.name));
      return jsonRep(res, 200, (b.paths || []).map(n => ok.has(n) ? {path: n, signedURL: `/object/sign/${m[1]}/${n}?token=${signer(m[1], n, b.expiresIn)}`, error: null} : {path: n, signedURL: null, error: 'Either the object does not exist or you do not have access to it'}));
    }
    // Liste d'un dossier (comme Storage : sous-dossiers avec id null), droits par la RLS de storage.objects
    if (req.method === 'POST' && (m = p.match(/^\/object\/list\/([^/]+)$/))) {
      const o = JSON.parse((await corps(req)).toString() || '{}'), pre = (o.prefix || '').replace(/^\/|\/$/g, '');
      const r = await enTantQue(req, c => c.query('select name, id, metadata, created_at, updated_at from storage.objects where bucket_id = $1 and name like $2 order by name', [m[1], pre ? pre + '/%' : '%']));
      const vus = new Map();
      for (const x of r.rows) {
        const reste = pre ? x.name.slice(pre.length + 1) : x.name, i = reste.indexOf('/');
        if (i >= 0) { const d = reste.slice(0, i); if (!vus.has(d)) vus.set(d, {name: d, id: null, metadata: null}); }
        else vus.set(reste, {name: reste, id: x.id, metadata: x.metadata, created_at: x.created_at, updated_at: x.updated_at});
      }
      const L = [...vus.values()].slice(o.offset || 0, (o.offset || 0) + (o.limit || 100));
      return jsonRep(res, 200, L);
    }
    // Téléchargement authentifié (fichiers privés), droits par la RLS de storage.objects
    if (req.method === 'GET' && (m = p.match(/^\/object\/(?:authenticated\/)?([^/]+)\/(.+)$/)) && !/^(public|sign|list)$/.test(m[1])) {
      const vu = await enTantQue(req, c => c.query('select 1 from storage.objects where bucket_id = $1 and name = $2', [m[1], m[2]]));
      if (!vu.rowCount || !fs.existsSync(fichier(m[1], m[2]))) return jsonRep(res, 400, {statusCode: '404', error: 'not_found', message: 'Object not found'});
      res.writeHead(200, {'content-type': TYPES[path.extname(m[2])] || 'application/octet-stream', 'access-control-allow-origin': '*'}); return fs.createReadStream(fichier(m[1], m[2])).pipe(res);
    }
    if ((req.method === 'POST' || req.method === 'PUT') && (m = p.match(/^\/object\/([^/]+)\/(.+)$/))) {
      const data = await corps(req), type = req.headers['content-type'] || 'application/octet-stream';
      const bk = (await pool.query('select * from storage.buckets where id = $1', [m[1]])).rows[0];
      if (!bk) return jsonRep(res, 400, {statusCode: '404', error: 'Bucket not found', message: 'Bucket not found'});
      if (bk.file_size_limit && data.length > bk.file_size_limit) return jsonRep(res, 413, {statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size'});
      if (bk.allowed_mime_types && !bk.allowed_mime_types.includes(type.split(';')[0])) return jsonRep(res, 415, {statusCode: '415', error: 'invalid_mime_type', message: `mime type ${type} is not supported`});
      const upsert = req.headers['x-upsert'] === 'true';
      await enTantQue(req, async (c, cl) => {
        const sql = upsert ? `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)
          on conflict (bucket_id, name) do update set metadata = excluded.metadata, updated_at = now()` : `insert into storage.objects (bucket_id, name, owner, metadata) values ($1, $2, $3, $4)`;
        await c.query(sql, [m[1], m[2], cl.sub || null, {mimetype: type, size: data.length}]);
      });
      fs.mkdirSync(path.dirname(fichier(m[1], m[2])), {recursive: true}); fs.writeFileSync(fichier(m[1], m[2]), data);
      return jsonRep(res, 200, {Key: m[1] + '/' + m[2], Id: crypto.randomUUID()});
    }
    if (req.method === 'DELETE' && (m = p.match(/^\/object\/([^/]+)$/))) {
      const b = JSON.parse((await corps(req)).toString() || '{}');
      const r = await enTantQue(req, c => c.query('delete from storage.objects where bucket_id = $1 and name = any($2) returning name', [m[1], b.prefixes || []]));
      r.rows.forEach(x => { try { fs.unlinkSync(fichier(m[1], x.name)); } catch (e) {} });
      return jsonRep(res, 200, r.rows.map(x => ({name: x.name})));
    }
    return jsonRep(res, 404, {error: 'route inconnue ' + req.method + ' ' + p});
  } catch (e) {
    const code = e.code === 401 ? 401 : (e.code === '42501' || /row-level security/.test(e.message)) ? 403 : 400;
    return jsonRep(res, code, {statusCode: String(code), error: code === 403 ? 'Unauthorized' : 'Error', message: e.message});
  }
}

http.createServer((req, res) => {
  const p = req.url.split('?')[0];
  STATS.parChemin[p.split('/').slice(0, 4).join('/')] = (STATS.parChemin[p.split('/').slice(0, 4).join('/')] || 0) + 1;
  if (p === '/__stats') { const o = JSON.stringify(STATS); if (req.url.includes('reset')) { STATS.rest = STATS.auth = STATS.storage = 0; STATS.parChemin = {}; } return jsonRep(res, 200, JSON.parse(o)); }
  if (p.startsWith('/rest/v1')) { STATS.rest++; return relayer(req, res, 3000, '/rest/v1'); }
  if (p.startsWith('/auth/v1')) { STATS.auth++; return relayer(req, res, 9999, '/auth/v1'); }
  if (p.startsWith('/storage/v1')) return stockage(req, res);
  if (p.startsWith('/functions/v1/gerer-acces')) { STATS.fonctions = (STATS.fonctions || 0) + 1; return relayer(req, res, 54325, '/functions/v1/gerer-acces'); }
  if (p.startsWith('/__modeles/')) { res.writeHead(200, {'content-type': 'text/html'}); return res.end(fs.readFileSync(path.join(APP, 'supabase/templates', path.basename(p)))); }
  if (p === '/js/00-config.js') { res.writeHead(200, {'content-type': TYPES['.js']}); return res.end(CONFIG); }
  const f = path.join(APP, path.normalize(p === '/' ? '/index.html' : p).replace(/^(\.\.[/\\])+/, ''));
  if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('introuvable'); }
  res.writeHead(200, {'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store'});
  fs.createReadStream(f).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log('passerelle sur http://127.0.0.1:' + PORT));
