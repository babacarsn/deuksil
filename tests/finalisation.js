// Corrections de finalisation (AUDIT.md) : chaque problème constaté a son test.
// ETAPES=P1,P3 limite aux étapes demandées.
const {open, loginAs, goto} = require('./harnais.js');
const ETAPES = (process.env.ETAPES || 'P1,P3,P4,P2,P6,S1,N1,N2,N3,N4,I1,I2,I3').split(',');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const inscrire = async (role, cni) => {
    await p.evaluate(() => { localStorage.removeItem(DB.K.session); location.hash = '#/register'; }); await p.waitForTimeout(700);
    await p.evaluate(([role, cni]) => { const f = document.querySelector('form[data-action="register"]'); const r = f.querySelector('input[name="role"]:checked'); r.value = role;
      Object.entries({cni, firstName: 'Test', lastName: role, phone: '77' + cni.slice(-7), password: 'secret12', password2: 'secret12', agencyName: 'Agence ' + role}).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; });
      f.requestSubmit(); }, [role, cni]); await p.waitForTimeout(800);
    return p.evaluate(c => (DB.findItem(DB.K.users, u => u.cni === c) || {}).role || null, cni);
  };

  if (ETAPES.includes('P1')) {
    T('P1a', await inscrire('admin', '1999999999901') === null, 'inscription forgée en « admin » refusée (aucun compte créé)');
    T('P1b', await inscrire('manager', '1999999999902') === null, 'inscription forgée en « manager » refusée');
    T('P1c', await inscrire('client', '1999999999903') === 'client' && await inscrire('investor', '1999999999913') !== 'investor', 'client accepté ; investisseur refusé (Client, Propriétaire, Agence seulement)');
    T('P1d', await inscrire('agency', '1999999999904') === 'agency', 'inscription normale d\'une agence acceptée');
  }
  if (ETAPES.includes('P3')) {
    await loginAs(p, '1900000000012'); await goto(p, '#/agency/properties'); await p.waitForTimeout(700);
    const ids = await p.evaluate(() => { const u = Auth.current(); const P = DB.getData(DB.K.properties).filter(x => x.ownerId === u.id);
      let mien = P.find(x => x.agentId === u.member.id); const autre = P.find(x => x.agentId !== u.member.id);
      if (!mien) { DB.updateItem(DB.K.properties, P[0].id, {agentId: u.member.id}); mien = P[0]; }
      return {mien: mien.id, autre: autre.id}; });
    await goto(p, '#/owner/property/' + ids.autre); await p.waitForTimeout(600);
    T('P3a', await p.evaluate(() => !document.querySelector('form[data-action="save-property"]') && /^#\/bien\//.test(location.hash)), 'agent : la fiche de modification du bien d\'un collègue est refusée (renvoi vers sa fiche publique)');
    await goto(p, '#/owner/property/' + ids.mien); await p.waitForTimeout(600);
    T('P3b', await p.evaluate(() => !!document.querySelector('form[data-action="save-property"]')), 'agent : il modifie ses propres biens');
    await goto(p, '#/agency/properties'); await p.waitForTimeout(500);
    await p.evaluate(id => { const b = document.createElement('button'); b.dataset.action = 'pause'; b.dataset.id = id; document.querySelector('#app .content').appendChild(b); b.click(); }, ids.autre); await p.waitForTimeout(300);
    T('P3c', await p.evaluate(id => DB.findItem(DB.K.properties, id).listingStatus !== 'pause', ids.autre), 'agent : mise en pause du bien d\'un collègue bloquée (même par un bouton forgé)');
    await p.evaluate(id => { const b = document.createElement('button'); b.dataset.action = 'pause'; b.dataset.id = id; document.querySelector('#app .content').appendChild(b); b.click(); }, ids.mien); await p.waitForTimeout(300);
    T('P3d', await p.evaluate(id => DB.findItem(DB.K.properties, id).listingStatus === 'pause', ids.mien), 'agent : il met en pause son propre bien');
    await p.evaluate(() => { document.querySelector('[data-action="agent-portee"][data-v="tous"]').click(); }); await p.waitForTimeout(500);
    T('P3e', await p.evaluate(id => !document.querySelector(`#app [data-action][data-id="${id}"]:is([data-action="pause"],[data-action="archive"],[data-action="publish"])`) && !document.querySelector(`#app a[href="#/owner/property/${id}"]`), ids.autre), 'vue « Toute l\'agence » : pas de bouton d\'action sur les biens des collègues');
    T('P3f', await p.evaluate(() => !document.querySelector('#app [data-action="delete-prop"]')), 'agent : aucun bouton « supprimer un bien »');
    await loginAs(p, '1900000000004'); await goto(p, '#/owner/property/' + ids.autre); await p.waitForTimeout(600);
    T('P3g', await p.evaluate(() => !!document.querySelector('form[data-action="save-property"]')), 'le responsable modifie tous les biens de l\'agence');
  }
  if (ETAPES.includes('P4')) {
    await loginAs(p, '1900000000003'); await goto(p, '#/owner/property/new'); await p.waitForTimeout(900);
    const ops = await p.evaluate(() => [...document.querySelectorAll('input[name="transaction"]')].filter(i => i.closest('label').style.display !== 'none').map(i => i.value));
    T('P4a', ops.join() === 'location,vente', `deux opérations proposées : ${ops.join(', ')}`);
    await p.evaluate(() => { document.querySelector('input[name="transaction"][value="vente"]').click(); document.querySelector('input[name="type"][value="terrain"]').click(); }); await p.waitForTimeout(300);
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(400);
    const vu = await p.evaluate(() => ({rooms: document.querySelector('[name="rooms"]').offsetParent !== null, foncier: document.querySelector('.fin-foncier').offsetParent !== null, unite: document.querySelector('[name="surfaceUnite"]').offsetParent !== null,
      prix: document.querySelector('[name="price"]').closest('.field').querySelector('label').textContent, amen: document.querySelector('[name="amenities"]').offsetParent !== null}));
    T('P4b', !vu.rooms && !vu.amen && vu.foncier && vu.unite && vu.prix === 'Prix de vente (FCFA)', `terrain : pas de chambres ni d'équipements, bloc foncier et unité affichés, « ${vu.prix} »`);
    await p.evaluate(() => { const f = document.querySelector('#wiz'); f.title.value = 'Terrain de 2 ha à Sindia'; f.price.value = '60000000'; f.surface.value = '2'; f.surfaceUnite.value = 'ha'; f.quartier.value = 'Sindia'; });
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(400);
    T('P4c', await p.evaluate(() => document.querySelector('#wiz').dataset.cur === '2'), 'vente d\'un terrain sans statut foncier : l\'étape suivante est refusée');
    await p.evaluate(() => { const f = document.querySelector('#wiz'); f.statutFoncier.value = 'Titre foncier (TF)'; f.refFonciere.value = 'TF 4521/DG'; f.querySelector('input[name="viab"][value="Eau"]').checked = true; f.querySelector('input[name="docsT"][value="Plan cadastral / bornage"]').checked = true; });
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(400);
    await p.click('#wiz-end button[value="publish"]'); await p.waitForTimeout(2600);   // l'utilisateur relit le récapitulatif
    T('P4k', await p.evaluate(() => [...document.querySelectorAll('.recap-l')].some(l => /Surface/.test(l.textContent) && /2 ha/.test(l.textContent))), 'récapitulatif : surface affichée en ha');
    await p.click('[data-action="pub-oui"]'); await p.waitForTimeout(1200);
    const t = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.title === 'Terrain de 2 ha à Sindia'));
    T('P4d', t && t.transaction === 'terrain' && t.type === 'terrain' && t.surface === 20000 && t.surfaceUnite === 'ha' && t.rooms === 0, `enregistré : transaction « ${t && t.transaction} », ${t && t.surface} m² (saisi en ha), chambres ${t && t.rooms}`);
    T('P4e', t && t.foncier && t.foncier.statut === 'Titre foncier (TF)' && t.foncier.reference === 'TF 4521/DG' && t.foncier.viabilisation.join() === 'Eau' && t.foncier.verification === 'declaratif', 'informations foncières enregistrées, statut « déclaratif »');
    await goto(p, '#/property/' + t.id); await p.waitForTimeout(700);
    const fiche = await p.evaluate(() => (document.querySelector('#infos-foncieres') || {}).innerText || '');
    T('P4f', /Titre foncier/.test(fiche) && /2 ha/.test(fiche) && /non vérifié/.test(fiche), 'fiche publique : informations foncières, surface en ha, mention « non vérifié par DEUKSIL »');
    T('P4g', await p.evaluate(() => DB.getData(DB.K.properties).filter(x => x.transaction === 'terrain' && x.listingStatus === 'publiee').some(x => x.title === 'Terrain de 2 ha à Sindia')), 'le terrain apparaît avec les terrains à vendre (recherche)');
    await goto(p, '#/owner/property/' + t.id); await p.waitForTimeout(800);
    const ed = await p.evaluate(() => ({op: (document.querySelector('input[name="transaction"]:checked') || {}).value, type: (document.querySelector('input[name="type"]:checked') || {}).value, s: document.querySelector('[name="surface"]').value, u: document.querySelector('[name="surfaceUnite"]').value, st: document.querySelector('[name="statutFoncier"]').value}));
    T('P4h', ed.op === 'vente' && ed.type === 'terrain' && ed.s === '2' && ed.u === 'ha' && ed.st === 'Titre foncier (TF)', `modification : la saisie est retrouvée telle quelle (${JSON.stringify(ed)})`);
    await goto(p, '#/owner/property/new'); await p.waitForTimeout(800);
    await p.evaluate(() => { document.querySelector('input[name="transaction"][value="location"]').click(); document.querySelector('input[name="type"][value="appartement"]').click(); });
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(400);
    const lo = await p.evaluate(() => ({rooms: document.querySelector('[name="rooms"]').offsetParent !== null, foncier: document.querySelector('.fin-foncier').offsetParent !== null, prix: document.querySelector('[name="price"]').closest('.field').querySelector('label').textContent}));
    T('P4i', lo.rooms && !lo.foncier && lo.prix === 'Loyer mensuel (FCFA)', `location d'un appartement : chambres affichées, pas de bloc foncier, « ${lo.prix} »`);
    await p.evaluate(() => { const f = document.querySelector('#wiz'); f.title.value = 'Appartement F3 test location'; f.price.value = '250000'; f.surface.value = '90'; f.quartier.value = 'Mermoz'; f.rooms.value = '3'; });
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(400);
    await p.click('#wiz-end button[value="publish"]'); await p.waitForTimeout(700); await p.click('[data-action="pub-oui"]'); await p.waitForTimeout(1200);
    const a = await p.evaluate(() => DB.getData(DB.K.properties).find(x => x.title === 'Appartement F3 test location'));
    T('P4j', a && a.transaction === 'location' && a.rooms === 3 && !a.foncier && a.surface === 90, 'appartement à louer enregistré normalement (transaction location, 3 chambres, sans données foncières)');
  }
  if (ETAPES.includes('P2')) {
    const ajouterFiche = async (nom, tel, cni) => { await goto(p, '#/manage/owners'); await p.waitForTimeout(600);
      await p.evaluate(([n, t, c]) => { const f = document.querySelector('form[data-action="g9-owner"]'); f.name.value = n; f.phone.value = t; f.cni.value = c; f.requestSubmit(); }, [nom, tel, cni]); await p.waitForTimeout(1500);
      await goto(p, '#/agency/dashboard'); await p.waitForTimeout(400); await goto(p, '#/manage/owners'); await p.waitForTimeout(800); };
    await loginAs(p, '1900000000004');
    const nAvant = await p.evaluate(() => DB.getData(DB.K.users).length);
    await ajouterFiche('Mamadou Fall', '+221 78 000 00 03', '1900000000003');
    const r1 = await p.evaluate(() => ({comptes: DB.filterItems(DB.K.users, u => u.cni === '1900000000003').length, fiche: DB.findItem(DB.K.owners, o => o.cni === '1900000000003' && o.ownerId === Auth.current().id)}));
    T('P2a', r1.comptes === 1 && r1.fiche && r1.fiche.compteId === 'user_owner1' && r1.fiche.lien === 'demande', 'propriétaire déjà inscrit : aucun second compte, demande de rattachement envoyée');
    T('P2b', await p.evaluate(() => /Rattachement en attente/.test(document.querySelector('#app .content').innerText)), 'l\'agence voit « Rattachement en attente » dans sa liste');
    const nF = await p.evaluate(() => DB.filterItems(DB.K.owners, o => o.ownerId === Auth.current().id).length);
    await ajouterFiche('M. Fall', '780000003', '');
    T('P2c', await p.evaluate(() => DB.filterItems(DB.K.owners, o => o.ownerId === Auth.current().id).length) === nF, 'même propriétaire saisi une 2e fois (même téléphone) : fiche en double refusée');
    const ficheId = r1.fiche.id;
    const bienAg = await p.evaluate(fid => { const b = DB.getData(DB.K.properties).find(x => x.ownerId === Auth.current().id && !x.clientOwnerId); DB.updateItem(DB.K.properties, b.id, {clientOwnerId: fid}); return b.id; }, ficheId);
    await loginAs(p, '1900000000003'); await goto(p, '#/owner/properties'); await p.waitForTimeout(800);
    const v1 = await p.evaluate(() => ({demande: !!document.querySelector('#demandes-agence'), confies: !!document.querySelector('#biens-confies'), biens: myProps(Auth.current()).length}));
    T('P2d', v1.demande && !v1.confies, 'le propriétaire voit la demande ; avant son accord, aucun bien de l\'agence ne lui est montré');
    T('P2e', await p.evaluate(() => DB.getData(DB.K.notifications).some(n => n.userId === Auth.current().id && /souhaite vous rattacher/.test(n.text))), 'le propriétaire est notifié de la demande');
    await p.click('[data-action="lien-accepter"]'); await p.waitForTimeout(700);
    const v2 = await p.evaluate(b => ({confies: (document.querySelector('#biens-confies') || {}).innerText || '', direct: !!document.querySelector('.fin-direct'), biens: myProps(Auth.current()).length, menu: MENUS.owner.map(m => m[0])}), bienAg);
    T('P2f', /Biens confiés/.test(v2.confies) && v2.direct && v2.biens === v1.biens, `après accord : « Biens confiés à une agence » affiché à part, ses ${v2.biens} biens en gestion directe inchangés`);
    T('P2g', v2.menu.includes('#/mandant/releves'), 'son menu propose « Relevés de mon agence »');
    await goto(p, '#/mandant/releves'); await p.waitForTimeout(600);
    T('P2h', await p.evaluate(() => location.hash === '#/mandant/releves' && /Encaissé pour vous|Loyers encaissés/.test(document.querySelector('#app .content').innerText)), 'il consulte les relevés de l\'agence');
    const propre = await p.evaluate(() => myProps(Auth.current())[0].id);
    await goto(p, '#/owner/property/' + propre); await p.waitForTimeout(600);
    T('P2i', await p.evaluate(() => !!document.querySelector('form[data-action="save-property"]')), 'il gère toujours lui-même ses propres biens');
    await goto(p, '#/manage/rents'); await p.waitForTimeout(500);
    T('P2j', await p.evaluate(() => location.hash === '#/manage/rents'), 'sa gestion locative reste accessible (il n\'est pas réduit à la lecture seule)');
    await loginAs(p, '1900000000004');
    T('P2k', await p.evaluate(b => !myProps(Auth.current()).some(x => x.ownerId === 'user_owner1'), bienAg), 'l\'agence n\'obtient aucun des biens propres du propriétaire');
    await goto(p, '#/owner/property/' + propre); await p.waitForTimeout(600);
    T('P2l', await p.evaluate(() => !document.querySelector('form[data-action="save-property"]')), 'l\'agence ne peut pas modifier un bien du propriétaire');
    await p.evaluate(b => DB.updateItem(DB.K.properties, b, {clientOwnerId: ''}), bienAg);
    await goto(p, '#/manage/owners'); await p.waitForTimeout(700);
    await p.evaluate(id => document.querySelector(`[data-action="g9-odel"][data-id="${id}"]`).click(), ficheId); await p.waitForTimeout(400);
    await p.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /Clore/.test(x.textContent)); b && b.click(); }); await p.waitForTimeout(600);
    const r3 = await p.evaluate(id => ({fiche: DB.findItem(DB.K.owners, id), compte: !!DB.findItem(DB.K.users, 'user_owner1')}), ficheId);
    T('P2m', r3.fiche && r3.fiche.status === 'close' && r3.compte, 'clore la relation archive la fiche ; le compte du propriétaire est conservé');
    await ajouterFiche('Awa Ndoye', '771239876', '1999999999911');
    T('P2n', await p.evaluate(() => { const o = DB.findItem(DB.K.owners, x => x.cni === '1999999999911'); return !!DB.findItem(DB.K.users, u => u.ownerRec === o.id && u.cni === '1999999999911'); }), 'nouveau propriétaire sans compte : son accès mandant est créé comme avant');
  }
  if (ETAPES.includes('P6')) {
    await loginAs(p, '1900000000001'); await goto(p, '#/admin/users'); await p.waitForTimeout(700);
    const cible = await p.evaluate(() => { const x = DB.getData(DB.K.users).find(u => u.cni === '1900000000005'); return x.id; });
    const nBiens = await p.evaluate(() => DB.getData(DB.K.properties).length);
    await p.evaluate(id => { const b = document.querySelector(`[data-action="user-toggle"][data-id="${id}"]`); b.click(); }, cible); await p.waitForTimeout(400);
    T('P6a', await p.evaluate(id => !!document.querySelector('.modal') && DB.findItem(DB.K.users, id).status === 'actif', cible), 'suspension : une confirmation est demandée avant tout changement');
    await p.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /^Suspendre$/.test(x.textContent.trim())); b.click(); }); await p.waitForTimeout(500);
    const r = await p.evaluate(id => ({st: DB.findItem(DB.K.users, id).status, journal: DB.getData(DB.K.activity).some(a => /suspendu/.test(a.text) && /Ibrahima/.test(a.text)), biens: DB.getData(DB.K.properties).length}), cible);
    T('P6b', r.st === 'suspendu' && r.journal, 'compte suspendu après confirmation et inscrit au journal');
    T('P6c', r.biens === nBiens, 'aucune donnée métier supprimée par la suspension');
    T('P6d', await p.evaluate(() => { const x = DB.findItem(DB.K.users, u => u.cni === '1900000000005'); return (Auth.login('1900000000005', 'demo123')).error || ''; }).then(e => /suspendu/i.test(e)).catch(() => false), 'un compte suspendu ne peut plus se connecter');
    await loginAs(p, '1900000000004'); await p.evaluate(() => DB.updateItem(DB.K.users, Auth.current().id, {status: 'suspendu'}));
    await goto(p, '#/agency/dashboard'); await p.waitForTimeout(500);
    T('P6f', await p.evaluate(() => !Auth.current() && !/agency\/dashboard/.test(location.hash)), 'une session déjà ouverte est fermée dès la suspension du compte');
    await p.evaluate(() => DB.updateItem(DB.K.users, DB.findItem(DB.K.users, u => u.cni === '1900000000004').id, {status: 'actif'}));
    await loginAs(p, '1900000000001'); await goto(p, '#/admin/users'); await p.waitForTimeout(500);
    const adminId = await p.evaluate(() => Auth.current().id);
    await p.evaluate(id => { const b = document.createElement('button'); b.dataset.action = 'user-toggle'; b.dataset.id = id; document.querySelector('#app .content').appendChild(b); b.click(); }, adminId); await p.waitForTimeout(400);
    T('P6e', await p.evaluate(id => DB.findItem(DB.K.users, id).status !== 'suspendu' && !document.querySelector('.modal'), adminId), 'un compte administrateur ne peut pas être suspendu');
  }
  if (ETAPES.includes('S1')) {
    await loginAs(p, '1900000000003');
    await p.evaluate(() => DB.addItem(DB.K.providers, {ownerId: Auth.current().id, name: 'Plombier Test', phone: '770000000', trade: 'Plomberie'}));
    await goto(p, '#/manage/providers'); await p.waitForTimeout(600);
    const n0 = await p.evaluate(() => gMine('providers', Auth.current()).length);
    const btn = await p.$('[data-action="g3-delprov"]');
    if (btn) { await btn.click(); await p.waitForTimeout(400); }
    T('S1a', !!btn && await p.evaluate(n => !!document.querySelector('.modal') && gMine('providers', Auth.current()).length === n, n0), 'supprimer un prestataire demande confirmation (rien n\'est effacé avant)');
    await p.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /^Supprimer$/.test(x.textContent.trim())); b && b.click(); }); await p.waitForTimeout(500);
    T('S1b', await p.evaluate(n => gMine('providers', Auth.current()).length === n - 1, n0), 'après confirmation, le prestataire est supprimé');
  }
  const erreurSous = (sel, nom) => p.evaluate(([sel, nom]) => { const f = document.querySelector(sel); const i = f && f.querySelector(`[name="${nom}"]`); if (!i) return null;
    const c = (i.closest('.field') || i.parentElement).querySelector('.champ-err'); return c ? {msg: c.textContent, ko: i.classList.contains('champ-ko'), focus: document.activeElement === i} : null; }, [sel, nom]);
  const envoyer = (sel, vals) => p.evaluate(([sel, vals]) => { const f = document.querySelector(sel); Object.entries(vals).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; }); f.requestSubmit(f.querySelector('button:not([type=button])') || undefined); }, [sel, vals]);
  if (ETAPES.includes('N1')) {
    await loginAs(p, '1900000000004'); await goto(p, '#/manage/owners'); await p.waitForTimeout(600);
    await envoyer('form[data-action="g9-owner"]', {name: 'Test Mandant', phone: '770005555', cni: '12345'}); await p.waitForTimeout(500);
    let r = await erreurSous('form[data-action="g9-owner"]', 'cni');
    T('N1a', r && /13 chiffres/.test(r.msg) && r.ko && r.focus, 'CNI invalide : message sous le champ CNI, champ entouré et sélectionné');
    T('N1b', await p.evaluate(() => document.querySelector('form[data-action="g9-owner"] [name="name"]').value === 'Test Mandant'), 'la saisie est conservée');
    await p.type('form[data-action="g9-owner"] [name="cni"]', '1'); await p.waitForTimeout(200);
    T('N1c', !(await erreurSous('form[data-action="g9-owner"]', 'cni')), 'corriger le champ efface son message');
    await goto(p, '#/agency/clients'); await p.waitForTimeout(600);
    await envoyer('form[data-action="ag-demande"]', {name: 'Client X', phone: '77'}); await p.waitForTimeout(500);
    r = await erreurSous('form[data-action="ag-demande"]', 'phone');
    T('N1d', r && /téléphone/i.test(r.msg), 'téléphone trop court : message sous le champ Téléphone');
    await loginAs(p, '1900000000003'); await goto(p, '#/manage/leases'); await p.waitForTimeout(600);
    await envoyer('form[data-action="g-lease"]', {tenant: 'Awa Diop', phone: '770001234', rent: '0'}); await p.waitForTimeout(500);
    r = await erreurSous('form[data-action="g-lease"]', 'rent');
    T('N1e', r && /loyer mensuel supérieur à 0/.test(r.msg) && !(await erreurSous('form[data-action="g-lease"]', 'tenant')), 'bail : message précis sous le loyer (et non sur le locataire, déjà rempli)');
  }
  if (ETAPES.includes('N2')) {
    await loginAs(p, '1900000000003');
    const id = await p.evaluate(() => myProps(Auth.current()).find(x => x.listingStatus === 'publiee' && x.transaction === 'location').id);
    await goto(p, '#/owner/properties'); await p.waitForTimeout(500);
    await goto(p, '#/owner/property/' + id); await p.waitForTimeout(800);   // clic 1 : « Modifier »
    const b1 = await p.evaluate(() => { const b = document.querySelector('#wiz-end button[value="draft"]'); return b && b.offsetParent !== null ? b.textContent.trim() : null; });
    T('N2a', b1 === 'Enregistrer les modifications', `modification : « ${b1} » disponible dès la 1re étape`);
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(300);   // aller au prix
    await p.fill('#wiz [name="price"]', '333000');
    await p.click('#wiz-end button[value="draft"]'); await p.waitForTimeout(900);   // clic 3 : enregistrer
    const r = await p.evaluate(id => DB.findItem(DB.K.properties, id), id);
    T('N2b', r.price === 333000 && r.listingStatus === 'publiee', 'prix modifié en 3 clics, l\'annonce reste en ligne');
    T('N2c', await p.evaluate(() => !document.querySelector('.modal')), 'pas de récapitulatif de publication à confirmer pour une simple modification');
    await goto(p, '#/owner/property/new'); await p.waitForTimeout(700);
    T('N2d', await p.evaluate(() => document.querySelector('#wiz-end').style.display === 'none'), 'création d\'un bien : l\'assistant complet est conservé');
  }
  if (ETAPES.includes('N3')) {
    await loginAs(p, '1900000000003'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(500);
    T('N3a', await p.evaluate(() => MENUS.owner.some(m => m[0] === '#/owner/visits')), 'propriétaire : entrée « Visites » dans son menu');
    await goto(p, '#/owner/visits'); await p.waitForTimeout(700);
    T('N3b', !!(await p.$('.page-head [data-action="agent-planif"]')), 'propriétaire : bouton « Planifier une visite » sur son écran Visites');
    await p.click('.page-head [data-action="agent-planif"]'); await p.waitForTimeout(400);
    const dem = await p.evaluate(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
    await envoyer('form[data-action="agent-planif-ok"]', {name: 'Fatou Sène', phone: '776543210', date: dem, time: '16:00'}); await p.waitForTimeout(800);
    const v = await p.evaluate(() => DB.getData(DB.K.visits).find(x => x.clientName === 'Fatou Sène'));
    T('N3c', v && v.ownerId === 'user_owner1' && v.status === 'acceptee' && v.source === 'proprietaire', 'visite planifiée par le propriétaire, confirmée d\'office');
    T('N3d', await p.evaluate(() => location.hash === '#/owner/visits' && /Fatou Sène/.test(document.querySelector('#app .content').innerText)), 'elle apparaît dans ses visites avec le nom du client (sans compte)');
    await loginAs(p, '1900000000011'); await goto(p, '#/owner/visits'); await p.waitForTimeout(600);
    T('N3e', await p.evaluate(() => MENUS.owner.some(m => m[0] === '#/owner/visits')) && !!(await p.$('.page-head [data-action="agent-planif"]')), 'le gestionnaire (droit Visites) a aussi l\'entrée et le bouton');
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(1500);   // l'agence ouvre les accès mandants
    await loginAs(p, '1900000000031'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(500);
    T('N3f', await p.evaluate(() => !MENUS.owner.some(m => m[0] === '#/owner/visits')), 'le mandant (biens gérés par l\'agence) n\'a pas d\'entrée Visites');
  }
  if (ETAPES.includes('N4')) {
    await loginAs(p, '1900000000011'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(500);
    const m = await p.evaluate(() => [...document.querySelectorAll('.side nav a[href]')].map(a => a.innerText.trim() + '→' + a.getAttribute('href')));
    T('N4a', m.some(x => /^Travaux→#\/manage\/tickets/.test(x)) && !m.some(x => /^Maintenance/.test(x)), 'gestionnaire : « Travaux », comme chez le propriétaire');
    T('N4b', m.some(x => /^Locataires→#\/manage\/leases/.test(x)), 'gestionnaire : « Locataires » mène au même écran que chez le propriétaire');
    await goto(p, '#/manage/leases'); await p.waitForTimeout(400);
    T('N4c', await p.evaluate(() => location.hash === '#/manage/leases'), 'cet écran lui est bien autorisé');
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(1500);
    await p.setViewportSize({width: 390, height: 844});
    await loginAs(p, '1900000000031'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(600);
    const barre = await p.evaluate(() => [...document.querySelectorAll('.tabbar a')].map(a => a.getAttribute('href')));
    T('N4d', barre.join() === '#/owner/dashboard,#/owner/properties,#/mandant/releves,#/coffre,#/owner/messages', `mandant : barre du bas complète (${barre.length} entrées)`);
    for (const h of barre) { await goto(p, h); await p.waitForTimeout(350); }
    T('N4e', await p.evaluate(() => location.hash === '#/owner/messages'), 'chaque entrée de sa barre s\'ouvre sans refus');
    await p.setViewportSize({width: 1280, height: 900});
  }
  if (ETAPES.includes('I1')) {
    await loginAs(p, '1900000000003');
    const ids = await p.evaluate(() => { const u = Auth.current(), L = gMine('leases', u).filter(l => l.status === 'actif').map(l => l.propertyId);
      const loue = L[0]; DB.updateItem(DB.K.properties, loue, {status: 'loue'});
      const libre = myProps(u).find(x => !L.includes(x.id) && x.status === 'disponible').id;
      const mk = pid => DB.addItem(DB.K.visits, {ownerId: u.id, propertyId: pid, clientId: DB.getData(DB.K.users).find(c => c.role === 'client').id, date: new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10), time: '09:30', status: 'attente'}).id;
      return {loue, libre, v1: mk(loue), v2: mk(libre)}; });
    await goto(p, '#/owner/visits'); await p.waitForTimeout(600);
    await p.evaluate(id => document.querySelector(`[data-action="visit-status"][data-id="${id}"][data-s="acceptee"]`).click(), ids.v1); await p.waitForTimeout(400);
    await p.evaluate(id => document.querySelector(`[data-action="visit-status"][data-id="${id}"][data-s="acceptee"]`).click(), ids.v2); await p.waitForTimeout(400);
    const r = await p.evaluate(ids => [DB.findItem(DB.K.properties, ids.loue).status, DB.findItem(DB.K.properties, ids.libre).status, DB.findItem(DB.K.visits, ids.v1).status], ids);
    T('I1a', r[0] === 'loue' && r[2] === 'acceptee', `visite acceptée sur un bien loué : il reste « loué » (${r[0]})`);
    T('I1b', r[1] === 'discussion', 'sur un bien disponible, il passe bien « En discussion » comme avant');
  }
  if (ETAPES.includes('I2')) {
    await loginAs(p, '1900000000003'); await goto(p, '#/owner/properties'); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const u = Auth.current(); const caches = myProps(u).filter(x => x.listingStatus === 'publiee' && !listable(x)).map(x => x.id), visibles = myProps(u).filter(x => listable(x)).map(x => x.id);
      const badgeDe = id => { const el = document.querySelector(`#app table [data-id="${id}"]`); const tr = el && el.closest('tr'); return tr ? [...tr.querySelectorAll('.badge')].map(b => b.textContent.trim()).join('|') : null; };
      return {caches: caches.map(badgeDe), visibles: visibles.slice(0, 3).map(badgeDe)}; });
    T('I2a', r.caches.length && r.caches.every(b => /Hors ligne · (loué|vendu|aucun lot libre)/.test(b)), `annonces non visibles : « ${r.caches[0]} » au lieu de « Publiée » (${r.caches.length})`);
    T('I2b', r.visibles.every(b => /Publiée/.test(b)), 'annonces réellement en ligne : toujours « Publiée »');
    await loginAs(p, '1900000000001'); await goto(p, '#/admin/dashboard'); await p.waitForTimeout(700);
    const a = await p.evaluate(() => ({tuile: [...document.querySelectorAll('#app .pd-mini')].map(x => x.innerText.replace(/\s+/g, ' ')).find(t => /Annonces publiées/.test(t)), vrai: published().length, tous: DB.getData(DB.K.properties).filter(x => x.listingStatus === 'publiee').length}));
    T('I2c', a.tuile && new RegExp('Annonces publiées ' + a.vrai + ' ').test(a.tuile) && a.vrai < a.tous, `admin : « Annonces publiées » compte les annonces visibles (${a.tuile}) — visibles ${a.vrai}, publiées ${a.tous}`);
  }
  if (ETAPES.includes('I3')) {
    await loginAs(p, '1900000000003');
    const c = await p.evaluate(() => { const u = Auth.current(); return gMine('contracts', u).find(x => x.status === 'actif' && daysBetween(ymd(), x.end) >= 0 && daysBetween(ymd(), x.end) <= 30); });
    const avant = await p.evaluate(() => todoList(Auth.current(), dashStats(Auth.current())).map(t => t[0]).join(' | '));
    await goto(p, '#/manage/contracts'); await p.waitForTimeout(600);
    if (c) await p.evaluate(id => document.querySelector(`[data-action="g3-renew"][data-id="${id}"]`).click(), c.id); await p.waitForTimeout(600);
    const apres = await p.evaluate(() => todoList(Auth.current(), dashStats(Auth.current())).map(t => t[0]).join(' | '));
    T('I3a', c && /contrat/.test(avant) && !/contrat/.test(apres), `contrat renouvelé : il disparaît de « À traiter » (avant : ${avant.match(/\d+ contrats? à renouveler/)}, après : aucun)`);
  }
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
