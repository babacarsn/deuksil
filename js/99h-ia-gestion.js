/* ==========================================================================
   99h-ia-gestion.js — Assistant DEUKSIL : questions sur la gestion.
   Quand un utilisateur connecté pose une question, l'assistant reçoit un
   résumé des données QU'IL VOIT DÉJÀ dans son espace (copie en mémoire
   chargée sous la RLS de la base) : biens, baux, loyers, devis, proformas,
   factures, avoirs, paiements, dépenses, contrats, travaux, ventes,
   honoraires, mandants, visites… Les droits d'un membre d'équipe sont
   respectés (un gestionnaire sans droit « finances » ne reçoit pas les
   factures). Rien n'est modifié : l'assistant lit et conseille.
   Le serveur (fonction assistant-ia) n'accepte ce mode que pour un
   utilisateur connecté et avec l'offre payante de l'API Gemini.
   ========================================================================== */
const IA_MAX = 26000;                       // taille maximale du résumé (caractères)
const iaRole = u => !u ? 'visiteur non connecté'
  : u.member ? ({manager: 'gestionnaire', agent: 'agent'}[u.member.role] || 'membre d\'équipe') + ' de ' + (u.role === 'agency' ? 'l\'agence ' + (u.agencyName || '') : 'l\'espace de ' + u.firstName + ' ' + u.lastName)
  : u.ownerRec ? 'propriétaire mandant (biens confiés à une agence)'
  : ({client: 'client', tenant: 'locataire', owner: 'propriétaire', agency: 'agence', admin: 'administrateur'}[u.role] || u.role);
const iaM = n => money(Math.round(+n || 0));
const iaD = s => s ? String(s).slice(0, 10) : '—';
const iaBien = id => { const p = id && gProp(id); return p ? p.title : '—'; };
const iaPeut = (u, k) => { try { return gAllowed(u, k); } catch (e) { return !u.member; } };
const iaSafe = f => { try { return f(); } catch (e) { console.warn('[IA] résumé', e); return ''; } };
const iaLignes = (titre, L, max, fmt) => !L.length ? `## ${titre}\naucun\n` :
  `## ${titre} (${L.length}${L.length > max ? `, ${max} affichés` : ''})\n` + L.slice(0, max).map(fmt).join('\n') + '\n';
const iaParMois = (L, cle, val) => { const o = {}; L.forEach(x => { const m = String(cle(x) || '').slice(0, 7); if (m) o[m] = (o[m] || 0) + val(x); }); return o; };
const iaMois12 = () => [...Array(12)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i); return d.toISOString().slice(0, 7); });

