/* ==========================================================================
   MODULE : pieces.js — un message peut porter un fichier, et un fichier reçu
   peut rejoindre ses documents.
   La messagerie ne transportait que du texte. Pour envoyer un bail scanné ou
   une attestation, il fallait sortir de l'application. Et un locataire qui
   recevait une quittance n'avait aucun moyen de la ranger dans son coffre :
   il la téléchargeait, puis la redéposait à la main.
   Deux gestes manquaient donc : joindre, et ranger. Les voici, sur les deux
   messageries — celle des clients (fils de discussion) et celle des
   locataires (échanges attachés au bail).
   ========================================================================== */

/* --- 1. Les limites, posées une fois ------------------------------------ */
/* Le bouton portait une flèche d'import : on y met un trombone, qui dit
   « joindre » sans avoir à l'expliquer. */
ICONS.paperclip = '<path d="M20.4 11.6 12 20a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/>';

const PJ_MAX = 3;                       /* fichiers par message */
const PJ_POIDS = 4 * 1024 * 1024;       /* 4 Mo, comme le coffre */
const PJ_TYPES = '.pdf,image/*,.doc,.docx';
const pjAttente = new Map();            /* clé de composeur -> fichiers lus */

const pjPoids = n => !n ? '' : n < 1024 * 1024
  ? Math.max(1, Math.round(n / 1024)) + ' Ko'
  : (n / 1048576).toFixed(1).replace('.', ',') + ' Mo';

/* Une image pèse lourd : on la réduit comme les photos de biens. Un PDF
   passe tel quel, sous les 4 Mo. */
async function pjLire(file) {
  if (file.size > PJ_POIDS) throw new Error('trop volumineux');
  if ((file.type || '').startsWith('image/')) {
    const dataUrl = await readImageAsDataUrl(file);
    const nom = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return {name: nom, mime: 'image/jpeg', dataUrl, size: Math.round(dataUrl.length * .75)};
  }
  const dataUrl = await readFileAsDataUrl(file);
  return {name: file.name, mime: file.type || 'application/octet-stream', dataUrl, size: file.size};
}

/* --- 2. Le trombone dans le composeur ----------------------------------- */
const PJ_FORMES = ['send-msg', 'g9-osend', 'g9-tsend'];
const pjCle = f => f.dataset.action + ':' + (f.dataset.id || 'moi');

function pjChips(cle) {
  const bac = document.querySelector(`[data-pj-bac="${cle}"]`);
  if (!bac) return;
  const l = pjAttente.get(cle) || [];
  bac.innerHTML = l.map((a, i) => `<span class="pj pj-sel">${icon(docIcon(a.mime), 13)}
    <span class="pj-n">${esc(a.name)}</span><span class="pj-p">${pjPoids(a.size)}</span>
    <button type="button" class="pj-x" data-action="pj-oter" data-id="${esc(cle)}" data-i="${i}"
      aria-label="Retirer ${esc(a.name)}">${icon('close', 13)}</button></span>`).join('');
  bac.hidden = !l.length;
  const f = document.querySelector(`form[data-pj="${cle}"]`);
  const b = f && f.querySelector('.pj-btn input');
  if (b) b.disabled = l.length >= PJ_MAX;
}

