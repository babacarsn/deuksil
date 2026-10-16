/* ==========================================================================
   MODULE : messagerie.js — une seule boîte pour le propriétaire et l'agence.
   Deux circuits existaient : les discussions (client, propriétaire, agence)
   et les échanges du bail (locataire ↔ bailleur). Le locataire avait déjà
   une boîte unique, mais le bailleur lisait le second circuit ailleurs
   (Gestion › Messages locataires, hors du menu de l'agence) : ce que le
   locataire écrivait n'arrivait pas dans « Messages », et la réponse partie
   de « Messages » n'arrivait pas dans le bail. Une personne = une
   conversation, quel que soit le circuit ; la réponse repart dans le bail
   quand il y en a un, et les deux côtés la voient.
   ========================================================================== */

/* --- 1. Les locataires du bailleur et leurs baux --------------------------- */
function bauxBailleur(u) {
  if (!u || !['owner', 'agency'].includes(u.role)) return [];
  if (u.member && !(u.perms || []).includes('gestion')) return [];   // un agent ne gère pas les baux
  return DB.filterItems(DB.K.leases, l => l.ownerId === u.id);
}

function conversationsPro(u) {
  const parGens = new Map();
  const prendre = id => { if (!parGens.has(id)) parGens.set(id, {autreId: id, fils: [], baux: []}); return parGens.get(id); };
  DB.filterItems(DB.K.messages, t => t.participants.includes(u.id))
    .forEach(t => prendre(t.participants.find(p => p !== u.id)).fils.push(t));
  bauxBailleur(u).forEach(l => {
    const loc = locataireDuBail(l); if (!loc) return;
    const aDesMsgs = DB.findItem(DB.K.tmsgs, m => m.leaseId === l.id);
    if (l.status === 'actif' || aDesMsgs) prendre(loc.id).baux.push(l);
  });
  return [...parGens.values()].map(c => {
    /* Le bail actif d'abord : c'est par lui que repart la réponse. */
    c.baux.sort((a, b) => (a.status === 'actif' ? 0 : 1) - (b.status === 'actif' ? 0 : 1));
    c.items = itemsPro(c, u);
    c.cle = c.fils.length ? 't:' + c.fils[0].id : 'b:' + c.baux[0].id;
    c.dernier = c.items[c.items.length - 1] || {};
    c.nonLus = c.items.filter(m => !m.moi && !m.read).length;
    return c;
  }).filter(c => c.fils.length || c.baux.length)
    /* Une conversation vide n'a d'intérêt que si on vient de l'ouvrir. */
    .filter(c => c.items.length || c.baux.length || c.fils.some(t => t.id === openThread))
    .sort((a, b) => (b.dernier.at || '') < (a.dernier.at || '') ? -1 : 1);
}

function itemsPro(c, u) {
  const out = [];
  c.fils.forEach(t => (t.items || []).forEach((m, i) => out.push({
    moi: m.senderId === u.id, text: m.text || '', at: m.at, pj: m.pj || [], read: !!m.read, ref: 'msg:' + t.id + ':' + i})));
  c.baux.forEach(l => DB.filterItems(DB.K.tmsgs, x => x.leaseId === l.id).forEach(m => out.push({
    moi: m.from === 'owner', text: m.text || '', at: m.createdAt, pj: m.pj || [], read: !!m.read, ref: 'tmsg:' + m.id})));
  return out.sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1);
}

function marquerProLue(c, u) {
  let bouge = false;
  c.fils.forEach(t => {
    let touche = false;
    const items = (t.items || []).map(m => { if (m.senderId === u.id || m.read) return m; touche = true; return Object.assign({}, m, {read: true, readAt: now()}); });
    if (touche) { DB.updateItem(DB.K.messages, t.id, {items}); bouge = true; }
  });
  c.baux.forEach(l => DB.filterItems(DB.K.tmsgs, x => x.leaseId === l.id && x.from === 'tenant' && !x.read)
    .forEach(m => { DB.updateItem(DB.K.tmsgs, m.id, {read: true}); bouge = true; }));
  return bouge;
}

