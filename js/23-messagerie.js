/* ==========================================================================
   VUE : messagerie (client, propriétaire, agence)
   ========================================================================== */
let openThread = null;
let mobileThreadOpen = false;
function displayName(x) { return x ? (x.role === 'agency' ? x.agencyName : `${x.firstName} ${x.lastName}`) : 'Utilisateur'; }
route(/^\/(client|owner|agency)\/messages$/, role => {
  const u = Auth.guard(role); if (!u) return false;
  const threads = DB.filterItems(DB.K.messages, t => t.participants.includes(u.id))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (!threads.length) return shellApp(u, page('Messages', 'Vos échanges avec les autres utilisateurs.') +
    `<div class="empty"><b>Aucune conversation</b><p class="small">Les échanges démarrent depuis la fiche d'un bien, avec le bouton « Contacter ».</p></div>`);
  const t = threads.find(x => x.id === openThread) || threads[0];
  openThread = t.id;
  const other = DB.findItem(DB.K.users, t.participants.find(p => p !== u.id));
  const prop = DB.findItem(DB.K.properties, t.propertyId);
  return shellApp(u, page('Messages', `${threads.length} conversation${threads.length > 1 ? 's' : ''}`) + `
    <div class="chat ${mobileThreadOpen ? 'thread-open' : ''}">
      <div class="threads">${threads.map(x => {
        const o = DB.findItem(DB.K.users, x.participants.find(p => p !== u.id));
        const last = x.items[x.items.length - 1] || {};
        return `<div class="thread ${x.id === t.id ? 'on' : ''}" data-action="open-thread" data-id="${x.id}">
          <div class="row">${avatarHtml(o, 36)}
            <div style="min-width:0"><b class="small">${esc(displayName(o))}</b>
            <div class="small muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(last.text || '')}</div></div></div></div>`;
      }).join('')}</div>
      <div class="msgs">
        <div class="row-between" style="padding:12px 16px;border-bottom:1px solid var(--line)">
          <div class="row" style="gap:10px">
            <button class="chat-back" data-action="close-thread-mobile" aria-label="Retour aux conversations">${icon('arrowLeft', 18)}</button>
            <div><b>${esc(displayName(other))}</b><div class="small muted"><a href="${telHref(other?.phone)}" style="color:inherit;text-decoration:none">${icon('phone', 11)} ${esc(other?.phone || '')}</a></div>${prop ? `<div class="small muted">À propos de ${esc(prop.title)}</div>` : ''}</div>
          </div>
          ${prop ? `<a class="btn ghost sm" href="#/property/${prop.id}">Voir le bien</a>` : ''}</div>
        <div class="list" id="msg-list">${t.items.map(m => `<div class="bubble ${m.senderId === u.id ? 'me' : ''}">${esc(m.text)}
          <div class="small" style="opacity:.65;margin-top:3px">${dateTimeFr(m.at)}</div></div>`).join('')}</div>
        <form class="composer" data-action="send-msg" data-id="${t.id}">
          <input class="input" name="text" placeholder="Écrire un message…" autocomplete="off" required>
          <button class="btn">Envoyer</button></form>
      </div></div>`);
});
