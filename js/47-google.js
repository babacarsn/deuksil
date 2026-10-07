/* ==========================================================================
   MODULE : google.js — connexion par compte Google (simulation).
   Aucun échange réel avec Google : pas de serveur, pas d'OAuth. Le sélecteur
   reproduit le comportement attendu pour la démonstration, et le dit.
   ========================================================================== */
const gmailOf = u => u.email || `${(u.firstName || 'user').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}.${(u.lastName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\W+/g, '')}@gmail.com`.replace(/\.@/, '@');
/* chaque compte de démonstration reçoit une adresse Gmail stable */
function seedEmails() {
  DB.getData(DB.K.users).filter(u => !u.email).forEach(u => DB.updateItem(DB.K.users, u.id, {email: gmailOf(u)}));
}
const _seedG = seedIfNeeded; seedIfNeeded = function (f) { _seedG(f); seedEmails(); };
setTimeout(seedEmails, 900);

/* le « compte du téléphone » : le dernier utilisé, sinon le client de démonstration */
const DEVICE_KEY = 'deuksil_device_account';
const deviceAccount = () => {
  const id = localStorage.getItem(DEVICE_KEY);
  return (id && DB.findItem(DB.K.users, id)) || DB.findItem(DB.K.users, u => u.cni === '1900000000002') || DB.getData(DB.K.users)[0];
};
const googleAccounts = () => DB.filterItems(DB.K.users, u => !u.parentId).slice(0, 6);
const ROLE_FR = {client:'Client', owner:'Propriétaire', agency:'Agence', tenant:'Client', admin:'Administration', investor:'Investisseur', promoter:'Promoteur', manager:'Gestionnaire', agent:'Agent'};
const gLogo = (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-2.7-.4-4H24v7.3h12.1c-.2 1.9-1.6 4.9-4.5 6.9l-.1.3 6.5 5 .5.1c4.1-3.8 6.6-9.4 6.6-15.6"/><path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-6.9-5.4c-1.8 1.3-4.3 2.2-7.6 2.2-5.8 0-10.7-3.8-12.5-9.1l-.3 0-6.7 5.2-.1.3C7.9 41 15.4 46 24 46"/><path fill="#FBBC05" d="M11.5 28.4c-.5-1.4-.7-2.9-.7-4.4s.3-3 .7-4.4l0-.3-6.8-5.3-.2.1C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 9.9l7-5.5"/><path fill="#EA4335" d="M24 9.5c4.1 0 6.9 1.8 8.5 3.3l6.2-6C34.9 3.4 29.9 1 24 1 15.4 1 7.9 6 4.5 13.2l7 5.4C13.3 13.3 18.2 9.5 24 9.5"/></svg>`;
const gAvatar = u => `<span class="g-av" style="background:${avatarColor(u.id)}">${esc((u.firstName || '?')[0])}${esc((u.lastName || '')[0] || '')}</span>`;

document.head.insertAdjacentHTML('beforeend', '<style>'
  + '.g-btn{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;min-height:52px;border-radius:14px;border:1px solid var(--line-strong);background:var(--surface);color:var(--ink);font:600 .95rem var(--font);cursor:pointer;transition:background .18s,border-color .18s,transform .12s}'
  + '.g-btn:hover{background:var(--surface-2);border-color:var(--brand)} .g-btn:active{transform:scale(.985)}'
  + '.g-one{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:12px 14px;border-radius:16px;border:1px solid var(--line);background:var(--surface);cursor:pointer;font:inherit;color:var(--ink);margin-bottom:12px;transition:border-color .18s,background .18s,transform .12s;box-shadow:var(--sh-2)}'
  + '.g-one:hover{border-color:var(--brand);background:var(--surface-2)} .g-one:active{transform:scale(.99)}'
  + '.g-one .txt{min-width:0;flex:1} .g-one b{display:block;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-one .sub{font-size:.78rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-av{width:38px;height:38px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700;font-size:.85rem;flex:none}'
  + '.g-row{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:11px 12px;border:0;border-radius:12px;background:none;cursor:pointer;font:inherit;color:var(--ink);transition:background .16s}'
  + '.g-row:hover{background:var(--surface-2)}'
  + '.g-row .txt{min-width:0;flex:1}.g-row b{display:block;font-size:.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-row .sub{display:block;font-size:.78rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}'
  + '.g-row svg{flex:none;color:var(--muted)}'
  + '.g-head{display:flex;align-items:center;gap:10px;margin-bottom:4px;font-weight:600}'
  + '.g-note{font-size:.76rem;color:var(--muted);line-height:1.5;margin:12px 0 0}'
  + '</style>');

/* Sélecteur de compte, à la manière d'un téléphone Android */
function googleChooser() {
  const list = googleAccounts();
  modal('Choisir un compte', `
    <div class="g-head">${gLogo(20)} <span>Se connecter avec Google</span></div>
    <p class="small muted" style="margin:0 0 12px">Comptes présents sur cet appareil</p>
    ${list.map(u => `<button class="g-row" data-action="g-pick" data-id="${u.id}">${gAvatar(u)}
      <span class="txt"><b>${esc(u.firstName)} ${esc(u.lastName || u.agencyName || '')}</b><span class="sub">${esc(u.email || gmailOf(u))} · ${ROLE_FR[u.role] || u.role}</span></span>
      ${icon('arrowRight', 16)}</button>`).join('')}
    <div style="height:1px;background:var(--line);margin:10px 0"></div>
    <button class="g-row" data-action="g-other">${icon('plus', 18)}<span class="txt"><b>Utiliser un autre compte</b><span class="sub">Créer un compte DEUKSIL</span></span></button>
    <p class="g-note">Démonstration : aucun échange n'a lieu avec Google. Cette liste reprend les comptes de test enregistrés dans ce navigateur.</p>`);
}
document.addEventListener('click', e => {
  const pick = e.target.closest('[data-action="g-pick"]');
  if (pick) {
    const u = DB.findItem(DB.K.users, pick.dataset.id); if (!u) return;
    if (u.status === 'suspendu') { toast('Ce compte est suspendu.', 'bad'); return; }
    localStorage.setItem(DEVICE_KEY, u.id);
    localStorage.setItem(DB.K.session, JSON.stringify({id: u.id, at: now()}));
    closeModal(); toast(`Connecté en tant que ${u.firstName}.`); go(Auth.home(Auth.current() || u)); render();
    return;
  }
  if (e.target.closest('[data-action="g-other"]')) { closeModal(); go('#/register'); return; }
  if (e.target.closest('[data-action="g-choose"]')) googleChooser();
});
