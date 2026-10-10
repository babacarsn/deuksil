/* ==========================================================================
   MODULE : actions.js — délégation d'événements (un seul point d'entrée)
   ========================================================================== */
function afterRender() {
  const list = $('#msg-list'); if (list) list.scrollTop = list.scrollHeight;
  const anchor = location.hash.match(/^#\/#([\w-]+)$/);
  if (anchor) document.getElementById(anchor[1])?.scrollIntoView({behavior: 'smooth'});
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }

/* ---- Fiche bien : favoris, contact, visite ---- */
function requireClient(action) {
  const u = Auth.current();
  if (!u) { toast('Connectez-vous pour ' + action + '.', 'bad'); go('#/login'); return null; }
  if (u.role === 'admin') { toast("L'administration ne peut pas " + action + '.', 'bad'); return null; }
  return u;
}
function toggleFav(pid) {
  const u = requireClient('enregistrer un favori'); if (!u) return;
  const ex = DB.findItem(DB.K.favorites, f => f.userId === u.id && f.propertyId === pid);
  if (ex) { DB.deleteItem(DB.K.favorites, ex.id); toast('Retiré de vos favoris.'); }
  else { DB.addItem(DB.K.favorites, {userId: u.id, propertyId: pid}); toast('Bien ajouté aux favoris.'); }
  render();
}
function openContact(pid) {
  const u = requireClient('envoyer un message'); if (!u) return;
  const p = DB.findItem(DB.K.properties, pid);
  startThread(u, p.ownerId, p.id);
}
function startThread(u, otherId, propertyId) {
  let t = DB.findItem(DB.K.messages, x => x.participants.includes(u.id) && x.participants.includes(otherId));
  if (!t) t = DB.addItem(DB.K.messages, {participants: [u.id, otherId], propertyId, items: []});
  openThread = t.id;
  mobileThreadOpen = true;
  go(`#/${u.role}/messages`);
}
function askVisit(pid) {
  const u = requireClient('demander une visite'); if (!u) return;
  const p = DB.findItem(DB.K.properties, pid);
  modal('Demander une visite', `
    <p class="small muted">${esc(p.title)} — ${esc(p.quartier)}, ${esc(p.city)}</p>
    <form data-action="create-visit" data-id="${p.id}">
      <div class="form-grid">
        <div class="field"><label>Date souhaitée</label><input class="input" type="date" name="date" value="${addDays(now(), 2).slice(0, 10)}" required></div>
        <div class="field"><label>Heure</label><input class="input" type="time" name="time" value="10:00" required></div></div>
      <div class="field"><label>Message au propriétaire</label><textarea name="message" placeholder="Précisez votre disponibilité, le nombre de personnes…"></textarea></div>
      <button class="btn block">Envoyer la demande</button></form>`);
}

/* ---- Inscription : création du compte puis paiements simulés ---- */
function startRegistration(data) {
  const exists = DB.findItem(DB.K.users, u => u.cni === data.cni);
  if (exists) { toast('Un compte existe déjà avec cette CNI.', 'bad'); return; }
  const user = DB.addItem(DB.K.users, {cni: data.cni, firstName: data.firstName, lastName: data.lastName, phone: data.phone,
    password: data.password, role: data.role, agencyName: data.agencyName || '', address: data.address || '', agencyDesc: data.agencyDesc || '',
    status: 'actif', registrationPaid: true});
  if (!DB.lastWriteOk) return;
  activate(user, 'Bienvenue sur DEUKSIL : votre compte est actif, gratuitement.');
}

function activate(user, msg) {
  logActivity(`${displayName(user)} a créé un compte ${user.role}`);
  notify(user.id, 'Bienvenue sur DEUKSIL. Votre compte est actif.', Auth.home(user));
  notify('user_admin', `Nouveau compte ${user.role} : ${displayName(user)}`, '#/admin/users');
  localStorage.setItem(DB.K.session, JSON.stringify({id: user.id, at: now()}));
  toast(msg);
  go(Auth.home(user));
}


/* ---- Enregistrement d'un bien ---- */
function saveProperty(form, id, intent) {
  const u = Auth.current();
  const d = formData(form);
  const amenities = $$('input[name="amenities"]:checked', form).map(i => i.value);
  if (!d.title.trim() || d.title.trim().length < 5) return formError(form, 'Le titre doit comporter au moins 5 caractères.');
  if (!d.price || +d.price <= 0) return formError(form, 'Indiquez un prix supérieur à 0.');
  if (!d.surface || +d.surface <= 0) return formError(form, 'Indiquez une surface supérieure à 0.');
  clearFormError(form);
  const payload = {
    title: d.title, description: d.description, type: d.type, transaction: d.transaction,
    price: +d.price, surface: +d.surface, rooms: +d.rooms || 0, baths: +d.baths || 0,
    region: d.region, city: d.city, commune: d.commune || d.city, quartier: d.quartier || d.city,
    availableFrom: d.availableFrom, amenities, furnished: amenities.includes('Meublé'), parking: amenities.includes('Parking'),
    photos: formPhotos.slice()
  };
  try {
    if (id) {
      const before = DB.findItem(DB.K.properties, id);
      DB.updateItem(DB.K.properties, id, {...payload, listingStatus: intent === 'publish' ? 'publiee' : before.listingStatus});
      if (!DB.lastWriteOk) return;
      toast(intent === 'publish' ? 'Annonce mise à jour et en ligne.' : 'Brouillon mis à jour.');
    } else {
      const p = DB.addItem(DB.K.properties, {...payload, ownerId: u.id, status: 'disponible', views: 0, contacts: 0,
        listingStatus: intent === 'publish' ? 'publiee' : 'brouillon'});
      if (!DB.lastWriteOk) return;
      if (intent === 'publish') notify('user_admin', `Nouvelle annonce en ligne : ${p.title}`, '#/admin/listings');
      logActivity(`${displayName(u)} a ${intent === 'publish' ? 'soumis' : 'enregistré'} l'annonce « ${p.title} »`);
      toast(intent === 'publish' ? 'Annonce publiée.' : 'Brouillon enregistré.');
    }
  } catch (e) {
    toast("Stockage local saturé : réduisez le nombre ou le poids des photos.", 'bad'); return;
  }
  formPhotos = []; formPhotosFor = null;
  go(u.role === 'agency' ? '#/agency/properties' : '#/owner/properties');
}

/* ---- Notifications ---- */
function openNotifications(u) {
  const items = DB.filterItems(DB.K.notifications, n => n.userId === u.id).slice().reverse();
  const canAskPermission = window.Notification && Notification.permission === 'default';
  const permBlocked = window.Notification && Notification.permission === 'denied';
  modal('Notifications', `
    ${canAskPermission ? `<div class="row-between card pad-s" style="margin-bottom:14px;background:var(--surface-2)">
        <span class="small">Recevoir aussi une alerte du navigateur ?</span>
        <button class="btn sm" data-action="ask-notif-permission">Activer</button></div>` : ''}
    ${permBlocked ? `<p class="small muted" style="margin-bottom:14px">Les alertes du navigateur sont bloquées ; le carillon sonore reste actif.</p>` : ''}
    ${items.length
      ? `<div class="stack">${items.map(n => `<button type="button" class="notif-row ${n.read ? 'read' : ''}" data-action="open-notification" data-id="${n.id}" data-link="${esc(n.link || '')}">
          <div>${esc(n.text)}</div><div class="small muted">${dateTimeFr(n.createdAt)}</div></button>`).join('')}</div>
         <button class="btn ghost block" style="margin-top:14px" data-action="read-all">Tout marquer comme lu</button>`
      : `<p class="muted">Aucune notification pour le moment.</p>`}`);
}

/* ---- Écouteurs globaux (une seule fois) ---- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'FORM' || el.tagName === 'SELECT') return;
  const a = el.dataset.action, id = el.dataset.id, u = Auth.current();
  const stop = () => e.preventDefault();

  switch (a) {
    case 'close-modal': stop(); closeModal(); break;
    case 'logout': stop(); Auth.logout(); break;
    case 'notifications': stop(); openNotifications(u); break;
    case 'open-ai-chat': stop(); openAiChat(); break;
    case 'ai-voice': stop(); startVoiceInput($('#ai-chat-text'), el); break;
    case 'open-notification': {
      stop();
      DB.updateItem(DB.K.notifications, id, {read: true});
      const link = el.dataset.link;
      closeModal();
      if (link) go(link); else render();
      break;
    }
    case 'view-receipt': stop(); openReceipt(id); break;
    case 'open-more-menu': stop(); openMoreMenu(u); break;
    case 'nav-close-modal': closeModal(); break;
    case 'toggle-pw': {
      stop();
      const input = el.previousElementSibling;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      el.setAttribute('aria-label', showing ? 'Afficher le mot de passe' : 'Masquer le mot de passe');
      el.innerHTML = icon(showing ? 'eye' : 'eyeOff', 16);
      break;
    }
    case 'sound-toggle': {
      stop();
      const enable = !soundEnabled();
      localStorage.setItem('deuksil_sound_pref', enable ? 'on' : 'off');
      if (enable) playNotifySound();
      render(); break;
    }
    case 'ask-notif-permission': {
      stop();
      if (window.Notification) {
        Notification.requestPermission().then(() => { closeModal(); openNotifications(u); });
      }
      break;
    }
    case 'read-all': stop(); DB.getData(DB.K.notifications).filter(n => n.userId === u.id).forEach(n => DB.updateItem(DB.K.notifications, n.id, {read: true})); closeModal(); render(); break;
    case 'toggle-fav': stop(); toggleFav(id); break;
    case 'contact': stop(); openContact(id); break;
    case 'call-owner': {
      stop();
      const cu = requireClient('voir le numéro de téléphone'); if (!cu) break;
      const p = DB.findItem(DB.K.properties, id);
      const owner = DB.findItem(DB.K.users, p.ownerId) || {};
      window.location.href = telHref(owner.phone);
      break;
    }
    case 'ask-visit': stop(); askVisit(id); break;
    case 'message-user': stop(); startThread(u, id, null); break;
    case 'open-thread': openThread = id; mobileThreadOpen = true; render(); break;
    case 'close-thread-mobile': stop(); mobileThreadOpen = false; render(); break;
    case 'fill-login': stop(); $('[name="cni"]').value = el.dataset.cni; $('[name="password"]').value = el.dataset.pwd; break;

    case 'set-transaction': stop(); searchState.transaction = el.dataset.v; searchState.page = 1; render(); break;
    case 'reset-search': stop(); searchState = {transaction:'', region:'', city:'', quartier:'', type:'', min:'', max:'', rooms:'', baths:'', surface:'', furnished:false, parking:false, sort:'recent', page:1}; render(); break;
    case 'clear-chip': stop(); searchState[el.dataset.k] = typeof searchState[el.dataset.k] === 'boolean' ? false : ''; searchState.page = 1; render(); break;
    case 'go-page': stop(); searchState.page = +el.dataset.p; render(); window.scrollTo({top: 0, behavior: 'smooth'}); break;
    case 'toggle-compare': if (el.tagName !== 'INPUT') { stop(); compareIds = compareIds.filter(x => x !== id); render(); } break;
    case 'clear-compare': stop(); compareIds = []; render(); break;
    case 'go-compare': stop(); go('#/compare'); break;
    case 'doc-delete': stop(); confirmDialog({title:'Supprimer ce document', message:'Cette action est définitive.', confirmLabel:'Supprimer', danger:true, onConfirm: () => { DB.deleteItem(DB.K.documents, id); toast('Document supprimé.'); render(); }}); break;
    case 'avatar-remove': stop(); DB.updateItem(DB.K.users, u.id, {avatarPhoto: null}); toast('Photo retirée.'); render(); break;
    case 'delete-account': {
      stop();
      confirmDialog({title:'Supprimer votre compte', message:'Votre compte, vos biens, vos messages, vos documents, votre abonnement et vos agents seront supprimés définitivement. Cette action est irréversible.', confirmLabel:'Supprimer définitivement', danger:true, onConfirm: () => {
        const uid = u.id;
        cascadeDeleteUser(uid);
        Auth.logout();
        toast('Compte supprimé.');
      }});
      break;
    }
    case 'bulk-validate': {
      stop();
      const ids = [...bulkSelected];
      ids.forEach(pid => {
        const p = DB.updateItem(DB.K.properties, pid, {listingStatus: 'publiee'});
        if (p) { notify(p.ownerId, `Votre annonce « ${p.title} » a été validée et publiée.`, `#/property/${p.id}`); logActivity(`Annonce validée : ${p.title}`); }
      });
      bulkSelected = [];
      toast(`${ids.length} annonce${ids.length > 1 ? 's' : ''} validée${ids.length > 1 ? 's' : ''}.`); render(); break;
    }
    case 'bulk-reject': {
      stop();
      const ids = [...bulkSelected];
      ids.forEach(pid => {
        const p = DB.updateItem(DB.K.properties, pid, {listingStatus: 'refusee'});
        if (p) notify(p.ownerId, `Votre annonce « ${p.title} » a été refusée.`, `#/owner/property/${p.id}`);
      });
      bulkSelected = [];
      toast(`${ids.length} annonce${ids.length > 1 ? 's' : ''} refusée${ids.length > 1 ? 's' : ''}.`, 'warn'); render(); break;
    }
    case 'owner-bulk-pause': stop(); ownerBulkSelected.forEach(pid => DB.updateItem(DB.K.properties, pid, {listingStatus: 'pause'})); toast(`${ownerBulkSelected.length} annonce(s) mise(s) en pause.`); ownerBulkSelected = []; render(); break;
    case 'owner-bulk-archive': stop(); ownerBulkSelected.forEach(pid => DB.updateItem(DB.K.properties, pid, {listingStatus: 'archivee', status: 'archive'})); toast(`${ownerBulkSelected.length} annonce(s) archivée(s).`); ownerBulkSelected = []; render(); break;
    case 'owner-bulk-delete': {
      stop();
      const ids = [...ownerBulkSelected];
      confirmDialog({title: 'Supprimer ces biens', message: `${ids.length} bien${ids.length > 1 ? 's seront supprimés' : ' sera supprimé'} définitivement.`, confirmLabel: 'Supprimer', danger: true, onConfirm: () => {
        ids.forEach(pid => DB.deleteItem(DB.K.properties, pid));
        ownerBulkSelected = [];
        toast(`${ids.length} bien(s) supprimé(s).`); render();
      }});
      break;
    }
    case 'save-search': {
      stop();
      promptDialog({title:'Enregistrer cette recherche', label:"Nom de l'alerte", value:[searchState.type || 'Bien', searchState.region || 'Sénégal'].join(' '), confirmLabel:'Créer l\'alerte', onConfirm: name => {
        DB.addItem(DB.K.searches, {userId: u.id, name, criteria: {...searchState}});
        notify(u.id, `Alerte « ${name} » créée. Vous serez prévenu des nouvelles annonces.`, '#/client/alerts');
        toast('Recherche enregistrée dans vos alertes.'); render();
      }});
      break;
    }
    case 'run-alert': { stop(); const al = DB.findItem(DB.K.searches, id); searchState = {...searchState, ...al.criteria}; go('#/search'); break; }
    case 'del-alert': stop(); DB.deleteItem(DB.K.searches, id); toast('Alerte supprimée.'); render(); break;

    case 'publish': {
      stop();
      if (!ownsProperty(id, u)) break;
      DB.updateItem(DB.K.properties, id, {listingStatus: 'publiee'});
      notify('user_admin', `Nouvelle annonce en ligne : ${DB.findItem(DB.K.properties, id).title}`, '#/admin/listings');
      toast('Annonce publiée : elle est visible dans la recherche.'); render(); break;
    }
    case 'pause': stop(); if (!ownsProperty(id, u)) break; DB.updateItem(DB.K.properties, id, {listingStatus: 'pause'}); toast('Annonce mise en pause.'); render(); break;
    case 'archive': stop(); if (!ownsProperty(id, u)) break; DB.updateItem(DB.K.properties, id, {listingStatus: 'archivee', status: 'archive'}); toast('Annonce archivée.'); render(); break;
    case 'delete-prop': {
      stop();
      if (!ownsProperty(id, u)) break;
      confirmDialog({title:'Supprimer ce bien', message:'Cette action est définitive : le bien, son annonce, ses favoris et ses demandes de visite associées seront retirés de la plateforme.', confirmLabel:'Supprimer', danger:true, onConfirm: () => { cascadeDeleteProperty(id); toast('Bien supprimé.'); render(); }});
      break;
    }

    case 'visit-status': {
      stop();
      const s = el.dataset.s;
      const target = DB.findItem(DB.K.visits, id);
      if (!target) break;
      if (target.ownerId !== u.id) { toast("Cette demande ne vous appartient pas.", 'bad'); break; }
      if (s === 'acceptee') {
        const conflict = DB.findItem(DB.K.visits, v => v.id !== id && v.propertyId === target.propertyId && v.date === target.date && v.time === target.time && v.status === 'acceptee');
        if (conflict) { toast('Un autre rendez-vous est déjà accepté pour ce bien à cette date et cette heure. Reportez plutôt cette demande.', 'bad'); break; }
      }
      const v = DB.updateItem(DB.K.visits, id, {status: s});
      notify(v.clientId, `Votre demande de visite est : ${VISIT_LABEL[s].toLowerCase()}.`, '#/client/visits');
      if (s === 'acceptee') DB.updateItem(DB.K.properties, v.propertyId, {status: 'discussion'});
      toast(`Demande ${VISIT_LABEL[s].toLowerCase()}.`); render(); break;
    }
    case 'validate': {
      stop(); const p = DB.updateItem(DB.K.properties, id, {listingStatus: 'publiee'});
      notify(p.ownerId, `Votre annonce « ${p.title} » a été validée et publiée.`, `#/property/${p.id}`);
      DB.getData(DB.K.searches).forEach(s => { if (!s.criteria.type || s.criteria.type === p.type) notify(s.userId, `Nouvelle annonce correspondant à « ${s.name} » : ${p.title}.`, `#/property/${p.id}`); });
      logActivity(`Annonce validée : ${p.title}`); toast('Annonce publiée.'); render(); break;
    }
    case 'reject': {
      stop(); const p = DB.updateItem(DB.K.properties, id, {listingStatus: 'refusee'});
      notify(p.ownerId, `Votre annonce « ${p.title} » a été refusée. Complétez la description et les photos.`, `#/owner/property/${p.id}`);
      toast('Annonce refusée.', 'warn'); render(); break;
    }
    case 'user-toggle': { stop(); const x = DB.findItem(DB.K.users, id); DB.updateItem(DB.K.users, id, {status: x.status === 'suspendu' ? 'actif' : 'suspendu'}); toast('Statut du compte mis à jour.'); render(); break; }
    case 'user-del': stop(); confirmDialog({title:'Supprimer ce compte', message:'Le compte, ses biens, ses messages, ses documents, son abonnement et ses données associées seront supprimés définitivement.', confirmLabel:'Supprimer', danger:true, onConfirm: () => { cascadeDeleteUser(id); toast('Compte supprimé.'); render(); }}); break;

    case 'add-agent': {
      stop();
      modal('Ajouter un agent', `<form data-action="create-agent">
        <div class="form-grid"><div class="field"><label>Prénom</label><input class="input" name="firstName" required></div>
        <div class="field"><label>Nom</label><input class="input" name="lastName" required></div></div>
        <div class="field"><label>Téléphone</label><input class="input" name="phone" required></div>
        <div class="field"><label>Numéro de CNI (fictif)</label><input class="input" name="cni" maxlength="13" required></div>
        <div class="field"><label>Rôle</label><input class="input" name="role" value="Agent commercial"></div>
        <button class="btn block">Ajouter l'agent</button></form>`);
      break;
    }
    case 'agent-toggle': { stop(); const ag = ownsAgent(id, u); if (!ag) break; DB.updateItem(DB.K.agents, id, {status: ag.status === 'actif' ? 'inactif' : 'actif'}); render(); break; }
    case 'agent-del': stop(); if (!ownsAgent(id, u)) break; DB.deleteItem(DB.K.agents, id); toast('Agent supprimé.'); render(); break;

    case 'remove-photo': stop(); formPhotos.splice(+el.dataset.i, 1); render(); break;
    case 'export-data': {
      stop();
      const dump = Object.fromEntries(Object.entries(DB.K).map(([k, v]) => [k, localStorage.getItem(v)]));
      modal('Export JSON', `<textarea style="min-height:260px;font-size:.75rem">${esc(JSON.stringify(dump, null, 1))}</textarea>
        <p class="small muted">Copiez ce contenu pour le réinjecter dans un backend lors de la migration.</p>`);
      break;
    }
    case 'reset-demo': stop(); confirmDialog({title:'Réinitialiser la démonstration', message:'Toutes les données créées seront remplacées par le jeu de démonstration initial. Cette action est irréversible.', confirmLabel:'Réinitialiser', danger:true, onConfirm: () => { seedIfNeeded(true); resetSessionUiState(); localStorage.removeItem(DB.K.session); toast('Données réinitialisées.'); go('#/'); render(); }}); break;
  }
});

document.addEventListener('change', e => {
  if (e.target.name === 'role' && $('#agency-fields')) {
    $('#agency-fields').classList.toggle('hidden', e.target.value !== 'agency');
  }
  const el = e.target.closest('[data-action]'); if (!el) return;
  if (el.dataset.action === 'set-status') {
    const u = Auth.current();
    if (!ownsProperty(el.dataset.id, u)) { render(); return; }
    const p = DB.updateItem(DB.K.properties, el.dataset.id, {status: el.value});
    toast(`Statut mis à jour : ${STATUS_LABEL[el.value]}.`);
    if (['loue', 'vendu'].includes(el.value)) {
      DB.getData(DB.K.favorites).filter(f => f.propertyId === p.id).forEach(f => notify(f.userId, `Un bien de vos favoris n'est plus disponible : ${p.title}.`, `#/property/${p.id}`));
    }
    render();
  }
  if (el.dataset.action === 'region-change') {
    const form = el.closest('form'), city = form.querySelector('[name="city"]');
    city.innerHTML = Object.keys(LOCATIONS[el.value] || {}).map(c => `<option>${c}</option>`).join('');
    lieuSuitVille(form);
  }
  if (el.dataset.action === 'search-region-change') { searchState.region = el.value; searchState.city = ''; searchState.quartier = ''; searchState.page = 1; render(); }
  if (el.dataset.action === 'search-city-change') { searchState.city = el.value; searchState.quartier = ''; searchState.page = 1; render(); }
  if (el.dataset.action === 'sort-change') { searchState.sort = el.value; render(); }
  if (el.dataset.action === 'owner-bulk-toggle' && el.tagName === 'INPUT') {
    const id = el.dataset.id;
    ownerBulkSelected = el.checked ? [...ownerBulkSelected, id] : ownerBulkSelected.filter(x => x !== id);
    render();
  }
  if (el.dataset.action === 'owner-bulk-toggle-all' && el.tagName === 'INPUT') {
    const rows = [...el.closest('table').querySelectorAll('[data-action="owner-bulk-toggle"]')].map(x => x.dataset.id);
    ownerBulkSelected = el.checked ? [...new Set([...ownerBulkSelected, ...rows])] : ownerBulkSelected.filter(x => !rows.includes(x));
    render();
  }
  if (el.dataset.action === 'bulk-toggle' && el.tagName === 'INPUT') {
    const id = el.dataset.id;
    bulkSelected = el.checked ? [...bulkSelected, id] : bulkSelected.filter(x => x !== id);
    render();
  }
  if (el.dataset.action === 'bulk-toggle-all' && el.tagName === 'INPUT') {
    const rows = [...el.closest('table').querySelectorAll('[data-action="bulk-toggle"]')].map(x => x.dataset.id);
    bulkSelected = el.checked ? [...new Set([...bulkSelected, ...rows])] : bulkSelected.filter(x => !rows.includes(x));
    render();
  }
  if (el.dataset.action === 'toggle-compare' && el.tagName === 'INPUT') {
    const id = el.dataset.id;
    if (el.checked) {
      if (compareIds.length >= 3) { toast('Vous pouvez comparer 3 biens maximum.', 'warn'); el.checked = false; return; }
      compareIds.push(id);
    } else compareIds = compareIds.filter(x => x !== id);
    render();
  }
  if (el.dataset.action === 'photos-input') {
    const files = [...el.files].slice(0, MAX_PHOTOS - formPhotos.length);
    if (!files.length) return;
    toast(`Ajout de ${files.length} photo${files.length > 1 ? 's' : ''}…`, 'warn');
    Promise.all(files.map(f => readImageAsDataUrl(f).catch(() => null)))
      .then(results => {
        formPhotos.push(...results.filter(Boolean));
        if (formPhotos.length) toast('Photos ajoutées.');
        render();
      });
  }
  if (el.dataset.action === 'avatar-upload') {
    const u = Auth.current();
    const file = el.files[0];
    if (!file) return;
    readImageAsDataUrl(file).then(dataUrl => {
      DB.updateItem(DB.K.users, u.id, {avatarPhoto: dataUrl});
      if (!DB.lastWriteOk) return;
      toast('Photo de profil mise à jour.'); render();
    }).catch(() => toast("Impossible de charger cette image.", 'bad'));
  }
  if (el.dataset.action === 'doc-upload') {
    const u = Auth.current();
    const files = [...el.files];
    if (!files.length) return;
    toast(`Ajout de ${files.length} document${files.length > 1 ? 's' : ''}…`, 'warn');
    Promise.all(files.map(f => readFileAsDataUrl(f).then(dataUrl => ({name: f.name, mime: f.type, dataUrl})).catch(() => null)))
      .then(results => {
        const ok = results.filter(Boolean);
        let saved = 0;
        ok.forEach(r => { DB.addItem(DB.K.documents, {ownerId: u.id, name: r.name, mime: r.mime, dataUrl: r.dataUrl}); if (DB.lastWriteOk) saved++; });
        if (ok.length < files.length) toast('Certains fichiers dépassaient 4 Mo et ont été ignorés.', 'warn');
        if (saved) toast(`${saved} document(s) ajouté(s).`);
        render();
      });
  }
});

document.addEventListener('submit', e => {
  const form = e.target.closest('[data-action]'); if (!form) return;
  e.preventDefault();
  const a = form.dataset.action, d = formData(form), u = Auth.current();

  if (a === 'login') {
    const res = Auth.login(d.cni, d.password);
    if (res.error) { $('#login-err').innerHTML = `<p class="err">${esc(res.error)}</p>`; return; }
    toast(`Bienvenue ${res.user.role === 'agency' ? res.user.agencyName : res.user.firstName}.`);
    go(Auth.home(res.user));
  }
  if (a === 'register') startRegistration(d);
  if (a === 'quick-search') { searchState = {...searchState, transaction: d.transaction, region: d.region, type: d.type, city: '', quartier: '', page: 1}; go('#/search'); }
  if (a === 'ai-search') {
    const box = $('#ai-search-state');
    if (box) box.innerHTML = `<div class="row" style="gap:8px;align-items:center"><div class="spinner" style="margin:0;width:16px;height:16px;border-width:2px"></div><span class="small muted">L'assistant réfléchit…</span></div>`;
    runAiSearch(d.q, box);
  }
  if (a === 'ai-chat-send') {
    const input = form.querySelector('#ai-chat-text');
    const val = input.value; input.value = '';
    sendAiChat(val);
  }
  if (a === 'search') {
    searchState = {...searchState, region: d.region, city: d.city, quartier: d.quartier, type: d.type,
      min: d.min, max: d.max, rooms: d.rooms, baths: d.baths, surface: d.surface,
      furnished: !!d.furnished, parking: !!d.parking, page: 1};
    render();
  }
  if (a === 'save-property') saveProperty(form, form.dataset.id, (e.submitter && e.submitter.value) || 'draft');
  if (a === 'create-visit') {
    if (!d.date || !d.time) return formError(form, 'Indiquez une date et une heure.');
    if (d.date < now().slice(0, 10)) return formError(form, 'La date souhaitée ne peut pas être dans le passé.');
    clearFormError(form);
    const p = DB.findItem(DB.K.properties, form.dataset.id);
    DB.addItem(DB.K.visits, {clientId: u.id, ownerId: p.ownerId, propertyId: p.id, date: d.date, time: d.time, message: d.message, status: 'attente'});
    if (!DB.lastWriteOk) return formError(form, 'La demande n\'a pas pu être enregistrée (stockage local saturé).');
    notify(p.ownerId, `Nouvelle demande de visite pour « ${p.title} » le ${dateFr(d.date)}.`, roleLink(p.ownerId, 'visits'));
    DB.updateItem(DB.K.properties, p.id, {contacts: (p.contacts || 0) + 1});
    logActivity(`Demande de visite envoyée pour ${p.title}`);
    closeModal(); toast('Demande envoyée au propriétaire.'); go('#/client/visits');
  }
  if (a === 'create-agent') {
    if (!d.firstName.trim() || !d.lastName.trim()) return formError(form, 'Renseignez le prénom et le nom.');
    if (!/^\d{13}$/.test(d.cni)) return formError(form, 'Le numéro de CNI doit comporter 13 chiffres (utilisez un numéro fictif).');
    if (!d.phone.trim()) return formError(form, 'Renseignez un numéro de téléphone.');
    clearFormError(form);
    DB.addItem(DB.K.agents, {agencyId: u.id, firstName: d.firstName, lastName: d.lastName, phone: d.phone, cni: d.cni, role: d.role, status: 'actif'});
    if (!DB.lastWriteOk) return formError(form, "L'agent n'a pas pu être enregistré (stockage local saturé).");
    closeModal(); toast('Agent ajouté.'); render();
  }
  if (a === 'send-msg') {
    const t = DB.findItem(DB.K.messages, form.dataset.id);
    t.items.push({senderId: u.id, text: d.text, at: now()});
    DB.updateItem(DB.K.messages, t.id, {items: t.items});
    const other = t.participants.find(p => p !== u.id);
    notify(other, `Nouveau message de ${displayName(u)}.`, roleLink(other, 'messages'));
    render();
  }
  if (a === 'save-profile') {
    DB.updateItem(DB.K.users, u.id, {firstName: d.firstName, lastName: d.lastName, phone: d.phone,
      ...(u.role === 'agency' ? {agencyName: d.agencyName, agencyDesc: d.agencyDesc, address: d.address} : {})});
    toast('Profil mis à jour.'); render();
  }
  if (a === 'save-agency-settings') {
    DB.updateItem(DB.K.users, u.id, {agencyName: d.agencyName, agencyDesc: d.agencyDesc, address: d.address, hours: d.hours});
    toast('Paramètres enregistrés.'); render();
  }
  if (a === 'save-notif-prefs') {
    DB.updateItem(DB.K.users, u.id, {notifPrefs: {email: !!d.email, sms: !!d.sms, newRequest: !!d.newRequest, newMessage: !!d.newMessage}});
    toast('Préférences de notification enregistrées.'); render();
  }
});

/* Formulaire d'annonce : la commune et le quartier suivent la ville.
   En changeant de région, la commune restait « Dakar » et le quartier
   « Almadies » : une villa de Saly s'enregistrait « Saly, Dakar, Mbour ».
   La commune reprend la ville tant que le propriétaire ne l'a pas saisie
   lui-même ; le quartier est vidé s'il n'appartient pas à la nouvelle ville,
   et la liste des quartiers connus est proposée pendant la saisie. */
function lieuSuitVille(form) {
  if (!form) return;
  const region = form.querySelector('[name="region"]'), city = form.querySelector('[name="city"]');
  const com = form.querySelector('[name="commune"]'), q = form.querySelector('[name="quartier"]');
  if (!region || !city) return;
  const quartiers = (LOCATIONS[region.value] || {})[city.value] || [];
  if (com && com.dataset.saisie !== '1') com.value = city.value;
  if (q && q.tagName === 'INPUT') {
    let dl = document.getElementById('dl-quartiers');
    if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-quartiers'; document.body.appendChild(dl); }
    dl.innerHTML = quartiers.map(x => `<option value="${esc(x)}">`).join('');
    q.setAttribute('list', 'dl-quartiers');
    if (q.value && quartiers.length && !quartiers.includes(q.value) && q.dataset.saisie !== '1') q.value = '';
  }
}
document.addEventListener('change', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]');
  if (f && e.target.name === 'city') lieuSuitVille(f);
});
document.addEventListener('input', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]');
  if (f && ['commune', 'quartier'].includes(e.target.name)) e.target.dataset.saisie = '1';
});
/* suggestions de quartiers dès qu'on entre dans le champ, sans rien effacer */
document.addEventListener('focusin', e => {
  const f = e.target.closest && e.target.closest('form[data-action="save-property"]');
  if (!f || e.target.name !== 'quartier') return;
  const region = f.querySelector('[name="region"]'), city = f.querySelector('[name="city"]');
  const quartiers = region && city ? ((LOCATIONS[region.value] || {})[city.value] || []) : [];
  let dl = document.getElementById('dl-quartiers');
  if (!dl) { dl = document.createElement('datalist'); dl.id = 'dl-quartiers'; document.body.appendChild(dl); }
  dl.innerHTML = quartiers.map(x => `<option value="${esc(x)}">`).join('');
  e.target.setAttribute('list', 'dl-quartiers');
});
