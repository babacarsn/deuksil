/* =========================================================================
   97-visiteur.js — Visiteur sans compte : numéro, message, visite, favori ou
   signalement mènent à la connexion (ou à la création d'un compte client) ;
   une fois connecté, il revient sur l'annonce qu'il regardait.
   ========================================================================= */
const CLE_RETOUR = 'deuksil_retour';
document.addEventListener('click', e => {
  if (Auth.current()) return;
  const b = e.target.closest && e.target.closest('[data-action="call-owner"], [data-action="contact"], [data-action="ask-visit"], [data-action="toggle-fav"], [data-action="g5-report"]'); if (!b) return;
  e.preventDefault(); e.stopImmediatePropagation();
  const h = location.hash || '#/'; try { sessionStorage.setItem(CLE_RETOUR, /^#\/(login|register)/.test(h) ? '#/search' : h); } catch (err) {}
  toast('Connectez-vous ou créez un compte client pour contacter l\'annonceur.');
  go('#/login');
}, true);
const _goRetour = go;
go = function (h) {
  let r = null; try { r = sessionStorage.getItem(CLE_RETOUR); } catch (e) {}
  const u = Auth.current();
  if (r && u && ['client', 'tenant'].includes(u.role) && h === Auth.home(u)) { try { sessionStorage.removeItem(CLE_RETOUR); } catch (e) {} return _goRetour(r); }
  return _goRetour(h);
};