/* --- 2. L'écran ------------------------------------------------------------ */
function boitePro(u) {
  const convs = conversationsPro(u);
  if (!convs.length) return shellApp(u, page('Messages', 'Vos échanges avec vos clients, locataires et partenaires.') +
    `<div class="empty"><b>Aucune conversation</b><p class="small">Les échanges arrivent ici : clients qui vous contactent depuis une annonce, locataires, propriétaires. Pour écrire le premier, utilisez « Nouvelle discussion ».</p></div>`);
  /* Une discussion qu'on vient d'ouvrir (fiche d'un bien, numéro) passe devant. */
  let c = null;
  if (openThread) { c = convs.find(x => x.fils.some(t => t.id === openThread)); openThread = null; }
  c = c || convs.find(x => x.cle === boiteOuverte) || convs[0];
  boiteOuverte = c.cle;
  if (marquerProLue(c, u)) { c.items = itemsPro(c, u); c.nonLus = 0; }
  const autre = DB.findItem(DB.K.users, c.autreId) || {};
  const bail = c.baux[0];
  const prop = bail ? gProp(bail.propertyId) : (c.fils[0] && gProp(c.fils[0].propertyId));
  const composeur = bail
    ? `<form class="composer" data-action="g9-osend" data-id="${bail.id}"><input class="input" name="text" maxlength="500" placeholder="Écrire à ${esc(autre.firstName || 'votre locataire')}…" autocomplete="off"><button class="btn">Envoyer</button></form>`
    : `<form class="composer" data-action="send-msg" data-id="${c.fils[0].id}"><input class="input" name="text" placeholder="Écrire un message…" autocomplete="off"><button class="btn">Envoyer</button></form>`;
  return shellApp(u, page('Messages', `${convs.length} conversation${convs.length > 1 ? 's' : ''}`) + `
    <div class="chat ${mobileThreadOpen ? 'thread-open' : ''}">
      <div class="threads">${convs.map(x => {
        const o = DB.findItem(DB.K.users, x.autreId) || {};
        const apercu = (x.dernier.text || '').trim() || ((x.dernier.pj || []).length ? pjMot(x.dernier.pj) + ' · ' + x.dernier.pj[0].name : (x.baux.length ? 'Locataire · ' + ((gProp(x.baux[0].propertyId) || {}).title || '') : 'Nouvelle discussion'));
        return `<div class="thread ${x.cle === c.cle ? 'on' : ''} ${x.nonLus ? 'nonlu' : ''}" data-action="boite-ouvrir" data-id="${esc(x.cle)}" data-pja="1">
          <div class="row">${avatarHtml(o, 36)}
            <div style="min-width:0"><b class="small">${esc(displayName(o))}</b>${x.baux.length ? ' <span class="badge info" style="font-size:10px;padding:1px 6px">Locataire</span>' : ''}
            <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(apercu)}</div></div>
            ${x.nonLus ? `<span class="lu-n">${x.nonLus}</span>` : ''}</div></div>`;
      }).join('')}</div>
      <div class="msgs">
        <div class="row-between" style="padding:12px 16px;border-bottom:1px solid var(--line)">
          <div class="row" style="gap:10px">
            <button class="chat-back" data-action="close-thread-mobile" aria-label="Retour aux conversations">${icon('arrowLeft', 18)}</button>
            <div><b>${esc(displayName(autre))}</b>
              <div class="small muted"><a href="${telHref(autre.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(autre.phone || '')}</a></div>
              ${bail ? `<div class="small muted">Locataire${prop ? ' · ' + esc(prop.title) : ''}</div>` : prop ? `<div class="small muted">À propos de ${esc(prop.title)}</div>` : ''}</div>
          </div>
          ${prop ? `<a class="btn ghost sm" href="#/property/${prop.id}">Voir le bien</a>` : ''}</div>
        <div class="list" id="msg-list">${c.items.map(bulleHtml).join('') || '<p class="small muted" style="padding:14px">Aucun message pour l\'instant. Écrivez le premier.</p>'}</div>
        ${composeur}
      </div></div>`);
}

(() => {
  const r = routes.find(x => x.re.source === '^\\/(client|owner|agency)\\/messages$'); if (!r) return;
  const f = r.fn;
  r.fn = role => {
    if (role === 'client') return f(role);
    const u = Auth.guard(role); if (!u) return false;
    if (u.member && !memberCan(u, 'messages')) { toast('Accès non autorisé pour votre profil.', 'bad'); go(Auth.home(u)); return false; }
    return boitePro(u);
  };
})();

/* Les anciens liens (notifications, raccourcis) vers les échanges du bail
   mènent à la boîte. */
(() => {
  const r = routes.find(x => x.re.test('/manage/tmsgs'));
  routes.unshift({re: /^\/manage\/tmsgs$/, fn: () => {
    const u = Auth.current();
    if (u && ['owner', 'agency'].includes(u.role)) { go(`#/${u.role}/messages`); return false; }
    return r ? r.fn('tmsgs') : false;
  }});
})();

