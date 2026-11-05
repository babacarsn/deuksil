// Génère js/02c-schema.js (types des colonnes de chaque table) à partir de la base.
// Usage : DATABASE_URL=postgres://… node supabase/outils/generer-schema-front.js
// À relancer après chaque migration qui ajoute, retire ou change une colonne.
const {Client} = require('pg');
const TYPES = {uuid: 'uuid', text: 'text', integer: 'int', bigint: 'int', numeric: 'num', boolean: 'bool', date: 'date',
  'timestamp with time zone': 'ts', jsonb: 'json', ARRAY: 'array'};
(async () => {
  const c = new Client({connectionString: process.env.DATABASE_URL}); await c.connect();
  const r = await c.query(`select c.table_name t, c.column_name n, c.data_type d, c.udt_name u, c.is_generated g, c.is_nullable nl
    from information_schema.columns c join information_schema.tables x on x.table_name = c.table_name and x.table_schema = c.table_schema
    where c.table_schema = 'public' and x.table_type = 'BASE TABLE' order by c.table_name, c.ordinal_position`);
  const S = {};
  for (const x of r.rows) {
    let t = TYPES[x.d] || 'text';
    if (t === 'array') t = x.u === '_uuid' ? 'uuid[]' : 'text[]';
    if (t === 'text' && x.nl === 'NO') t = 'text!';   // texte obligatoire : « » reste « », jamais NULL
    if (x.g === 'ALWAYS') t = 'lecture:' + t;     // colonne calculée : jamais envoyée
    (S[x.t] = S[x.t] || {})[x.n] = t;
  }
  const out = `/* Généré par supabase/outils/generer-schema-front.js — ne pas modifier à la main.\n   Types des colonnes de chaque table, utilisés par js/03-storage.js pour convertir\n   les champs de l'interface (camelCase) en colonnes typées (snake_case). */\nconst DEUKSIL_SCHEMA = ${JSON.stringify(S)};\n`;
  require('fs').writeFileSync(require('path').join(__dirname, '../../js/02c-schema.js'), out);
  console.log(Object.keys(S).length + ' tables, ' + r.rows.length + ' colonnes');
  await c.end();
})();
