// =============================================================================
// Tests de sécurité multi-comptes (RLS, déclencheurs, fonctions) — BASE DE TEST.
//
// Chaque test se connecte avec un VRAI compte (Supabase Auth, mot de passe) et
// appelle l'API REST exactement comme le navigateur. Aucun test n'utilise la clé
// service_role. Les tests écrivent des lignes de test : ne JAMAIS lancer contre
// la production (le script refuse une URL qui n'est pas locale, sauf
// DEUKSIL_TEST_AUTORISE=1 sur un projet Supabase de test dédié).
//
//   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… \
//   COMPTES_TEST=supabase/tests-local/comptes-test.json MOT_DE_PASSE_TEST=… \
//   node supabase/tests-local/securite-rls.test.js
// Sortie : tableau des résultats + supabase/tests-local/resultats/securite-rls.json
// =============================================================================
const fs = require('fs'), path = require('path');
const URL_SB = process.env.SUPABASE_URL || 'http://127.0.0.1:54321';
const ANON = process.env.SUPABASE_ANON_KEY;
const MDP = process.env.MOT_DE_PASSE_TEST;
const COMPTES = JSON.parse(fs.readFileSync(process.env.COMPTES_TEST || path.join(__dirname, 'comptes-test.json')));
if (!ANON || !MDP) { console.error('SUPABASE_ANON_KEY et MOT_DE_PASSE_TEST sont requis.'); process.exit(2); }
if (!/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(URL_SB) && process.env.DEUKSIL_TEST_AUTORISE !== '1') {
  console.error('Refus : ces tests écrivent des données. URL non locale : ' + URL_SB); process.exit(2);
}

