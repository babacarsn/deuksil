/* ==========================================================================
   MODULE : boite.js — une seule boîte de réception par personne.
   Fatou avait deux messageries sans le savoir. Son propriétaire pouvait lui
   écrire à deux endroits : depuis « Messages », qui ouvre un fil de
   discussion, ou depuis « Locataires › Échanges », qui écrit dans la
   conversation du bail. Or son menu ne menait qu'à la première. Tout ce qui
   partait de la seconde — messages et pièces jointes — n'arrivait nulle part
   chez elle : elle ne l'a jamais reçu.
   Une personne, une boîte. Les deux sources sont réunies dans un seul écran,
   classées par date, et la réponse repart là où la conversation vit.
   ========================================================================== */

/* --- 1. Ce que contient la boîte d'un locataire ------------------------- */
function bauxDuLocataire(u) {
  if (typeof bauxDe === 'function') return bauxDe(u).filter(l => l && l.status !== 'termine');
  const l = DB.findItem(DB.K.leases, u.leaseId);
  return l ? [l] : [];
}

/* Une conversation par interlocuteur : le fil et le bail avec la même
   personne ne font qu'une seule discussion. */
function conversationsDe(u) {
  const parGens = new Map();
  const prendre = id => {
    if (!parGens.has(id)) parGens.set(id, {autreId: id, fils: [], baux: []});
    return parGens.get(id);
  };
  DB.filterItems(DB.K.messages, t => t.participants.includes(u.id))
    .forEach(t => prendre(t.participants.find(p => p !== u.id)).fils.push(t));
  bauxDuLocataire(u).forEach(l => prendre(l.ownerId).baux.push(l));
  const out = [...parGens.values()].map(c => {
    c.items = itemsDeConversation(c, u);
    c.cle = c.baux.length ? 'b:' + c.baux[0].id : 't:' + c.fils[0].id;
    c.dernier = c.items[c.items.length - 1] || {};
    c.nonLus = c.items.filter(m => !m.moi && !m.read).length;
    return c;
  }).filter(c => c.fils.length || c.baux.length);
  return out.sort((a, b) => (b.dernier.at || '') < (a.dernier.at || '') ? -1 : 1);
}

function itemsDeConversation(c, u) {
  const out = [];
  c.fils.forEach(t => (t.items || []).forEach((m, i) => out.push({
    moi: m.senderId === u.id, text: m.text || '', at: m.at, pj: m.pj || [],
    read: !!m.read, ref: 'msg:' + t.id + ':' + i, filId: t.id
  })));
  c.baux.forEach(l => DB.filterItems(DB.K.tmsgs, x => x.leaseId === l.id).forEach(m => out.push({
    moi: m.from === 'tenant', text: m.text || '', at: m.createdAt, pj: m.pj || [],
    read: !!m.read, ref: 'tmsg:' + m.id, bailId: l.id
  })));
  return out.sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1);
}

/* --- 2. Lire, c'est marquer comme lu ----------------------------------- */
function marquerConversationLue(c, u) {
  let bouge = false;
  c.fils.forEach(t => {
    let touche = false;
    const items = (t.items || []).map(m => {
      if (m.senderId === u.id || m.read) return m;
      touche = true; return Object.assign({}, m, {read: true, readAt: now()});
    });
    if (touche) { DB.updateItem(DB.K.messages, t.id, {items}); bouge = true; }
  });
  c.baux.forEach(l => DB.filterItems(DB.K.tmsgs, x => x.leaseId === l.id
    && x.from === 'owner' && !x.read).forEach(m => {
    DB.updateItem(DB.K.tmsgs, m.id, {read: true}); bouge = true;
  }));
  return bouge;
}

/* --- 3. L'écran -------------------------------------------------------- */
let boiteOuverte = null;

