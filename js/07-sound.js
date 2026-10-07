/* ==========================================================================
   MODULE : sound.js — carillon de notification (Web Audio, aucun fichier audio)
   ========================================================================== */
let audioCtx = null;
function soundEnabled() { return localStorage.getItem('deuksil_sound_pref') !== 'off'; }
function playNotifySound() {
  if (!soundEnabled()) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [[880, 0, .12, .16], [1318.5, .1, .18, .14]].forEach(([freq, delay, dur, peak]) => {
      const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      const start = t0 + delay;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(peak, start + .015);
      gain.gain.exponentialRampToValueAtTime(.0001, start + dur);
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.start(start); osc.stop(start + dur + .03);
    });
  } catch (e) { /* Web Audio indisponible dans ce navigateur : on ignore silencieusement */ }
}
let lastUnreadCount = {};
function checkNotifySound(u) {
  if (!u) return;
  const count = DB.filterItems(DB.K.notifications, n => n.userId === u.id && !n.read).length;
  if (lastUnreadCount[u.id] !== undefined && count > lastUnreadCount[u.id]) {
    playNotifySound();
    if (window.Notification && Notification.permission === 'granted') {
      try {
        const latest = DB.filterItems(DB.K.notifications, n => n.userId === u.id).slice(-1)[0];
        new Notification('DEUKSIL', {body: latest ? latest.text : 'Nouvelle notification', silent: true});
      } catch (e) { /* API Notification indisponible dans ce contexte : on ignore */ }
    }
  }
  lastUnreadCount[u.id] = count;
}

function openReceipt(id) {
  const p = DB.findItem(DB.K.payments, id);
  if (!p || !p.paydunya) return;
  const pd = p.paydunya;
  modal('Reçu PayDunya', `
    <div class="pd-topbar"><b>PayDunya</b><span class="badge ok">Bac à sable — simulation</span></div>
    <div class="pd-merchant">
      <div class="row-between"><span class="small muted">Marchand</span><b class="small">DEUKSIL</b></div>
      <div class="row-between"><span class="small muted">Référence facture</span><code class="small">${pd.token}</code></div>
      <div class="row-between"><span class="small muted">Statut</span>${badge(pd.status, 'ok')}</div>
      <div class="row-between"><span class="small muted">Client</span><span class="small">${esc(pd.customer.name)} · ${esc(pd.customer.phone)}</span></div>
      <div class="row-between"><span class="small muted">Empreinte (hash)</span><code class="small">${pd.hash.slice(0, 20)}…</code></div>
      <div class="row-between" style="margin-top:6px"><span>Montant réglé</span><b style="font-family:var(--display);font-weight:600;font-size:1.3rem">${money(p.amount)}</b></div>
    </div>
    <p class="small muted" style="margin-top:12px">${esc(p.type)} · ${esc(p.method)} · ${dateTimeFr(p.createdAt)} · Réf. interne ${esc(p.ref)}</p>
    <p class="small muted">Ce reçu est une simulation : aucune transaction bancaire réelle n'a eu lieu.</p>`);
}

function toast(msg, tone = 'ok') {
  const el = document.createElement('div');
  el.className = 'toast ' + (tone === 'ok' ? '' : tone);
  el.innerHTML = `<span class="row" style="gap:8px;align-items:flex-start">${icon(tone === 'bad' ? 'alert' : tone === 'warn' ? 'clock' : 'check', 17)}<span>${esc(msg)}</span></span>`;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}
let modalLastFocus = null;
function modal(title, bodyHtml, opts = {}) {
  closeModal();
  modalLastFocus = document.activeElement;
  const titleId = 'modal-title-' + uid('t');
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="${titleId}">
    <div class="modal-head"><h3 id="${titleId}">${esc(title)}</h3>${opts.noClose ? '' : `<button class="x" data-action="close-modal" aria-label="Fermer cette fenêtre">${icon('close', 18)}</button>`}</div>
    <div class="modal-body">${bodyHtml}</div></div>`;
  if (!opts.noClose) back.addEventListener('click', e => { if (e.target === back) closeModal(); });
  $('#modal-root').appendChild(back);
  const dialog = back.querySelector('.modal');
  const focusables = () => [...dialog.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')];
  back.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !opts.noClose) { e.preventDefault(); closeModal(); return; }
    if (e.key === 'Tab') {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  const toFocus = focusables()[0] || dialog;
  setTimeout(() => toFocus.focus(), 20);
  return back;
}
function closeModal() {
  $('#modal-root').innerHTML = '';
  if (modalLastFocus && document.contains(modalLastFocus)) modalLastFocus.focus();
  modalLastFocus = null;
}
function go(route) { if (location.hash !== route) { location.hash = route; render(); } else render(); }

/* Boîtes de dialogue maison (remplacent confirm()/prompt() du navigateur) */
/* Erreurs de formulaire stylées, cohérentes avec l'inscription */
function formError(form, msg) {
  let box = form.querySelector('.form-err-box');
  if (!box) { box = document.createElement('div'); box.className = 'form-err-box'; form.prepend(box); }
  box.innerHTML = `<p class="err">${esc(msg)}</p>`;
  if (typeof box.scrollIntoView === 'function') box.scrollIntoView({block: 'nearest', behavior: 'smooth'});
  return false;
}
function clearFormError(form) { const box = form.querySelector('.form-err-box'); if (box) box.innerHTML = ''; }

function confirmDialog({title = 'Confirmer', message, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', danger = false, onConfirm}) {
  modal(title, `
    <p class="muted">${esc(message)}</p>
    <div class="row" style="justify-content:flex-end;gap:10px;margin-top:18px">
      <button class="btn ghost" data-action="dlg-cancel">${esc(cancelLabel)}</button>
      <button class="btn ${danger ? 'danger' : ''}" data-action="dlg-confirm">${esc(confirmLabel)}</button>
    </div>`);
  $('[data-action="dlg-cancel"]').onclick = closeModal;
  $('[data-action="dlg-confirm"]').onclick = () => { closeModal(); onConfirm(); };
}
function promptDialog({title = 'Renseignez une valeur', label, value = '', placeholder = '', confirmLabel = 'Valider', onConfirm}) {
  modal(title, `<form data-action="dlg-prompt-form">
      <div class="field">${label ? `<label>${esc(label)}</label>` : ''}<input class="input" id="dlg-prompt-input" value="${esc(value)}" placeholder="${esc(placeholder)}" autofocus></div>
      <div class="row" style="justify-content:flex-end;gap:10px"><button type="button" class="btn ghost" data-action="dlg-cancel">Annuler</button>
      <button class="btn">${esc(confirmLabel)}</button></div></form>`);
  $('[data-action="dlg-cancel"]').onclick = closeModal;
  $('[data-action="dlg-prompt-form"]').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#dlg-prompt-input').value.trim();
    if (!v) return;
    closeModal(); onConfirm(v);
  });
  setTimeout(() => $('#dlg-prompt-input')?.focus(), 30);
}
