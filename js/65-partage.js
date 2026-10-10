/* ==========================================================================
   MODULE : partage.js — un document concerne deux personnes, pas une.
   Factures, devis, proformas, avoirs, reçus, quittances et contrats étaient
   rangés dans le seul coffre de celui qui les émet. Le client recevait une
   facture… qu'il ne voyait nulle part. Le locataire ne voyait ni ses reçus
   ni les documents d'une vente.
   Chaque document se range désormais AUSSI dans le tiroir correspondant du
   destinataire — et seulement ceux qui le concernent : les titres de
   propriété, mandats, diagnostics et dépenses du propriétaire restent chez
   lui.
   ========================================================================== */

/* --- 1. Qui est le destinataire ? --------------------------------------- */
/* Trois pistes, de la plus sûre à la plus souple : le compte enregistré sur
   le document, le téléphone, puis le nom. */
function destinataireDe(x) {
  if (!x) return null;
  if (x.clientId) {
    const u = DB.findItem(DB.K.users, x.clientId);
    if (u) return u;
  }
  const nom = x.client || x.party || x.tenant || '';
  const tel = x.clientPhone || x.phone || '';
  const ct = telCle(tel), cn = nomCle({firstName: nom, lastName: ''});
  if (!ct && !cn) return null;
  const gens = DB.filterItems(DB.K.users, u => ['client', 'tenant'].includes(u.role)
    || (typeof estMandant === 'function' && estMandant(u)));
  return (ct && gens.find(u => telCle(u.phone) === ct))
      || (cn && gens.find(u => nomCle(u) === cn))
      || null;
}

function estPourMoi(u, x) {
  if (!u || !x) return false;
  if (x.clientId && x.clientId === u.id) return true;
  const d = destinataireDe(x);
  return !!d && d.id === u.id;
}

/* --- 2. Le document retient à qui il s'adresse -------------------------- */
const _mkDocPt = mkDoc;
mkDoc = function (u, type, o) {
  const d = _mkDocPt(u, type, o);
  try {
    if (d && !d.clientId) {
      const qui = destinataireDe(d);
      if (qui) DB.updateItem(DB.K.docs, d.id, {clientId: qui.id});
      return DB.findItem(DB.K.docs, d.id) || d;
    }
  } catch (e) {}
  return d;
};

/* --- 3. Les tiroirs du client et du locataire s'ouvrent ----------------- */
/* Ils peuvent voir et télécharger ces documents, mais pas y déposer :
   UPCATS n'est pas touché, le dépôt reste limité à leurs propres pièces. */
const RECUS_CATS = ['factures', 'devis', 'avoirs', 'recus', 'quittances', 'contrats'];
DRAWERS.tenant = [...new Set([...RECUS_CATS, 'identite', 'assurance', 'autres'])];
DRAWERS.client = [...new Set([...RECUS_CATS, 'identite', 'revenus', 'autres'])];

/* --- 4. Ce qui lui est adressé ------------------------------------------ */
const CAT_DOC = {FAC: 'factures', DEV: 'devis', PF: 'devis', AV: 'avoirs'};

function documentsRecus(u) {
  const out = [], pt = id => (gProp(id) || {}).title || '';
  const emetteur = id => {
    const x = DB.findItem(DB.K.users, id) || {};
    return x.role === 'agency' ? (x.agencyName || 'Votre agence')
      : `${x.firstName || ''} ${x.lastName || ''}`.trim() || 'Votre propriétaire';
  };
  const de = id => 'de ' + emetteur(id);

  try {
    DB.getData(DB.K.docs).filter(d => estPourMoi(u, d)).forEach(d => out.push({
      cat: CAT_DOC[d.type], name: d.ref, title: d.ref,
      sub: [DT[d.type], de(d.ownerId), pt(d.propertyId)].filter(Boolean).join(' · '),
      date: d.createdAt, info: `${money(dTot(d))} ${badge(...dState(d))}`}));

    DB.getData(DB.K.fpay).filter(p => estPourMoi(u, p)).forEach(p => out.push({
      cat: 'recus', name: p.rec, title: p.rec,
      sub: [de(p.ownerId), p.docRef].filter(Boolean).join(' · '),
      date: p.createdAt, info: `${money(p.amount)} · ${esc(p.method)}`}));

    DB.getData(DB.K.contracts).filter(c => estPourMoi(u, c)).forEach(c => out.push({
      cat: 'contrats', name: c.ref, title: `${c.ref} · ${CTYPE[c.type]}`,
      sub: [de(c.ownerId), pt(c.propertyId)].filter(Boolean).join(' · '),
      date: c.createdAt, info: badge(c.status, CTONE[c.status])}));

    /* Les quittances suivent les baux de la personne — tous ses logements. */
    const baux = bauxDe(u);
    if (baux.length) {
      const ids = new Set(baux.map(b => b.id));
      DB.getData(DB.K.rents).filter(r => r.paidAt && ids.has(r.leaseId)).forEach(r => {
        const l = DB.findItem(DB.K.leases, r.leaseId) || {};
        out.push({cat: 'quittances', name: 'QUIT-' + r.id,
          title: 'Quittance de ' + monthLabel(r.month),
          sub: [de(r.ownerId), pt(l.propertyId)].filter(Boolean).join(' · '),
          date: r.paidAt, info: money(r.amount)});
      });
    }
  } catch (e) {}
  return out;
}

