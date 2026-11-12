/* =============================================================================
   99k-photos.js — Photos des biens : contrôle, optimisation, variantes, envoi,
   ordre et couverture, affichage adapté à la taille, galerie complète.

   Remplace le traitement des photos du formulaire de bien (24-espace-proprietaire,
   27-actions) sans changer le reste du formulaire :
   * à la sélection, chaque fichier est contrôlé (vrai format lu dans ses octets,
     fichier complet, dimensions), puis réduit en trois variantes
       s 480 px · m 960 px · l 1600 px (grand côté, jamais agrandi),
     en WebP si le navigateur sait l'encoder, sinon en JPEG ;
   * les variantes sont déposées tout de suite dans Storage, une photo à la fois
     (deux en parallèle au plus), avec une progression réelle (octets envoyés),
     une erreur par photo et une reprise de la seule photo en échec ;
   * l'annonce n'est enregistrée qu'une fois toutes les photos déposées ; on ne
     quitte le formulaire qu'après la confirmation de la base (sinon la saisie
     reste à l'écran) ;
   * properties.photos garde l'URL de la variante m (lue par tous les écrans
     existants) ; properties.photos_meta décrit chaque photo (contrôlée en base,
     migration 20261102000100_photos.sql).
   Chemins : photos/<espace>/<bien>/<photo>/<s|m|l>.<webp|jpg>.
   ============================================================================= */
