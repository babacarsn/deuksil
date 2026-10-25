// Chaque champ de mot de passe a un bouton « œil » qui affiche puis masque la saisie.
const {open, loginAs, goto} = require('./harnais');
(async () => {
  const {b, p} = await open(); let ok = 0, n = 0;
  const verifier = async (nom) => {
    const r = await p.evaluate(async () => {
      const champs = [...document.querySelectorAll('input[type="password"], input[data-oeil]')].filter(i => i.offsetParent);
      const res = [];
      for (const i of champs) {
        const bt = i.nextElementSibling && i.nextElementSibling.matches('[data-action="toggle-pw"]') ? i.nextElementSibling : null;
        if (!bt) { res.push([i.name, 'pas de bouton']); continue; }
        const r0 = bt.getBoundingClientRect(), ri = i.getBoundingClientRect();
        const dedans = r0.left >= ri.left && r0.right <= ri.right + 1 && r0.top >= ri.top - 1 && r0.bottom <= ri.bottom + 1;
        bt.click(); const vu = i.type === 'text'; bt.click(); const cache = i.type === 'password';
        res.push([i.name, dedans && vu && cache ? 'ok' : `dedans=${dedans} vu=${vu} cache=${cache}`]);
      }
      return res;
    });
    if (!r.length) { console.log('ÉCHEC', nom, ': aucun champ trouvé'); n++; return; }
    for (const [name, etat] of r) { n++; if (etat === 'ok') ok++; console.log(etat === 'ok' ? 'OK  ' : 'ÉCHEC', nom, name, etat === 'ok' ? '' : etat); }
  };
  await goto(p, '#/login'); await verifier('connexion');
  await goto(p, '#/register'); await p.evaluate(() => document.querySelectorAll('.wstep').forEach(s => s.style.display = 'block')); await verifier('inscription');
  await loginAs(p, '1900000000003'); await goto(p, '#/manage/team'); await verifier('propriétaire · équipe et accès locataire');
  await goto(p, '#/owner/profile'); await verifier('propriétaire · changer mon mot de passe');
  await loginAs(p, '1900000000002'); await goto(p, '#/client/profile'); await verifier('client · changer mon mot de passe');
  await loginAs(p, '1900000000004'); await goto(p, '#/agency/settings'); await verifier('agence · paramètres');
  await loginAs(p, '1900000000001'); await goto(p, '#/admin/settings'); await verifier('admin · paramètres');
  await loginAs(p, '1900000000012'); await goto(p, '#/agent/profil'); await verifier('agent · mon profil');
  await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1900000000012'); DB.updateItem(DB.K.users, u.id, {mdpProvisoire: true}); });
  await goto(p, '#/mot-de-passe'); await verifier('premier mot de passe (compte ouvert par un tiers)');
  console.log(`\n${ok}/${n} erreurs JS`, p.errs); await b.close(); process.exit(ok === n ? 0 : 1);
})();
