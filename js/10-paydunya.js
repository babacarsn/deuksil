/* ==========================================================================
   MODULE : paydunya.js — simulation fidèle du flux PayDunya (agrégateur)
   Structure des réponses alignée sur l'API réelle de PayDunya (documentation
   publique developers.paydunya.com) : /checkout-invoice/create puis
   /checkout-invoice/confirm/{token}. AUCUN appel réseau réel, AUCUNE clé —
   une intégration réelle nécessite un backend (les clés PAYDUNYA-* ne
   doivent jamais vivre côté navigateur). Voir le README, section Paiements.
   ========================================================================== */
const PAYDUNYA_METHODS = [
  {key: 'orange_money', label: 'Orange Money', hint: 'Code de confirmation envoyé par SMS', field: 'phone'},
  {key: 'wave',         label: 'Wave',          hint: 'Paiement mobile instantané',          field: 'phone'},
  {key: 'free_money',   label: 'Free Money',    hint: 'Paiement mobile Free',                 field: 'phone'},
  {key: 'card',         label: 'Carte bancaire',hint: 'Visa, Mastercard',                     field: 'card'}
];
function randToken(n) { const c = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; let s = ''; for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)]; return s; }
function randHex(n) { let s = ''; for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }

const Pay = {
  open({title, amount, type, userId, onSuccess}) {
    const user = DB.findItem(DB.K.users, userId) || {};
    const token = 'test_' + randToken(10);
    const invoiceUrl = `https://app.paydunya.com/sandbox-checkout/invoice/${token}`;

    modal('PayDunya', `
      <div class="pd-topbar"><b>PayDunya</b><span class="badge">Bac à sable — simulation</span></div>
      <div class="spinner"></div>
      <p class="small muted" style="text-align:center">Création de la facture…</p>`, {noClose: true});

    setTimeout(() => renderCheckout(), 550);

    function renderCheckout(selected) {
      const m = selected || PAYDUNYA_METHODS[0].key;
      modal('PayDunya', `
        <div class="pd-topbar"><b>PayDunya</b><span class="badge ok">Bac à sable — simulation</span></div>
        <div class="pd-merchant">
          <div class="row-between"><span class="small muted">Marchand</span><b class="small">DEUKSIL</b></div>
          <div class="row-between"><span class="small muted">Description</span><span class="small">${esc(title)}</span></div>
          <div class="row-between"><span class="small muted">Référence facture</span><code class="small">${token}</code></div>
          <div class="row-between" style="margin-top:6px"><span>Montant</span><b style="font-family:var(--display);font-weight:600;font-size:1.3rem">${money(amount)}</b></div>
        </div>
        <p class="small muted" style="margin:14px 0 8px">Choisissez un moyen de paiement</p>
        <div class="pd-methods">
          ${PAYDUNYA_METHODS.map(x => `<button type="button" class="pd-method ${x.key === m ? 'on' : ''}" data-action="pd-select" data-m="${x.key}">
            <b class="small">${x.label}</b><span class="small muted">${x.hint}</span></button>`).join('')}
        </div>
        ${PAYDUNYA_METHODS.find(x => x.key === m).field === 'card' ? `
          <div class="form-grid" style="margin-top:14px">
            <div class="field" style="grid-column:1/-1"><label>Numéro de carte</label><input class="input" id="pd-card" placeholder="4242 4242 4242 4242" maxlength="19"></div>
            <div class="field"><label>Expiration</label><input class="input" id="pd-exp" placeholder="MM/AA" maxlength="5"></div>
            <div class="field"><label>CVV</label><input class="input" id="pd-cvv" placeholder="123" maxlength="3"></div>
          </div>` : `
          <div class="field" style="margin-top:14px"><label>Numéro de téléphone</label>
            <input class="input" id="pd-phone" value="${esc(user.phone || '+221 77 000 00 00')}"></div>`}
        <button class="btn block" data-action="pd-pay" data-m="${m}">Payer ${money(amount)}</button>
        <p class="small muted" style="text-align:center;margin-top:10px">Simulation à but pédagogique — aucune donnée bancaire n'est transmise.</p>
        <div id="pd-state" style="margin-top:10px"></div>`, {noClose: true});

      $$('[data-action="pd-select"]').forEach(btn => btn.onclick = () => renderCheckout(btn.dataset.m));
      $('[data-action="pd-pay"]').onclick = () => runPayment(m);
    }

    function runPayment(methodKey) {
      const method = PAYDUNYA_METHODS.find(x => x.key === methodKey);
      const box = $('#pd-state');
      $('[data-action="pd-pay"]').disabled = true;
      $$('.pd-method').forEach(b => b.disabled = true);
      box.innerHTML = `<div class="spinner"></div><p class="small muted" style="text-align:center">Connexion à ${esc(method.label)}…</p><div class="progress"><i></i></div>`;
      let p = 0;
      const steps = ['Vérification des informations…', 'Envoi de la demande de paiement…', 'Confirmation auprès de PayDunya…'];
      const iv = setInterval(() => {
        p += 34; const bar = box.querySelector('.progress i'); if (bar) bar.style.width = Math.min(p, 100) + '%';
        const stepText = box.querySelector('p'); if (stepText) stepText.textContent = steps[Math.min(2, Math.floor(p / 34))];
        if (p >= 100) {
          clearInterval(iv);
          const hash = randHex(64);
          const paydunya = {
            token, response_code: '00', status: 'completed', hash,
            customer: {name: displayName(user), phone: user.phone || ''},
            invoiceUrl
          };
          const tx = DB.addItem(DB.K.payments, {ref: payRef(), userId, type, amount, method: 'PayDunya · ' + method.label, status: 'paye', paydunya});
          if (!DB.lastWriteOk) {
            box.innerHTML = `<div class="card pad-s" style="border-color:var(--bad);background:var(--bad-soft)">
              <b>Paiement non enregistré</b><div class="small">Le paiement a été traité par PayDunya mais n'a pas pu être enregistré localement (stockage saturé). Contactez le support avec la référence ${token}.</div></div>`;
            $$('.pd-method').forEach(b => b.disabled = false);
            return;
          }
          box.innerHTML = `<div class="card pad-s" style="border-color:var(--ok);background:var(--ok-soft)">
            <div class="row" style="gap:8px;align-items:flex-start">${icon('checkCircle', 18)}
              <div><b>Paiement confirmé</b>
              <div class="small" style="margin-top:2px">Jeton PayDunya <code>${token}</code></div>
              <div class="small muted">Statut : completed · Hash ${hash.slice(0, 12)}…</div>
              <div class="small muted">${method.label} · ${money(amount)}</div></div></div></div>`;
          setTimeout(() => { closeModal(); onSuccess(tx); }, 1100);
        }
      }, 480);
    }
  }
};