/* --- Résumé des données de l'espace ------------------------------------- */
function iaContexte(u) {
  if (!u) return '';
  const auj = ymd(), S = [];
  S.push(`# Données de l'espace de l'utilisateur (au ${auj})\nMontants en FCFA. Ce sont les seules données dont tu disposes.`);

  if (u.role === 'admin') {
    S.push(iaSafe(() => {
      const users = DB.getData(DB.K.users), props = DB.getData(DB.K.properties);
      const parRole = {}; users.forEach(x => { parRole[x.role] = (parRole[x.role] || 0) + 1; });
      const att = props.filter(p => p.listingStatus === 'attente' || p.listingStatus === 'validation');
      return `## Plateforme\ncomptes par rôle : ${JSON.stringify(parRole)}\nannonces : ${props.length} (publiées ${props.filter(p => p.listingStatus === 'publiee').length}, à valider ${att.length})\n`
        + `signalements ouverts : ${DB.getData(DB.K.reports).filter(r => !['traite', 'rejete', 'clos'].includes(r.status)).length}\n`
        + `messages de contact non traités : ${(DB.getData(DB.K.contacts) || []).filter(c => (c.status || 'nouveau') === 'nouveau').length}\n`
        + iaLignes('Annonces à valider', att, 30, p => `${p.title} | ${p.city} | ${iaM(p.price)} | déposée le ${iaD(p.createdAt)}`);
    }));
  }

  if (u.role === 'tenant') {
    S.push(iaSafe(() => {
      const ids = Array.isArray(u.leaseIds) && u.leaseIds.length ? u.leaseIds : [u.leaseId];
      return ids.filter(Boolean).map(id => {
        const l = DB.findItem(DB.K.leases, id); if (!l) return '';
        const R = DB.filterItems(DB.K.rents, r => r.leaseId === l.id).sort((a, b) => a.month < b.month ? -1 : 1);
        const ret = R.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
        return `## Mon bail : ${iaBien(l.propertyId)}\nloyer ${iaM(l.rent)} / mois, caution ${iaM(l.deposit)}, du ${iaD(l.start)} au ${iaD(leaseEnd(l))}, statut ${l.status}\n`
          + `loyers en retard : ${ret.length} (${iaM(ret.reduce((s, r) => s + r.amount - rPaid(r), 0))})\n`
          + iaLignes('Mes loyers', R.slice(-14), 14, r => `${r.month} | dû ${iaM(r.amount)} | payé ${iaM(rPaid(r))} | ${rentState(r)[0]}${r.paidAt ? ' le ' + iaD(r.paidAt) + ' (quittance disponible)' : ''}`);
      }).join('\n') + iaLignes('Mes signalements (travaux)', DB.getData(DB.K.tickets), 15, t => `${t.ref || ''} ${t.title} | ${tkSt(t)} | ${iaD(t.createdAt)}`);
    }));
  }

  if (['client', 'tenant'].includes(u.role)) {
    S.push(iaSafe(() => iaLignes('Mes visites', DB.getData(DB.K.visits), 20, v => `${iaBien(v.propertyId)} | ${iaD(v.date)} ${v.time || ''} | ${v.status}`)
      + `favoris : ${DB.getData(DB.K.favorites).length}\n`));
  }

  if (u.ownerRec) {
    const mesBiens = DB.filterItems(DB.K.properties, p => p.clientOwnerId === u.ownerRec), ids = new Set(mesBiens.map(p => p.id));
    S.push(iaSafe(() => iaLignes('Mes biens confiés à l\'agence', mesBiens, 40, p => `${p.title} | ${p.city} | ${p.transaction} | ${iaM(p.price)} | ${STATUS_LABEL[p.status] || p.status}`)
      + iaLignes('Mes reversements', DB.getData(DB.K.transfers).slice().reverse(), 24, t => `${t.ref || ''} | ${t.month} | encaissé ${iaM(t.encaisse)} | dépenses ${iaM(t.dep)} | commission ${iaM(t.com)} | versé ${iaM(t.amount)} | ${t.status || ''} ${iaD(t.paidOn)}`)
      + iaLignes('Baux de mes biens', DB.getData(DB.K.leases).filter(l => l.status === 'actif' && ids.has(l.propertyId)), 30, l => `${l.tenant} | ${iaBien(l.propertyId)} | loyer ${iaM(l.rent)} | fin ${iaD(leaseEnd(l))}`)));
  }

  if (['owner', 'agency'].includes(u.role) && !u.ownerRec) {
    const props = iaSafe(() => myProps(u)) || [];
    S.push(iaSafe(() => {
      const st = {}; props.forEach(p => { st[p.status] = (st[p.status] || 0) + 1; });
      return `## Biens (${props.length}) — par statut : ${JSON.stringify(st)}\n` + props.slice(0, 60).map(p =>
        `${p.title} | ${p.type} | ${p.city}${p.quartier ? ', ' + p.quartier : ''} | ${p.transaction} | ${iaM(p.price)} | ${STATUS_LABEL[p.status] || p.status} | annonce ${p.listingStatus} | vues ${p.views || 0}`).join('\n') + '\n';
    }));
    if (iaPeut(u, 'leases')) S.push(iaSafe(() => {
      const L = gMine('leases', u), act = L.filter(l => l.status === 'actif');
      const fin60 = act.filter(l => { const d = daysBetween(auj, leaseEnd(l)); return d >= 0 && d <= 60; });
      return iaLignes('Baux actifs', act, 60, l => `${l.tenant} | ${iaBien(l.propertyId)}${l.unitRef ? ' ' + l.unitRef : ''} | loyer ${iaM(l.rent)} | caution ${iaM(l.deposit)} | du ${iaD(l.start)} au ${iaD(leaseEnd(l))}${l.preavis ? ' | préavis donné' : ''}`)
        + iaLignes('Baux qui finissent dans les 60 jours', fin60, 20, l => `${l.tenant} | ${iaBien(l.propertyId)} | fin ${iaD(leaseEnd(l))}`)
        + `baux terminés : ${L.length - act.length}\n`;
    }));
    if (iaPeut(u, 'rents')) S.push(iaSafe(() => {
      const R = gMine('rents', u), m = auj.slice(0, 7);
      const ret = R.filter(r => !r.paidAt && rentState(r)[1] === 'bad');
      const nom = r => (DB.findItem(DB.K.leases, r.leaseId) || {}).tenant || '—';
      const enc = iaParMois(R.flatMap(r => rPays(r)), p => p.date, p => +p.amount || 0);
      return `## Loyers\nmois en cours (${m}) : attendu ${iaM(R.filter(r => r.month === m).reduce((s, r) => s + r.amount, 0))}, encaissé ${iaM(R.filter(r => r.month === m).reduce((s, r) => s + rPaid(r), 0))}\n`
        + `encaissements des 12 derniers mois : ${iaMois12().map(k => `${k} ${iaM(enc[k] || 0)}`).join(' ; ')}\n`
        + iaLignes('Loyers en retard', ret, 60, r => `${nom(r)} | ${iaBien(r.propertyId || (DB.findItem(DB.K.leases, r.leaseId) || {}).propertyId)} | ${r.month} | reste ${iaM(r.amount - rPaid(r))} | relances ${(r.reminders || []).length || 0}`);
    }));
    if (iaPeut(u, 'docs')) S.push(iaSafe(() => {
      const D = gMine('docs', u).slice().sort((a, b) => (b.createdAt || '') < (a.createdAt || '') ? -1 : 1);
      const fac = D.filter(d => d.type === 'FAC'), imp = fac.filter(d => dRest(d) > 0);
      const tot = t => D.filter(d => d.type === t).reduce((s, d) => s + dTot(d), 0);
      const pays = gMine('fpay', u);
      return `## Devis, proformas, factures, avoirs\ntotaux : devis ${iaM(tot('DEV'))}, proformas ${iaM(tot('PF'))}, factures ${iaM(tot('FAC'))}, avoirs ${iaM(tot('AV'))}\n`
        + `factures impayées : ${imp.length}, reste à encaisser ${iaM(imp.reduce((s, d) => s + dRest(d), 0))} (dont en retard ${iaM(imp.filter(d => d.due < auj).reduce((s, d) => s + dRest(d), 0))})\n`
        + iaLignes('Pièces (plus récentes d\'abord)', D, 70, d => `${d.ref} | ${DT[d.type] || d.type} | ${d.client || '—'} | ${iaBien(d.propertyId)} | créée ${iaD(d.createdAt)} | total TTC ${iaM(dTot(d))}${d.type === 'FAC' ? ` | payé ${iaM(dPaid(d))} | reste ${iaM(dRest(d))} | échéance ${iaD(d.due)}` : ''} | ${dState(d)[0]} | ${d.items.map(i => `${i.label} ×${i.qty}`).join(', ').slice(0, 120)}`)
        + iaLignes('Paiements reçus (plus récents)', pays.slice().reverse(), 40, p => `${p.rec || p.ref || ''} | ${p.docRef || '—'} | ${p.client || '—'} | ${iaM(p.amount)} | ${p.method || ''} | ${iaD(p.createdAt)}`);
    }));
    if (iaPeut(u, 'expenses')) S.push(iaSafe(() => {
      const E = gMine('expenses', u), an = auj.slice(0, 4);
      const parCat = {}; E.filter(x => (x.date || '').startsWith(an)).forEach(x => { parCat[x.cat] = (parCat[x.cat] || 0) + x.amount; });
      return `## Dépenses\nannée ${an} par catégorie : ${Object.entries(parCat).map(([k, v]) => `${k} ${iaM(v)}`).join(' ; ') || 'aucune'}\n`
        + iaLignes('Dernières dépenses', E.slice().reverse(), 25, x => `${iaD(x.date)} | ${x.cat} | ${x.supplier || ''} | ${iaBien(x.propertyId)} | ${iaM(x.amount)}`);
    }));
    if (iaPeut(u, 'contracts')) S.push(iaSafe(() => {
      const C = gMine('contracts', u);
      return iaLignes('Contrats', C, 50, c => `${c.ref} | ${c.type}${c.genre ? ' (' + c.genre + ')' : ''} | ${c.party || '—'} | ${iaBien(c.propertyId)} | du ${iaD(c.start)} au ${iaD(c.end)} | ${iaM(c.amount)} | ${c.status}${c.end && c.status === 'actif' && daysBetween(auj, c.end) <= 60 ? ' | expire dans ' + daysBetween(auj, c.end) + ' j' : ''}`);
    }));
    if (iaPeut(u, 'tickets')) S.push(iaSafe(() => iaLignes('Travaux et interventions non terminés', gMine('tickets', u).filter(t => !['terminée', 'résolu', 'fermé'].includes(tkSt(t))), 30,
      t => `${t.ref || ''} | ${t.title} | ${iaBien(t.propertyId)} | priorité ${t.priority || '—'} | ${tkSt(t)} | coût ${iaM(t.cost)} | ouvert ${iaD(t.createdAt)}`)));
    if (iaPeut(u, 'deals')) S.push(iaSafe(() => iaLignes('Ventes en cours', gMine('deals', u).filter(d => d.stage !== 'signe'), 30,
      d => `${iaBien(d.propertyId)} | acheteur ${d.buyer || '—'} | étape ${(STAGES.find(s => s[0] === d.stage) || [0, d.stage])[1]} | prix ${iaM(d.price)} | offre ${iaM(d.offer)} | échéance ${iaD(d.deadline)}`)));
    if (u.role === 'agency' && iaPeut(u, 'owners')) S.push(iaSafe(() => {
      const O = gMine('owners', u), mois = auj.slice(0, 7);
      return iaLignes('Propriétaires mandants', O, 30, o => { const b = ownerBalance(u, o, mois); return `${o.name} | commission ${commissionRate(u, o)} % | ce mois : encaissé ${iaM(b.encaisse)}, dépenses ${iaM(b.dep)}, commission ${iaM(b.com)}, net à reverser ${iaM(b.net)}`; })
        + iaLignes('Honoraires non encaissés', gMine('fees', u).filter(f => f.status !== 'payee' && f.status !== 'payé'), 30, f => `${f.ref || ''} | ${f.kind} | ${f.payerName || f.payer || '—'} | ${iaM(f.ttc)} | ${f.status}`);
    }));
    if (iaPeut(u, 'visits') || !u.member) S.push(iaSafe(() => iaLignes('Visites à venir', DB.getData(DB.K.visits).filter(v => v.ownerId === u.id && (v.date || '') >= auj && v.status !== 'refusee'), 30,
      v => `${iaD(v.date)} ${v.time || ''} | ${iaBien(v.propertyId)} | ${v.clientName || '—'} | ${v.status}`)));
    if (u.role === 'agency') S.push(iaSafe(() => iaLignes('Demandes de clients (recherches à satisfaire)', DB.getData(DB.K.demandes).filter(x => x.status === 'active'), 30,
      x => `${x.name} | ${x.transaction} ${x.type || ''} | budget ${iaM(x.budget)} | ${x.lieu || ''} | ${x.rooms || 0} ch.`)));
  }
  let t = S.filter(Boolean).join('\n');
  if (t.length > IA_MAX) t = t.slice(0, IA_MAX) + '\n[résumé tronqué : demander à l\'utilisateur de préciser sa question]';
  return t;
}

