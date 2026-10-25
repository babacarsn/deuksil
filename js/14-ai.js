/* ==========================================================================
   MODULE : ai.js — assistant de recherche
   Utilise la vraie IA (capacité "sample") quand elle est disponible ; sinon
   bascule sur un analyseur local en français (aucun réseau, fonctionne
   toujours depuis le lien publié). Le rendu du résultat ne change pas :
   seule la façon d'interpréter la phrase diffère.
   ========================================================================== */
let aiSample = null;
let aiSearchAvailable = false;
async function initAi() {
  if (typeof SB !== 'undefined' && SB) {
    const appeler = async corps => {
      const {data, error} = await SB.functions.invoke('assistant-ia', {body: corps});
      if (error || !data || typeof data.text !== 'string') throw {code: 'erreur'};
      return data.text;
    };
    aiSample = async (turns, opts = {}) => {
      const text = await appeler({mode: 'chat', turns});
      if (opts.onText) opts.onText({text});
      return {text};
    };
    aiSample.json = async prompt => JSON.parse(await appeler({mode: 'json', prompt}));
    aiSearchAvailable = true;
    return;
  }
  if (!(window.claude && typeof window.claude.use === 'function')) return;
  try {
    const ns = await window.claude.use('sample');
    if (!ns) return;
    aiSample = ns;
    aiSearchAvailable = true;
  } catch (e) { /* capacité indisponible pour cette personne : on reste sur l'analyseur local */ }
}
function sanitizeAiFilters(raw) {
  const out = {};
  if (['location', 'vente', 'terrain'].includes(raw.transaction)) out.transaction = raw.transaction;
  if (raw.region && LOCATIONS[raw.region]) {
    out.region = raw.region;
    if (raw.city && LOCATIONS[raw.region][raw.city]) {
      out.city = raw.city;
      if (raw.quartier && LOCATIONS[raw.region][raw.city].includes(raw.quartier)) out.quartier = raw.quartier;
    }
  }
  if (PROPERTY_TYPES.includes(raw.type)) out.type = raw.type;
  if (Number.isFinite(raw.min) && raw.min >= 0) out.min = String(Math.round(raw.min));
  if (Number.isFinite(raw.max) && raw.max >= 0) out.max = String(Math.round(raw.max));
  if (Number.isFinite(raw.rooms) && raw.rooms >= 0) out.rooms = String(Math.round(raw.rooms));
  if (raw.furnished === true) out.furnished = true;
  if (raw.parking === true) out.parking = true;
  return out;
}

