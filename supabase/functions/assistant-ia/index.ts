// Fonction Edge « assistant-ia » : relais vers Gemini. La clé reste côté serveur.
const CLE = Deno.env.get('GEMINI_API_KEY') || '';
const MODELE = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';
const ORIGINES = (Deno.env.get('DEUKSIL_ORIGINES') || '*').split(',').map((s) => s.trim());

function entetes(req: Request) {
  const o = req.headers.get('origin') || '';
  const ok = ORIGINES.includes('*') ? '*' : (ORIGINES.includes(o) ? o : ORIGINES[0]);
  return { 'Access-Control-Allow-Origin': ok, 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
           'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Vary': 'Origin' };
}
const rep = (req: Request, code: number, corps: unknown) => new Response(JSON.stringify(corps), { status: code, headers: entetes(req) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: entetes(req) });
  if (req.method !== 'POST') return rep(req, 405, { message: 'Méthode non autorisée.' });
  if (!CLE) { console.error('GEMINI_API_KEY manquante'); return rep(req, 503, { message: 'Assistant non configuré.' }); }

  let b: any;
  try { b = await req.json(); } catch { return rep(req, 400, { message: 'Requête illisible.' }); }

  const contents: any[] = [];
  let systeme = '';
  const config: Record<string, unknown> = { temperature: 0.3 };

  if (b.mode === 'json') {
    const p = typeof b.prompt === 'string' ? b.prompt : '';
    if (!p || p.length > 8000) return rep(req, 400, { message: 'Demande invalide.' });
    contents.push({ role: 'user', parts: [{ text: p }] });
    config.temperature = 0.1;
    config.responseMimeType = 'application/json';
  } else if (b.mode === 'chat') {
    const t = Array.isArray(b.turns) ? b.turns : [];
    if (t.length < 2) return rep(req, 400, { message: 'Demande invalide.' });
    systeme = String(t[0].content || '').slice(0, 3000);
    for (const m of t.slice(1).slice(-11)) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const txt = String(m.content || '').slice(0, 1500);
      if (!txt) continue;
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts[0].text += '\n' + txt;
      else contents.push({ role, parts: [{ text: txt }] });
    }
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) return rep(req, 400, { message: 'Demande invalide.' });
  } else {
    return rep(req, 400, { message: 'Mode inconnu.' });
  }

  const corps: Record<string, unknown> = { contents, generationConfig: config };
  if (systeme) corps.systemInstruction = { parts: [{ text: systeme }] };

    // 3 essais : modèle principal, encore lui, puis un modèle léger de secours.
  const essais = [MODELE, MODELE, 'gemini-flash-lite-latest'];
  let r: Response | undefined;
  for (let i = 0; i < essais.length; i++) {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${essais[i]}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CLE },
      body: JSON.stringify(corps),
    });
    if (r.ok || ![429, 500, 503].includes(r.status) || i === essais.length - 1) break;
    console.error('Gemini', essais[i], r.status, (await r.text()).slice(0, 200));
    await new Promise((res) => setTimeout(res, 700 * (i + 1)));
  }
  if (!r || !r.ok) {
    console.error('Gemini échec final', r?.status, r ? (await r.text()).slice(0, 300) : '');
    if (r?.status === 429) return rep(req, 429, { message: 'Trop de demandes, réessayez dans un instant.' });
    return rep(req, 502, { message: 'Assistant indisponible.' });
  }

  const d = await r.json();
  const text = (d?.candidates?.[0]?.content?.parts || []).map((p: any) => p.text || '').join('');
  return rep(req, 200, { text });
});