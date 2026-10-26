// Fonction Edge « assistant-ia » : relais vers Gemini. La clé reste côté serveur.
//
// Trois usages :
//   * mode « tache » : outils des écrans (annonce, relance, rapport, relevé, rapprochement,
//     estimation, modération, résumé, lecture de pièce) ; consignes fixées ci-dessous (TACHES),
//     utilisateur connecté obligatoire, rôle vérifié dans la base pour la modération,
//     offre payante obligatoire dès que la tâche contient des données personnelles ;
//   * questions générales (visiteurs compris) : consignes courtes, aucune donnée de compte ;
//   * questions de GESTION (factures, devis, contrats, loyers…) : le navigateur joint
//     un résumé des données que l'utilisateur voit déjà dans son espace (RLS). Ce mode
//     exige (1) un utilisateur connecté, vérifié ici par Supabase Auth, et (2) l'offre
//     PAYANTE de l'API Gemini, déclarée par le secret GEMINI_PAYANT=oui : les conditions
//     de l'offre gratuite interdisent d'y envoyer des données personnelles ou
//     confidentielles, et Google peut les utiliser pour améliorer ses produits.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
const URL_SB = Deno.env.get('SUPABASE_URL') || '';
// Clé publique pour vérifier le jeton de l'utilisateur. DEUKSIL_CLE_PUBLIQUE (facultatif, clé « sb_publishable_… »)
// sert si les anciennes clés JWT du projet ont été désactivées.
const ANON = Deno.env.get('DEUKSIL_CLE_PUBLIQUE') || Deno.env.get('SUPABASE_ANON_KEY') || '';
const PAYANT = (Deno.env.get('GEMINI_PAYANT') || '').toLowerCase() === 'oui';
const MAX_CONTEXTE = 30000;
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

/* Utilisateur connecté (jeton vérifié par Supabase Auth) et, si demandé, son rôle lu sous la RLS. */
async function utilisateur(req: Request, avecRole = false): Promise<{ id: string; role?: string } | null> {
  const jeton = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jeton || !URL_SB || !ANON) return null;
  const sb = createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + jeton } } });
  const { data, error } = await sb.auth.getUser(jeton);
  if (error || !data?.user) return null;
  if (!avecRole) return { id: data.user.id };
  const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
  return { id: data.user.id, role: p?.role };
}

/* Outils de l'assistant. Les consignes sont fixées ICI (le navigateur n'envoie que des données).
   perso : la demande contient des données personnelles → offre payante obligatoire (GEMINI_PAYANT).
   role  : rôle exigé (lu dans la base, jamais fourni par le navigateur). */
