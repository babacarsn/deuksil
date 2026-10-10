/* ==========================================================================
   MODULE : nouvelle.js — écrire à quelqu'un qu'on n'a jamais croisé.
   Une discussion ne pouvait naître que depuis la fiche d'un bien, avec le
   bouton « Contacter ». Impossible donc d'écrire à un propriétaire, à un
   locataire ou à un client dont on a simplement le numéro : il fallait
   attendre qu'il vous écrive le premier.
   Le numéro de téléphone est ce que tout le monde a en poche, et c'est lui
   qui identifie un compte. On le saisit, l'application cherche le compte
   correspondant : s'il n'existe pas, elle le dit en rouge ; s'il existe,
   elle ouvre la discussion avec lui.
   ========================================================================== */

/* --- 1. Reconnaître un numéro ------------------------------------------ */
/* Les numéros sont écrits de vingt façons : « +221 77 000 00 01 »,
   « 770000001 », « 77 000 00 01 ». On compare ce qui ne change pas :
   les neuf derniers chiffres. */
const chiffresDe = s => String(s || '').replace(/\D+/g, '');

function memeNumero(a, b) {
  const x = chiffresDe(a), y = chiffresDe(b);
  if (x.length < 6 || y.length < 6) return false;
  const n = Math.min(9, x.length, y.length);
  return x.slice(-n) === y.slice(-n);
}

const compteParNumero = tel => DB.getData(DB.K.users)
  .find(u => memeNumero(u.phone, tel)) || null;

/* --- 2. Ouvrir la discussion ------------------------------------------- */
function ouvrirDiscussion(u, autre, tel) {
  let t = DB.findItem(DB.K.messages, x => x.participants.includes(u.id)
    && x.participants.includes(autre.id));
  if (!t) {
    t = DB.addItem(DB.K.messages, {participants: [u.id, autre.id], propertyId: '',
      items: [], phone: chiffresDe(tel || autre.phone)});
    if (!DB.lastWriteOk) return false;
  } else if (!t.phone) {
    /* Le numéro reste attaché à la discussion : c'est par lui qu'on l'a
       trouvée, c'est par lui qu'on la retrouvera. */
    DB.updateItem(DB.K.messages, t.id, {phone: chiffresDe(tel || autre.phone)});
  }
  openThread = t.id;
  mobileThreadOpen = true;
  if (u.role === 'tenant' && typeof conversationsDe === 'function') {
    const c = conversationsDe(u).find(x => x.autreId === autre.id);
    if (c) boiteOuverte = c.cle;
  }
  const cible = u.role === 'tenant' ? '#/client/messages' : `#/${u.role}/messages`;
  if (location.hash === cible) render(); else go(cible);
  return true;
}

/* --- 3. La fenêtre ------------------------------------------------------ */
function fenetreNouvelleDiscussion() {
  modal('Nouvelle discussion', `
    <p class="small muted">Saisissez le numéro de téléphone de la personne.
      S'il correspond à un compte DEUKSIL, la discussion s'ouvre aussitôt.</p>
    <form data-action="nd-ouvrir" autocomplete="off">
      <div class="field"><label>Numéro de téléphone</label>
        <input class="input" name="tel" type="tel" inputmode="tel"
          placeholder="77 000 00 01" required autofocus></div>
      <button class="btn block">Ouvrir la discussion</button></form>`);
}

document.addEventListener('click', e => {
  if (!e.target.closest('[data-action="nd-new"]')) return;
  const u = Auth.current();
  if (!u) { toast('Connectez-vous pour écrire un message.', 'bad'); go('#/login'); return; }
  fenetreNouvelleDiscussion();
});

document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="nd-ouvrir"]');
  if (!f) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const u = Auth.current(); if (!u) return;
  const tel = (formData(f).tel || '').trim();
  const refus = m => { formError(f, m); toast(m, 'bad'); };

  if (chiffresDe(tel).length < 9) return refus('Numéro incomplet : saisissez les 9 chiffres.');
  if (memeNumero(u.phone, tel)) return refus('C\'est votre propre numéro.');

  const autre = compteParNumero(tel);
  if (!autre) return refus('Ce compte n\'existe pas.');
  if (autre.role === 'admin') return refus('Ce compte ne peut pas recevoir de messages.');
  if (autre.status && autre.status !== 'actif') return refus('Ce compte n\'est pas actif.');

  clearFormError(f);
  closeModal();
  if (typeof marquerChoixDiscussion === 'function') marquerChoixDiscussion();
  if (ouvrirDiscussion(u, autre, tel)) toast('Discussion ouverte avec ' + displayName(autre) + '.');
}, true);

/* --- 4. Le bouton, sur chaque messagerie -------------------------------- */
const ND_ECRANS = /^#\/(client|owner|agency|tenant)\/messages$/;

function greffeBoutonND() {
  if (!ND_ECRANS.test(location.hash)) return;
  const u = Auth.current(); if (!u) return;
  const contenu = document.querySelector('.main > .content');
  if (!contenu || contenu.querySelector('[data-action="nd-new"]')) return;
  const ancre = contenu.querySelector('.chat, .empty');
  if (!ancre) return;
  const bar = document.createElement('div');
  bar.className = 'nd-bar';
  bar.innerHTML = `<button class="btn" data-action="nd-new">${icon('plus', 16)} Nouvelle discussion</button>`;
  ancre.parentNode.insertBefore(bar, ancre);
}

new MutationObserver(() => requestAnimationFrame(() => {
  try { greffeBoutonND(); } catch (err) {}
})).observe(document.body, {childList: true, subtree: true});
