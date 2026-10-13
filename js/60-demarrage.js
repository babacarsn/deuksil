/* ==========================================================================
   Démarrage
   ========================================================================== */
function bootSkeletonHtml() {
  return `<div class="nav"><div class="wrap nav-in">
      <div class="skeleton" style="height:30px;width:150px;border-radius:8px"></div>
      <div class="row" style="gap:10px"><div class="skeleton" style="height:34px;width:90px;border-radius:999px"></div>
        <div class="skeleton" style="height:34px;width:120px;border-radius:999px"></div></div>
    </div></div>
    <div class="wrap" style="padding-top:64px">
      <div class="skeleton" style="height:44px;width:60%;border-radius:10px;margin-bottom:14px"></div>
      <div class="skeleton" style="height:44px;width:38%;border-radius:10px;margin-bottom:26px"></div>
      <div class="skeleton" style="height:72px;width:100%;max-width:640px;border-radius:18px;margin-bottom:40px"></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px;padding-bottom:60px">
        ${[1, 2, 3].map(() => `<div class="skeleton" style="height:300px;border-radius:16px"></div>`).join('')}
      </div>
    </div>`;
}
$('#app').innerHTML = bootSkeletonHtml();
/* Plus de préférence de thème : l'application n'existe qu'en clair (voir 76-demarrage). */
setTimeout(() => {
  seedIfNeeded();
  if (!location.hash) location.hash = '#/';
  render();
}, 360);
initAi();