/* --- Consignes ------------------------------------------------------------- */
aiChatRules = function () {
  const u = Auth.current();
  return `Tu es l'assistant DEUKSIL, une plateforme immobilière et un logiciel de gestion locative au Sénégal (location, vente, terrains).
Tu aides à trouver un logement, à utiliser la plateforme, et, pour un utilisateur connecté, à suivre et piloter sa gestion : biens, baux, loyers, impayés, devis, proformas, factures, avoirs, paiements, dépenses, contrats, travaux, ventes, honoraires, reversements aux propriétaires.
La plateforme est gratuite : pas de frais, pas d'abonnement, pas de commission. Aucun paiement ne transite par DEUKSIL.
Règles :
- Réponds en français, clairement, avec des chiffres précis quand ils figurent dans les données (cite les références : FAC-2026-00012, CTR-…, nom du locataire).
- N'utilise QUE les données fournies plus bas. Si l'information n'y est pas, dis-le simplement ; n'invente jamais un montant, une date, un nom ou un bien.
- Pour aider à décider : pose le constat chiffré, puis 2 ou 3 actions concrètes et classées par priorité (relancer, renouveler, réviser un loyer, planifier des travaux…), en expliquant pourquoi. Signale ce qui demande l'avis d'un professionnel (juridique, fiscal).
- Tu ne peux rien modifier dans l'application : indique la page où agir (Gestion → Loyers, Devis & Factures, Contrats, Travaux…).
- Réponse courte par défaut (5 à 8 lignes, listes si utile) ; plus détaillée seulement si on le demande.
Utilisateur actuel : ${iaRole(u)}.`;
};