function bulleHtml(m) {
  /* Les pièces et la coche sont posées ici même : les greffes qui comptent
     les bulles d'un autre écran ne doivent pas y toucher. */
  const pj = (m.pj || []).length ? pjHtml(m.pj, m.ref, !m.moi) : '';
  const coche = m.moi ? ' ' + cocheHtml(!!m.read) : '';
  return `<div class="bubble ${m.moi ? 'me' : ''}" data-pjv="1" data-boite="1" data-lu="${m.moi ? (m.read ? '2' : '1') : '0'}">
    ${esc(m.text)}${pj}<div class="small" style="opacity:.65;margin-top:3px">${dateTimeFr(m.at)}${coche}</div></div>`;
}

function boiteHtml(u) {
  const convs = conversationsDe(u);
  if (!convs.length) {
    return shellApp(u, page('Messages', 'Vos échanges avec votre propriétaire et les autres utilisateurs.') +
      `<div class="empty"><b>Aucune conversation</b><p class="small">Les échanges démarrent depuis la fiche d'un bien, avec le bouton « Contacter », ou à l'initiative de votre propriétaire.</p></div>`);
  }
  const c = convs.find(x => x.cle === boiteOuverte) || convs[0];
  boiteOuverte = c.cle;
  if (c.baux.length) { try { localStorage.setItem(CLE_BAIL_ACTIF, c.baux[0].id); } catch (e) {} }
  if (marquerConversationLue(c, u)) { c.items = itemsDeConversation(c, u); c.nonLus = 0; }

  const autre = DB.findItem(DB.K.users, c.autreId) || {};
  const bail = c.baux[0];
  const prop = bail ? gProp(bail.propertyId) : (c.fils[0] && gProp(c.fils[0].propertyId));
  const composeur = bail
    ? `<form class="composer" data-action="g9-tsend">
         <input class="input" name="text" maxlength="500" placeholder="Écrire un message…" autocomplete="off">
         <button class="btn">Envoyer</button></form>`
    : `<form class="composer" data-action="send-msg" data-id="${c.fils[0].id}">
         <input class="input" name="text" placeholder="Écrire un message…" autocomplete="off">
         <button class="btn">Envoyer</button></form>`;

  return shellApp(u, page('Messages', `${convs.length} conversation${convs.length > 1 ? 's' : ''}`) + `
    <div class="chat ${mobileThreadOpen ? 'thread-open' : ''}">
      <div class="threads">${convs.map(x => {
        const o = DB.findItem(DB.K.users, x.autreId) || {};
        const apercu = (x.dernier.text || '').trim()
          || ((x.dernier.pj || []).length ? pjMot(x.dernier.pj) + ' · ' + x.dernier.pj[0].name : '');
        return `<div class="thread ${x.cle === c.cle ? 'on' : ''} ${x.nonLus ? 'nonlu' : ''}"
            data-action="boite-ouvrir" data-id="${esc(x.cle)}" data-pja="1">
          <div class="row">${avatarHtml(o, 36)}
            <div style="min-width:0"><b class="small">${esc(displayName(o))}</b>
            <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(apercu)}</div></div>
            ${x.nonLus ? `<span class="lu-n">${x.nonLus}</span>` : ''}</div></div>`;
      }).join('')}</div>
      <div class="msgs">
        <div class="row-between" style="padding:12px 16px;border-bottom:1px solid var(--line)">
          <div class="row" style="gap:10px">
            <button class="chat-back" data-action="close-thread-mobile" aria-label="Retour aux conversations">${icon('arrowLeft', 18)}</button>
            <div><b>${esc(displayName(autre))}</b>
              <div class="small muted"><a href="${telHref(autre.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(autre.phone || '')}</a></div>
              ${bail ? `<div class="small muted">Votre propriétaire${prop ? ' · ' + esc(prop.title) : ''}</div>`
                : prop ? `<div class="small muted">À propos de ${esc(prop.title)}</div>` : ''}</div>
          </div>
          ${prop ? `<a class="btn ghost sm" href="#/property/${prop.id}">Voir le bien</a>` : ''}</div>
        <div class="list" id="msg-list">${c.items.map(bulleHtml).join('')
          || '<p class="small muted" style="padding:14px">Aucun message pour l\'instant.</p>'}</div>
        ${composeur}
      </div></div>`);
}

