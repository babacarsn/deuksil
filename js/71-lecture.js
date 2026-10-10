/* ==========================================================================
   MODULE : lecture.js — savoir si son message a été lu.
   On écrivait dans le vide : rien ne disait si le message était parvenu à
   son destinataire, ni s'il l'avait ouvert. Et la pastille « Messages » du
   menu comptait les conversations, pas les messages non lus — elle affichait
   donc 2 en permanence, même quand tout était lu.
   Deux coches suffisent à tout dire, comme ailleurs : une coche, le message
   est parti ; deux coches colorées, il a été lu. Les messages reçus et non
   lus sont annoncés, dans la liste des fils comme dans le menu.
   ========================================================================== */

ICONS.coche1 = '<path d="M4 12.5 9 17.5 20 6.5"/>';
ICONS.coche2 = '<path d="M1.5 12.5 6.5 17.5 17.5 6.5"/><path d="M8.5 15 11 17.5 22 6.5"/>';

/* --- 1. Lire, c'est marquer comme lu ------------------------------------ */
/* Un fil affiché à l'écran est un fil lu : on l'inscrit sans redessiner la
   page, sinon chaque lecture relancerait un rendu. */
function marquerFilLu() {
  const f = document.querySelector('form[data-action="send-msg"]');
  const u = Auth.current();
  if (!f || !u) return false;
  /* Sur un téléphone, la liste des fils s'affiche d'abord et le fil reste
     caché : il ne faut pas déclarer lu ce que personne n'a encore ouvert. */
  const volet = document.querySelector('.msgs');
  if (!volet || !volet.getBoundingClientRect().width) return false;
  const t = DB.findItem(DB.K.messages, f.dataset.id);
  if (!t || !t.participants.includes(u.id)) return false;
  let touche = false;
  const items = (t.items || []).map(m => {
    if (m.senderId === u.id || m.read) return m;
    touche = true;
    return Object.assign({}, m, {read: true, readAt: now()});
  });
  if (touche) DB.updateItem(DB.K.messages, t.id, {items});
  return touche;
}

/* Compte ce que l'utilisateur n'a pas encore lu. */
const filsNonLus = u => DB.filterItems(DB.K.messages, t => t.participants.includes(u.id))
  .reduce((n, t) => n + (t.items || []).filter(m => m.senderId !== u.id && !m.read).length, 0);
const filNonLus = (t, u) => (t.items || []).filter(m => m.senderId !== u.id && !m.read).length;

/* --- 2. La pastille du menu dit enfin quelque chose --------------------- */
const _sidebarBadgeL = sidebarBadge;
sidebarBadge = function (u, href) {
  const p = href.slice(1);
  if (p === '/client/messages' || (p === '/owner/messages' && ['owner', 'agency'].includes(u.role))) {
    return {n: filsNonLus(u), tone: 'bad'};
  }
  if (p === '/tenant/messages' && u.role === 'tenant') {
    const b = typeof bauxDe === 'function' ? bauxDe(u).map(x => x.id) : [u.leaseId];
    return {n: DB.getData(DB.K.tmsgs).filter(m => b.includes(m.leaseId) && m.from === 'owner' && !m.read).length,
      tone: 'bad'};
  }
  return _sidebarBadgeL(u, href);
};

/* --- 3. Les coches, sur ses propres messages ---------------------------- */
function cocheHtml(lu) {
  return `<span class="lu ${lu ? 'lu-2' : ''}" title="${lu ? 'Lu' : 'Envoyé'}"
    aria-label="${lu ? 'Lu' : 'Envoyé'}">${icon(lu ? 'coche2' : 'coche1', 14)}</span>`;
}

function poseCoche(bulle, lu) {
  if (bulle.dataset.boite) return;   /* bulle dessinée par la boîte unifiée */
  if (bulle.dataset.lu === (lu ? '2' : '1')) return;
  bulle.dataset.lu = lu ? '2' : '1';
  const anc = bulle.querySelector('.lu');
  if (anc) anc.remove();
  const horo = bulle.lastElementChild;
  if (horo) horo.insertAdjacentHTML('beforeend', ' ' + cocheHtml(lu));
}

/* 3a. Fils de discussion */
function cochesFil() {
  const liste = document.querySelector('#msg-list');
  const f = document.querySelector('form[data-action="send-msg"]');
  const u = Auth.current();
  if (!liste || !f || !u) return;
  const t = DB.findItem(DB.K.messages, f.dataset.id);
  if (!t) return;
  [...liste.querySelectorAll('.bubble')].forEach((b, i) => {
    const m = (t.items || [])[i];
    if (!m || m.senderId !== u.id) return;
    poseCoche(b, !!m.read);
  });
  /* Dans la liste des fils : combien de messages attendent. */
  document.querySelectorAll('.thread[data-id]').forEach(d => {
    const fil = DB.findItem(DB.K.messages, d.dataset.id);
    if (!fil) return;
    const n = filNonLus(fil, u);
    const ex = d.querySelector('.lu-n');
    if (!n) { if (ex) ex.remove(); d.classList.remove('nonlu'); return; }
    d.classList.add('nonlu');
    if (ex) { if (ex.textContent !== String(n)) ex.textContent = n; return; }
    const r = d.querySelector('.row');
    if (r) r.insertAdjacentHTML('beforeend', `<span class="lu-n">${n}</span>`);
  });
}

/* 3b. Échanges du bail : le champ « read » existait déjà, il ne servait
   qu'à compter. On le montre. */
function cochesBail() {
  const u = Auth.current(); if (!u) return;
  const cadres = [];
  const form = document.querySelector('.main > .content form[data-action="g9-tsend"]:not(.composer)');
  if (form && u.leaseId) {
    let z = form.previousElementSibling;
    while (z && z.classList.contains('pj-bac')) z = z.previousElementSibling;
    cadres.push([z, u.leaseId, 'tenant']);
  }
  const titre = document.querySelector('#modal-root .modal-head h3');
  if (typeof pjBailOuvert !== 'undefined' && pjBailOuvert && titre
      && /^Messages\s·/.test(titre.textContent || '')) {
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
      if (!m || m.from !== cote) return;
      poseCoche(b, !!m.read);
    });
  });
}

/* --- 4. Greffes après chaque rendu ------------------------------------- */
new MutationObserver(() => requestAnimationFrame(() => {
  try {
    if (marquerFilLu()) majBadgeMessages();
    cochesFil();
    cochesBail();
  } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* La pastille du menu est dessinée au rendu : après une lecture, on la met
   à jour sur place plutôt que de redessiner tout l'écran. */
function majBadgeMessages() {
  const u = Auth.current(); if (!u) return;
  const n = filsNonLus(u);
  document.querySelectorAll(`a[href="#/${u.role}/messages"]`).forEach(a => {
    const b = a.querySelector('.sidebar-badge');
    if (!b) return;
    if (!n) b.remove(); else b.textContent = n;
  });
}