/* Un propriétaire sous mandat reçoit lui aussi : son agence lui adresse des
   factures de gestion et son mandat. Il a le rôle « owner », mais du côté
   des documents il est un destinataire comme un autre. */
const recoitDocuments = u => !!u && (['client', 'tenant'].includes(u.role)
  || (typeof estMandant === 'function' && estMandant(u)));

const _vaultItemsPt = vaultItems;
vaultItems = function (u) {
  const base = _vaultItemsPt(u);
  if (!recoitDocuments(u)) return base;
  const vus = new Set(base.map(i => i.name));
  const ajout = documentsRecus(u).filter(i => i.cat && !vus.has(i.name));
  const permis = DRAWERS[u.role] || [];
  return base.concat(ajout.filter(i => permis.includes(i.cat)))
    .sort((a, b) => (b.date || '') < (a.date || '') ? -1 : 1);
};

/* --- 5. Le destinataire peut aussi en tirer le PDF ---------------------- */
/* pdfFor n'autorisait que l'émetteur : un client voyait son document dans
   son tiroir et s'entendait répondre « Document introuvable ». */
const _pdfForPt = pdfFor;
pdfFor = function (name, u) {
  const direct = _pdfForPt(name, u);
  if (direct) return direct;
  if (!recoitDocuments(u)) return direct;
  const iss = x => DB.findItem(DB.K.users, x.ownerId) || u;
  let m;
  if (/^(DEV|PF|FAC|AV)-/.test(name)) {
    const d = DB.findItem(DB.K.docs, x => x.ref === name && estPourMoi(u, x));
    return d && ['finances', pdfInvoice, d, iss(d)];
  }
  if (/^REC-/.test(name)) {
    const p = DB.findItem(DB.K.fpay, x => x.rec === name && estPourMoi(u, x));
    return p && ['finances', pdfReceipt, p, iss(p)];
  }
  if (/^CTR-/.test(name)) {
    const c = DB.findItem(DB.K.contracts, x => x.ref === name && estPourMoi(u, x));
    return c && ['gestion', pdfContract, c, iss(c)];
  }
  if (m = name.match(/^QUIT-(.+)$/)) {
    const ids = new Set(bauxDe(u).map(b => b.id));
    const r = DB.findItem(DB.K.rents, x => x.id === m[1] && x.paidAt && ids.has(x.leaseId));
    return r && ['gestion', pdfQuittance, r, iss(r)];
  }
  return null;
};

/* --- 5 bis. Les documents déjà émis sont rattachés eux aussi ----------- */
/* Les factures et contrats créés avant cette version ne portent pas le
   compte de leur destinataire. On les retrouve par téléphone ou par nom et
   on inscrit le lien, une fois : si la personne change de nom plus tard,
   son document la suit quand même. */
/* Pas de drapeau « déjà fait » : un compte locataire peut naître après le
   document qui le concerne. On repasse donc, mais seulement sur ce qui n'est
   pas encore rattaché — la liste se vide d'elle-même. */
function rattacherAnciens() {
  const u = Auth.current();
  if (!u || !['owner', 'agency', 'admin'].includes(u.role)) return;
  try {
    [DB.K.docs, DB.K.contracts, DB.K.fpay].forEach(cle => {
      DB.getData(cle)
        .filter(x => !x.clientId && (u.role === 'admin' || x.ownerId === u.id))
        .forEach(x => {
          const qui = destinataireDe(x);
          if (qui) DB.updateItem(cle, x.id, {clientId: qui.id});
        });
    });
  } catch (e) {}
}