/* --- Envoi d'une question -------------------------------------------------- */
let iaGestionCoupee = false;               // le serveur a refusé le mode gestion : questions générales seulement
async function iaAppeler(corps) {
  const {data, error} = await SB.functions.invoke('assistant-ia', {body: corps});
  if (!error && data && typeof data.text === 'string') return data.text;
  let j = {}; try { j = await error.context.json(); } catch (e) {}
  const err = new Error(j.message || 'erreur'); err.code = j.code || (error && error.context && error.context.status) || 'erreur'; throw err;
}
sendAiChat = async function (text) {
  const msg = (text || '').trim();
  if (!msg || aiChatBusy) return;
  aiChatBusy = true;
  aiChatHistory.push({role: 'user', content: msg});
  aiChatHistory.push({role: 'assistant', content: ''});
  renderAiChatInPlace();
  const u = Auth.current(), turns = [{role: 'user', content: aiChatRules()}, ...aiChatHistory.slice(0, -1).slice(-12)];
  const avecDonnees = !!(u && typeof SB !== 'undefined' && SB && !iaGestionCoupee);
  try {
    let rep;
    try { rep = await iaAppeler({mode: 'chat', turns, ...(avecDonnees ? {contexte: iaContexte(u)} : {})}); }
    catch (e) {
      if (!avecDonnees || !['gestion_off', 'connexion', 413].includes(e.code)) throw e;
      if (e.code === 'gestion_off') iaGestionCoupee = true;
      rep = await iaAppeler({mode: 'chat', turns});
      rep += '\n\n(' + e.message + ' Je réponds sans consulter les données de votre espace.)';
    }
    aiChatHistory[aiChatHistory.length - 1].content = rep;
  } catch (e) {
    aiChatHistory[aiChatHistory.length - 1].content = e.code === 429 || /Trop de demandes/.test(e.message) ? 'Trop de demandes, réessayez dans un instant.' : 'L\'assistant ne répond pas pour le moment. Réessayez dans un instant.';
  }
  aiChatBusy = false;
  renderAiChatInPlace();
};

