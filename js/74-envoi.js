/* ==========================================================================
   MODULE : envoi.js — envoyer un document depuis son tiroir.
   Les pièces jointes partaient de l'ordinateur, jamais du coffre. Pour
   transmettre une quittance déjà rangée, il fallait la télécharger, puis la
   rejoindre depuis la messagerie : un aller-retour pour un fichier qu'on
   avait sous les yeux.
   Une flèche sur chaque ligne du tiroir suffit. On la touche, le document
   suit : la messagerie s'ouvre, on choisit une discussion — ou on en ouvre
   une au numéro — et le document s'y trouve déjà, prêt à partir.
   ========================================================================== */

ICONS.partager = '<path d="M4 13v6a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-6"/>'
  + '<path d="M12 3.5v12"/><path d="m7.5 8 4.5-4.5L16.5 8"/>';

/* --- 1. Ce qu'on a choisi d'envoyer ------------------------------------ */
let aEnvoyer = null;        /* {src, label} */
let choixFait = false;      /* l'utilisateur a désigné une discussion */
let attacheEnCours = false;

/* Un document du coffre peut être un fichier déposé, une pièce reçue par
   message, ou un papier que l'application fabrique à la demande. */
async function fichierDuCoffre(src, u) {
  const [genre, ref] = [src.slice(0, src.indexOf(':')), src.slice(src.indexOf(':') + 1)];
  if (genre === 'up') {
    const d = DB.findItem(DB.K.documents, x => x.id === ref && x.ownerId === u.id);
    if (!d) throw new Error('introuvable');
    if (d.dataUrl) return {name: d.name, mime: d.mime, dataUrl: d.dataUrl,
      size: Math.round(d.dataUrl.length * .75)};
    const {pj, ok} = pjTrouve(d.pjSrc, d.pjI || 0);
    if (!pj || !ok) throw new Error('introuvable');
    return {name: pj.name, mime: pj.mime, dataUrl: pj.dataUrl, size: pj.size};
  }
  const hit = pdfFor(ref, u);
  if (!hit) throw new Error('introuvable');
  if (u.member && !u.perms.includes(hit[0])) throw new Error('interdit');
  await loadPdf();
  const f = hit[1](hit[2], hit[3] || u);
  const dataUrl = await b64(f.blob);
  return {name: f.name, mime: 'application/pdf', dataUrl, size: f.blob.size};
}

/* --- 2. La flèche sur chaque ligne du tiroir --------------------------- */
function greffeFleches() {
  if (!/^#\/coffre(\/\w+)?$/.test(location.hash)) return;
  const u = Auth.current();
  if (!u || u.role === 'admin') return;
  document.querySelectorAll('.main > .content table tbody tr').forEach(tr => {
    if (tr.dataset.env) return;
    const dl = tr.querySelector('[data-action="g7-dl"]');
    const pdf = tr.querySelector('[data-action="g6-pdf"]');
    const src = dl ? 'up:' + dl.dataset.id : pdf ? 'gen:' + pdf.dataset.id : '';
    if (!src) return;
    const zone = (dl || pdf).parentNode;
    tr.dataset.env = '1';
    const nom = (tr.querySelector('b') || {}).textContent || 'Ce document';
    const b = document.createElement('button');
    b.className = 'btn ghost sm env-b';
    b.type = 'button';
    b.title = 'Envoyer par message';
    b.setAttribute('aria-label', 'Envoyer ' + nom + ' par message');
    b.dataset.action = 'env-partager';
    b.dataset.src = src;
    b.dataset.nom = nom;
    b.innerHTML = icon('partager', 15);
    zone.appendChild(b);
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="env-partager"]');
  if (!b) return;
  const u = Auth.current(); if (!u) return;
  aEnvoyer = {src: b.dataset.src, label: b.dataset.nom};
  choixFait = false;
  go(u.role === 'tenant' ? '#/client/messages' : `#/${u.role}/messages`);
});

/* --- 3. Le bandeau : il reste à choisir à qui ------------------------- */
const ENV_ECRANS = /^#\/(client|owner|agency|tenant)\/messages$/;

function greffeBandeau() {
  const vieux = document.querySelector('.env-bar');
  if (!aEnvoyer || !ENV_ECRANS.test(location.hash)) { if (vieux) vieux.remove(); return; }
  if (vieux) return;
  const contenu = document.querySelector('.main > .content');
  const ancre = contenu && (contenu.querySelector('.nd-bar') || contenu.querySelector('.chat, .empty'));
  if (!ancre) return;
  const d = document.createElement('div');
  d.className = 'env-bar';
  d.innerHTML = `<div class="env-t">${icon('partager', 16)}
      <div><b>À envoyer : ${esc(aEnvoyer.label)}</b>
      <div class="small">Choisissez une discussion, ou ouvrez-en une nouvelle avec un numéro.</div></div></div>
    <button class="btn ghost sm" type="button" data-action="env-annuler">Annuler</button>`;
  ancre.parentNode.insertBefore(d, ancre);
}

document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="env-annuler"]')) return;
  aEnvoyer = null; choixFait = false;
  const d = document.querySelector('.env-bar'); if (d) d.remove();
  toast('Envoi annulé.');
});

/* --- 4. Le choix d'une discussion ------------------------------------- */
/* On n'attache rien tant que la personne n'a pas désigné quelqu'un : à
   l'arrivée sur l'écran, une conversation est déjà ouverte, et ce n'est pas
   un choix. */
document.addEventListener('click', e => {
  if (!aEnvoyer) return;
  if (e.target.closest('[data-action="open-thread"], [data-action="boite-ouvrir"]')) choixFait = true;
}, true);

/* L'ouverture par numéro arrête la propagation de son formulaire : elle nous
   prévient directement plutôt que par un écouteur qui ne verrait rien. */
function marquerChoixDiscussion() { if (aEnvoyer) choixFait = true; }

async function attacherAuComposeur() {
  if (!aEnvoyer || !choixFait || attacheEnCours) return;
  if (!ENV_ECRANS.test(location.hash)) return;
  const f = document.querySelector('.msgs form[data-pj], .main > .content form.composer[data-pj]');
  if (!f) return;
  const cle = f.dataset.pj;
  const liste = pjAttente.get(cle) || [];
  if (liste.length >= PJ_MAX) { toast(`${PJ_MAX} fichiers au maximum par message.`, 'bad'); return; }
  attacheEnCours = true;
  const u = Auth.current();
  const quoi = aEnvoyer;
  aEnvoyer = null; choixFait = false;
  const bar = document.querySelector('.env-bar'); if (bar) bar.remove();
  try {
    const pj = await fichierDuCoffre(quoi.src, u);
    if (pj.size > PJ_POIDS) { toast('Document trop volumineux pour un message (4 Mo max).', 'bad'); return; }
    liste.push(pj);
    pjAttente.set(cle, liste);
    pjChips(cle);
    toast('Document joint : ajoutez un mot si vous voulez, puis Envoyer.');
  } catch (err) {
    toast(String(err && err.message) === 'interdit'
      ? 'Action non autorisée pour votre profil.'
      : 'Ce document n\'a pas pu être préparé : connexion Internet nécessaire pour les PDF.', 'bad');
  } finally { attacheEnCours = false; }
}

/* --- 5. Greffes après chaque rendu ------------------------------------- */
new MutationObserver(() => requestAnimationFrame(() => {
  try { greffeFleches(); greffeBandeau(); attacherAuComposeur(); } catch (err) {}
})).observe(document.body, {childList: true, subtree: true});
