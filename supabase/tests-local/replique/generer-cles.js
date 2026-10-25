// Génère les clés anon / service_role de la RÉPLIQUE LOCALE (signées avec JWT_SECRET).
// Ces clés ne valent que pour la réplique : elles n'ouvrent aucun projet hébergé.
const jwt = require('jsonwebtoken'), fs = require('fs'), path = require('path');
const s = process.env.JWT_SECRET || 'super-secret-jwt-token-with-at-least-32-characters-long';
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 86400;
const cles = {anon: jwt.sign({role: 'anon', iss: 'supabase-local', exp}, s), service: jwt.sign({role: 'service_role', iss: 'supabase-local', exp}, s)};
fs.writeFileSync(path.join(__dirname, 'keys.json'), JSON.stringify(cles, null, 1));
console.log('keys.json écrit (réplique locale).');