function greffePJ(form) {
  if (!form || form.dataset.pj) return;
  const cle = pjCle(form);
  form.dataset.pj = cle;

  /* Un fichier seul suffit : le texte n'est plus obligatoire. */
  const champ = form.querySelector('[name="text"]');
  if (champ) champ.required = false;

  const pince = document.createElement('label');
  pince.className = 'pj-btn';
  pince.title = 'Joindre un fichier';
  pince.setAttribute('aria-label', 'Joindre un fichier');
  pince.innerHTML = `${icon('paperclip', 18)}<input type="file" multiple accept="${PJ_TYPES}">`;
  const envoi = form.querySelector('button:not([type="button"])');
  if (envoi) form.insertBefore(pince, envoi); else form.appendChild(pince);

  const bac = document.createElement('div');
  bac.className = 'pj-bac';
  bac.setAttribute('data-pj-bac', cle);
  bac.hidden = true;
  form.parentNode.insertBefore(bac, form);

  pince.querySelector('input').addEventListener('change', async ev => {
    const el = ev.target;
    const l = pjAttente.get(cle) || [];
    const fichiers = [...el.files].slice(0, PJ_MAX - l.length);
    el.value = '';
    let refuses = 0;
    for (const file of fichiers) {
      try { l.push(await pjLire(file)); } catch { refuses++; }
    }
    pjAttente.set(cle, l);
    pjChips(cle);
    if (refuses) toast(`${refuses} fichier${refuses > 1 ? 's' : ''} refusé${refuses > 1 ? 's' : ''} : 4 Mo maximum.`, 'bad');
  });
  pjChips(cle);
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="pj-oter"]');
  if (!b) return;
  const cle = b.dataset.id, l = pjAttente.get(cle) || [];
  l.splice(+b.dataset.i, 1);
  pjAttente.set(cle, l);
  pjChips(cle);
});

/* --- 3. Envoyer -------------------------------------------------------- */
/* L'application de base traite ces formulaires dans un gros gestionnaire :
   on l'intercepte à la capture quand il y a des fichiers, et on le laisse
   travailler quand il n'y en a pas. */
document.addEventListener('submit', e => {
  const f = e.target.closest(PJ_FORMES.map(a => `form[data-action="${a}"]`).join(','));
  if (!f) return;
  const u = Auth.current(); if (!u) return;
  const cle = f.dataset.pj;
  const pj = (cle && pjAttente.get(cle)) || [];
  const champ = f.querySelector('[name="text"]');
  const texte = ((champ && champ.value) || '').trim();
  if (!pj.length) {
    if (!texte) {
      e.preventDefault(); e.stopImmediatePropagation();
      toast('Écrivez un message ou joignez un fichier.', 'bad');
    }
    return;
  }
  e.preventDefault(); e.stopImmediatePropagation();
  envoyerAvecPJ(f, u, texte, pj, cle);
}, true);

function pjMot(pj) {
  return pj.length === 1 ? '1 fichier joint' : `${pj.length} fichiers joints`;
}

/* --- 3b. Un fichier envoyé arrive aussi dans les documents du receveur -- */
/* Une facture ou un contrat se range tout seul dans le tiroir du client :
   un fichier envoyé par message doit faire de même, sinon le destinataire
   le croit perdu. On n'en garde qu'un seul exemplaire : la fiche du coffre
   renvoie à la pièce du message au lieu de la recopier. */
function pjTiroir(role, nom) {
  const permis = DRAWERS[role] || [];
  const devine = guessCat(nom);
  return permis.includes(devine) ? devine : permis.includes('autres') ? 'autres' : permis[0];
}

function rangerChezLeDestinataire(pj, ref, destId, deId) {
  const dest = DB.findItem(DB.K.users, destId);
  if (!dest || !(DRAWERS[dest.role] || []).length) return 0;
  let n = 0;
  pj.forEach((a, i) => {
    const cat = pjTiroir(dest.role, a.name);
    if (!cat) return;
    DB.addItem(DB.K.documents, {ownerId: dest.id, name: a.name, mime: a.mime, cat,
      propertyId: '', expiry: '', recuDe: deId, pjSrc: ref, pjI: i});
    if (DB.lastWriteOk) n++;
  });
  return n;
}

/* La fiche du coffre qui correspond à une pièce de message, s'il y en a une. */
const pjDocDe = (ref, i, u) => DB.findItem(DB.K.documents,
  x => x.ownerId === u.id && x.pjSrc === ref && x.pjI === i);