/* --- 6. On le lui dit ---------------------------------------------------- */
/* Un document rangé sans un mot, c'est un document que personne n'ouvre. */
const NOTE_DOC = 'deuksil_docs_notifies_v1';
function prevenirDestinataires() {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  let faits;
  try { faits = new Set(JSON.parse(localStorage.getItem(NOTE_DOC) || '[]')); }
  catch (e) { faits = new Set(); }
  let change = false;
  const dire = (cle, qui, texte, cat) => {
    if (faits.has(cle)) return;
    faits.add(cle); change = true;
    notify(qui.id, texte, '#/coffre/' + cat);
  };
  try {
    DB.filterItems(DB.K.docs, d => d.ownerId === u.id).forEach(d => {
      const qui = destinataireDe(d); if (!qui) return;
      dire('d' + d.id, qui, `${DT[d.type]} ${d.ref} de ${displayName(u)} : ${money(dTot(d))}.`,
        CAT_DOC[d.type] || 'autres');
    });
    DB.filterItems(DB.K.contracts, c => c.ownerId === u.id).forEach(c => {
      const qui = destinataireDe(c); if (!qui) return;
      dire('c' + c.id, qui, `Contrat ${c.ref} (${CTYPE[c.type]}) déposé dans vos documents.`, 'contrats');
    });
    DB.filterItems(DB.K.fpay, p => p.ownerId === u.id).forEach(p => {
      const qui = destinataireDe(p); if (!qui) return;
      dire('p' + p.id, qui, `Reçu ${p.rec} : ${money(p.amount)} enregistré sur ${p.docRef}.`, 'recus');
    });
  } catch (e) {}
  if (change) {
    try { localStorage.setItem(NOTE_DOC, JSON.stringify([...faits])); } catch (e) {}
  }
}

/* --- 7. Le coffre vu par celui qui reçoit ------------------------------- */
/* Les libellés étaient écrits du point de vue de l'émetteur — « Offres
   envoyées aux clients » n'a aucun sens pour celui qui les reçoit — et un
   client n'aura jamais de quittance : un tiroir vide qui ne se remplira
   jamais n'a rien à faire là. */
const MOTS_RECUS = {
  factures: 'Factures reçues de votre propriétaire ou de votre agence',
  devis: 'Devis et proformas qui vous ont été adressés',
  avoirs: 'Notes de crédit établies à votre nom',
  recus: 'Vos preuves de paiement',
  quittances: 'Vos loyers payés',
  contrats: 'Vos baux et contrats'
};

function adapterCoffre() {
  const u = Auth.current();
  if (!recoitDocuments(u)) return;
  /* La page d'un tiroir porte la même description : on la reprend aussi. */
  const m = location.hash.match(/^#\/coffre\/(\w+)$/);
  if (m && MOTS_RECUS[m[1]]) {
    const p = document.querySelector('.main > .content .page-head p');
    if (p && !p.dataset.recu) {
      p.dataset.recu = '1';
      const suite = p.textContent.split('·').slice(1).join('·').trim();
      p.textContent = MOTS_RECUS[m[1]] + (suite ? ' · ' + suite : '');
    }
    return;
  }
  if (location.hash !== '#/coffre') return;
  document.querySelectorAll('.coffre .drawer').forEach(a => {
    const cat = (a.getAttribute('href') || '').split('/').pop();
    if (!RECUS_CATS.includes(cat)) return;
    const n = +((a.querySelector('.dn') || {}).textContent || 0);
    if (!n) { a.remove(); return; }
    const d = a.querySelector('.desk');
    if (d && MOTS_RECUS[cat]) d.textContent = MOTS_RECUS[cat];
  });
}

function noteCoffrePartage() {
  const u = Auth.current();
  if (!recoitDocuments(u)) return;
  if (location.hash !== '#/coffre') return;
  const c = document.querySelector('.main > .content');
  if (!c || c.querySelector('.coffre-note')) return;
  const n = documentsRecus(u).length;
  if (!n) return;
  const d = document.createElement('p');
  d.className = 'small muted coffre-note';
  d.style.cssText = 'margin:-8px 0 16px';
  d.textContent = `${n} document${n > 1 ? 's' : ''} reçu${n > 1 ? 's' : ''} de votre `
    + 'propriétaire ou de votre agence sont rangés automatiquement dans ces tiroirs.';
  const h = c.querySelector('.page-head');
  if (h) h.after(d); else c.prepend(d);
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { rattacherAnciens(); } catch (e) {}
  try { prevenirDestinataires(); } catch (e) {}
  try { adapterCoffre(); } catch (e) {}
  try { noteCoffrePartage(); } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});