const compte = cni => { const c = COMPTES.find(x => x.cni === cni); if (!c) throw new Error('compte inconnu ' + cni); return c; };
const JETONS = {};
async function connecter(cni) {
  if (JETONS[cni]) return JETONS[cni];
  const r = await fetch(URL_SB + '/auth/v1/token?grant_type=password', {method: 'POST', headers: {apikey: ANON, 'content-type': 'application/json'},
    body: JSON.stringify({email: compte(cni).email, password: MDP})});
  const j = await r.json(); if (!j.access_token) throw new Error('connexion ' + cni + ' : ' + JSON.stringify(j));
  return (JETONS[cni] = j.access_token);
}
/* Appel REST comme supabase-js. qui = cni ou null (visiteur anonyme). */
async function api(qui, methode, chemin, corps, entetes = {}) {
  const h = {apikey: ANON, 'content-type': 'application/json', Prefer: 'return=representation', ...entetes};
  h.authorization = 'Bearer ' + (qui ? await connecter(qui) : ANON);
  const r = await fetch(URL_SB + '/rest/v1/' + chemin, {method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps)});
  const t = await r.text(); let j; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
  return {status: r.status, data: j};
}
const RESULTATS = [];
async function test(categorie, nom, fn) {
  try { const detail = await fn(); RESULTATS.push({categorie, nom, ok: true, detail: detail || ''}); }
  catch (e) { RESULTATS.push({categorie, nom, ok: false, detail: e.message}); }
}
const attendu = (cond, msg) => { if (!cond) throw new Error(msg); };
const refuse = (r, msg) => attendu(r.status >= 400, `${msg} — attendu refus, obtenu ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
const rien = (r, msg) => attendu(r.status < 300 && Array.isArray(r.data) && r.data.length === 0, `${msg} — attendu 0 ligne, obtenu ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
const uuid = () => require('crypto').randomUUID();

// Comptes du jeu de test
const ADMIN = '1900000000001', PROPRIO_A = '1900000000003', PROPRIO_B = '1900000000007', AGENCE = '1900000000004',
      GESTIONNAIRE = '1900000000011', AGENT = '1900000000012', CLIENT_A = '1900000000005', CLIENT_B = '1900000000006',
      LOCATAIRE = '1900000000002', LOCATAIRE_B = '1900000000301', MANDANT = '1900000000031';
const id = cni => compte(cni).id;

(async () => {
  // Données de référence lues avec les comptes eux-mêmes
  const biensA = (await api(PROPRIO_A, 'GET', `properties?select=id,listing_status,views&owner_id=eq.${id(PROPRIO_A)}`)).data;
  const bienA = biensA.find(b => b.listing_status === 'publiee') || biensA[0];
  const bailLoc = (await api(LOCATAIRE, 'GET', 'leases?select=id,property_id,owner_id,start,months,unit_id')).data[0];

  // --- Isolement entre espaces ------------------------------------------------------
  await test('Isolement', 'Propriétaire A ne voit que ses baux', async () => {
    const r = await api(PROPRIO_A, 'GET', 'leases?select=owner_id');
    attendu(r.data.length > 0 && r.data.every(l => l.owner_id === id(PROPRIO_A)), JSON.stringify(r.data).slice(0, 200));
    return r.data.length + ' baux, tous à A';
  });
  await test('Isolement', 'Propriétaire B ne lit pas un bail de A par son identifiant', async () =>
    rien(await api(PROPRIO_B, 'GET', `leases?id=eq.${bailLoc.id}`), 'lecture croisée'));
  await test('Isolement', 'Propriétaire B ne modifie pas un bien de A', async () => {
    rien(await api(PROPRIO_B, 'PATCH', `properties?id=eq.${bienA.id}`, {title: 'piraté'}), 'modification croisée');
    const v = await api(PROPRIO_A, 'GET', `properties?select=title&id=eq.${bienA.id}`); attendu(v.data[0].title !== 'piraté', 'titre modifié');
  });
  await test('Isolement', 'Propriétaire B ne supprime pas un bien de A', async () =>
    rien(await api(PROPRIO_B, 'DELETE', `properties?id=eq.${bienA.id}`), 'suppression croisée'));
  await test('Isolement', 'Propriétaire B ne crée pas de bail dans l\'espace de A (owner_id falsifié)', async () =>
    refuse(await api(PROPRIO_B, 'POST', 'leases', {owner_id: id(PROPRIO_A), property_id: bienA.id, tenant: 'X', rent: 1, start: '2026-01-01'}), 'owner_id falsifié'));
  await test('Isolement', 'Propriétaire B ne crée pas de bail sur le bien de A dans son propre espace', async () =>
    refuse(await api(PROPRIO_B, 'POST', 'leases', {owner_id: id(PROPRIO_B), property_id: bienA.id, tenant: 'X', rent: 1, start: '2030-01-01'}), 'bien d\'un autre'));
  await test('Isolement', 'Ticket rattaché d\'office à l\'espace du bien (owner_id ignoré)', async () => {
    const biensB = (await api(PROPRIO_B, 'GET', `properties?select=id&owner_id=eq.${id(PROPRIO_B)}&limit=1`)).data;
    const r = await api(PROPRIO_A, 'POST', 'tickets', {owner_id: id(PROPRIO_A), property_id: biensB[0].id, title: 'test'});
    refuse(r, 'ticket sur le bien d\'un autre espace');
  });

  // --- Visiteur anonyme ------------------------------------------------------------------
  await test('Anonyme', 'Ne voit que les annonces publiées', async () => {
    const r = await api(null, 'GET', 'properties?select=listing_status');
    attendu(r.data.length > 0 && r.data.every(p => p.listing_status === 'publiee'), JSON.stringify(r.data).slice(0, 100)); return r.data.length + ' annonces';
  });
  for (const t of ['profiles', 'leases', 'rents', 'billing_docs', 'documents', 'notifications', 'audit_log', 'contact_messages'])
    await test('Anonyme', `Aucune lecture de ${t}`, async () => { const r = await api(null, 'GET', t + '?select=*&limit=1'); attendu(r.status >= 400 || (Array.isArray(r.data) && !r.data.length), r.status + ' ' + JSON.stringify(r.data).slice(0, 100)); return 'HTTP ' + r.status; });
  await test('Anonyme', 'Message de contact : statut imposé « nouveau »', async () =>
    refuse(await api(null, 'POST', 'contact_messages', {name: 'T', email: 't@exemple.sn', subject: 'S', message: 'M', statut: 'traite'}, {Prefer: 'return=minimal'}), 'statut forcé'));
  await test('Anonyme', 'Ne modifie aucune annonce', async () => { const r = await api(null, 'PATCH', `properties?id=eq.${bienA.id}`, {price: 1}); attendu(r.status >= 400 || (Array.isArray(r.data) && !r.data.length), 'HTTP ' + r.status); });

  // --- Élévation de privilèges sur le profil ----------------------------------------------
  for (const [champ, valeur] of [['role', 'admin'], ['status', 'actif'], ['verif_level', 'or'], ['parent_id', id(AGENCE)], ['perms', ['finances']], ['mdp_provisoire', false]])
    await test('Profil', `Un client ne change pas lui-même « ${champ} »`, async () => {
      const avant = (await api(CLIENT_A, 'GET', `profiles?select=${champ}&id=eq.${id(CLIENT_A)}`)).data[0][champ];
      const r = await api(CLIENT_A, 'PATCH', `profiles?id=eq.${id(CLIENT_A)}`, {[champ]: valeur});
      const apres = (await api(CLIENT_A, 'GET', `profiles?select=${champ}&id=eq.${id(CLIENT_A)}`)).data[0][champ];
      attendu(JSON.stringify(avant) === JSON.stringify(apres), `valeur changée (${JSON.stringify(avant)} → ${JSON.stringify(apres)}, HTTP ${r.status})`);
      return 'HTTP ' + r.status;
    });
  await test('Profil', 'Un agent ne s\'attribue pas la permission « finances »', async () => {
    const r = await api(AGENT, 'PATCH', `profiles?id=eq.${id(AGENT)}`, {perms: ['biens', 'finances']});
    const p = (await api(AGENT, 'GET', `profiles?select=perms&id=eq.${id(AGENT)}`)).data[0].perms;
    attendu(!p.includes('finances'), 'permission obtenue'); return 'HTTP ' + r.status;
  });
  await test('Profil', 'Un client ne lit pas le profil d\'un autre client', async () => rien(await api(CLIENT_A, 'GET', `profiles?id=eq.${id(CLIENT_B)}`), 'profil d\'autrui'));

  // --- Équipe ----------------------------------------------------------------------------------
  await test('Équipe', 'Agent sans permission « finances » : aucune facture lue', async () => rien(await api(AGENT, 'GET', 'billing_docs?select=id&limit=5'), 'factures lues'));
  await test('Équipe', 'Agent : aucune suppression de bien de l\'agence', async () => {
    const b = (await api(AGENT, 'GET', `properties?select=id&owner_id=eq.${id(AGENCE)}&limit=1`)).data[0];
    rien(await api(AGENT, 'DELETE', `properties?id=eq.${b.id}`), 'suppression par un agent');
  });
  await test('Équipe', 'Gestionnaire : aucune suppression de bien', async () => {
    const b = (await api(GESTIONNAIRE, 'GET', `properties?select=id&owner_id=eq.${id(PROPRIO_A)}&limit=1`)).data[0];
    rien(await api(GESTIONNAIRE, 'DELETE', `properties?id=eq.${b.id}`), 'suppression par un gestionnaire');
  });
  await test('Équipe', 'Gestionnaire de A : lit les baux de A, pas ceux de B', async () => {
    const r = await api(GESTIONNAIRE, 'GET', 'leases?select=owner_id');
    attendu(r.data.length > 0 && r.data.every(l => l.owner_id === id(PROPRIO_A)), 'baux hors espace'); return r.data.length + ' baux';
  });

  // --- Locataire --------------------------------------------------------------------------------
  await test('Locataire', 'Ne lit que les loyers de son bail', async () => {
    const r = await api(LOCATAIRE, 'GET', 'rents?select=lease_id');
    attendu(r.data.length > 0 && r.data.every(x => x.lease_id === bailLoc.id), 'loyers d\'un autre bail'); return r.data.length + ' échéances';
  });
  await test('Locataire', 'Ne marque pas lui-même un loyer payé', async () => {
    const loyer = (await api(LOCATAIRE, 'GET', 'rents?select=id&paid_at=is.null&limit=1')).data[0];
    if (!loyer) return 'aucun loyer impayé dans le jeu de test (non applicable)';
    rien(await api(LOCATAIRE, 'PATCH', `rents?id=eq.${loyer.id}`, {paid_at: '2026-01-01'}), 'loyer marqué payé');
  });
  await test('Locataire', 'Ne signale pas de panne sur un logement qui n\'est pas le sien', async () => {
    const autre = (await api(null, 'GET', `properties?select=id&id=neq.${bailLoc.property_id}&limit=1`)).data[0];
    refuse(await api(LOCATAIRE, 'POST', 'tickets', {property_id: autre.id, tenant_id: id(LOCATAIRE), title: 'Fuite'}), 'ticket hors logement');
  });
  let ticketRef;
  await test('Locataire', 'Signale une panne sur son logement : numéro attribué par la base', async () => {
    const r = await api(LOCATAIRE, 'POST', 'tickets', {property_id: bailLoc.property_id, tenant_id: id(LOCATAIRE), title: 'Test RLS : fuite', ref: 'n\'importe quoi'});
    attendu(r.status === 201, r.status + ' ' + JSON.stringify(r.data)); ticketRef = r.data[0].ref;
    attendu(r.data[0].owner_id === bailLoc.owner_id, 'ticket pas dans l\'espace du bailleur');
    attendu(/^MNT-\d{4}-\d{5}$/.test(ticketRef), 'référence imposée par le navigateur : ' + ticketRef);
    return 'référence ' + ticketRef;
  });
  await test('Locataire', 'Message de bail : signé « locataire » même si le navigateur dit « owner »', async () => {
    const r = await api(LOCATAIRE, 'POST', 'lease_messages', {lease_id: bailLoc.id, from: 'owner', author_id: id(PROPRIO_A), text: 'Test RLS', read: true});
    attendu(r.status === 201 && r.data[0].from === 'tenant' && r.data[0].author_id === id(LOCATAIRE) && r.data[0].read === false, JSON.stringify(r.data));
  });
  await test('Locataire', 'Ne réécrit pas un message du bailleur', async () => {
    const m = await api(PROPRIO_A, 'POST', 'lease_messages', {lease_id: bailLoc.id, text: 'Message du bailleur (test)'});
    attendu(m.status === 201 && m.data[0].from === 'owner', 'envoi bailleur ' + m.status);
    refuse(await api(LOCATAIRE, 'PATCH', `lease_messages?id=eq.${m.data[0].id}`, {text: 'modifié'}), 'réécriture');
    const lu = await api(LOCATAIRE, 'PATCH', `lease_messages?id=eq.${m.data[0].id}`, {read: true});
    attendu(lu.status === 200 && lu.data[0].read === true, 'marquer lu refusé ' + lu.status);
  });
  await test('Locataire', 'Locataire B ne lit pas le bail du locataire A', async () => rien(await api(LOCATAIRE_B, 'GET', `leases?id=eq.${bailLoc.id}`), 'bail d\'autrui'));

  // --- Client ------------------------------------------------------------------------------------
  let visite;
  await test('Client', 'Demande de visite : statut et agent imposés par la base', async () => {
    const r = await api(CLIENT_A, 'POST', 'visits', {property_id: bienA.id, client_id: id(CLIENT_A), owner_id: id(PROPRIO_B), status: 'acceptee', agent_id: id(AGENT), date: '2031-03-0' + (1 + Math.floor(Math.random() * 8)), time: String(8 + Math.floor(Math.random() * 10)).padStart(2, '0') + ':' + String(Math.floor(Math.random() * 60)).padStart(2, '0')});
    attendu(r.status === 201, r.status + ' ' + JSON.stringify(r.data)); visite = r.data[0];
    attendu(visite.status === 'attente' && visite.agent_id === null && visite.owner_id === id(PROPRIO_A), JSON.stringify(visite));
  });
  await test('Client', 'Ne modifie pas une visite (statut)', async () => rien(await api(CLIENT_A, 'PATCH', `visits?id=eq.${visite.id}`, {status: 'acceptee'}), 'visite modifiée'));
  await test('Client', 'Client B ne voit pas la visite du client A', async () => rien(await api(CLIENT_B, 'GET', `visits?id=eq.${visite.id}`), 'visite d\'autrui'));
  await test('Client', 'Pas de visite au même créneau sur le même bien', async () =>
    refuse(await api(CLIENT_B, 'POST', 'visits', {property_id: bienA.id, client_id: id(CLIENT_B), date: visite.date, time: visite.time}), 'double réservation'));
  await test('Client', 'Ne crée pas de favori au nom d\'un autre', async () =>
    refuse(await api(CLIENT_A, 'POST', 'favorites', {user_id: id(CLIENT_B), property_id: bienA.id}), 'favori usurpé'));

  // --- Annonces ------------------------------------------------------------------------------------
  await test('Annonces', 'Le propriétaire ne s\'attribue pas de niveau de vérification', async () =>
    refuse(await api(PROPRIO_A, 'PATCH', `properties?id=eq.${bienA.id}`, {verif_level: 'or'}), 'verif_level'));
  await test('Annonces', 'Création : compteurs remis à zéro, niveau de vérification ignoré', async () => {
    const r = await api(PROPRIO_A, 'POST', 'properties', {owner_id: id(PROPRIO_A), title: 'Test RLS', type: 'appartement', transaction: 'location', views: 9999, contacts: 50, verif_level: 'or', listing_status: 'brouillon'});
    attendu(r.status === 201 && r.data[0].views === 0 && r.data[0].contacts === 0 && r.data[0].verif_level === null, JSON.stringify(r.data).slice(0, 200));
    await api(PROPRIO_A, 'DELETE', `properties?id=eq.${r.data[0].id}`);
  });
  await test('Annonces', 'Compteur de vues : +1 par la fonction, champ arbitraire refusé', async () => {
    const avant = biensA.find(b => b.id === bienA.id).views;
    const ok = await api(CLIENT_A, 'POST', 'rpc/compter', {bien: bienA.id, champ: 'views'});
    const ko = await api(CLIENT_A, 'POST', 'rpc/compter', {bien: bienA.id, champ: 'price; drop table properties'});
    const apres = (await api(PROPRIO_A, 'GET', `properties?select=views&id=eq.${bienA.id}`)).data[0].views;
    attendu(ok.status < 300 && ko.status >= 400 && apres === avant + 1, `ok ${ok.status}, ko ${ko.status}, vues ${avant}→${apres}`);
  });

  // --- Notifications, messagerie ----------------------------------------------------------------------
  await test('Notifications', 'Pas d\'insertion directe pour un autre compte', async () =>
    refuse(await api(CLIENT_A, 'POST', 'notifications', {user_id: id(CLIENT_B), text: 'spam'}), 'notification directe'));
  await test('Notifications', 'notifier() refuse un destinataire sans relation', async () =>
    refuse(await api(CLIENT_A, 'POST', 'rpc/notifier', {dest: id(CLIENT_B), texte: 'spam'}), 'notifier sans relation'));
  await test('Notifications', 'Lecture : uniquement les siennes', async () => {
    const r = await api(CLIENT_A, 'GET', 'notifications?select=user_id'); attendu(r.data.every(n => n.user_id === id(CLIENT_A)), 'notifications d\'autrui');
    return r.data.length + ' notifications';
  });
  await test('Messagerie', 'Les participants d\'une conversation ne changent pas', async () => {
    const c = await api(CLIENT_A, 'POST', 'conversations', {participants: [id(CLIENT_A), id(PROPRIO_A)], property_id: bienA.id});
    attendu(c.status === 201, 'création ' + c.status + ' ' + JSON.stringify(c.data));
    refuse(await api(CLIENT_A, 'PATCH', `conversations?id=eq.${c.data[0].id}`, {participants: [id(CLIENT_A), id(PROPRIO_A), id(CLIENT_B)]}), 'ajout de participant');
    rien(await api(CLIENT_B, 'GET', `conversations?id=eq.${c.data[0].id}`), 'lecture par un tiers');
    rien(await api(CLIENT_B, 'POST', 'conversation_messages', {conversation_id: c.data[0].id, sender_id: id(CLIENT_B), text: 'intrus'}).then(r => r.status >= 400 ? {status: 200, data: []} : r), 'message d\'un tiers');
  });

  // --- Mandant, liens agence ----------------------------------------------------------------------------
  await test('Mandant', 'Lit les factures de ses biens mais ne les modifie pas', async () => {
    const f = (await api(MANDANT, 'GET', 'billing_docs?select=id,items&limit=1')).data[0];
    if (!f) return 'aucune facture sur ses biens dans le jeu de test (non applicable)';
    rien(await api(MANDANT, 'PATCH', `billing_docs?id=eq.${f.id}`, {items: []}), 'facture modifiée');
  });
  await test('Liens agence', 'Le propriétaire n\'accepte pas lui-même sa demande', async () => {
    const d = await api(PROPRIO_B, 'POST', 'agency_link_requests', {proprio_id: id(PROPRIO_B), agence_id: id(AGENCE), message: 'test RLS'});
    attendu(d.status === 201, 'demande ' + d.status + ' ' + JSON.stringify(d.data));
    refuse(await api(PROPRIO_B, 'PATCH', `agency_link_requests?id=eq.${d.data[0].id}`, {statut: 'acceptee'}), 'auto-acceptation');
    const an = await api(PROPRIO_B, 'PATCH', `agency_link_requests?id=eq.${d.data[0].id}`, {statut: 'annulee'});
    attendu(an.status === 200 && an.data[0].statut === 'annulee', 'annulation refusée ' + an.status);
    refuse(await api(AGENCE, 'PATCH', `agency_link_requests?id=eq.${d.data[0].id}`, {statut: 'acceptee'}), 'acceptation après annulation');
  });

  await test('Comptes', 'rattacher_locataire : bail d\'un autre espace refusé', async () =>
    refuse(await api(PROPRIO_B, 'POST', 'rpc/rattacher_locataire', {bail: bailLoc.id, compte: id(CLIENT_A)}), 'bail d\'autrui'));
  await test('Comptes', 'rattacher_locataire : compte sans relation refusé (profil non approprié)', async () => {
    const r = await api(PROPRIO_A, 'POST', 'rpc/rattacher_locataire', {bail: bailLoc.id, compte: id(LOCATAIRE_B)});
    refuse(r, 'rattachement sans relation');
    const p = (await api(ADMIN, 'GET', `profiles?select=owner_ref,lease_ids&id=eq.${id(LOCATAIRE_B)}`)).data[0];
    attendu(p.owner_ref !== id(PROPRIO_A) && !(p.lease_ids || []).includes(bailLoc.id), 'profil modifié');
  });
  await test('Comptes', 'rattacher_locataire : un membre d\'équipe ne rattache pas', async () =>
    refuse(await api(GESTIONNAIRE, 'POST', 'rpc/rattacher_locataire', {bail: bailLoc.id, compte: id(CLIENT_A)}), 'membre'));
  await test('Comptes', 'gerer-acces : un client ne crée pas de compte', async () => {
    const r = await fetch(URL_SB + '/functions/v1/gerer-acces', {method: 'POST', headers: {apikey: ANON, authorization: 'Bearer ' + await connecter(CLIENT_A), 'content-type': 'application/json'},
      body: JSON.stringify({action: 'creer', role: 'manager', email: 'intrus@deuksil.test', parentId: id(CLIENT_A)})});
    attendu(r.status === 403, 'HTTP ' + r.status);
  });
  await test('Comptes', 'gerer-acces : un propriétaire ne supprime pas le compte d\'un autre', async () => {
    const r = await fetch(URL_SB + '/functions/v1/gerer-acces', {method: 'POST', headers: {apikey: ANON, authorization: 'Bearer ' + await connecter(PROPRIO_B), 'content-type': 'application/json'},
      body: JSON.stringify({action: 'supprimer', id: id(LOCATAIRE)})});
    attendu(r.status === 403, 'HTTP ' + r.status);
  });
  await test('Comptes', 'gerer-acces : sans jeton, refus', async () => {
    const r = await fetch(URL_SB + '/functions/v1/gerer-acces', {method: 'POST', headers: {apikey: ANON, 'content-type': 'application/json'}, body: JSON.stringify({action: 'creer'})});
    attendu(r.status === 401, 'HTTP ' + r.status);
  });

  // --- Journal, règles métier ----------------------------------------------------------------------------
  await test('Journal', 'Le journal d\'audit ne se modifie ni ne s\'efface', async () => {
    const j = await api(PROPRIO_A, 'POST', 'audit_log', {owner_id: id(PROPRIO_A), action: 'Test RLS'});
    attendu(j.status === 201, 'écriture ' + j.status);
    const m = await api(PROPRIO_A, 'PATCH', `audit_log?id=eq.${j.data[0].id}`, {action: 'falsifié'});
    const s = await api(PROPRIO_A, 'DELETE', `audit_log?id=eq.${j.data[0].id}`);
    attendu((m.status >= 400 || !m.data.length) && (s.status >= 400 || !s.data.length), `modif ${m.status}, suppr ${s.status}`);
  });
  await test('Journal', 'Écriture au nom d\'un autre acteur refusée', async () =>
    refuse(await api(PROPRIO_A, 'POST', 'audit_log', {owner_id: id(PROPRIO_A), actor_id: id(PROPRIO_B), action: 'usurpé'}), 'acteur usurpé'));
  await test('Règles métier', 'Deux baux actifs qui se chevauchent sur le même logement : refusé', async () => {
    const r = await api(PROPRIO_A, 'POST', 'leases', {owner_id: bailLoc.owner_id, property_id: bailLoc.property_id, unit_id: bailLoc.unit_id, tenant: 'Doublon', rent: 1000, start: bailLoc.start, months: 12});
    refuse(r, 'chevauchement'); return 'code ' + (r.data && r.data.code);
  });
  await test('Règles métier', 'Numérotation concurrente : 12 factures simultanées, 12 numéros distincts', async () => {
    const ref = 'FAC-2026-77777';
    const rs = await Promise.all(Array.from({length: 12}, () => api(PROPRIO_A, 'POST', 'billing_docs', {owner_id: id(PROPRIO_A), type: 'FAC', ref, items: []})));
    attendu(rs.every(r => r.status === 201), rs.map(r => r.status).join(','));
    const refs = rs.map(r => r.data[0].ref); attendu(new Set(refs).size === 12, 'doublons : ' + refs.join(' '));
    await Promise.all(rs.map(r => api(PROPRIO_A, 'DELETE', `billing_docs?id=eq.${r.data[0].id}`)));
    return refs.sort().slice(0, 2).join(', ') + '…';
  });

  // --- Injections ------------------------------------------------------------------------------------
  const charges = ["' or '1'='1", "'; drop table public.properties; --", "%' union select id, email from auth.users --", '") or 1=1 --', '\\x27; select pg_sleep(5); --'];
  await test('Injection', 'Filtres PostgREST avec charges SQL : traités comme du texte', async () => {
    for (const c of charges) {
      const r = await api(null, 'GET', 'properties?select=id&title=eq.' + encodeURIComponent(c));
      attendu(r.status === 200 && Array.isArray(r.data) && r.data.length === 0, c + ' → ' + r.status + ' ' + JSON.stringify(r.data).slice(0, 80));
      const r2 = await api(null, 'GET', 'properties?select=id&title=ilike.' + encodeURIComponent('*' + c + '*'));
      attendu(r2.status === 200 && r2.data.length === 0, 'ilike ' + c + ' → ' + r2.status);
    }
    const t0 = Date.now(); await api(null, 'GET', 'properties?select=id&title=eq.' + encodeURIComponent("x'; select pg_sleep(3); --"));
    attendu(Date.now() - t0 < 2500, 'délai suspect'); return charges.length + ' charges × 2 opérateurs';
  });
  await test('Injection', 'Charge SQL enregistrée comme texte puis relue à l\'identique', async () => {
    const c = charges[1], r = await api(PROPRIO_A, 'POST', 'providers', {owner_id: id(PROPRIO_A), name: c, job: '<img src=x onerror=alert(1)>'});
    attendu(r.status === 201 && r.data[0].name === c, 'écriture ' + r.status);
    const n = await api(null, 'GET', 'properties?select=id&limit=1'); attendu(n.status === 200 && n.data.length === 1, 'table properties altérée');
    await api(PROPRIO_A, 'DELETE', `providers?id=eq.${r.data[0].id}`);
  });
  await test('Injection', 'Colonnes et tables arbitraires dans select/order refusées ou sans effet', async () => {
    const a = await api(null, 'GET', 'properties?select=id,owner:profiles!properties_owner_id_fkey(email)&limit=1');
    attendu(a.status >= 400 || a.data.every(x => !x.owner || !x.owner.email), 'jointure vers profiles : ' + JSON.stringify(a.data).slice(0, 120));
    const a2 = await api(CLIENT_A, 'GET', 'properties?select=id,owner:profiles!properties_owner_id_fkey(email,cni,phone)&limit=20');
    attendu(a2.status >= 400 || a2.data.every(x => !x.owner), 'profils des annonceurs lus par jointure : ' + JSON.stringify(a2.data).slice(0, 120));
    const b = await api(null, 'GET', 'properties?select=id&order=' + encodeURIComponent('id;drop table x'));
    attendu(b.status >= 400, 'order injecté accepté ' + b.status);
    const c = await api(CLIENT_A, 'GET', 'auth.users?select=*'); attendu(c.status >= 400, 'schéma auth exposé ' + c.status);
    const d = await api(CLIENT_A, 'POST', 'rpc/generer_rappels', {}); attendu(d.status >= 400, 'fonction serveur exposée ' + d.status);
  });

  // --- Administrateur ----------------------------------------------------------------------------------
  await test('Admin', 'L\'administrateur lit tous les espaces', async () => {
    const r = await api(ADMIN, 'GET', 'leases?select=owner_id'); const espaces = new Set(r.data.map(x => x.owner_id));
    attendu(espaces.size > 1, 'un seul espace visible'); return r.data.length + ' baux, ' + espaces.size + ' espaces';
  });

  // Nettoyage des lignes de test créées ci-dessus (base de test)
  if (visite) await api(PROPRIO_A, 'DELETE', `visits?id=eq.${visite.id}`);

  // --- Rapport ----------------------------------------------------------------------------------------
  const ok = RESULTATS.filter(r => r.ok).length;
  for (const r of RESULTATS) console.log(`${r.ok ? 'OK ' : 'ÉCHEC'}  [${r.categorie}] ${r.nom}${r.detail ? ' — ' + r.detail : ''}`);
  console.log(`\n${ok}/${RESULTATS.length} tests réussis`);
  const dossier = path.join(__dirname, 'resultats'); fs.mkdirSync(dossier, {recursive: true});
  fs.writeFileSync(path.join(dossier, 'securite-rls.json'), JSON.stringify({date: new Date().toISOString(), url: URL_SB, total: RESULTATS.length, reussis: ok, resultats: RESULTATS}, null, 2));
  process.exit(ok === RESULTATS.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