(() => {
  if (typeof DB === 'undefined') return;
  const NB_MAX = typeof MAX_PHOTOS !== 'undefined' ? MAX_PHOTOS : 20;
  const {Refus, optimiser} = DEUKSIL_IMAGES;   // traitement : js/00-photos-traitement.js
  const ENVOIS_SIMULTANES = 2, DELAI_ENVOI = 90000;
  const CACHE = 'max-age=31536000';   // noms uniques (UUID) : le fichier ne change jamais

  Object.assign(ICONS, {
    phEtoile: ICONS.phEtoile || '<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.9z"/>',
    phReprendre: ICONS.phReprendre || '<path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/>',
    phRemplacer: ICONS.phRemplacer || '<path d="M4 7h11l-3-3M20 17H9l3 3"/>',
    phGauche: ICONS.phGauche || '<path d="M15 5l-7 7 7 7"/>',
    phDroite: ICONS.phDroite || '<path d="M9 5l7 7-7 7"/>'
  });

  /* ---------------------------------------------------------------------------
     2. Envoi vers Storage (corps brut, sans remplacement : un nom n'est jamais réutilisé)
     --------------------------------------------------------------------------- */
  const espace = () => DB.espaceId();
  const urlPublique = chemin => SB.storage.from('photos').getPublicUrl(chemin).data.publicUrl;
  const ERREURS_HTTP = {400: 'Envoi refusé par le serveur.', 401: 'Session expirée : reconnectez-vous.', 403: 'Envoi non autorisé pour ce bien.',
    413: 'Photo trop lourde pour le serveur.', 415: 'Format refusé par le serveur.', 429: 'Trop d\'envois en même temps : réessayez dans un instant.'};
  async function deposer(chemin, blob, progres) {
    const {data} = await SB.auth.getSession(); const jeton = data && data.session && data.session.access_token;
    if (!jeton) throw new Error(ERREURS_HTTP[401]);
    return new Promise((ok, ko) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${DEUKSIL_CONFIG.supabaseUrl}/storage/v1/object/photos/${chemin.split('/').map(encodeURIComponent).join('/')}`);
      x.setRequestHeader('authorization', 'Bearer ' + jeton); x.setRequestHeader('apikey', DEUKSIL_CONFIG.supabaseAnonKey);
      x.setRequestHeader('content-type', blob.type); x.setRequestHeader('x-upsert', 'false'); x.setRequestHeader('cache-control', CACHE);
      x.timeout = DELAI_ENVOI;
      x.upload.onprogress = e => { if (e.lengthComputable) progres(e.loaded); };
      x.onload = () => {
        if (x.status >= 200 && x.status < 300) return ok();
        let m = ''; try { const j = JSON.parse(x.responseText); m = j.message || j.error || ''; } catch (e) {}
        // déjà présent : un envoi précédent a abouti sans que la réponse arrive
        if (x.status === 409 || /already exists|Duplicate/i.test(m)) return ok();
        const err = new Error(ERREURS_HTTP[x.status] || 'Envoi refusé par le serveur.'); err.statut = x.status; ko(err);
      };
      x.onerror = () => ko(new Error('Connexion interrompue pendant l\'envoi.'));
      x.ontimeout = () => ko(new Error('Envoi trop long : connexion lente ou coupée.'));
      x.onabort = () => { const e = new Error('annulé'); e.annule = true; ko(e); };
      P.xhr.set(chemin, x);
      x.send(blob);
    }).finally(() => P.xhr.delete(chemin));
  }

  /* ---------------------------------------------------------------------------
     3. État du formulaire
     item : {id, etat, message, nom, apercu, ancien, url, meta, blobs, faits:Set, envoye, total, essais}
     etat : lecture | attente | envoi | ok | erreur | refus
     --------------------------------------------------------------------------- */
  const P = {pour: undefined, bienId: null, items: [], xhr: new Map(), file: [], actifs: 0, enregistre: null};
  window.DEUKSIL_PHOTOS = P;   // lecture seule pour les tests
  const occupe = () => P.items.some(x => x.etat === 'lecture' || x.etat === 'attente' || x.etat === 'envoi');
  function synchroniser() {   // formPhotos : lu par le récapitulatif de publication et l'ancien code
    P.items = [...P.items.filter(x => x.etat !== 'refus'), ...P.items.filter(x => x.etat === 'refus')];   // fichiers refusés en fin de liste
    formPhotos = P.items.filter(x => x.etat !== 'refus').map(x => x.url || x.apercu || '');
  }
  function initialiser(pid) {
    P.items.forEach(liberer); P.items = []; P.file = []; P.pour = pid; P.enregistre = null;
    const p = pid && pid !== 'new' ? DB.findItem(DB.K.properties, pid) : null;
    P.bienId = p ? p.id : uid();
    const meta = (p && p.photosMeta) || [];
    (p && p.photos || []).forEach((u, i) => {
      const m = meta.length === p.photos.length ? meta[i] : {legacy: true};
      P.items.push({id: (m && m.id) || uid(), etat: 'ok', ancien: true, url: u, meta: m && !m.legacy ? m : {legacy: true},
        apercu: varianteDe(u, m, 's'), nom: ''});
    });
    synchroniser();
  }
  function liberer(x) {
    if (x.apercu && x.apercu.startsWith('blob:')) URL.revokeObjectURL(x.apercu);
    for (const c of P.xhr.keys()) if (x.dossier && c.startsWith(x.dossier + '/')) P.xhr.get(c).abort();
  }
  /* Fichiers déposés pendant cette saisie mais pas (encore) enregistrés : supprimés tout de suite
     (la base refuse de supprimer un fichier encore référencé par une annonce). */
  function supprimerDepots(x) {
    if (x.ancien || !x.dossier || !x.faits || !x.faits.size) return;
    const chemins = [...x.faits].map(k => `${x.dossier}/${k}.${x.ext}`);
    SB.storage.from('photos').remove(chemins).catch(() => {});   // sinon : nettoyage automatique après 24 h
  }

  async function ajouterFichiers(liste) {
    const place = NB_MAX - P.items.filter(x => x.etat !== 'refus').length;
    const pris = liste.slice(0, Math.max(0, place));
    if (!pris.length) { toast(`Limite de ${NB_MAX} photos atteinte.`, 'warn'); return; }
    if (liste.length > pris.length) toast(`Limite de ${NB_MAX} photos atteinte : ${pris.length} photo${pris.length > 1 ? 's' : ''} ajoutée${pris.length > 1 ? 's' : ''} sur ${liste.length}.`, 'warn');
    const nouveaux = pris.map(f => ({id: uid(), etat: 'lecture', fichier: f, nom: f.name || 'photo', envoye: 0, total: 0, faits: new Set(), essais: 0}));
    P.items.push(...nouveaux); synchroniser(); dessiner();
    let ok = 0, ko = 0;
    for (const x of nouveaux) {   // une à la fois : mémoire maîtrisée sur téléphone
      if (!P.items.includes(x)) continue;
      try {
        const r = await optimiser(x.fichier);
        if (!P.items.includes(x)) continue;   // retirée pendant le traitement
        Object.assign(x, r, {etat: 'attente', dossier: `${espace()}/${P.bienId}/${x.id}`, total: Object.values(r.blobs).reduce((s, b) => s + b.size, 0)});
        x.apercu = URL.createObjectURL(r.blobs.s || r.blobs.m);
        x.message = 'Photo optimisée, en attente d\'envoi';
        delete x.fichier; ok++; P.file.push(x);
      } catch (e) {
        x.etat = 'refus'; x.message = e instanceof Refus ? e.message : 'Photo illisible ou endommagée.'; delete x.fichier; ko++;
      }
      synchroniser(); dessiner(); pomper();
    }
    if (ok && !ko) toast(ok > 1 ? `${ok} photos ajoutées et optimisées.` : 'Photo ajoutée et optimisée.');
    else if (ok && ko) toast(`${ok} photo${ok > 1 ? 's' : ''} ajoutée${ok > 1 ? 's' : ''}, ${ko} refusée${ko > 1 ? 's' : ''} : voyez le motif sous chaque photo.`, 'warn');
    else if (ko) toast(ko > 1 ? `${ko} fichiers refusés : voyez le motif sous chaque photo.` : 'Fichier refusé : voyez le motif sous la photo.', 'bad');
  }

  function pomper() {
    while (P.actifs < ENVOIS_SIMULTANES && P.file.length) {
      const x = P.file.shift(); if (!P.items.includes(x) || x.etat !== 'attente') continue;
      P.actifs++; envoyer(x).finally(() => { P.actifs--; pomper(); dessiner(); });
    }
  }
  async function envoyer(x) {
    if (!navigator.onLine) { x.etat = 'erreur'; x.message = 'Hors connexion : l\'envoi reprendra au retour du réseau.'; dessiner(); return; }
    x.etat = 'envoi'; x.message = 'Envoi en cours…'; dessiner();
    const cles = Object.keys(x.blobs).filter(k => !x.faits.has(k));
    let deja = [...x.faits].reduce((s, k) => s + x.blobs[k].size, 0);
    try {
      for (const k of cles) {
        await deposer(`${x.dossier}/${k}.${x.ext}`, x.blobs[k], n => { x.envoye = deja + n; majProgression(x); });
        x.faits.add(k); deja += x.blobs[k].size; x.envoye = deja; majProgression(x);
      }
      x.url = urlPublique(`${x.dossier}/m.${x.ext}`);   // m existe toujours (v.m n'a jamais de « fichier »)
      x.meta = {id: x.id, dossier: x.dossier, ext: x.ext, v: x.v, src: x.src};
      x.etat = 'ok'; x.message = 'Envoyée'; x.blobs = Object.fromEntries(Object.entries(x.blobs).filter(([k]) => k === 's'));
      synchroniser();
    } catch (e) {
      if (e.annule) return;
      x.essais++;
      if (x.essais === 1 && !e.statut && navigator.onLine) {   // une reprise automatique après une coupure
        x.etat = 'attente'; x.message = 'Nouvelle tentative…'; setTimeout(() => { P.file.unshift(x); pomper(); }, 2000); return;
      }
      x.etat = 'erreur'; x.message = e.message;
    }
  }
  function reprendre(x) {
    if (!x || x.etat !== 'erreur') return;
    x.etat = 'attente'; x.message = 'Nouvelle tentative…'; x.essais = 0; P.file.push(x); dessiner(); pomper();
  }
  window.addEventListener('online', () => { const L = P.items.filter(x => x.etat === 'erreur' && /connexion/i.test(x.message || '')); if (L.length) { L.forEach(reprendre); toast('Connexion retrouvée : nouvelle tentative d\'envoi.'); } });
  window.addEventListener('beforeunload', e => { if (occupe()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------------------------------------------------------------------------
     4. Interface (dans le formulaire existant, mise à jour sur place : un
        render() global ramènerait l'assistant à l'étape 1)
     --------------------------------------------------------------------------- */
  function tuileHtml(x, i) {
    const n = P.items.filter(y => y.etat !== 'refus').length, refus = x.etat === 'refus';
    const pct = x.total ? Math.min(100, Math.round(100 * (x.envoye || 0) / x.total)) : 0;
    const etat = refus ? 'Refusée' : x.etat === 'lecture' ? 'Optimisation…' : x.etat === 'attente' ? (x.message || 'En attente d\'envoi') : x.etat === 'envoi' ? `Envoi ${pct} %` : x.etat === 'erreur' ? 'Échec de l\'envoi' : x.ancien ? 'Enregistrée' : 'Envoyée';
    return `<li class="ph-tuile ph-${x.etat}${i === 0 && !refus ? ' ph-couv' : ''}" data-ph="${x.id}" draggable="${refus ? 'false' : 'true'}">
      <div class="ph-vue">${x.apercu ? `<img src="${esc(x.apercu)}" alt="Photo ${i + 1}" loading="lazy">` : `<span class="ph-attente" aria-hidden="true"></span>`}
        ${i === 0 && !refus ? '<em class="cover-tag">Couverture</em>' : ''}
        ${x.etat === 'envoi' || x.etat === 'attente' ? `<span class="ph-barre" role="progressbar" aria-label="Envoi de la photo ${i + 1}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span>` : ''}
        <button type="button" class="rm" data-ph-act="retirer" aria-label="Retirer la photo ${i + 1}">${icon('close', 13)}</button></div>
      <div class="ph-info"><b class="ph-etat">${etat}</b>${x.etat === 'ok' || x.etat === 'envoi' ? '' : `<span class="ph-msg">${esc(x.message || '')}</span>`}</div>
      ${refus ? '' : `<div class="ph-outils">
        ${x.etat === 'erreur' ? `<button type="button" class="btn sm" data-ph-act="reprendre">${icon('phReprendre', 13)} Réessayer</button>` : ''}
        ${i > 0 ? `<button type="button" class="ph-b" data-ph-act="couverture" title="Définir comme couverture" aria-label="Définir la photo ${i + 1} comme couverture">${icon('phEtoile', 14)}</button>` : ''}
        <button type="button" class="ph-b" data-ph-act="avant" ${i === 0 ? 'disabled' : ''} aria-label="Déplacer la photo ${i + 1} vers la gauche">${icon('phGauche', 14)}</button>
        <button type="button" class="ph-b" data-ph-act="apres" ${i >= n - 1 ? 'disabled' : ''} aria-label="Déplacer la photo ${i + 1} vers la droite">${icon('phDroite', 14)}</button>
        <label class="ph-b" title="Remplacer" aria-label="Remplacer la photo ${i + 1}">${icon('phRemplacer', 14)}<input type="file" accept="image/*" data-ph-remplacer hidden></label>
      </div>`}</li>`;
  }
  function zoneHtml() {
    const actives = P.items.filter(x => x.etat !== 'refus'), n = actives.length;
    const envoi = actives.filter(x => !x.ancien), fini = envoi.filter(x => x.etat === 'ok').length;
    const tot = envoi.reduce((s, x) => s + (x.total || 0), 0), env = envoi.reduce((s, x) => s + (x.etat === 'ok' ? x.total : x.envoye || 0), 0);
    const enCours = envoi.some(x => x.etat !== 'ok' && x.etat !== 'erreur'), err = P.items.filter(x => x.etat === 'erreur').length;
    const pct = tot ? Math.round(100 * env / tot) : 0;
    return `<div class="upload-zone" id="ph-zone">
      <label class="upload-btn${n >= NB_MAX ? ' ph-plein' : ''}">
        <input type="file" accept="image/*" multiple data-action="photos-input" ${n >= NB_MAX ? 'disabled' : ''}>
        ${icon('upload', 20)}<span>${n >= NB_MAX ? `Limite de ${NB_MAX} photos atteinte` : 'Ajouter des photos'}</span>
        <span class="small muted">${n}/${NB_MAX} photos. Elles sont optimisées automatiquement. La première sert de couverture.</span>
      </label>
      ${enCours || err ? `<div class="ph-global" aria-live="polite">
        ${enCours ? `<div class="ph-ligne"><span>Envoi : ${fini}/${envoi.length} photo${envoi.length > 1 ? 's' : ''} · ${envoi.length - fini} restante${envoi.length - fini > 1 ? 's' : ''}</span><b>${pct} %</b></div>
          <span class="ph-barre ph-barre-g" role="progressbar" aria-label="Envoi des photos" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span>` : ''}
        ${err ? `<div class="ph-ligne ph-err"><span>${err} photo${err > 1 ? 's' : ''} non envoyée${err > 1 ? 's' : ''}.</span><button type="button" class="btn sm" data-ph-act="tout-reprendre">${icon('phReprendre', 13)} Réessayer</button></div>` : ''}
      </div>` : ''}
      ${P.items.length ? `<ol class="ph-grille">${P.items.map((x, i) => tuileHtml(x, i)).join('')}</ol>`
        : '<p class="small muted" style="margin-top:10px">Aucune photo ajoutée : une illustration générique sera utilisée pour l\'annonce.</p>'}
    </div>`;
  }
  function dessiner() {
    const z = document.getElementById('ph-zone'); if (!z) return;
    const a = document.activeElement, li = a && a.closest && a.closest('#ph-zone [data-ph]'), act = a && a.dataset && a.dataset.phAct;
    const t = document.createElement('div'); t.innerHTML = zoneHtml(); z.replaceWith(t.firstElementChild);
    if (li && act) { const c = document.querySelector(`#ph-zone [data-ph="${li.dataset.ph}"] [data-ph-act="${act}"]`); if (c && !c.disabled) c.focus({preventScroll: true}); }   // le clavier garde sa place
    verrouiller();
  }
  /* Progression d'une tuile sans tout redessiner (événements fréquents). */
  let majPrevue = false;
  function majProgression() { if (majPrevue) return; majPrevue = true; requestAnimationFrame(() => { majPrevue = false; dessiner(); }); }
  /* Enregistrer est impossible tant qu'une photo est en traitement ou en échec. */
  function verrouiller() {
    const f = document.querySelector('form[data-action="save-property"]'); if (!f) return;
    const bloque = occupe() || !!P.enregistre;
    f.querySelectorAll('button[name="intent"]').forEach(b => { b.disabled = bloque; b.title = bloque ? 'Patientez : photos en cours d\'envoi' : ''; });
  }

  /* L'ancien rendu est remplacé : même place dans le formulaire, mêmes classes de style. */
  photoUploadHtml = function () {
    if (P.pour !== formPhotosFor) initialiser(formPhotosFor);
    return `<div class="field"><label>Photos du bien</label>${zoneHtml()}</div>`;
  };

  // Sélection (capture : l'ancien gestionnaire de 27-actions ne voit plus l'événement)
  window.addEventListener('change', e => {
    const el = e.target;
    if (el.matches && el.matches('#ph-zone input[data-action="photos-input"]')) {
      e.stopImmediatePropagation();
      const L = [...el.files]; el.value = ''; if (L.length) ajouterFichiers(L);
    } else if (el.matches && el.matches('#ph-zone input[data-ph-remplacer]')) {
      e.stopImmediatePropagation();
      const f = el.files[0], li = el.closest('[data-ph]'); el.value = ''; if (!f || !li) return;
      const i = P.items.findIndex(x => x.id === li.dataset.ph); if (i < 0) return;
      const ancien = P.items[i]; liberer(ancien); supprimerDepots(ancien); P.items.splice(i, 1);
      const avant = P.items.length;
      ajouterFichiers([f]);   // la nouvelle photo est ajoutée en fin de liste de façon synchrone…
      if (P.items.length > avant) { const [x] = P.items.splice(P.items.length - 1, 1); P.items.splice(i, 0, x); }   // …puis prend la place de l'ancienne
      synchroniser(); dessiner();
    }
  }, true);

  document.addEventListener('click', e => {
    const b = e.target.closest('#ph-zone [data-ph-act]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const act = b.dataset.phAct;
    if (act === 'tout-reprendre') { const L = P.items.filter(x => x.etat === 'erreur'); L.forEach(reprendre); if (L.length) toast('Nouvelle tentative d\'envoi.'); return; }
    const li = b.closest('[data-ph]'), i = li ? P.items.findIndex(x => x.id === li.dataset.ph) : -1; if (i < 0) return;
    const x = P.items[i];
    if (act === 'retirer') { liberer(x); supprimerDepots(x); P.items.splice(i, 1); toast('Photo supprimée.'); }
    else if (act === 'reprendre') { reprendre(x); toast('Nouvelle tentative d\'envoi.'); return; }
    else if (act === 'couverture') { P.items.splice(i, 1); P.items.unshift(x); toast('Photo définie comme couverture.'); }
    else if (act === 'avant' && i > 0) { P.items.splice(i, 1); P.items.splice(i - 1, 0, x); }
    else if (act === 'apres' && i < P.items.length - 1) { P.items.splice(i, 1); P.items.splice(i + 1, 0, x); }
    synchroniser(); dessiner();
  }, true);

  // Glisser-déposer pour réordonner (ordinateur ; sur téléphone : flèches)
  let tire = null;
  document.addEventListener('dragstart', e => { const li = e.target.closest && e.target.closest('#ph-zone [data-ph]'); if (!li) return; tire = li.dataset.ph; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', tire); } catch (x) {} });
  document.addEventListener('dragover', e => { if (tire && e.target.closest && e.target.closest('#ph-zone [data-ph]')) e.preventDefault(); });
  document.addEventListener('drop', e => {
    const li = tire && e.target.closest && e.target.closest('#ph-zone [data-ph]'); if (!li) return;
    e.preventDefault();
    const de = P.items.findIndex(x => x.id === tire), vers = P.items.findIndex(x => x.id === li.dataset.ph); tire = null;
    if (de < 0 || vers < 0 || de === vers) return;
    const [x] = P.items.splice(de, 1); P.items.splice(vers, 0, x); synchroniser(); dessiner();
    if (vers === 0) toast('Photo définie comme couverture.');
  });
  document.addEventListener('dragend', () => { tire = null; });

  /* ---------------------------------------------------------------------------
     5. Enregistrement fiable
     --------------------------------------------------------------------------- */
  // Bloque l'envoi du formulaire tant que des photos sont en traitement ou en échec.
  window.addEventListener('submit', e => {
    const f = e.target.closest && e.target.closest('form[data-action="save-property"]'); if (!f || P.pour === undefined) return;
    const refusees = P.items.filter(x => x.etat === 'refus');
    if (occupe()) { e.preventDefault(); e.stopImmediatePropagation(); toast('Patientez : des photos sont encore en cours d\'envoi.', 'warn'); return; }
    if (P.items.some(x => x.etat === 'erreur')) { e.preventDefault(); e.stopImmediatePropagation(); toast('Des photos n\'ont pas pu être envoyées : réessayez ou retirez-les.', 'bad'); return; }
    if (P.enregistre) { e.preventDefault(); e.stopImmediatePropagation(); return; }   // double clic
    if (refusees.length) { P.items = P.items.filter(x => x.etat !== 'refus'); dessiner(); }
    synchroniser();
  }, true);

  // La ligne du bien emporte photos (URL m, couverture en tête) ET photos_meta, dans la même écriture.
  const metaCourante = () => P.items.filter(x => x.etat === 'ok').map(x => x.meta && !x.meta.legacy ? x.meta : {legacy: true});
  const doitCompleter = (photos) => P.pour !== undefined && Array.isArray(photos) && !!document.querySelector('form[data-action="save-property"]')
    && photos.length === P.items.filter(x => x.etat === 'ok').length && photos.every((u, i) => u === P.items.filter(x => x.etat === 'ok')[i].url);
  const _ajouter = DB.addItem, _maj = DB.updateItem;
  DB.addItem = function (k, item) {
    if (k === DB.K.properties && item && !item.id && doitCompleter(item.photos)) {
      item.id = P.bienId; item.photosMeta = metaCourante(); suivre(item.id);
    }
    return _ajouter.apply(this, arguments);
  };
  DB.updateItem = function (k, id, patch) {
    if (k === DB.K.properties && id === P.bienId && patch && doitCompleter(patch.photos)) {
      patch = {...patch, photosMeta: metaCourante()}; suivre(id);
      return _maj.call(this, k, id, patch);
    }
    return _maj.apply(this, arguments);
  };
  /* Tant que la base n'a pas confirmé, on reste sur le formulaire : les annonces de
     succès et la navigation sont retenues, puis rejouées (ou annulées en cas d'échec). */
  let retenus = null;
  const _go = go, _toast = toast;
  go = function (h) { if (retenus) { retenus.go = h; return; } return _go.apply(this, arguments); };
  toast = function (m, t) { if (retenus && (!t || t === 'ok')) { retenus.toasts.push([m, t]); return; } return _toast.apply(this, arguments); };
  function suivre(id) {
    if (retenus) return;
    P.enregistre = id; verrouiller();
    retenus = {go: null, toasts: [], erreurs: DB.erreurs.length};
    const formulaire = P.items.slice(), pour = P.pour, bienId = P.bienId;
    setTimeout(async () => {   // après le code appelant (récapitulatif de publication compris)
      await DB.attendre();
      const r = retenus; retenus = null;
      const enBase = DB.findItem(DB.K.properties, id), erreur = DB.erreurs.slice(r.erreurs).some(x => /^properties/.test(x.contexte || ''));
      if (enBase && !erreur) {
        P.items.forEach(liberer); P.items = []; P.pour = undefined; P.enregistre = null; formPhotos = []; formPhotosFor = null;
        r.toasts.forEach(([m, t]) => toast(m, t));
        if (r.go) go(r.go);
      } else {
        // la saisie reste : photos déposées, formulaire à l'écran ; l'erreur précise a déjà été affichée
        P.items = formulaire; P.pour = pour; P.bienId = bienId; P.enregistre = null; formPhotosFor = pour; synchroniser(); dessiner();
        toast('L\'annonce n\'a pas été enregistrée. Votre saisie et vos photos sont conservées : ' + (DB.erreurs.slice(r.erreurs).some(x => /connexion|fetch|network/i.test(x.message || '')) ? 'vérifiez la connexion puis réessayez.' : 'corrigez le point signalé puis réessayez.'), 'bad');
      }
    }, 0);
  }

  /* ---------------------------------------------------------------------------
     6. Affichage : bonne taille, échappement, chargement, repli, galerie
     --------------------------------------------------------------------------- */
  function varianteDe(url, m, taille) {
    if (!url || !m || m.legacy || !m.v || !m.v[taille]) return url || '';
    const i = url.lastIndexOf('/'); if (i < 0) return url;
    return url.slice(0, i + 1) + (m.v[taille].fichier || taille) + '.' + m.ext;
  }
  function srcsetDe(url, m) {
    if (!m || m.legacy || !m.v) return '';
    const vus = new Set(), L = [];
    for (const k of ['s', 'm', 'l']) { const v = m.v[k]; if (!v) continue; const u = varianteDe(url, m, k); if (vus.has(u)) continue; vus.add(u); L.push(`${esc(u)} ${v.w}w`); }
    return L.length > 1 ? L.join(', ') : '';
  }
  const metaDe = (p, i) => (p && Array.isArray(p.photosMeta) && p.photos && p.photosMeta.length === p.photos.length) ? p.photosMeta[i] : null;
  window.photoBien = (p, i = 0, taille = 'm') => varianteDe(p.photos[i], metaDe(p, i), taille);
  /* Attributs d'une photo de bien : source échappée, variantes, taille d'affichage. */
  function attributs(p, i, sizes) {
    const u = p.photos[i], m = metaDe(p, i), ss = srcsetDe(u, m);
    return `src="${esc(varianteDe(u, m, 'm'))}"${ss ? ` srcset="${ss}" sizes="${sizes}"` : ''}${m && m.v && m.v.m ? ` width="${m.v.m.w}" height="${m.v.m.h}"` : ''} class="ph-img"`;
  }
  /* Les gabarits existants reçoivent des jetons à la place des URL, remplacés ensuite par
     des attributs sûrs : leur mise en page reste exactement la même. */
  const jeton = j => `__deuksil_photo_${j}__`;
  function avecJetons(gabarit, p, sizes, args) {
    if (!p || !Array.isArray(p.photos) || !p.photos.length) return gabarit.apply(this, args);
    const h = gabarit.apply(this, [{...p, photos: p.photos.map((_, j) => jeton(j))}, ...[].slice.call(args, 1)]);
    return h.replace(/src="__deuksil_photo_(\d+)__"/g, (_, j) => attributs(p, +j, sizes));
  }
  const _photoHtml = photoHtml;
  photoHtml = function (p, o = {}) {
    const w = /width:\s*(\d+)px/.exec(o.style || ''); const sizes = w ? `${w[1]}px` : '(max-width: 700px) 92vw, 50vw';
    return avecJetons(_photoHtml, p, sizes, arguments);
  };
  const _carte = propertyCard;
  propertyCard = function (p) { return avecJetons(_carte, p, '(max-width: 640px) 92vw, (max-width: 1100px) 46vw, 360px', arguments); };

  /* Autres écrans (tableaux de bord, accueil) : la source est déjà la variante m ; on
     ajoute les variantes et la taille réelle d'affichage avant le chargement. */
  let index = null, indexDe = -1;
  function indexPhotos() {
    const L = typeof lireMem === 'function' ? lireMem(DB.K.properties) : DB.getData(DB.K.properties);
    if (index && indexDe === L) return index;
    index = new Map(); indexDe = L;
    for (const p of L) (p.photos || []).forEach((u, i) => { const m = metaDe(p, i); if (m && !m.legacy) index.set(u, m); });
    return index;
  }
  function ameliorer(racine) {
    racine.querySelectorAll('img[src*="/object/public/photos/"]:not([srcset]):not([data-ph-vu])').forEach(img => {
      img.dataset.phVu = '1'; img.classList.add('ph-img');
      const m = indexPhotos().get(img.getAttribute('src')); if (!m) return;
      const ss = srcsetDe(img.getAttribute('src'), m); if (!ss) return;
      const w = Math.ceil((img.parentElement && img.parentElement.clientWidth) || img.clientWidth || 0);
      img.sizes = w ? w + 'px' : '50vw'; img.srcset = ss.replace(/&amp;/g, '&');
    });
  }
  new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(n => { if (n.nodeType === 1) ameliorer(n.matches && n.matches('img') ? n.parentElement || n : n); }); })
    .observe(document.getElementById('app') || document.body, {childList: true, subtree: true});

  // Placeholder pendant le chargement, image de repli en cas d'erreur.
  const REPLI = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120"><rect width="160" height="120" fill="#EEF1F5"/><path d="M58 76l14-16 10 11 8-8 14 13z" fill="#C3CBD6"/><circle cx="96" cy="48" r="7" fill="#C3CBD6"/><text x="80" y="102" font-family="sans-serif" font-size="9" fill="#8A94A3" text-anchor="middle">Photo indisponible</text></svg>');
  document.addEventListener('load', e => { const t = e.target; if (t.tagName === 'IMG' && t.classList.contains('ph-img')) t.classList.add('ph-charge'); }, true);
  document.addEventListener('error', e => {
    const t = e.target; if (t.tagName !== 'IMG' || !t.classList.contains('ph-img') || t.dataset.phRepli) return;
    t.dataset.phRepli = '1'; t.removeAttribute('srcset'); t.src = REPLI; t.classList.add('ph-charge');
  }, true);

  // Galerie de la fiche : toutes les photos, visionneuse en grand.
  const routeBien = () => (location.hash.match(/^#\/(?:property|bien)\/([\w-]+)/) || [])[1];
  function bienAffiche() { const id = routeBien(); return id ? DB.findItem(DB.K.properties, id) || (typeof bienDeRef === 'function' ? bienDeRef(id) : null) : null; }
  function galerie() {
    const g = document.querySelector('#app .gallery:not([data-ph-gal])'); if (!g) return;
    const p = bienAffiche(); if (!p || !p.photos || !p.photos.length) return;
    g.dataset.phGal = '1';
    const tuiles = [...g.querySelectorAll('.photo')];
    tuiles.forEach((t, i) => { if (i < p.photos.length) { t.dataset.phOuvrir = i; t.setAttribute('role', 'button'); t.tabIndex = 0; t.setAttribute('aria-label', `Voir la photo ${i + 1} sur ${p.photos.length} en grand`); } });
    const prem = tuiles[0] && tuiles[0].querySelector('img');
    if (prem) { prem.loading = 'eager'; prem.setAttribute('fetchpriority', 'high'); }
    // Photos au-delà des trois affichées : ajoutées à la bande (téléphone) et comptées sur la première (ordinateur).
    for (let i = tuiles.length; i < p.photos.length; i++) {
      const d = document.createElement('div'); d.className = 'photo ph-sup'; d.dataset.phOuvrir = i; d.setAttribute('role', 'button'); d.tabIndex = 0;
      d.setAttribute('aria-label', `Voir la photo ${i + 1} sur ${p.photos.length} en grand`);
      d.innerHTML = `<img ${attributs(p, i, '86vw')} alt="${esc(p.title || 'Photo du bien')} — photo ${i + 1}" loading="lazy">`;
      g.appendChild(d);
    }
    if (p.photos.length > 1 && tuiles[0]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ph-toutes'; b.dataset.phOuvrir = 0;
      b.innerHTML = `${icon('image', 15)} ${p.photos.length} photos`; tuiles[0].appendChild(b);
    }
  }
  new MutationObserver(() => { try { galerie(); } catch (e) { console.warn('galerie', e); } }).observe(document.getElementById('app') || document.body, {childList: true, subtree: true});

  let vis = null;
  function ouvrir(i) {
    const p = bienAffiche(); if (!p || !p.photos || !p.photos.length) return;
    fermer();
    vis = {p, i: Math.max(0, Math.min(p.photos.length - 1, i)), retour: document.activeElement};
    const d = document.createElement('div'); d.className = 'ph-visio'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Photos du bien');
    d.innerHTML = `<div class="ph-visio-haut"><span class="ph-visio-n" aria-live="polite"></span><button type="button" class="ph-visio-x" data-ph-v="fermer" aria-label="Fermer">${icon('close', 20)}</button></div>
      <div class="ph-visio-corps"><button type="button" class="ph-visio-nav" data-ph-v="prec" aria-label="Photo précédente">${icon('phGauche', 26)}</button>
      <img class="ph-visio-img ph-img" alt=""><button type="button" class="ph-visio-nav" data-ph-v="suiv" aria-label="Photo suivante">${icon('phDroite', 26)}</button></div>`;
    document.body.appendChild(d); document.documentElement.classList.add('ph-visio-ouverte');
    montrer(); d.querySelector('[data-ph-v="fermer"]').focus();
  }
  function montrer() {
    if (!vis) return; const d = document.querySelector('.ph-visio'); if (!d) return;
    const {p, i} = vis, n = p.photos.length, img = d.querySelector('.ph-visio-img'), m = metaDe(p, i);
    img.classList.remove('ph-charge'); delete img.dataset.phRepli;
    img.removeAttribute('srcset'); img.src = varianteDe(p.photos[i], m, 'l');
    const ss = srcsetDe(p.photos[i], m); if (ss) { img.sizes = '100vw'; img.srcset = ss.replace(/&amp;/g, '&'); }
    img.alt = `${p.title || 'Photo du bien'} — photo ${i + 1} sur ${n}`;
    d.querySelector('.ph-visio-n').textContent = `${i + 1} / ${n}`;
    d.querySelectorAll('.ph-visio-nav').forEach(b => { b.hidden = n < 2; });
    [i + 1, i - 1].forEach(j => { if (j >= 0 && j < n) { const pre = new Image(); pre.src = varianteDe(p.photos[j], metaDe(p, j), 'l'); } });   // voisines prêtes
  }
  const pas = k => { if (!vis) return; const n = vis.p.photos.length; vis.i = (vis.i + k + n) % n; montrer(); };
  function fermer() {
    const d = document.querySelector('.ph-visio'); if (d) d.remove(); document.documentElement.classList.remove('ph-visio-ouverte');
    if (vis && vis.retour && vis.retour.focus) try { vis.retour.focus(); } catch (e) {}
    vis = null;
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-ph-ouvrir]');
    if (o && !e.target.closest('[data-action]')) { e.preventDefault(); ouvrir(+o.dataset.phOuvrir); return; }
    const v = e.target.closest('.ph-visio [data-ph-v]');
    if (v) { e.preventDefault(); v.dataset.phV === 'fermer' ? fermer() : pas(v.dataset.phV === 'suiv' ? 1 : -1); return; }
    if (e.target.classList && e.target.classList.contains('ph-visio-corps')) fermer();
  });
  document.addEventListener('keydown', e => {
    if (vis) {
      if (e.key === 'Escape') { e.preventDefault(); fermer(); } else if (e.key === 'ArrowRight') pas(1); else if (e.key === 'ArrowLeft') pas(-1);
      else if (e.key === 'Tab') { const L = [...document.querySelectorAll('.ph-visio button:not([hidden])')]; const i = L.indexOf(document.activeElement); if (L.length) { e.preventDefault(); L[(i + (e.shiftKey ? -1 : 1) + L.length) % L.length].focus(); } }
      return;
    }
    const o = e.target.closest && e.target.closest('[data-ph-ouvrir]');
    if (o && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ouvrir(+o.dataset.phOuvrir); }
  });
  let x0 = null;
  document.addEventListener('pointerdown', e => { if (e.target.closest('.ph-visio-corps')) x0 = e.clientX; });
  document.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 50) pas(dx < 0 ? 1 : -1); });
  window.addEventListener('hashchange', fermer);
})();