/* --- Questions toutes prêtes selon le profil ------------------------------ */
function iaSuggestions(u) {
  if (!u) return ['Comment publier un bien ?', 'DEUKSIL est-il payant ?', 'Comment se passe une visite ?'];
  if (u.role === 'admin') return ['Combien d\'annonces attendent une validation ?', 'Résume l\'activité de la plateforme', 'Que dois-je traiter en priorité ?'];
  if (u.role === 'tenant') return ['Ai-je des loyers en retard ?', 'Quand finit mon bail ?', 'Où sont mes quittances ?'];
  if (u.role === 'client') return ['Où en sont mes demandes de visite ?', 'Aide-moi à préciser ma recherche', 'Comment contacter un propriétaire ?'];
  return ['Quelles factures sont impayées ?', 'Résume mon mois : loyers, factures, dépenses', 'Quels contrats ou baux arrivent à échéance ?', 'Que dois-je faire en priorité cette semaine ?'];
}
const _renderAiChatInPlace = renderAiChatInPlace;
renderAiChatInPlace = function () {
  _renderAiChatInPlace();
  const list = $('#ai-chat-list'); if (!list || aiChatHistory.length) return;
  const u = Auth.current();
  list.innerHTML = `<p class="small muted">${u ? 'Posez une question sur votre espace (factures, devis, contrats, loyers, travaux…) ou sur DEUKSIL.' : 'Posez une question sur DEUKSIL, une annonce, ou dites ce que vous cherchez.'}</p>
    <div class="ia-sugg">${iaSuggestions(u).map(q => `<button type="button" class="ia-chip" data-ia-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    ${u ? '<p class="small muted ia-note">Pour répondre, l\'assistant lit les données de votre espace (celles que vous voyez déjà). Il ne modifie rien.</p>' : ''}`;
};
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-ia-q]'); if (!b) return;
  e.preventDefault(); sendAiChat(b.dataset.iaQ);
});
document.head.insertAdjacentHTML('beforeend', '<style>.ia-sugg{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}'
  + '.ia-chip{border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);border-radius:999px;padding:7px 12px;font:inherit;font-size:.86rem;cursor:pointer;text-align:left}'
  + '.ia-chip:hover{border-color:var(--brand);color:var(--brand)}.ia-note{font-size:.78rem;margin-top:8px}'
  + '#ai-chat-list .bubble{white-space:pre-wrap}</style>');

/* --- Déconnexion : la conversation de ce compte est effacée de l'appareil -- */
(() => {
  const _logout = Auth.logout;
  Auth.logout = async function (...a) {
    try { localStorage.removeItem(aiCle()); } catch (e) {}
    aiChatHistory = []; iaGestionCoupee = false;
    return _logout.apply(this, a);
  };
})();