function envoyerAvecPJ(f, u, texte, pj, cle) {
  const a = f.dataset.action;
  const fini = () => { pjAttente.delete(cle); pjChips(cle); };

  if (a === 'send-msg') {
    const t = DB.findItem(DB.K.messages, f.dataset.id);
    if (!t || !t.participants.includes(u.id)) return;
    const items = (t.items || []).concat([{senderId: u.id, text: texte, at: now(), pj}]);
    DB.updateItem(DB.K.messages, t.id, {items});
    if (!DB.lastWriteOk) return;
    const autre = t.participants.find(p => p !== u.id);
    const range = rangerChezLeDestinataire(pj, pjRef('msg', t.id + ':' + (items.length - 1)), autre, u.id);
    notify(autre, `${displayName(u)} vous a envoyé ${pjMot(pj)}`
      + (range ? ' : rangé dans vos documents.' : '.'), roleLink(autre, 'messages'));
    fini(); toast(`${pjMot(pj)} envoyé${pj.length > 1 ? 's' : ''}.`); render();
    return;
  }

  /* Messagerie du bail : le propriétaire répond depuis une fenêtre, le
     locataire depuis sa page. */
  const bailId = a === 'g9-osend' ? f.dataset.id : u.leaseId;
  const l = DB.findItem(DB.K.leases, bailId);
  if (!l) return;
  const depuis = a === 'g9-osend' ? 'owner' : 'tenant';
  if (depuis === 'owner' && l.ownerId !== u.id) return;
  const vers = depuis === 'owner'
    ? (DB.findItem(DB.K.users, x => x.leaseId === l.id || (x.leaseIds || []).includes(l.id)) || {}).id
    : l.ownerId;
  const rec = DB.addItem(DB.K.tmsgs, {leaseId: l.id, from: depuis, text: texte.slice(0, 500), read: false, pj});
  if (!DB.lastWriteOk) return;
  const range = vers ? rangerChezLeDestinataire(pj, pjRef('tmsg', rec.id), vers, u.id) : 0;
  if (vers) notify(vers, `Nouveau message avec ${pjMot(pj)}`
    + (range ? ' : rangé dans vos documents.' : '.'),
    depuis === 'owner' ? '#/tenant/messages' : '#/manage/tmsgs');
  fini();
  if (depuis === 'owner') { closeModal(); toast('Message envoyé.'); render(); }
  else { toast(`${pjMot(pj)} envoyé${pj.length > 1 ? 's' : ''}.`); render(); }
}

/* --- 4. Afficher les pièces reçues ------------------------------------- */
/* Les bulles sont construites par l'application de base, sans identifiant :
   elles suivent l'ordre du tableau de messages, et c'est cet ordre qui sert
   de repère. */
function pjRef(a, b) { return a + ':' + b; }

function pjTrouve(ref, i) {
  const p = String(ref).split(':');
  if (p[0] === 'msg') {
    const t = DB.findItem(DB.K.messages, p[1]);
    const it = t && (t.items || [])[+p[2]];
    return {pj: it && (it.pj || [])[i], ok: t && t.participants.includes((Auth.current() || {}).id)};
  }
  const m = DB.findItem(DB.K.tmsgs, p[1]);
  if (!m) return {};
  const l = DB.findItem(DB.K.leases, m.leaseId);
  const u = Auth.current() || {};
  const sien = l && (l.ownerId === u.id
    || (typeof bauxDe === 'function' ? bauxDe(u).some(x => x.id === l.id) : u.leaseId === l.id));
  return {pj: (m.pj || [])[i], ok: !!sien};
}

const pjRangee = (u, a) => !!DB.findItem(DB.K.documents,
  x => x.ownerId === u.id && sameName(x.name, a.name));

/* Déjà rangé d'office : on ne propose pas de le ranger, on dit où il est. */
function pjLienCoffre(ref, i, u) {
  const d = pjDocDe(ref, i, u);
  if (!d) return '';
  return `<a class="pj-a pj-ok" href="#/coffre/${esc(d.cat)}">Dans vos documents</a>`;
}