document.addEventListener('click', e => {
  const d = e.target.closest('[data-action="boite-ouvrir"]');
  if (!d) return;
  boiteOuverte = d.dataset.id;
  mobileThreadOpen = true;
  render();
});

/* --- 4. La boîte prend la place des deux anciennes ---------------------- */
/* Les deux adresses existantes y mènent : les notifications déjà envoyées
   pointent tantôt vers l'une, tantôt vers l'autre. */
const _msgsClient = routes.find(r => r.re.test('/client/messages'));
const _msgsBail = routes.find(r => r.re.test('/tenant/messages'));
routes.unshift({
  re: /^\/(client|tenant)\/messages$/,
  fn: quoi => {
    const u = Auth.current();
    if (u && u.role === 'tenant') return boiteHtml(u);
    /* Les autres profils gardent l'écran d'origine : on le rend nous-mêmes,
       car un itinéraire qui renvoie « false » n'en essaie pas d'autre. */
    const base = quoi === 'tenant' ? _msgsBail : _msgsClient;
    return base ? base.fn(quoi) : false;
  }
});

/* Un locataire qui n'a pas encore de compte client garde son entrée de menu
   fonctionnelle : on la fait pointer vers la boîte. */
(function entreeMenu() {
  let m = null;
  try { m = MENUS_RAW.tenant; } catch (e) {}
  if (!m || !m.findIndex) return;
  const i = m.findIndex(x => x[0] === '#/tenant/messages' || x[0] === '#/client/messages');
  if (i >= 0) m[i] = ['#/client/messages', 'Messages', 'message'];
})();

/* --- 5. La pastille compte les deux sources ---------------------------- */
const _badgeBoite = sidebarBadge;
sidebarBadge = function (u, href) {
  if (u && u.role === 'tenant' && /^#\/(client|tenant)\/messages$/.test(href)) {
    return {n: conversationsDe(u).reduce((n, c) => n + c.nonLus, 0), tone: 'bad'};
  }
  return _badgeBoite(u, href);
};

/* Après lecture, la pastille est rafraîchie sur place : le lien du menu
   d'un locataire est « client/messages », pas « tenant/messages ». */
const _majBadgeBoite = typeof majBadgeMessages === 'function' ? majBadgeMessages : null;
majBadgeMessages = function () {
  const u = Auth.current();
  if (!u || u.role !== 'tenant') return _majBadgeBoite && _majBadgeBoite();
  const n = conversationsDe(u).reduce((x, c) => x + c.nonLus, 0);
  document.querySelectorAll('a[href="#/client/messages"], a[href="#/tenant/messages"]')
    .forEach(a => {
      const b = a.querySelector('.sidebar-badge');
      if (!b) return;
      if (!n) b.remove(); else b.textContent = n;
    });
};

/* --- 6. Répondre depuis la boîte --------------------------------------- */
/* Le gestionnaire de base de « g9-tsend » attend un champ rempli et ne
   redessine pas toujours l'écran : on s'en charge pour que la réponse
   apparaisse aussitôt. */
document.addEventListener('submit', e => {
  const f = e.target.closest('form.composer[data-action="g9-tsend"]');
  if (!f) return;
  const u = Auth.current();
  if (!u || u.role !== 'tenant') return;
  const champ = f.querySelector('[name="text"]');
  const texte = ((champ && champ.value) || '').trim();
  if (!texte) return;                      /* pieces.js gère le cas des fichiers */
  e.preventDefault(); e.stopImmediatePropagation();
  const l = DB.findItem(DB.K.leases, u.leaseId);
  if (!l) { toast('Aucun bail actif.', 'bad'); return; }
  sendMsg(l.id, 'tenant', texte, l.ownerId, '#/manage/tmsgs');
  render();
});