const REGLE = "Tu es l'assistant de DEUKSIL, plateforme immobilière au Sénégal. Réponds en français. Montants en FCFA. N'utilise que les données fournies ; n'invente aucun montant, nom, date ou bien.";
const TACHES: Record<string, { perso: boolean; role?: string; json: boolean; consigne: string }> = {
  annonce: { perso: false, json: true, consigne: REGLE + `
Rédige une annonce immobilière à partir des caractéristiques fournies (champ « notes » : ce que le propriétaire a déjà écrit, à reprendre et améliorer).
Ton professionnel et chaleureux, sans superlatifs creux ni promesse non fondée ; ne mentionne aucun élément absent des données (pas de vue mer, de piscine… si ce n'est pas indiqué).
Réponds en JSON : {"titre": "60 caractères maximum, type + atout principal + quartier", "description": "3 à 5 courts paragraphes : le bien, les pièces et équipements, le quartier et ses commodités en termes généraux, les conditions (prix, disponibilité)"}.` },
  relance: { perso: true, json: false, consigne: REGLE + `
Rédige un message de relance de loyer impayé, à envoyer par le bailleur au locataire (messagerie ou WhatsApp).
Adapte le ton au retard : courtois et bref pour une première relance ou un retard de quelques jours ; plus ferme mais toujours respectueux après plusieurs relances ou plus d'un mois ; jamais de menace ni de propos humiliant.
Indique le ou les mois, le montant restant dû, invite à régler ou à prendre contact pour convenir d'une solution. 4 à 7 lignes, signé du nom du bailleur. Réponds par le texte du message seulement.` },
  rapport: { perso: true, json: false, consigne: REGLE + `
Rédige le rapport de gestion du mois indiqué à partir des données de l'espace : 1) chiffres clés (loyers attendus / encaissés, impayés, factures à encaisser, dépenses), 2) ce qui va bien, 3) points à surveiller (retards, baux et contrats qui arrivent à échéance, travaux en cours), 4) trois actions prioritaires. Titres courts, listes, 25 lignes maximum.` },
  releve: { perso: true, json: false, consigne: REGLE + `
Rédige pour un propriétaire mandant le relevé expliqué de ses biens gérés par l'agence, pour la période indiquée : loyers encaissés, dépenses, commission de l'agence (taux), montant net qui lui revient, déjà reversé, reste à reverser, et les faits marquants (retards, travaux). Phrases simples, vouvoiement, 15 lignes maximum, signé de l'agence.` },
  rapprochement: { perso: false, json: true, consigne: REGLE + `
Une agence cherche, pour une demande de client (anonymisée), les biens les plus pertinents parmi les candidats fournis.
Classe au plus 5 biens, du plus pertinent au moins pertinent, en tenant compte de la transaction, du type, du budget, du lieu, du nombre de chambres. Écarte ceux qui ne conviennent pas.
Réponds en JSON : {"biens": [{"id": "identifiant exact du candidat", "raison": "une phrase", "ecart": "ce qui ne correspond pas, ou vide"}], "conseil": "une phrase pour l'agent"}.` },
  estimation: { perso: false, json: true, consigne: REGLE + `
Donne une fourchette INDICATIVE de prix pour le bien décrit, uniquement à partir des annonces comparables DEUKSIL fournies et de leurs statistiques (médianes calculées). Ce n'est pas une expertise.
Si moins de 3 comparables, la fiabilité est « faible ». Explique en 2 ou 3 phrases (comparables retenus, ajustements surface / chambres / quartier).
Réponds en JSON : {"min": nombre, "max": nombre, "fiabilite": "faible|moyenne|bonne", "explication": "…"}.` },
  moderation: { perso: false, role: 'admin', json: true, consigne: REGLE + `
Aide un modérateur à repérer une annonce suspecte avant validation. Tu reçois l'annonce, des signaux calculés (écart de prix avec les comparables, textes très proches d'autres annonces) et les annonces proches.
Signale seulement ce que les données montrent : prix anormal, texte copié ou incohérent, doublon probable, coordonnées dans le texte, promesses douteuses (paiement d'avance, urgence). Ne conclus pas à une fraude : indique un niveau de vigilance.
Réponds en JSON : {"vigilance": "faible|moyenne|elevee", "points": ["…"], "recommandation": "valider | demander des précisions à l'annonceur | refuser", "explication": "une phrase"}.` },
  resume: { perso: true, json: false, consigne: REGLE + `
Résume la conversation fournie (messages datés, « moi » = l'utilisateur) : objet, ce qui a été convenu ou demandé, questions restées sans réponse, prochaine étape. 6 lignes maximum, neutre.` },
  piece: { perso: true, json: true, consigne: REGLE + `
Lis la facture ou le reçu en image et extrais les informations pour enregistrer une dépense. Ne devine pas : laisse vide ce qui n'est pas lisible.
Catégorie : l'une de maintenance, réparation, électricité, eau, nettoyage, gardiennage, travaux, assurance, taxes, commissions, fournitures, autres.
Réponds en JSON : {"fournisseur": "", "date": "AAAA-MM-JJ ou vide", "montant": nombre TTC ou null, "categorie": "", "reference": "", "objet": "courte description"}.` },
};
const MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

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
    if (b.contexte) {
      if (!PAYANT) return rep(req, 403, { code: 'gestion_off', message: "Les questions sur vos données de gestion ne sont pas encore activées sur DEUKSIL." });
      const jeton = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const { data: qui, error } = jeton && URL_SB && ANON
        ? await createClient(URL_SB, ANON, { auth: { persistSession: false, autoRefreshToken: false } }).auth.getUser(jeton)
        : { data: null, error: true } as any;
      if (error || !qui?.user) return rep(req, 401, { code: 'connexion', message: 'Connectez-vous pour interroger vos données.' });
      const ctx = String(b.contexte);
      if (ctx.length > MAX_CONTEXTE) return rep(req, 413, { message: 'Trop de données à analyser : précisez votre question.' });
      systeme += '\n\n' + ctx;
    }
    for (const m of t.slice(1).slice(-11)) {
      const role = m.role === 'assistant' ? 'model' : 'user';
      const txt = String(m.content || '').slice(0, 2500);
      if (!txt) continue;
      const last = contents[contents.length - 1];
      if (last && last.role === role) last.parts[0].text += '\n' + txt;
      else contents.push({ role, parts: [{ text: txt }] });
    }
    while (contents.length && contents[0].role !== 'user') contents.shift();
    if (!contents.length) return rep(req, 400, { message: 'Demande invalide.' });
  } else if (b.mode === 'tache') {
    const T = TACHES[String(b.tache || '')];
    if (!T) return rep(req, 400, { message: 'Tâche inconnue.' });
    const qui = await utilisateur(req, !!T.role);
    if (!qui) return rep(req, 401, { code: 'connexion', message: 'Connectez-vous pour utiliser cet outil.' });
    if (T.role && qui.role !== T.role) return rep(req, 403, { message: 'Outil réservé à l\'administration.' });
    if (T.perso && !PAYANT) return rep(req, 403, { code: 'gestion_off', message: "Cet outil utilise des données personnelles : il sera disponible quand l'offre payante de l'assistant sera activée." });
    const donnees = JSON.stringify(b.donnees ?? {});
    if (donnees.length > MAX_CONTEXTE) return rep(req, 413, { message: 'Trop de données à analyser.' });
    systeme = T.consigne;
    const parts: any[] = [{ text: 'Données :\n' + donnees }];
    if (b.tache === 'piece') {
      const img = b.image || {};
      if (!MIMES.includes(img.mime) || typeof img.data !== 'string' || img.data.length > 5_600_000) return rep(req, 400, { message: 'Image invalide (JPEG, PNG, WEBP ou HEIC, 4 Mo maximum).' });
      parts.push({ inline_data: { mime_type: img.mime, data: img.data } });
    }
    contents.push({ role: 'user', parts });
    config.temperature = b.tache === 'annonce' || b.tache === 'relance' ? 0.6 : 0.2;
    if (T.json) config.responseMimeType = 'application/json';
  } else {
    return rep(req, 400, { message: 'Mode inconnu.' });
  }

  const corps: Record<string, unknown> = { contents, generationConfig: config };
  if (systeme) corps.systemInstruction = { parts: [{ text: systeme }] };

    // 3 essais : modèle principal, encore lui, puis un modèle léger de secours.
  const essais = [MODELE, MODELE, 'gemini-flash-lite-latest'];
  let r: Response | undefined;
  for (let i = 0; i < essais.length; i++) {
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${essais[i]}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': CLE },
        body: JSON.stringify(corps),
      });
    } catch (e) {                                   // réseau : Gemini injoignable
      console.error('Gemini injoignable', String(e).slice(0, 200)); r = undefined;
      if (i === essais.length - 1) break; await new Promise((res) => setTimeout(res, 700 * (i + 1))); continue;
    }
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