function pjHtml(pj, ref, recu) {
  const u = Auth.current() || {};
  const peutRanger = recu && (UPCATS[u.role] || []).length;
  return `<div class="pj-list">${pj.map((a, i) => {
    const deja = peutRanger && pjRangee(u, a);
    const img = (a.mime || '').startsWith('image/');
    /* Une image se lit dans la discussion même : on la montre, on ne la
       décrit pas. Le reste s'ouvre d'un clic sur « Voir ». */
    const vignette = img ? `<img class="pj-vue" src="${a.dataUrl}" alt="${esc(a.name)}"
      data-action="pj-voir" data-id="${esc(ref)}" data-i="${i}" loading="lazy">` : '';
    return `<div class="pj-item">${vignette}
      <span class="pj">${icon(docIcon(a.mime), 13)}
      <span class="pj-n">${esc(a.name)}</span><span class="pj-p">${pjPoids(a.size)}</span>
      <button type="button" class="pj-a" data-action="pj-voir" data-id="${esc(ref)}" data-i="${i}">Voir</button>
      <button type="button" class="pj-a" data-action="pj-dl" data-id="${esc(ref)}" data-i="${i}">Télécharger</button>
      ${!peutRanger ? '' : pjLienCoffre(ref, i, u) || (deja
        ? '<span class="pj-ok">Dans mes documents</span>'
        : `<button type="button" class="pj-a" data-action="pj-ranger" data-id="${esc(ref)}" data-i="${i}">Ranger</button>`)}
    </span></div>`;
  }).join('')}</div>`;
}

function poseDansBulle(bulle, html) {
  const horo = bulle.lastElementChild;
  if (horo) horo.insertAdjacentHTML('beforebegin', html);
  else bulle.insertAdjacentHTML('beforeend', html);
}

/* 4a. Fils de discussion (client ↔ propriétaire / agence) */
function greffeFil() {
  const liste = document.querySelector('#msg-list');
  const f = document.querySelector('form[data-action="send-msg"]');
  if (!liste || !f) return;
  const t = DB.findItem(DB.K.messages, f.dataset.id);
  const u = Auth.current();
  if (!t || !u) return;
  [...liste.querySelectorAll('.bubble')].forEach((b, i) => {
    const m = (t.items || [])[i];
    if (!m || b.dataset.pjv) return;
    if (!m.pj || !m.pj.length) return;
    b.dataset.pjv = '1';
    poseDansBulle(b, pjHtml(m.pj, pjRef('msg', t.id + ':' + i), m.senderId !== u.id));
  });
  /* Un message sans texte laissait un aperçu vide dans la liste des fils. */
  document.querySelectorAll('.thread[data-id]').forEach(d => {
    if (d.dataset.pja) return;
    const fil = DB.findItem(DB.K.messages, d.dataset.id);
    const last = fil && (fil.items || [])[fil.items.length - 1];
    if (!last || (last.text || '').trim() || !(last.pj || []).length) return;
    const ap = d.querySelector('.small.muted');
    if (!ap) return;
    d.dataset.pja = '1';
    ap.textContent = pjMot(last.pj) + ' · ' + last.pj[0].name;
  });
}

/* 4b. Échanges du bail : la page du locataire, et la fenêtre du propriétaire */
let pjBailOuvert = null;
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="g9-thread"]');
  if (b) pjBailOuvert = b.dataset.id;
}, true);