/* --- Analyseur local (sans IA) : reconnaît ville/quartier, type, budget, meublé --- */
function parseSearchLocal(query) {
  const q = ' ' + query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ';
  const out = {};
  if (/\b(louer|location|a louer|locatif)\b/.test(q)) out.transaction = 'location';
  else if (/\b(vendre|vente|a vendre|acheter)\b/.test(q)) out.transaction = 'vente';
  else if (/\bterrain\b/.test(q)) out.transaction = 'terrain';

  for (const t of PROPERTY_TYPES) { if (q.includes(' ' + t + ' ') || q.includes(' ' + t + 's ')) { out.type = t; break; } }

  outer:
  for (const region of Object.keys(LOCATIONS)) {
    for (const city of Object.keys(LOCATIONS[region])) {
      for (const quartier of LOCATIONS[region][city]) {
        if (q.includes(' ' + quartier.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ')) {
          out.region = region; out.city = city; out.quartier = quartier; break outer;
        }
      }
      if (q.includes(' ' + city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ')) { out.region = region; out.city = city; break outer; }
    }
    if (q.includes(' ' + region.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + ' ')) { out.region = region; break outer; }
  }

  if (/\bmeuble/.test(q) && !/\bnon meuble/.test(q)) out.furnished = true;
  if (/\bparking\b/.test(q)) out.parking = true;

  const roomsM = q.match(/(\d+)\s*(chambres?|pieces?)/);
  if (roomsM) out.rooms = +roomsM[1];

  const numTokens = [...q.matchAll(/(\d[\d\s]{2,})(k|000)?\s*(fcfa|cfa|f)?/g)]
    .map(m => { let n = parseInt(m[1].replace(/\s/g, ''), 10); if (m[2] === 'k') n *= 1000; return n; })
    .filter(n => n >= 1000);
  const between = q.match(/entre\s+(\d[\d\s]*)\s*(?:et|-)\s+(\d[\d\s]*)/);
  if (between) { out.min = parseInt(between[1].replace(/\s/g, ''), 10); out.max = parseInt(between[2].replace(/\s/g, ''), 10); }
  else if (/(moins de|maximum|max|jusqu.a|sous)\s/.test(q) && numTokens.length) out.max = numTokens[0];
  else if (/(a partir de|minimum|min|plus de|au moins)\s/.test(q) && numTokens.length) out.min = numTokens[0];
  else if (numTokens.length === 1) out.max = numTokens[0];
  else if (numTokens.length >= 2) { out.min = Math.min(...numTokens); out.max = Math.max(...numTokens); }

  return out;
}
function describeFilters(f) {
  const parts = [];
  if (f.transaction) parts.push(TRANSACTION_LABEL[f.transaction].toLowerCase());
  if (f.type) parts.push(f.type);
  if (f.quartier) parts.push('à ' + f.quartier);
  else if (f.city) parts.push('à ' + f.city);
  else if (f.region) parts.push('en région ' + f.region);
  if (f.min && f.max) parts.push(`entre ${money(f.min)} et ${money(f.max)}`);
  else if (f.max) parts.push('jusqu\'à ' + money(f.max));
  else if (f.min) parts.push('à partir de ' + money(f.min));
  if (f.rooms) parts.push(f.rooms + ' chambres minimum');
  if (f.furnished) parts.push('meublé');
  if (f.parking) parts.push('avec parking');
  return parts.length ? `Voici ce que j'ai compris : ${parts.join(', ')}.` : "Je n'ai pas trouvé de critère précis dans votre phrase ; affinez avec les filtres ci-dessous.";
}
async function runAiSearch(query, box) {
  if (!query || !query.trim()) return;
  let filters, message;
  if (aiSample) {
    const prompt = `Tu es l'assistant de recherche du site immobilier DEUKSIL au Sénégal.
Réponds UNIQUEMENT avec un objet JSON strict (pas de texte autour, pas de balises markdown), avec exactement ces clés :
{"transaction":"location|vente|terrain ou vide","region":"...","city":"...","quartier":"...","type":"...","min":nombre ou null,"max":nombre ou null,"rooms":nombre ou null,"furnished":true|false,"parking":true|false,"message":"une phrase amicale en français, courte, confirmant ce que tu as compris"}
Règles strictes :
- "region" doit être exactement l'une de ces valeurs, sinon laisse "" : ${Object.keys(LOCATIONS).join(', ')}.
- "city" doit être une ville qui existe réellement dans cette région : ${JSON.stringify(LOCATIONS)}.
- "type" doit être exactement l'une de ces valeurs, sinon laisse "" : ${PROPERTY_TYPES.join(', ')}.
- Les prix sont en francs CFA. Ne déduis jamais un champ que la phrase ne permet pas clairement de déterminer : laisse-le vide/null plutôt que de deviner.
Demande du client, en français : "${query.trim()}"`;
    try {
      const result = await aiSample.json(prompt, {modelTier: 'quick'});
      filters = sanitizeAiFilters(result || {});
      message = result && result.message ? result.message : describeFilters(filters);
    } catch (e) {
      filters = sanitizeAiFilters(parseSearchLocal(query));
      message = describeFilters(filters);
    }
  } else {
    filters = sanitizeAiFilters(parseSearchLocal(query));
    message = describeFilters(filters);
  }
  searchState = {...searchState, region: '', city: '', quartier: '', type: '', min: '', max: '', rooms: '', furnished: false, parking: false, ...filters, page: 1};
  render();
  toast(message);
}

/* ---- Chat flottant : conversation libre avec Claude, texte ou voix ---- */
let aiChatHistory = [];
const aiCle = () => 'deuksil-ai-chat:' + ((typeof Auth !== 'undefined' && Auth.current() && Auth.current().id) || 'visiteur');
function aiChatCharger() {
  try { const v = JSON.parse(localStorage.getItem(aiCle()) || '[]'); aiChatHistory = Array.isArray(v) ? v.filter(m => m && m.content).slice(-40) : []; } catch (e) { aiChatHistory = []; }
}
function aiChatSauver() {
  try { localStorage.setItem(aiCle(), JSON.stringify(aiChatHistory.filter(m => m.content).slice(-40))); } catch (e) {}
}
let aiChatBusy = false;
function aiErrorMessage(e) {
  return e && e.code === 'not_granted' ? "Autorisation refusée pour l'assistant."
    : e && e.code === 'rate_limited' ? 'Trop de demandes, réessayez dans un instant.'
    : e && e.code === 'session_expired' ? 'Votre session a expiré, rouvrez la conversation.'
    : "Une erreur est survenue. Réessayez dans un instant.";
}
function aiChatRules() {
  const u = Auth.current();
  const role = u ? {client:'client', owner:'propriétaire', agency:'agence', admin:'administrateur'}[u.role] : 'visiteur non connecté';
  return `Tu es l'assistant DEUKSIL, une plateforme immobilière au Sénégal (location, vente, terrains).
Tu aides à trouver un logement, à comprendre une annonce, ou à utiliser la plateforme (inscription gratuite, visites, messagerie). La plateforme est gratuite : pas de frais, pas d'abonnement, pas de commission.
Réponds toujours en français, de façon brève (2 à 4 phrases), concrète et chaleureuse. N'invente jamais de prix ni de biens précis : reste général et renvoie vers la recherche (#/search) si la personne veut voir de vraies annonces.
Utilisateur actuel : ${role}.`;
}
function renderAiChatInPlace() {
   aiChatSauver();
  const list = $('#ai-chat-list');
  if (!list) return;
  list.innerHTML = aiChatHistory.length
    ? aiChatHistory.map(m => `<div class="bubble ${m.role === 'user' ? 'me' : ''}">${m.content ? esc(m.content) : '<span class="ai-dots"><i></i><i></i><i></i></span>'}</div>`).join('')
    : `<p class="small muted">Posez une question sur DEUKSIL, une annonce, ou dites ce que vous cherchez.</p>`;
  list.scrollTop = list.scrollHeight;
}
/* Réponses locales (sans IA) : uniquement des faits tirés de la configuration réelle de la plateforme. */
function localAssistantReply(text) {
  const t = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/(abonnement|tarif|frais|gratuit|combien|prix des|cout|coute)/.test(t) && !/(f3|chambre|villa|appartement|studio|terrain)/.test(t))
    return {reply: "DEUKSIL est gratuit : aucun frais d'inscription, aucun abonnement et aucune commission sur les loyers ou les ventes. Vous créez votre compte avec votre CNI et vous publiez librement."};
  if (/(publier|ajouter un bien|mettre en ligne|proprietaire)/.test(t))
    return {reply: "Pour publier un bien : créez gratuitement un compte propriétaire ou agence, puis utilisez « Ajouter un bien ». L'annonce passe par une validation avant d'apparaître dans la recherche."};
  if (/visite/.test(t))
    return {reply: "Depuis la fiche d'un bien, cliquez sur « Demander une visite », choisissez une date et une heure. Le propriétaire accepte, refuse ou reporte, et vous êtes notifié."};
  if (/(paiement|payer|wave|orange|free money|paydunya|carte)/.test(t))
    return {reply: "DEUKSIL est gratuit : aucun paiement n'est demandé pour créer un compte ou publier une annonce. Les loyers et les ventes se règlent directement entre vous et le propriétaire ou l'agence."};
  if (/(bonjour|salut|bonsoir|hello|coucou)/.test(t) && t.length < 25)
    return {reply: "Bonjour ! Dites-moi ce que vous cherchez (type de bien, ville, budget) ou posez une question sur les tarifs, la publication d'un bien ou les visites."};
  const filters = sanitizeAiFilters(parseSearchLocal(text));
  if (Object.keys(filters).length)
    return {reply: describeFilters(filters) + " J'ouvre la recherche pour vous.", filters};
  return {reply: "Je peux vous aider à chercher un bien (ex. « appartement meublé à Almadies moins de 400 000 »), ou répondre sur les tarifs, la publication d'un bien, les visites et les paiements."};
}
async function sendAiChat(text) {
  const msg = (text || '').trim();
  if (!msg || aiChatBusy) return;
  if (!aiSample) {
    const r = localAssistantReply(msg);
    aiChatHistory.push({role: 'user', content: msg});
    aiChatHistory.push({role: 'assistant', content: r.reply});
    renderAiChatInPlace();
    if (r.filters) {
      searchState = {...searchState, region: '', city: '', quartier: '', type: '', min: '', max: '', rooms: '', furnished: false, parking: false, ...r.filters, page: 1};
      setTimeout(() => { closeModal(); go('#/search'); }, 900);
    }
    return;
  }
  aiChatBusy = true;
  aiChatHistory.push({role: 'user', content: msg});
  aiChatHistory.push({role: 'assistant', content: ''});
  renderAiChatInPlace();
  const turns = [{role: 'user', content: aiChatRules()}, ...aiChatHistory.slice(0, -1)];
  try {
    const res = await aiSample(turns, {cache: false, onText: ({text}) => { aiChatHistory[aiChatHistory.length - 1].content = text; renderAiChatInPlace(); }});
    aiChatHistory[aiChatHistory.length - 1].content = res.text;
  } catch (e) {
    aiChatHistory[aiChatHistory.length - 1].content = aiErrorMessage(e);
  }
  aiChatBusy = false;
  renderAiChatInPlace();
}
function openAiChat() {
  modal('Assistant DEUKSIL', `<div class="ai-chat">
      <div class="ai-chat-list" id="ai-chat-list"></div>
      <form class="ai-chat-input" data-action="ai-chat-send">
        <button type="button" class="mic-btn" data-action="ai-voice" aria-label="Dicter votre question">${icon('mic', 16)}</button>
        <input class="input" id="ai-chat-text" name="msg" placeholder="Écrivez ou dictez votre question…" autocomplete="off">
        <button class="btn sm" type="submit" aria-label="Envoyer">${icon('arrowRight', 15)}</button>
      </form>
    </div>`);
      if (!aiChatHistory.length) aiChatCharger();
  renderAiChatInPlace();
  renderAiChatInPlace();
  setTimeout(() => $('#ai-chat-text')?.focus(), 30);
}
function startVoiceInput(inputEl, micBtn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { toast("La dictée vocale n'est pas prise en charge par ce navigateur.", 'warn'); return; }
  try {
    const rec = new SR();
    rec.lang = 'fr-FR'; rec.interimResults = false; rec.maxAlternatives = 1;
    micBtn.classList.add('listening');
    rec.onresult = e => { if (inputEl) inputEl.value = e.results[0][0].transcript; };
    rec.onerror = () => toast('Dictée vocale interrompue.', 'bad');
    rec.onend = () => micBtn.classList.remove('listening');
    rec.start();
  } catch (e) { toast('Impossible de démarrer la dictée vocale.', 'bad'); }
}

/* L'application n'a qu'un thème, clair. */
function isDarkTheme() { return false; }
function ownerSubscriptionActive(ownerId) {
  const owner = DB.findItem(DB.K.users, ownerId);
  if (!owner || !['owner', 'agency'].includes(owner.role)) return true;
  return true;   /* plateforme gratuite : aucune annonce n'est retirée pour non-paiement */
}
/* Un bien déjà loué ou vendu ne doit plus apparaître aux visiteurs : on ne peut pas
   louer deux fois le même logement. Un immeuble reste visible tant qu'une unité est libre. */
const listable = p => {
  if (p.listingStatus !== 'publiee') return false;
  const us = DB.getData(DB.K.units).filter(x => x.propertyId === p.id && x.status !== 'archivee');
  if (us.length) return us.some(x => x.status === 'libre');
  if (['loue', 'vendu', 'archive', 'maintenance'].includes(p.status)) return false;
  return !DB.getData(DB.K.leases).some(l => l.propertyId === p.id && !l.unitId && l.status === 'actif');
};
const published = () => DB.filterItems(DB.K.properties, p => listable(p) && ownerSubscriptionActive(p.ownerId));