/* --- 3. Répondre ------------------------------------------------------------- */
/* Dans le bail : le message va dans les échanges du bail, que le locataire
   lit dans sa boîte. Les fichiers joints restent gérés par pieces.js. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form.composer[data-action="g9-osend"]'); if (!f) return;
  const pj = (f.dataset.pj && typeof pjAttente !== 'undefined' && pjAttente.get(f.dataset.pj)) || [];
  if (pj.length) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  const texte = String((f.querySelector('[name="text"]') || {}).value || '').trim();
  if (!texte) return toast('Écrivez un message.', 'bad');
  const l = DB.findItem(DB.K.leases, x => x.id === f.dataset.id && x.ownerId === u.id);
  if (!l || !bauxBailleur(u).some(x => x.id === l.id)) return toast('Action non autorisée pour votre profil.', 'bad');
  const loc = locataireDuBail(l);
  sendMsg(l.id, 'owner', texte, loc && loc.id, '#/client/messages');
  render();
}, true);

/* Le locataire répond dans le bail de la conversation ouverte (il peut en
   avoir plusieurs), pas toujours dans le premier. */
window.addEventListener('submit', e => {
  const f = e.target.closest && e.target.closest('form.composer[data-action="g9-tsend"]'); if (!f) return;
  const u = Auth.current(); if (!u || u.role !== 'tenant') return;
  const pj = (f.dataset.pj && typeof pjAttente !== 'undefined' && pjAttente.get(f.dataset.pj)) || [];
  if (pj.length) return;
  const texte = String((f.querySelector('[name="text"]') || {}).value || '').trim(); if (!texte) return;
  const c = conversationsDe(u).find(x => x.cle === boiteOuverte);
  const l = (c && c.baux[0]) || DB.findItem(DB.K.leases, u.leaseId);
  e.preventDefault(); e.stopImmediatePropagation();
  if (!l) return toast('Aucun bail actif.', 'bad');
  sendMsg(l.id, 'tenant', texte, l.ownerId, '');
  render();
}, true);

/* Les notifications mènent à la boîte de chacun. */
sendMsg = function (leaseId, from, text, toUser) {
  DB.addItem(DB.K.tmsgs, {leaseId, from, text: text.slice(0, 500), read: false});
  const dest = toUser && DB.findItem(DB.K.users, toUser); if (!dest) return;
  const loc = DB.findItem(DB.K.users, x => x.leaseId === leaseId || (x.leaseIds || []).includes(leaseId));
  const lien = ['tenant', 'client'].includes(dest.role) ? '#/client/messages' : `#/${dest.role}/messages`;
  notify(dest.id, `${from === 'tenant' ? 'Message de ' + (loc ? displayName(loc).trim() : 'votre locataire') : 'Nouveau message de votre bailleur'} : ${text.slice(0, 60)}`, lien);
};
const _notifyBoite = notify;
notify = function (userId, text, link) {
  /* pieces.js et les anciens écrans pointent encore vers les échanges du bail. */
  if (link === '#/manage/tmsgs') { const d = DB.findItem(DB.K.users, userId); link = d ? `#/${d.role}/messages` : link; }
  if (link === '#/tenant/messages') link = '#/client/messages';
  return _notifyBoite(userId, text, link);
};

/* --- 4. Pastille « Messages » ------------------------------------------------- */
const _badgePro = sidebarBadge;
sidebarBadge = function (u, href) {
  if (u && ['owner', 'agency'].includes(u.role) && /^#\/(owner|agency)\/messages$/.test(href)) {
    return {n: conversationsPro(u).reduce((n, c) => n + c.nonLus, 0), tone: 'bad'};
  }
  return _badgePro(u, href);
};
const _majBadgePro = majBadgeMessages;
majBadgeMessages = function () {
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return _majBadgePro();
  const n = conversationsPro(u).reduce((x, c) => x + c.nonLus, 0);
  document.querySelectorAll(`a[href="#/${u.role}/messages"]`).forEach(a => { const b = a.querySelector('.sidebar-badge'); if (!b) return; if (!n) b.remove(); else b.textContent = n; });
};

/* --- 5. Une seule discussion entre deux personnes ------------------------- */
function fusionnerFilsDoubles() {
  const parCle = new Map();
  DB.getData(DB.K.messages).forEach(t => {
    if (!Array.isArray(t.participants) || t.participants.length !== 2) return;
    const k = t.participants.slice().sort().join('|');
    if (!parCle.has(k)) { parCle.set(k, t); return; }
    const garde = parCle.get(k);
    const items = (garde.items || []).concat(t.items || []).sort((a, b) => (a.at || '') < (b.at || '') ? -1 : 1);
    const maj = DB.updateItem(DB.K.messages, garde.id, {items, propertyId: garde.propertyId || t.propertyId || '', phone: garde.phone || t.phone || '', agentId: garde.agentId || t.agentId || ''});
    DB.deleteItem(DB.K.messages, t.id);
    if (openThread === t.id) openThread = garde.id;
    parCle.set(k, maj || garde);
  });
}
[0, 1500, 4000].forEach(t => setTimeout(() => { try { fusionnerFilsDoubles(); } catch (e) {} }, t));