function greffeBail() {
  const u = Auth.current(); if (!u) return;
  const cadres = [];
  const form = document.querySelector('.main > .content form[data-action="g9-tsend"]:not(.composer)');
  if (form && u.leaseId) {
    /* Attention : le bac à cartouches est posé juste avant le formulaire.
       La liste des messages est donc l'élément d'avant. */
    let z = form.previousElementSibling;
    while (z && z.classList.contains('pj-bac')) z = z.previousElementSibling;
    cadres.push([z, u.leaseId, 'tenant']);
  }
  /* La fenêtre du propriétaire : on ne la reconnaît qu'à son titre, pour ne
     pas greffer des bulles dans une fenêtre qui parle d'autre chose. */
  const titre = document.querySelector('#modal-root .modal-head h3');
  if (pjBailOuvert && titre && /^Messages\s·/.test(titre.textContent || '')) {
    const z = document.querySelector('#modal-root .modal-body > div:not(.pj-bac)');
    if (z) cadres.push([z, pjBailOuvert, 'owner']);
  }
  cadres.forEach(([zone, bailId, cote]) => {
    if (!zone) return;
    const msgs = DB.filterItems(DB.K.tmsgs, x => x.leaseId === bailId);
    const bulles = [...zone.querySelectorAll(':scope > div > div')]
      .filter(x => x.querySelector('.small'));
    bulles.forEach((b, i) => {
      const m = msgs[i];
      if (!m || b.dataset.pjv || !(m.pj || []).length) return;
      b.dataset.pjv = '1';
      poseDansBulle(b, pjHtml(m.pj, pjRef('tmsg', m.id), m.from !== cote));
    });
  });
  /* Le tableau « Échanges avec vos locataires » montrait une case vide. */
  document.querySelectorAll('.main table tr').forEach(tr => {
    if (tr.dataset.pja) return;
    const b = tr.querySelector('[data-action="g9-thread"][data-id]');
    if (!b) return;
    const msgs = DB.filterItems(DB.K.tmsgs, x => x.leaseId === b.dataset.id);
    const last = msgs[msgs.length - 1];
    if (!last || (last.text || '').trim() || !(last.pj || []).length) return;
    const c = tr.children[2];
    if (!c) return;
    tr.dataset.pja = '1';
    c.textContent = pjMot(last.pj) + ' · ' + last.pj[0].name;
  });
}

/* --- 5. Télécharger, et ranger dans ses documents ---------------------- */
/* Un aperçu d'un instant : on relâche l'adresse du précédent pour ne pas
   laisser des fichiers entiers en mémoire. */
let pjUrlVue = null;
function pjApercu(pj) {
  if (pjUrlVue) { try { URL.revokeObjectURL(pjUrlVue); } catch (err) {} pjUrlVue = null; }
  if ((pj.mime || '').startsWith('image/')) {
    modal(pj.name, `<img src="${pj.dataUrl}" alt="${esc(pj.name)}"
      style="max-width:100%;border-radius:10px;display:block;margin:auto">`);
    return;
  }
  pjUrlVue = URL.createObjectURL(dataUrlBlob(pj.dataUrl));
  modal(pj.name, `<iframe src="${pjUrlVue}" title="${esc(pj.name)}"
      style="width:100%;height:58vh;border:1px solid var(--line);border-radius:10px;background:var(--surface-2)"></iframe>
    <p class="small muted" style="margin:10px 0 0">Si l'aperçu reste vide, votre navigateur
      n'affiche pas ce format : téléchargez le fichier pour l'ouvrir.</p>`);
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-action="pj-dl"], [data-action="pj-ranger"], [data-action="pj-voir"]');
  if (!b) return;
  const u = Auth.current(); if (!u) return;
  const {pj, ok} = pjTrouve(b.dataset.id, +b.dataset.i);
  if (!pj || !ok) { toast('Pièce jointe introuvable.', 'bad'); return; }

  if (b.dataset.action === 'pj-voir') { pjApercu(pj); return; }
  if (b.dataset.action === 'pj-dl') { saveFile(pj.name, dataUrlBlob(pj.dataUrl)); return; }

  const cats = UPCATS[u.role] || [];
  if (!cats.length) { toast('Votre profil ne permet pas de ranger des documents.', 'bad'); return; }
  const defaut = cats.includes(guessCat(pj.name)) ? guessCat(pj.name) : cats[cats.length - 1];
  const props = ['owner', 'agency'].includes(u.role) ? myProps(u) : [];
  modal('Ranger dans mes documents', `
    <p class="small muted">« ${esc(pj.name)} » (${pjPoids(pj.size)}) sera copié dans votre coffre.</p>
    <form data-action="pj-ranger-ok" data-id="${esc(b.dataset.id)}" data-i="${esc(b.dataset.i)}">
      <div class="field"><label>Nom du document</label>
        <input class="input" name="name" value="${esc(pj.name)}" required></div>
      <div class="field"><label>Tiroir</label><select class="input" name="cat">${cats.map(c =>
        `<option value="${c}"${c === defaut ? ' selected' : ''}>${VCAT[c][0]}</option>`).join('')}</select></div>
      ${props.length ? `<div class="field"><label>Bien concerné (facultatif)</label>
        <select class="input" name="propertyId"><option value="">—</option>${gOpts(props)}</select></div>` : ''}
      <button class="btn block">Ranger dans le tiroir</button></form>`);
});

