/* =============================================================================
   99m-ia-agent.js — Assistant DEUKSIL qui consulte et agit.

   Pour un utilisateur connecté, l'assistant ne reçoit plus un simple résumé : il
   dispose d'OUTILS qu'il appelle au fil de la conversation (appel de fonctions
   Gemini, relayé par la fonction serveur « assistant-ia », mode « agent ») :
     - lire / calculer : n'importe quelle donnée de l'espace de l'utilisateur
       (biens, baux, loyers, devis, factures, paiements, dépenses, contrats,
       travaux, ventes, mandants, visites…), filtres, totaux, regroupements ;
     - agir : créer une facture, encaisser un loyer, planifier une visite…
       Chaque action est PROPOSÉE à l'écran et n'est faite qu'après un clic sur
       « Confirmer ». Elle passe par la même couche de données que les écrans
       (règles de la base, RLS) : l'assistant n'a jamais plus de droits que
       l'utilisateur, et les droits d'un membre d'équipe sont respectés.
   Les données lues sont celles que l'utilisateur voit déjà (copie en mémoire
   chargée sous la RLS). Les outils exécutés ici portent les mêmes noms que
   leurs déclarations dans supabase/functions/assistant-ia/index.ts (OUTILS).
   ============================================================================= */
(() => {
  if (typeof sendAiChat === 'undefined' || typeof DB === 'undefined') return;

  /* ---------------------------------------------------------------------------
     1. Données visibles, par collection, sous une forme lisible
     --------------------------------------------------------------------------- */
  const auj = () => ymd();
  const s = v => v == null ? '' : String(v);
  const n = v => Math.round(+v || 0);
  const nomBien = id => { const p = id && gProp(id); return p ? p.title : ''; };
  const locataireDu = leaseId => (DB.findItem(DB.K.leases, leaseId) || {}).tenant || '';
  /* Droits d'un membre d'équipe : mêmes noms que l'écran (31-rbac.js, permFor). */
  const PERM = {visits: 'visites', biens: 'biens', documents: 'documents', messages: 'messages'};
  const peut = (u, k) => { if (!u.member) return true; try { return memberCan(u, PERM[k] || permFor('/manage/' + k)); } catch (e) { return false; } };
  const gestionnaire = u => ['owner', 'agency'].includes(u.role) && !u.ownerRec;
  const miens = (k, u) => DB.filterItems(DB.K[k], x => x.ownerId === u.id);

  const COLLECTIONS = {
    biens: {
      lignes: u => gestionnaire(u) ? myProps(u) : u.ownerRec ? DB.filterItems(DB.K.properties, p => p.clientOwnerId === u.ownerRec) : published(),
      vue: p => ({id: p.id, titre: p.title, type: p.type, transaction: p.transaction, prix: n(p.price), surface: p.surface, chambres: p.rooms, salles_de_bain: p.baths,
        region: p.region, ville: p.city, quartier: p.quartier, statut: STATUS_LABEL[p.status] || p.status, annonce: p.listingStatus, vues: p.views || 0, contacts: p.contacts || 0,
        photos: (p.photos || []).length, disponible_le: s(p.availableFrom).slice(0, 10), cree_le: s(p.createdAt).slice(0, 10), lien: '#/property/' + p.id})
    },
    baux: {perm: 'leases', lignes: u => gestionnaire(u) ? miens('leases', u) : DB.getData(DB.K.leases),
      vue: l => ({id: l.id, locataire: l.tenant, telephone: l.phone, bien: nomBien(l.propertyId), unite: l.unitRef || '', loyer: n(l.rent), caution: n(l.deposit),
        debut: s(l.start).slice(0, 10), fin: s(leaseEnd(l)).slice(0, 10), duree_mois: l.months, jour_echeance: l.dueDay, statut: l.status, preavis: !!l.preavis})},
    loyers: {perm: 'rents', lignes: u => gestionnaire(u) ? miens('rents', u) : DB.getData(DB.K.rents),
      vue: r => ({id: r.id, mois: r.month, du: n(r.amount), paye: n(rPaid(r)), reste: n(rRest(r)), etat: rentState(r)[0], locataire: locataireDu(r.leaseId),
        bien: nomBien(r.propertyId || (DB.findItem(DB.K.leases, r.leaseId) || {}).propertyId), solde_le: s(r.paidAt).slice(0, 10), relances: +r.reminders || 0})},
    pieces: {perm: 'docs', lignes: u => miens('docs', u),
      vue: d => ({id: d.id, ref: d.ref, type: DT[d.type] || d.type, client: d.client, telephone: d.clientPhone || '', bien: nomBien(d.propertyId), cree_le: s(d.createdAt).slice(0, 10),
        echeance: d.due, total_ttc: dTot(d), paye: d.type === 'FAC' ? dPaid(d) : null, reste: d.type === 'FAC' ? dRest(d) : null, etat: dState(d)[0], remise: d.discount || 0, tva: d.tax || 0,
        lignes: (d.items || []).map(i => ({designation: i.label, quantite: i.qty, prix_unitaire: i.price})), issue_de: d.parentId ? (DB.findItem(DB.K.docs, d.parentId) || {}).ref : ''})},
    paiements: {perm: 'fpay', lignes: u => miens('fpay', u),
      vue: p => ({id: p.id, ref: p.ref, recu: p.rec, facture: p.docRef, client: p.client, montant: n(p.amount), mode: p.method, bien: nomBien(p.propertyId), date: s(p.createdAt).slice(0, 10)})},
    depenses: {perm: 'expenses', lignes: u => miens('expenses', u),
      vue: x => ({id: x.id, ref: x.ref, date: s(x.date).slice(0, 10), categorie: x.cat, fournisseur: x.supplier, montant: n(x.amount), mode: x.method, bien: nomBien(x.propertyId)})},
    contrats: {perm: 'contracts', lignes: u => miens('contracts', u),
      vue: c => ({id: c.id, ref: c.ref, type: c.type, genre: c.genre || '', partie: c.party, bien: nomBien(c.propertyId), debut: s(c.start).slice(0, 10), fin: s(c.end).slice(0, 10), montant: n(c.amount), statut: c.status})},
    travaux: {perm: 'tickets', lignes: u => gestionnaire(u) ? miens('tickets', u) : DB.getData(DB.K.tickets),
      vue: t => ({id: t.id, ref: t.ref || '', titre: t.title, categorie: t.category || '', bien: nomBien(t.propertyId), priorite: t.priority || '', etat: tkSt(t), cout: n(t.cost), ouvert_le: s(t.createdAt).slice(0, 10)})},
    ventes: {perm: 'deals', lignes: u => miens('deals', u),
      vue: d => ({id: d.id, bien: nomBien(d.propertyId), acheteur: d.buyer, telephone: d.phone || '', etape: (STAGES.find(x => x[0] === d.stage) || [0, d.stage])[1], prix: n(d.price), offre: n(d.offer), echeance: d.deadline || ''})},
    mandants: {perm: 'owners', roles: ['agency'], lignes: u => miens('owners', u),
      vue: o => { const u = Auth.current(), b = (() => { try { return ownerBalance(u, o, auj().slice(0, 7)); } catch (e) { return {}; } })();
        return {id: o.id, nom: o.name, telephone: o.phone, commission_pct: (() => { try { return commissionRate(u, o); } catch (e) { return o.rate; } })(),
          mois_en_cours: {encaisse: n(b.encaisse), depenses: n(b.dep), commission: n(b.com), net_a_reverser: n(b.net)}}; }},
    honoraires: {perm: 'owners', roles: ['agency'], lignes: u => miens('fees', u),
      vue: f => ({id: f.id, ref: f.ref, nature: f.kind, payeur: f.payerName || f.payer || '', ttc: n(f.ttc), statut: f.status, date: s(f.createdAt).slice(0, 10)})},
    reversements: {perm: 'owners', lignes: u => DB.getData(DB.K.transfers),
      vue: t => ({id: t.id, ref: t.ref || '', mois: t.month, encaisse: n(t.encaisse), depenses: n(t.dep), commission: n(t.com), verse: n(t.amount), statut: t.status || '', le: s(t.paidAt || t.createdAt).slice(0, 10)})},
    visites: {perm: 'visits', lignes: u => gestionnaire(u) ? DB.filterItems(DB.K.visits, v => v.ownerId === u.id) : DB.filterItems(DB.K.visits, v => v.clientId === u.id),
      vue: v => ({id: v.id, bien: nomBien(v.propertyId), client: v.clientName || (DB.findItem(DB.K.users, v.clientId) ? displayName(DB.findItem(DB.K.users, v.clientId)) : ''), telephone: v.clientPhone || '',
        date: v.date, heure: v.time, statut: v.status})},
    demandes: {roles: ['agency'], lignes: u => DB.getData(DB.K.demandes),
      vue: x => ({id: x.id, nom: x.name, telephone: x.phone, transaction: x.transaction, type: x.type || '', budget: n(x.budget), lieu: x.lieu || '', chambres: x.rooms || 0, statut: x.status})},
    prestataires: {perm: 'tickets', lignes: u => miens('providers', u), vue: p => ({id: p.id, nom: p.name, metier: p.trade || p.category || '', telephone: p.phone || ''})},
    unites: {perm: 'leases', lignes: u => miens('units', u), vue: x => ({id: x.id, ref: x.ref, bien: nomBien(x.propertyId), loyer: n(x.rent), statut: x.status})},
    notifications: {lignes: u => DB.filterItems(DB.K.notifications, x => x.userId === u.id).slice(-200), vue: x => ({texte: x.text, lue: !!x.read, date: s(x.createdAt).slice(0, 10)})},
    conversations: {perm: 'messages', lignes: u => DB.getData(DB.K.messages),
      vue: c => { const m = (c.items || []); const der = m[m.length - 1] || {};
        return {id: c.id, avec: (c.participants || []).filter(x => x !== Auth.current().id).map(x => displayName(DB.findItem(DB.K.users, x) || {})).join(', '), bien: nomBien(c.propertyId),
          messages: m.length, non_lus: m.filter(x => !x.read && x.senderId !== Auth.current().id).length, dernier: s(der.text).slice(0, 160), le: s(der.at).slice(0, 10)}; }},
    coffre: {perm: 'documents', lignes: u => DB.getData(DB.K.documents), vue: d => ({id: d.id, nom: d.name, type: d.mime || '', ajoute_le: s(d.createdAt).slice(0, 10)})},
    favoris: {lignes: u => DB.filterItems(DB.K.favorites, f => f.userId === u.id), vue: f => ({bien: nomBien(f.propertyId), bien_id: f.propertyId})},
    comptes: {roles: ['admin'], lignes: () => DB.getData(DB.K.users), vue: x => ({id: x.id, nom: displayName(x), role: x.role, statut: x.status, email: x.email || '', telephone: x.phone || '', cree_le: s(x.createdAt).slice(0, 10)})},
    signalements: {roles: ['admin'], lignes: () => DB.getData(DB.K.reports), vue: r => ({id: r.id, motif: r.reason || r.motif || '', statut: r.status, bien: nomBien(r.propertyId), le: s(r.createdAt).slice(0, 10)})},
    /* Le reste de la base visible par le compte, sous une forme générale (tous les champs utiles). */
    mandats: {perm: 'owners', gestion: true, lignes: u => DB.getData(DB.K.mandates), vue: x => brut(x)},
    mandats_vente: {perm: 'deals', gestion: true, lignes: u => DB.getData(DB.K.mventes), vue: x => brut(x)},
    etats_des_lieux: {perm: 'leases', lignes: u => DB.getData(DB.K.edl), vue: x => brut(x)},
    messages_bail: {perm: 'leases', lignes: u => DB.getData(DB.K.tmsgs), vue: x => brut(x)},
    recherches_enregistrees: {lignes: u => DB.filterItems(DB.K.searches, x => x.userId === u.id), vue: x => brut(x)},
    demandes_de_rattachement: {roles: ['owner', 'agency', 'admin'], lignes: u => DB.getData(DB.K.demandesLien), vue: x => brut(x)},
    journal: {perm: 'audit', gestion: true, lignes: u => DB.getData(DB.K.audit).slice(-300), vue: x => ({action: x.action, detail: x.detail || '', par: x.who || '', le: s(x.createdAt).slice(0, 16).replace('T', ' ')})},
    activite: {roles: ['admin'], lignes: () => DB.getData(DB.K.activity).slice(-300), vue: x => ({texte: x.text, le: s(x.createdAt).slice(0, 16).replace('T', ' ')})},
    messages_contact: {roles: ['admin'], lignes: () => DB.getData(DB.K.contacts), vue: x => brut(x)},
    annuaire: {lignes: u => DB.filterItems(DB.K.users, x => ['owner', 'agency'].includes(x.role) && x.id !== u.id),
      vue: x => ({id: x.id, nom: displayName(x), role: x.role === 'agency' ? 'agence' : 'propriétaire', ville: x.address || '', biens_publies: published().filter(p => p.ownerId === x.id).length})}
  };
  /* Toutes les données d'une ligne, sans secrets ni contenus lourds (fichiers, images). */
  const CHAMPS_EXCLUS = /^(password|motDePasse|dataUrl|photosMeta|cni|avatarPhoto|storagePath|signature|token)$/i;
  function brut(x) {
    const o = {};
    for (const [k, v] of Object.entries(x || {})) {
      if (CHAMPS_EXCLUS.test(k) || v == null || v === '') continue;
      if (typeof v === 'string' && (v.startsWith('data:') || v.length > 1500)) { o[k] = v.startsWith('data:') ? '[fichier]' : v.slice(0, 1500) + '…'; continue; }
      if (k === 'photos' && Array.isArray(v)) { o.photos = v.length; continue; }
      o[k] = v;
    }
    if (x && x.propertyId) o.bien = nomBien(x.propertyId);
    return o;
  }
  /* L'administration lit chaque collection en entier (ce que la base lui montre). */
  const K_ADMIN = {biens: 'properties', baux: 'leases', loyers: 'rents', pieces: 'docs', paiements: 'fpay', depenses: 'expenses', contrats: 'contracts', travaux: 'tickets',
    ventes: 'deals', mandants: 'owners', honoraires: 'fees', reversements: 'transfers', visites: 'visits', demandes: 'demandes', prestataires: 'providers', unites: 'units', coffre: 'documents'};
  /* Pour la lecture détaillée : la ligne d'origine de chaque collection. */
  const K_DE = {...K_ADMIN, notifications: 'notifications', conversations: 'messages', favoris: 'favorites', comptes: 'users', signalements: 'reports'};
  function collectionsDe(u) {
    return Object.keys(COLLECTIONS).filter(c => { const C = COLLECTIONS[c];
      if (C.roles && !C.roles.includes(u.role) && u.role !== 'admin') return false;
      if (C.perm && u.member && !peut(u, C.perm)) return false;
      if (u.role === 'admin') return true;
      if ((C.gestion || ['pieces', 'paiements', 'depenses', 'contrats', 'ventes', 'mandants', 'honoraires', 'prestataires', 'unites'].includes(c)) && !gestionnaire(u)) return false;
      if (c === 'reversements' && !(u.ownerRec || u.role === 'agency')) return false;
      return true; });
  }
  function lignesVues(u, c) {
    const C = COLLECTIONS[c];
    if (!C || !collectionsDe(u).includes(c)) { const e = new Error(`Collection « ${c} » inconnue ou non autorisée pour ce compte. Collections disponibles : ${collectionsDe(u).join(', ')}.`); e.outil = true; throw e; }
    const L = (u.role === 'admin' && K_ADMIN[c] ? DB.getData(DB.K[K_ADMIN[c]]) : C.lignes(u)) || [];
    return L.map(x => { try { const v = C.vue(x); if (v && x && x.id && !v.id) Object.defineProperty(v, '_id', {value: x.id}); if (v) Object.defineProperty(v, '_brut', {value: x}); return v; } catch (e) { return null; } }).filter(Boolean);
  }

  /* ---------------------------------------------------------------------------
     2. Filtres, tri, calculs
     --------------------------------------------------------------------------- */
  const plat = t => s(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const val = (o, champ) => champ == null || champ === '' ? undefined : String(champ).split('.').reduce((a, k) => a == null ? a : a[k], o);
  function filtrer(L, filtres) {
    return (filtres || []).reduce((acc, f) => acc.filter(o => {
      const v = val(o, f.champ), x = f.valeur;
      switch (f.operateur) {
        case 'egal': return plat(v) === plat(x);
        case 'different': return plat(v) !== plat(x);
        case 'contient': return plat(Array.isArray(v) ? JSON.stringify(v) : v).includes(plat(x));
        case 'superieur': return v != null && v !== '' && (typeof v === 'number' ? v > +x : s(v) > s(x));
        case 'inferieur': return v != null && v !== '' && (typeof v === 'number' ? v < +x : s(v) < s(x));
        case 'superieur_ou_egal': return v != null && v !== '' && (typeof v === 'number' ? v >= +x : s(v) >= s(x));
        case 'inferieur_ou_egal': return v != null && v !== '' && (typeof v === 'number' ? v <= +x : s(v) <= s(x));
        case 'parmi': return (Array.isArray(x) ? x : s(x).split(',')).map(plat).includes(plat(v));
        case 'vide': return v == null || v === '' || (Array.isArray(v) && !v.length);
        case 'non_vide': return !(v == null || v === '' || (Array.isArray(v) && !v.length));
        default: return true;
      }
    }), L);
  }
  const MAX_LIGNES = 100, MAX_CAR = 20000;
  function outilLire(u, a) {
    let L = filtrer(lignesVues(u, a.collection), a.filtres);
    const total = L.length;
    if (a.tri && a.tri.champ) { const sens = a.tri.ordre === 'decroissant' ? -1 : 1; L = L.slice().sort((x, y) => { const p = val(x, a.tri.champ), q = val(y, a.tri.champ); return (p > q ? 1 : p < q ? -1 : 0) * sens; }); }
    const lim = Math.min(MAX_LIGNES, Math.max(1, +a.limite || 30));
    let rows = L.slice(0, lim);
    if (a.details) rows = rows.map(o => ({...o, details: brut(o._brut)}));
    if (Array.isArray(a.champs) && a.champs.length) rows = rows.map(o => Object.fromEntries(a.champs.map(c => [c, val(o, c)])));
    let out = {collection: a.collection, total, renvoyees: rows.length, lignes: rows};
    while (JSON.stringify(out).length > MAX_CAR && out.lignes.length > 1) out = {...out, lignes: out.lignes.slice(0, Math.ceil(out.lignes.length / 2)), renvoyees: Math.ceil(out.lignes.length / 2)};
    if (out.renvoyees < total) out.note = `Seules ${out.renvoyees} lignes sur ${total} sont renvoyées : affiner les filtres, ou utiliser « calculer » pour des totaux.`;
    return out;
  }
  function outilCalculer(u, a) {
    const L = filtrer(lignesVues(u, a.collection), a.filtres), op = a.operation || 'compter';
    const cle = o => { if (!a.grouper_par) return 'total'; const m = /^mois\((.+)\)$/.exec(a.grouper_par); return m ? s(val(o, m[1])).slice(0, 7) || '—' : s(val(o, a.grouper_par)) || '—'; };
    const G = {}; L.forEach(o => (G[cle(o)] = G[cle(o)] || []).push(o));
    const calc = M => { if (op === 'compter') return M.length; const v = M.map(o => +val(o, a.champ)).filter(Number.isFinite);
      return op === 'compter' ? M.length : op === 'somme' ? n(v.reduce((x, y) => x + y, 0)) : op === 'moyenne' ? (v.length ? n(v.reduce((x, y) => x + y, 0) / v.length) : null)
        : op === 'min' ? (v.length ? Math.min(...v) : null) : op === 'max' ? (v.length ? Math.max(...v) : null) : null; };
    if (op !== 'compter' && !a.champ) { const e = new Error('Indiquer « champ » pour une somme, une moyenne, un minimum ou un maximum.'); e.outil = true; throw e; }
    const res = Object.fromEntries(Object.entries(G).sort((x, y) => x[0] < y[0] ? -1 : 1).map(([k, M]) => [k, calc(M)]));
    return {collection: a.collection, operation: op, champ: a.champ || null, lignes_retenues: L.length, resultat: a.grouper_par ? res : (res.total ?? (op === 'compter' ? 0 : null))};
  }
  function outilProfil(u) {
    const ex = {}; for (const c of collectionsDe(u)) { try { const L = lignesVues(u, c); ex[c] = {nombre: L.length, champs: L[0] ? Object.keys(L[0]) : []}; } catch (e) {} }
    return {aujourd_hui: auj(), utilisateur: iaRole(u), nom: displayName(u), role: u.role, membre_equipe: u.member ? u.member.role : null,
      droits: u.member ? u.member.perms || [] : 'tous', collections: ex, actions_possibles: actionsDe(u).map(x => x.nom),
      modes_de_paiement: typeof PAYM !== 'undefined' ? PAYM : [], categories_de_depenses: typeof EXPC !== 'undefined' ? EXPC : []};
  }

  /* ---------------------------------------------------------------------------
     3. Actions (toujours confirmées par l'utilisateur)
     préparer(u, a) → {resume, details[], executer: async () => résultat} ou erreur expliquée
     --------------------------------------------------------------------------- */
  class Refus extends Error { constructor(m) { super(m); this.outil = true; } }
  const exige = (c, m) => { if (!c) throw new Refus(m); };
  const montant = (v, nom) => { const x = Math.round(+v); exige(Number.isFinite(x) && x > 0, `${nom} : indiquer un montant supérieur à 0.`); return x; };
  const dateOk = d => /^\d{4}-\d{2}-\d{2}$/.test(s(d)) && !isNaN(new Date(d));
  function bienDe(u, ref) {
    exige(ref, 'Indiquer le bien (titre ou identifiant).');
    const L = myProps(u), r = plat(ref);
    const ex = L.find(p => p.id === ref) || L.find(p => plat(p.title) === r);
    if (ex) return ex;
    const c = L.filter(p => plat(p.title).includes(r) || plat(`${p.title} ${p.quartier} ${p.city}`).includes(r));
    exige(c.length, `Aucun de vos biens ne correspond à « ${ref} ».`);
    exige(c.length === 1, `Plusieurs biens correspondent à « ${ref} » : ${c.slice(0, 6).map(p => p.title).join(' ; ')}. Préciser lequel.`);
    return c[0];
  }
  const pieceDe = (u, ref) => { const d = DB.findItem(DB.K.docs, x => x.ownerId === u.id && (x.ref === ref || x.id === ref || plat(x.ref) === plat(ref))); exige(d, `Pièce « ${ref} » introuvable dans votre espace.`); return d; };
  const modeOk = m => (typeof PAYM !== 'undefined' && PAYM.find(x => plat(x) === plat(m))) || 'Espèces';
  const droit = (u, perm, quoi) => exige(!u.member || peut(u, perm), `Votre profil d'équipe n'a pas le droit de ${quoi}.`);
  /* Écritures confirmées : on attend la base, puis on vérifie qu'aucune n'a été refusée. */
  async function ecrire(f) {
    const avant = DB.erreurs.length, r = f();
    await DB.attendre();
    const err = DB.erreurs.slice(avant);
    if (err.length) { const e = new Error('La base a refusé l\'opération : ' + (err[0].message || err[0].code || 'erreur') + '.'); e.base = true; throw e; }
    return r;
  }
  const relire = (k, id) => DB.findItem(DB.K[k], id) || {};
  const TYPES_PIECE = {devis: 'DEV', proforma: 'PF', facture: 'FAC'};

  const ACTIONS = [
    {nom: 'creer_piece', roles: ['owner', 'agency'], perm: 'docs', preparer(u, a) {
      droit(u, 'docs', 'créer des devis ou des factures');
      const type = TYPES_PIECE[plat(a.type)]; exige(type, 'Type : devis, proforma ou facture.');
      exige(s(a.client).trim(), 'Indiquer le client.');
      const items = (a.lignes || []).map(l => ({label: s(l.designation).trim(), qty: Math.max(1, Math.round(+l.quantite || 1)), price: Math.round(+l.prix_unitaire)})).filter(l => l.label);
      exige(items.length, 'Au moins une ligne (désignation, quantité, prix unitaire).');
      exige(items.every(l => Number.isFinite(l.price) && l.price >= 0), 'Chaque ligne a besoin d\'un prix unitaire.');
      const p = a.bien ? bienDe(u, a.bien) : null, remise = Math.min(100, Math.max(0, +a.remise || 0)), tva = +a.tva === 18 ? 18 : 0, jours = Math.max(1, Math.round(+a.echeance_jours || 30));
      const o = {client: s(a.client).trim(), clientPhone: s(a.telephone).trim(), propertyId: p ? p.id : '', items, discount: remise, tax: tva, due: addDays(now(), jours).slice(0, 10), status: type === 'FAC' ? 'émise' : 'envoyé'};
      const total = dTot(o);
      return {resume: `Créer ${type === 'FAC' ? 'la facture' : type === 'PF' ? 'la proforma' : 'le devis'} pour ${o.client} : ${money(total)} TTC`,
        details: [...items.map(i => `${i.label} — ${i.qty} × ${money(i.price)}`), remise ? `Remise ${remise} %` : '', tva ? 'TVA 18 %' : '', p ? `Bien : ${p.title}` : '', `Échéance : ${dateFr(o.due)}`].filter(Boolean),
        async executer() { const d = await ecrire(() => mkDoc(u, type, o)); const f = relire('docs', d.id); return {ok: true, ref: f.ref || d.ref, total_ttc: total, lien: '#/manage/docs'}; }};
    }},
    {nom: 'convertir_piece', roles: ['owner', 'agency'], perm: 'docs', preparer(u, a) {
      droit(u, 'docs', 'modifier les pièces');
      const d = pieceDe(u, a.ref); exige(d.type === 'DEV' || d.type === 'PF', `${d.ref} n'est ni un devis ni une proforma.`);
      exige(!hasChild(d), `${d.ref} a déjà été transformé.`);
      const vers = d.type === 'DEV' ? 'PF' : 'FAC';
      return {resume: `Transformer ${d.ref} (${DT[d.type]}) en ${DT[vers].toLowerCase()} pour ${d.client} : ${money(dTot(d))}`, details: [],
        async executer() { const x = await ecrire(() => mkDoc(u, vers, {client: d.client, propertyId: d.propertyId, items: d.items, discount: d.discount, tax: d.tax || 0, parentId: d.id, status: d.type === 'DEV' ? 'envoyé' : 'émise'})); return {ok: true, ref: relire('docs', x.id).ref || x.ref}; }};
    }},
    {nom: 'creer_avoir', roles: ['owner', 'agency'], perm: 'docs', preparer(u, a) {
      droit(u, 'docs', 'émettre des avoirs');
      const d = pieceDe(u, a.ref_facture); exige(d.type === 'FAC', `${d.ref} n'est pas une facture.`);
      const m = montant(a.montant, 'Avoir'); exige(m <= dRest(d), `Un avoir ne peut pas dépasser le reste à payer (${money(dRest(d))}).`);
      return {resume: `Émettre un avoir de ${money(m)} sur ${d.ref} (${d.client})`, details: [s(a.motif)].filter(Boolean),
        async executer() { const x = await ecrire(() => mkDoc(u, 'AV', {client: d.client, propertyId: d.propertyId, items: [{label: 'Avoir sur ' + d.ref + (a.motif ? ' — ' + a.motif : ''), qty: 1, price: m}], parentId: d.id})); return {ok: true, ref: relire('docs', x.id).ref || x.ref}; }};
    }},
    {nom: 'encaisser_facture', roles: ['owner', 'agency'], perm: 'fpay', preparer(u, a) {
      droit(u, 'fpay', 'enregistrer des paiements');
      const d = pieceDe(u, a.ref); exige(d.type === 'FAC', `${d.ref} n'est pas une facture.`);
      const reste = dRest(d); exige(reste > 0, `${d.ref} est déjà soldée.`);
      const m = a.montant ? montant(a.montant, 'Montant') : reste; exige(m <= reste, `Le montant dépasse le reste à payer (${money(reste)}).`);
      const mode = modeOk(a.mode);
      return {resume: `Enregistrer un paiement de ${money(m)} (${mode}) sur ${d.ref} — ${d.client}`, details: [m < reste ? `Reste après paiement : ${money(reste - m)}` : 'La facture sera soldée.'],
        async executer() {
          const ref = nref('PAY', 'fpay');
          const p = await ecrire(() => { const x = DB.addItem(DB.K.fpay, {ownerId: u.id, docId: d.id, docRef: d.ref, client: d.client, propertyId: d.propertyId, amount: m, method: mode, ref, rec: ref.replace('PAY', 'REC')}); audit('Paiement ' + x.ref, `${money(m)} sur ${d.ref} (assistant)`); return x; });
          const f = relire('fpay', p.id); return {ok: true, paiement: f.ref || p.ref, recu: f.rec || p.rec, reste: dRest(relire('docs', d.id))};
        }};
    }},
    {nom: 'encaisser_loyer', roles: ['owner', 'agency'], perm: 'rents', preparer(u, a) {
      droit(u, 'rents', 'encaisser des loyers');
      let r = a.loyer_id ? DB.findItem(DB.K.rents, x => x.id === a.loyer_id && x.ownerId === u.id) : null;
      if (!r) {
        exige(a.locataire && a.mois, 'Indiquer le loyer (identifiant) ou le locataire et le mois (AAAA-MM).');
        const L = miens('rents', u).filter(x => x.month === s(a.mois).slice(0, 7) && plat(locataireDu(x.leaseId)).includes(plat(a.locataire)));
        exige(L.length, `Aucun loyer de ${a.mois} pour « ${a.locataire} ».`); exige(L.length === 1, 'Plusieurs loyers correspondent : préciser le locataire.'); r = L[0];
      }
      exige(!r.paidAt, `Le loyer de ${monthLabel(r.month)} est déjà soldé.`);
      const reste = rRest(r), m = a.montant ? montant(a.montant, 'Montant') : reste; exige(m <= reste, `Le montant dépasse le reste dû (${money(reste)}).`);
      const date = a.date ? s(a.date).slice(0, 10) : ymd(); exige(dateOk(date) && date <= ymd(), 'Date du paiement invalide ou dans le futur.');
      const ref = s(a.reference).trim(); if (ref && typeof refDejaUtilisee === 'function') { const dbl = refDejaUtilisee(u, ref); exige(!dbl, `La référence « ${ref} » est déjà enregistrée (${dbl}).`); }
      const mode = modeOk(a.mode), solde = m >= reste, loc = locataireDu(r.leaseId);
      return {resume: `Encaisser ${money(m)} (${mode}) — loyer de ${monthLabel(r.month)} de ${loc}`, details: [solde ? 'Le loyer sera soldé et la quittance disponible.' : `Acompte : il restera ${money(reste - m)}.`, `Date : ${dateFr(date)}`],
        async executer() {
          const at = date + 'T12:00:00.000Z';
          await ecrire(() => {
            const payments = [...rPays(r), {id: uid(), amount: m, date: at, method: mode, ref, savedAt: now()}];
            DB.updateItem(DB.K.rents, r.id, solde ? {payments, paidAt: at, method: mode, payRef: ref} : {payments});
            audit(solde ? 'Loyer encaissé' : 'Acompte sur loyer', `${monthLabel(r.month)} · ${money(m)} · ${mode} (assistant)`);
            const t = DB.findItem(DB.K.users, x => x.leaseId === r.leaseId);
            if (t) notify(t.id, solde ? `Votre loyer de ${monthLabel(r.month)} a été enregistré comme payé.` : `Acompte de ${money(m)} reçu pour le loyer de ${monthLabel(r.month)}. Reste à régler : ${money(reste - m)}.`, '#/tenant/rents');
          });
          return {ok: true, solde, reste: rRest(relire('rents', r.id)), lien: '#/manage/rents'};
        }};
    }},
    {nom: 'relancer_loyer', roles: ['owner', 'agency'], perm: 'rents', preparer(u, a) {
      droit(u, 'rents', 'relancer les locataires');
      const r = DB.findItem(DB.K.rents, x => x.id === a.loyer_id && x.ownerId === u.id); exige(r, 'Indiquer l\'identifiant du loyer (outil lire, collection loyers).');
      exige(!r.paidAt, 'Ce loyer est déjà soldé.');
      const loc = locataireDu(r.leaseId), compte = DB.findItem(DB.K.users, x => x.leaseId === r.leaseId), texte = s(a.message).trim() || `Rappel : votre loyer de ${monthLabel(r.month)} (${money(rRest(r))}) reste à régler. Merci de prendre contact si besoin.`;
      return {resume: `Relancer ${loc} pour le loyer de ${monthLabel(r.month)} (${money(rRest(r))})`, details: [compte ? 'Notification envoyée dans son espace DEUKSIL.' : 'Le locataire n\'a pas de compte DEUKSIL : la relance est seulement enregistrée (à envoyer par téléphone ou WhatsApp).', 'Message : ' + texte],
        async executer() { await ecrire(() => { DB.updateItem(DB.K.rents, r.id, {remindedAt: now(), reminders: (+r.reminders || 0) + 1}); if (compte) notify(compte.id, texte, '#/tenant/rents'); }); return {ok: true, notifie: !!compte, telephone: (DB.findItem(DB.K.leases, r.leaseId) || {}).phone || ''}; }};
    }},
    {nom: 'creer_depense', roles: ['owner', 'agency'], perm: 'expenses', preparer(u, a) {
      droit(u, 'expenses', 'enregistrer des dépenses');
      const m = montant(a.montant, 'Dépense'), p = a.bien ? bienDe(u, a.bien) : null;
      const cat = (typeof EXPC !== 'undefined' && EXPC.find(c => plat(c) === plat(a.categorie))) || 'autres', date = a.date ? s(a.date).slice(0, 10) : ymd();
      exige(dateOk(date), 'Date invalide (AAAA-MM-JJ).'); exige(s(a.fournisseur).trim(), 'Indiquer le fournisseur.');
      return {resume: `Enregistrer une dépense de ${money(m)} — ${cat}, ${a.fournisseur}`, details: [p ? `Bien : ${p.title}` : 'Sans bien rattaché', `Date : ${dateFr(date)}`, `Mode : ${modeOk(a.mode)}`],
        async executer() { const x = await ecrire(() => { const e = DB.addItem(DB.K.expenses, {ownerId: u.id, ref: nref('DEP', 'expenses'), propertyId: p ? p.id : '', supplier: s(a.fournisseur).trim(), cat, amount: m, method: modeOk(a.mode), date}); audit('Dépense', `${e.ref} · ${money(m)} (assistant)`); return e; }); return {ok: true, ref: relire('expenses', x.id).ref || x.ref}; }};
    }},
    {nom: 'creer_travaux', roles: ['owner', 'agency'], perm: 'tickets', preparer(u, a) {
      droit(u, 'tickets', 'créer des interventions');
      const p = bienDe(u, a.bien); exige(s(a.titre).trim(), 'Indiquer l\'intervention à faire.');
      return {resume: `Ouvrir une intervention « ${s(a.titre).trim()} » sur ${p.title}`, details: [a.cout ? `Coût estimé : ${money(a.cout)}` : ''].filter(Boolean),
        async executer() { const t = await ecrire(() => DB.addItem(DB.K.tickets, {ownerId: u.id, propertyId: p.id, title: s(a.titre).trim(), category: a.categorie || 'Autre', cost: n(a.cout), status: 'ouvert'})); return {ok: true, id: t.id, ref: relire('tickets', t.id).ref || '', lien: '#/manage/tickets'}; }};
    }},
    {nom: 'planifier_visite', roles: ['owner', 'agency'], perm: 'visits', preparer(u, a) {
      droit(u, 'visits', 'planifier des visites');
      const p = bienDe(u, a.bien), tel = chiffres9(a.telephone);
      exige(s(a.nom).trim(), 'Indiquer le nom du client.'); exige(tel.length >= 9, 'Téléphone du client : 9 chiffres.');
      exige(dateOk(a.date) && a.date >= ymd(), 'Date invalide ou passée (AAAA-MM-JJ).'); exige(/^\d\d:\d\d$/.test(s(a.heure)), 'Heure au format HH:MM.');
      exige(!DB.findItem(DB.K.visits, v => v.propertyId === p.id && v.date === a.date && v.time === a.heure && ['acceptee', 'attente'].includes(v.status)), 'Ce bien a déjà une visite à cette date et à cette heure.');
      return {resume: `Planifier une visite de « ${p.title} » le ${dateFr(a.date)} à ${a.heure} avec ${s(a.nom).trim()}`, details: [`Téléphone : ${a.telephone}`, s(a.note)].filter(Boolean),
        async executer() {
          const compte = DB.findItem(DB.K.users, x => x.role === 'client' && chiffres9(x.phone) === tel);
          const v = await ecrire(() => { const x = DB.addItem(DB.K.visits, {ownerId: u.id, propertyId: p.id, clientId: compte ? compte.id : '', clientName: s(a.nom).trim(), clientPhone: s(a.telephone).trim(),
            date: a.date, time: a.heure, status: 'acceptee', agentId: estAgent(u) ? moi(u).id : (p.agentId || ''), note: s(a.note).trim(), source: u.role === 'owner' ? 'proprietaire' : 'agence', planifieePar: u.member ? u.member.id : u.id, createdAt: now()});
            if (p.status === 'disponible') DB.updateItem(DB.K.properties, p.id, {status: 'discussion'});
            if (compte) notify(compte.id, `Visite confirmée : « ${p.title} » le ${dateFr(a.date)} à ${a.heure}.`, '#/client/visits');
            audit('Visite planifiée', `${p.title} · ${dateFr(a.date)} ${a.heure} (assistant)`); return x; });
          return {ok: true, id: v.id, client_notifie: !!compte};
        }};
    }},
    {nom: 'creer_bail', roles: ['owner', 'agency'], perm: 'leases', preparer(u, a) {
      droit(u, 'leases', 'créer des baux');
      const p = bienDe(u, a.bien), loyer = montant(a.loyer, 'Loyer'), mois = Math.min(36, Math.max(1, Math.round(+a.duree_mois || 12))), debut = s(a.debut).slice(0, 10);
      exige(s(a.locataire).trim(), 'Indiquer le locataire.'); exige(dateOk(debut), 'Date de début invalide (AAAA-MM-JJ).');
      exige(!DB.findItem(DB.K.leases, l => l.propertyId === p.id && l.status === 'actif'), 'Ce bien a déjà un bail actif.');
      exige(!miens('units', u).some(x => x.propertyId === p.id), 'Ce bien a des unités : le bail se crée depuis l\'onglet Unités.');
      return {resume: `Créer le bail de ${s(a.locataire).trim()} pour « ${p.title} » : ${money(loyer)} / mois pendant ${mois} mois`, details: [`Début : ${dateFr(debut)}`, `Caution : ${money(a.caution || 0)}`, `${mois} loyers seront planifiés ; le bien passera en « Loué ».`],
        async executer() {
          const l = await ecrire(() => {
            const b = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: p.id, tenant: s(a.locataire).trim(), phone: s(a.telephone), rent: loyer, deposit: n(a.caution), start: debut, months: mois, dueDay: Math.min(28, Math.max(1, +a.jour_echeance || 5)), status: 'actif'});
            const d0 = new Date(debut);
            for (let i = 0; i < mois; i++) { const m = new Date(d0.getFullYear(), d0.getMonth() + i, 1); DB.addItem(DB.K.rents, {ownerId: u.id, leaseId: b.id, month: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`, amount: loyer, paidAt: null}); }
            DB.updateItem(DB.K.properties, p.id, {status: 'loue'}); audit('Bail créé', `${p.title} · ${s(a.locataire).trim()} (assistant)`); return b; });
          return {ok: true, id: l.id, loyers_planifies: mois, lien: '#/manage/leases'};
        }};
    }},
    {nom: 'modifier_bien', roles: ['owner', 'agency'], perm: 'biens', preparer(u, a) {
      droit(u, 'biens', 'modifier les biens');
      const p = bienDe(u, a.bien), patch = {}, L = [];
      if (a.prix != null) { patch.price = montant(a.prix, 'Prix'); L.push(`Prix : ${money(p.price)} → ${money(patch.price)}`); }
      if (a.titre) { patch.title = s(a.titre).trim().slice(0, 200); exige(patch.title.length >= 5, 'Titre trop court.'); L.push(`Titre : « ${patch.title} »`); }
      if (a.description) { patch.description = s(a.description).slice(0, 10000); L.push('Description remplacée'); }
      if (a.statut_annonce) { const st = {publiee: 'publiee', 'en pause': 'pause', pause: 'pause', brouillon: 'brouillon', archivee: 'archivee'}[plat(a.statut_annonce)]; exige(st, 'Statut d\'annonce : publiee, pause, brouillon ou archivee.'); patch.listingStatus = st; L.push(`Annonce : ${p.listingStatus} → ${st}`); }
      exige(L.length, 'Rien à modifier : indiquer prix, titre, description ou statut d\'annonce.');
      return {resume: `Modifier « ${p.title} »`, details: L,
        async executer() { await ecrire(() => DB.updateItem(DB.K.properties, p.id, patch)); return {ok: true, lien: '#/property/' + p.id}; }};
    }},
    {nom: 'creer_bien', roles: ['owner', 'agency'], perm: 'biens', preparer(u, a) {
      droit(u, 'biens', 'créer des biens');
      const titre = s(a.titre).trim(); exige(titre.length >= 5, 'Titre : 5 caractères au moins.');
      const tr = {location: 'location', vente: 'vente', terrain: 'terrain'}[plat(a.transaction)]; exige(tr, 'Transaction : location, vente ou terrain.');
      const type = (PROPERTY_TYPES || []).find(t => plat(t) === plat(a.type)) || (tr === 'terrain' ? 'terrain' : null); exige(type, `Type de bien parmi : ${(PROPERTY_TYPES || []).join(', ')}.`);
      const prix = montant(a.prix, 'Prix'), surface = Math.max(0, +a.surface || 0);
      const o = {title: titre, type, transaction: tr, price: prix, surface, rooms: Math.max(0, Math.round(+a.chambres || 0)), baths: Math.max(0, Math.round(+a.salles_de_bain || 0)),
        region: s(a.region).trim() || 'Dakar', city: s(a.ville).trim() || 'Dakar', commune: s(a.ville).trim() || 'Dakar', quartier: s(a.quartier).trim(), description: s(a.description).slice(0, 10000),
        ownerId: u.id, status: 'disponible', views: 0, contacts: 0, listingStatus: 'brouillon', amenities: [], photos: []};
      return {resume: `Créer le bien « ${titre} » en brouillon (${tr}, ${money(prix)})`, details: [`${type}, ${surface} m², ${o.rooms} ch.`, `${o.quartier ? o.quartier + ', ' : ''}${o.city}`, 'Photos et publication : à faire depuis « Mes biens ».'],
        async executer() { const b = await ecrire(() => DB.addItem(DB.K.properties, o)); return {ok: true, id: b.id, lien: '#/owner/property/' + b.id}; }};
    }},
    {nom: 'creer_vente', roles: ['owner', 'agency'], perm: 'deals', preparer(u, a) {
      droit(u, 'deals', 'suivre les ventes');
      const p = bienDe(u, a.bien); exige(s(a.acheteur).trim(), 'Indiquer l\'acheteur.');
      return {resume: `Ouvrir un dossier de vente : « ${p.title} », acheteur ${s(a.acheteur).trim()}`, details: [a.offre ? `Offre : ${money(a.offre)}` : ''].filter(Boolean),
        async executer() { const d = await ecrire(() => DB.addItem(DB.K.deals, {ownerId: u.id, propertyId: p.id, buyer: s(a.acheteur).trim(), phone: s(a.telephone), offer: n(a.offre), stage: 'prospect'})); return {ok: true, id: d.id, lien: '#/manage/deals'}; }};
    }},
    /* Client */
    {nom: 'demander_visite', roles: ['client', 'tenant'], preparer(u, a) {
      const p = published().find(x => x.id === a.bien) || published().find(x => plat(x.title) === plat(a.bien));
      exige(p, 'Annonce introuvable : utiliser l\'identifiant renvoyé par lire (collection biens).');
      exige(dateOk(a.date) && a.date >= ymd(), 'Date invalide ou passée.'); exige(/^\d\d:\d\d$/.test(s(a.heure)), 'Heure au format HH:MM.');
      return {resume: `Demander une visite de « ${p.title} » le ${dateFr(a.date)} à ${a.heure}`, details: [s(a.message)].filter(Boolean),
        async executer() { await ecrire(() => DB.addItem(DB.K.visits, {clientId: u.id, ownerId: p.ownerId, propertyId: p.id, date: a.date, time: a.heure, message: s(a.message), status: 'attente'})); return {ok: true, lien: '#/client/visits'}; }};
    }},
    {nom: 'ajouter_favori', roles: ['client', 'tenant'], preparer(u, a) {
      const p = published().find(x => x.id === a.bien); exige(p, 'Annonce introuvable (identifiant attendu).');
      exige(!DB.findItem(DB.K.favorites, f => f.userId === u.id && f.propertyId === p.id), 'Déjà dans vos favoris.');
      return {resume: `Ajouter « ${p.title} » à vos favoris`, details: [], async executer() { await ecrire(() => DB.addItem(DB.K.favorites, {userId: u.id, propertyId: p.id})); return {ok: true}; }};
    }},
    /* Locataire */
    {nom: 'signaler_probleme', roles: ['tenant'], preparer(u, a) {
      const ids = Array.isArray(u.leaseIds) && u.leaseIds.length ? u.leaseIds : [u.leaseId], l = ids.map(id => DB.findItem(DB.K.leases, id)).find(Boolean);
      exige(l, 'Aucun bail trouvé pour votre compte.'); exige(s(a.titre).trim().length >= 4, 'Décrire le problème.');
      const cat = (typeof MCAT !== 'undefined' && MCAT.find(c => plat(c) === plat(a.categorie))) || 'Autre';
      return {resume: `Signaler à votre bailleur : « ${s(a.titre).trim()} » (${cat})`, details: [nomBien(l.propertyId)],
        async executer() { await ecrire(() => DB.addItem(DB.K.tickets, {ownerId: l.ownerId, propertyId: l.propertyId, title: s(a.titre).trim(), category: cat, cost: 0, status: 'nouvelle', tenantId: u.id})); return {ok: true, lien: '#/tenant/tickets'}; }};
    }}
  ];
  const actionsDe = u => ACTIONS.filter(x => x.roles.includes(u.role) && !(u.ownerRec && x.roles.every(r => r !== 'client')) && (!x.perm || !u.member || peut(u, x.perm)));

  /* ---------------------------------------------------------------------------
     4. Boucle de conversation avec le serveur
     --------------------------------------------------------------------------- */
  const PAS_MAX = 8;
  let contenus = [];        // historique au format Gemini (parties du modèle renvoyées telles quelles)
  let agentCoupe = true;    // le serveur n'offre pas le mode agent : ancien fonctionnement
  const attentes = new Map(); // action proposée → résolution (confirmer / annuler)

  async function appelerServeur(corps) {
    const {data, error} = await SB.functions.invoke('assistant-ia', {body: corps});
    if (!error && data) return data;
    let j = {}; try { j = await error.context.json(); } catch (e) {}
    const err = new Error(j.message || 'erreur'); err.code = j.code || (error && error.context && error.context.status) || 'erreur'; throw err;
  }
  const ajouter = m => { aiChatHistory.push(m); renderAiChatInPlace(); return m; };
  const LIB = {lire: 'Consulté', calculer: 'Calculé', profil: 'Espace analysé'};
  /* Noms affichés dans les traces (ce que l'utilisateur reconnaît). */
  const NOMS = {biens: 'biens', baux: 'baux', loyers: 'loyers', pieces: 'devis et factures', paiements: 'paiements reçus', depenses: 'dépenses', contrats: 'contrats',
    travaux: 'travaux', ventes: 'ventes', mandants: 'propriétaires mandants', honoraires: 'honoraires', reversements: 'reversements', visites: 'visites', demandes: 'demandes de clients',
    prestataires: 'prestataires', unites: 'unités', notifications: 'notifications', conversations: 'conversations', coffre: 'documents', favoris: 'favoris', comptes: 'comptes', signalements: 'signalements',
    mandats: 'mandats de gestion', mandats_vente: 'mandats de vente', etats_des_lieux: 'états des lieux', messages_bail: 'messages des baux', recherches_enregistrees: 'recherches enregistrées',
    demandes_de_rattachement: 'demandes de rattachement', journal: 'journal des actions', activite: 'activité de la plateforme', messages_contact: 'messages de contact', annuaire: 'annuaire'};
  const OPS_LIB = {compter: 'nombre', somme: 'total', moyenne: 'moyenne', min: 'minimum', max: 'maximum'};
  const nomCol = c => NOMS[c] || c;
  async function executerOutil(u, appel) {
    const a = appel.args || {};
    try {
      if (appel.name === 'profil') { ajouter({role: 'assistant', kind: 'outil', content: `${LIB.profil}`}); return outilProfil(u); }
      if (appel.name === 'lire') { const r = outilLire(u, a); ajouter({role: 'assistant', kind: 'outil', content: `${LIB.lire} : ${nomCol(a.collection)} (${r.total} ligne${r.total > 1 ? 's' : ''})`}); return r; }
      if (appel.name === 'calculer') { const r = outilCalculer(u, a); ajouter({role: 'assistant', kind: 'outil', content: `${LIB.calculer} : ${OPS_LIB[a.operation] || 'nombre'}${a.champ ? ' (' + a.champ.replace(/_/g, ' ') + ')' : ''} · ${nomCol(a.collection)}`}); return r; }
      const A = actionsDe(u).find(x => x.nom === appel.name);
      if (!A) return {erreur: `Action « ${appel.name} » non disponible pour ce compte.`};
      let plan; try { plan = A.preparer(u, a); } catch (e) { if (e.outil) return {erreur: e.message}; throw e; }
      const carte = ajouter({role: 'assistant', kind: 'action', etat: 'attente', content: plan.resume, details: plan.details, id: uid()});
      const choix = await new Promise(res => attentes.set(carte.id, res));
      attentes.delete(carte.id);
      if (choix !== 'ok') { carte.etat = 'annulee'; renderAiChatInPlace(); return {annule: true, message: 'L\'utilisateur a annulé : ne rien faire et ne pas réessayer sans nouvelle demande.'}; }
      carte.etat = 'en cours'; renderAiChatInPlace();
      try { const r = await plan.executer(); carte.etat = 'faite'; carte.resultat = r; renderAiChatInPlace(); return r; }
      catch (e) { carte.etat = 'echec'; carte.erreur = e.message; renderAiChatInPlace(); return {erreur: e.message}; }
    } catch (e) {
      console.warn('[IA] outil', appel.name, e);
      return {erreur: e.outil ? e.message : 'Erreur pendant l\'outil : ' + (e.message || e)};
    }
  }
  function textePremier(u) {
    return `Contexte (fourni par l'application, à titre d'information) : utilisateur ${iaRole(u)}, nom ${displayName(u)}, date du jour ${ymd()}.\n`
      + `Collections lisibles : ${collectionsDe(u).join(', ')}.\nActions possibles (avec confirmation) : ${actionsDe(u).map(x => x.nom).join(', ') || 'aucune'}.`;
  }
  const _envoiPrecedent = sendAiChat;
  let generation = 0;   // change à chaque nouvelle conversation ou déconnexion : une boucle en cours s'arrête
  const retirer = m => { const i = aiChatHistory.indexOf(m); if (i >= 0) aiChatHistory.splice(i, 1); };
  sendAiChat = async function (texte) {
    const msg = s(texte).trim(), u = Auth.current();
    if (!msg || aiChatBusy) return;
    if (!u || agentCoupe || typeof SB === 'undefined' || !SB) return _envoiPrecedent.apply(this, arguments);
    aiChatBusy = true;
    const gen = generation, perime = () => gen !== generation;
    ajouter({role: 'user', content: msg});
    if (!contenus.length) contenus.push({role: 'user', parts: [{text: textePremier(u)}]}, {role: 'model', parts: [{text: 'Compris.'}]});
    // Les gros résultats d'outils des questions précédentes sont allégés : la conversation reste sous la limite du serveur.
    contenus.forEach(c => c.parts.forEach(p => { if (p.functionResponse && JSON.stringify(p.functionResponse.response).length > 1500) p.functionResponse.response = {note: 'Résultat déjà utilisé pour une réponse précédente ; relire les données si besoin.'}; }));
    const base = contenus.length;   // en cas d'échec, l'échange inachevé est retiré (la conversation reste valide)
    contenus.push({role: 'user', parts: [{text: msg}]});
    const attente = ajouter({role: 'assistant', content: ''});
    try {
      let fini = false;
      for (let pas = 0; pas < PAS_MAX && !fini; pas++) {
        const r = await appelerServeur({mode: 'agent', contents: contenus});
        if (perime()) return;
        const parts = Array.isArray(r.parts) ? r.parts : [];
        contenus.push({role: 'model', parts});
        const appels = parts.filter(p => p.functionCall).map(p => p.functionCall);
        const txt = parts.filter(p => typeof p.text === 'string' && !p.thought).map(p => p.text).join('').trim();
        if (!appels.length) { retirer(attente); ajouter({role: 'assistant', content: txt || 'Je n\'ai pas de réponse à donner.'}); fini = true; break; }
        if (txt) { retirer(attente); ajouter({role: 'assistant', content: txt}); aiChatHistory.push(attente); renderAiChatInPlace(); }
        const reponses = [];
        for (const ap of appels) {
          retirer(attente);
          const res = await executerOutil(u, ap);
          if (perime()) return;
          aiChatHistory.push(attente); renderAiChatInPlace();
          reponses.push({functionResponse: {name: ap.name, response: res && typeof res === 'object' ? res : {resultat: res}}});
        }
        contenus.push({role: 'user', parts: reponses});
      }
      if (!fini) { retirer(attente); contenus.length = base; ajouter({role: 'assistant', content: 'La demande demande trop d\'étapes : précisez-la ou découpez-la.'}); }
    } catch (e) {
      if (perime()) return;
      retirer(attente);
      contenus.length = base;   // on retire la question et ce qui a suivi, pour pouvoir la reposer
      if (['gestion_off', 'agent_off'].includes(e.code)) {
        agentCoupe = true; aiChatHistory.pop(); aiChatBusy = false; renderAiChatInPlace();
        return _envoiPrecedent.call(this, msg);
      }
      ajouter({role: 'assistant', content: e.code === 429 || /Trop de demandes/.test(e.message) ? 'Trop de demandes, réessayez dans un instant.' : e.code === 413 ? 'La conversation est devenue trop longue : commencez-en une nouvelle (bouton +).' : e.code === 401 || e.code === 'connexion' ? 'Votre session a expiré : reconnectez-vous.' : 'L\'assistant ne répond pas pour le moment. Réessayez dans un instant.'});
    } finally {
      if (!perime()) { aiChatBusy = false; renderAiChatInPlace(); }
    }
  };
  /* Arrêter la conversation en cours (nouvelle conversation, déconnexion). */
  function arreter() { generation++; contenus = []; attentes.forEach(r => r('non')); attentes.clear(); aiChatBusy = false; }

  /* Nouvelle conversation, déconnexion : l'historique agent repart de zéro. */
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest('[data-iap="nouveau"]')) arreter(); }, true);
  const _logout = Auth.logout;
  Auth.logout = async function (...a) { arreter(); agentCoupe = true; return _logout.apply(this, a); };

  /* ---------------------------------------------------------------------------
     5. Affichage : traces d'outils et cartes de confirmation
     --------------------------------------------------------------------------- */
  const _rendu = renderAiChatInPlace;
  renderAiChatInPlace = function () {
    _rendu();
    const list = $('#ai-chat-list'); if (!list || !aiChatHistory.length) return;
    const bulles = [...list.querySelectorAll(':scope > .bubble')];
    aiChatHistory.forEach((m, i) => {
      const b = bulles[i]; if (!b || !m.kind) return;
      if (m.kind === 'outil') { b.className = 'bubble ia-trace'; b.textContent = m.content; return; }
      if (m.kind === 'action') {
        b.className = `bubble ia-action ia-${s(m.etat).replace(/\s/g, '-')}`;
        const res = m.resultat || {};
        b.innerHTML = `<b class="ia-a-titre">${esc(m.content)}</b>${(m.details || []).length ? `<ul>${m.details.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}`
          + (m.etat === 'attente' ? `<div class="ia-a-boutons"><button type="button" class="btn sm" data-ia-act="ok" data-ia-id="${m.id}">Confirmer</button><button type="button" class="btn ghost sm" data-ia-act="non" data-ia-id="${m.id}">Annuler</button></div>`
            : `<p class="ia-a-etat">${m.etat === 'faite' ? `Fait${res.ref ? ' : ' + esc(res.ref) : res.recu ? ' : reçu ' + esc(res.recu) : ''}${res.lien ? ` · <a href="${esc(res.lien)}">Ouvrir</a>` : ''}` : m.etat === 'annulee' ? 'Annulé' : m.etat === 'echec' ? 'Échec : ' + esc(m.erreur || '') : 'Enregistrement…'}</p>`);
      }
    });
  };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-ia-act]'); if (!b) return;
    e.preventDefault(); const r = attentes.get(b.dataset.iaId); if (r) r(b.dataset.iaAct);
  });
  /* Les cartes en attente ne survivent pas à un rechargement : elles sont enregistrées comme non faites. */
  const _sauver = aiChatSauver;
  aiChatSauver = function () {
    const vrai = aiChatHistory;
    aiChatHistory = vrai.filter(m => m.kind !== 'outil').map(m => m.kind === 'action' ? {role: 'assistant', content: `${m.content} — ${m.etat === 'faite' ? 'fait' : m.etat === 'annulee' ? 'annulé' : 'non fait'}`} : m);
    try { _sauver(); } finally { aiChatHistory = vrai; }
  };
  document.head.insertAdjacentHTML('beforeend', `<style>
    #ai-chat-list .ia-trace{background:transparent;border:0;padding:2px 4px;font-size:.78rem;color:var(--muted);box-shadow:none}
    #ai-chat-list .ia-trace::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--line-strong);margin-right:7px;vertical-align:middle}
    #ai-chat-list .ia-action{background:var(--surface);border:1px solid var(--line-strong);border-left:3px solid var(--brand);max-width:94%;white-space:normal}
    #ai-chat-list .ia-action ul{margin:6px 0 0;padding-left:18px;font-size:.88rem;color:var(--ink-2)}
    #ai-chat-list .ia-a-boutons{display:flex;gap:8px;margin-top:10px}
    #ai-chat-list .ia-a-etat{margin:8px 0 0;font-size:.86rem;font-weight:600}
    #ai-chat-list .ia-faite{border-left-color:var(--ok)} #ai-chat-list .ia-faite .ia-a-etat{color:var(--ok)}
    #ai-chat-list .ia-echec{border-left-color:var(--bad)} #ai-chat-list .ia-echec .ia-a-etat{color:var(--bad)}
    #ai-chat-list .ia-annulee{opacity:.7}
  </style>`);

  // Pour les tests et le diagnostic (lecture seule).
  window.DEUKSIL_IA = {collectionsDe, actionsDe, outilLire, outilCalculer, outilProfil, get contenus() { return contenus; }};
})();