document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="pj-ranger-ok"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  const {pj, ok} = pjTrouve(f.dataset.id, +f.dataset.i);
  if (!pj || !ok) { toast('Pièce jointe introuvable.', 'bad'); return; }
  const d = formData(f);
  const cats = UPCATS[u.role] || [];
  if (!cats.includes(d.cat)) { toast('Tiroir invalide.', 'bad'); return; }
  if (d.propertyId && !myProps(u).some(p => p.id === d.propertyId)) {
    toast('Choisissez un de vos biens.', 'bad'); return;
  }
  DB.addItem(DB.K.documents, {ownerId: u.id, name: (d.name || '').trim() || pj.name,
    mime: pj.mime, dataUrl: pj.dataUrl, cat: d.cat, propertyId: d.propertyId || '', expiry: ''});
  if (!DB.lastWriteOk) return;
  closeModal();
  toast(`Rangé dans « ${VCAT[d.cat][0]} ».`);
  render();
}, true);

/* --- 6. Dans le coffre, la fiche renvoie à la pièce du message --------- */
/* Elle ne porte pas le fichier : le coffre de base répondrait « aperçu
   indisponible » et téléchargerait du vide. On s'en charge avant lui. */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action="g7-view"], [data-action="g7-dl"]');
  if (!el) return;
  const u = Auth.current(); if (!u) return;
  const d = DB.findItem(DB.K.documents, x => x.id === el.dataset.id && x.ownerId === u.id);
  if (!d || !d.pjSrc) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const {pj, ok} = pjTrouve(d.pjSrc, d.pjI || 0);
  if (!pj || !ok) { toast('Ce fichier n\'est plus disponible dans la conversation.', 'bad'); return; }
  if (el.dataset.action === 'g7-view') pjApercu(pj); else saveFile(pj.name, dataUrlBlob(pj.dataUrl));
}, true);

/* Et la fiche dit d'où elle vient. */
const _vaultItemsPj = vaultItems;
vaultItems = function (u) {
  return _vaultItemsPj(u).map(i => {
    if (i.kind !== 'up' || !i.id) return i;
    const d = DB.findItem(DB.K.documents, i.id);
    if (!d || !d.recuDe) return i;
    const de = whoIs(d.recuDe);
    return Object.assign({}, i, {
      sub: [i.sub, de ? 'Reçu de ' + de : 'Reçu par message'].filter(Boolean).join(' · '),
      info: '<span class="small muted">Reçu par message</span>'});
  });
};

/* --- 7. Greffes après chaque rendu ------------------------------------- */
new MutationObserver(() => requestAnimationFrame(() => {
  try {
    PJ_FORMES.forEach(a => document.querySelectorAll(`form[data-action="${a}"]`).forEach(greffePJ));
    greffeFil();
    greffeBail();
  } catch (err) {}
})).observe(document.body, {childList: true, subtree: true});
