// Groupe A : sept compléments faisables sans serveur. ETAPES=A1,A2… limite.
const {open, loginAs, goto} = require('./harnais.js');
const fs = require('fs'), {execSync} = require('child_process'), path = require('path');
const JSPDF = process.env.JSPDF || '/tmp/claude-0/-home-claude/e421a70a-480c-5630-9578-e2fc923618de/scratchpad/jspdf/package/dist/jspdf.umd.min.js';
const ETAPES = (process.env.ETAPES || 'A1,A2,A3,A4,A5,A6').split(',');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const remplir = (sel, vals, envoyer = true) => p.evaluate(([sel, vals, envoyer]) => { const f = document.querySelector(sel); if (!f) return false; Object.entries(vals).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; }); if (envoyer) f.requestSubmit(f.querySelector('button:not([type=button])') || undefined); return true; }, [sel, vals, envoyer]);

  if (ETAPES.includes('A1')) {
    for (const [cni, page, ancien] of [['1900000000003', '#/owner/profile', 'demo123'], ['1900000000005', '#/client/profile', 'demo123'], ['1900000000002', '#/client/profile', 'demo123'], ['1900000000004', '#/agency/settings', 'demo123'], ['1900000000001', '#/admin/settings', 'admin123']]) {
      await loginAs(p, cni); await goto(p, page); await p.waitForTimeout(1000);
      const carte = await p.evaluate(() => !!document.querySelector('form[data-action="mdp-change"]'));
      await remplir('form[data-action="mdp-change"]', {ancien: 'faux', nouveau: 'Nouveau-1', confirme: 'Nouveau-1'}); await p.waitForTimeout(900);
      const refuse = await p.evaluate(c => verifierMotDePasse(DB.findItem(DB.K.users, x => x.cni === c), 'faux') === false && !verifierMotDePasse(DB.findItem(DB.K.users, x => x.cni === c), 'Nouveau-1'), cni);
      await remplir('form[data-action="mdp-change"]', {ancien, nouveau: 'Nouveau-1', confirme: 'Nouveau-1'}); await p.waitForTimeout(1200);
      const change = await p.evaluate(c => verifierMotDePasse(DB.findItem(DB.K.users, x => x.cni === c), 'Nouveau-1'), cni);
      T('A1-' + page.split('/')[1] + '-' + cni.slice(-3), carte && refuse && change, `${page} : carte présente, ancien mot de passe vérifié, nouveau enregistré`);
    }
    await loginAs(p, '1900000000005'); await goto(p, '#/client/profile'); await p.waitForTimeout(500);
    await remplir('form[data-action="mdp-change"]', {ancien: 'Nouveau-1', nouveau: 'demo123', confirme: 'demo123'}); await p.waitForTimeout(300);
    T('A1-demo', await p.evaluate(() => verifierMotDePasse(DB.findItem(DB.K.users, x => x.cni === '1900000000005'), 'Nouveau-1')), 'le mot de passe de démonstration est refusé comme nouveau mot de passe');
    await loginAs(p, '1900000000012'); await goto(p, '#/client/profile'); await p.waitForTimeout(400);
    T('A1-membre', await p.evaluate(() => !document.querySelector('form[data-action="mdp-change"]')), 'un membre d\'équipe garde sa page « Mon profil » (pas de carte qui changerait le mot de passe du compte principal)');
  }
  if (ETAPES.includes('A1')) {
    await loginAs(p, '1900000000011'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(500);
    const m = await p.evaluate(() => [...document.querySelectorAll('.side nav a[href]')].map(a => a.getAttribute('href')));
    await goto(p, '#/agent/profil'); await p.waitForTimeout(500);
    T('A1-gestionnaire', m.includes('#/agent/profil') && await p.evaluate(() => !!document.querySelector('form[data-action="agent-mdp"]')), 'le gestionnaire accède à « Mon profil » depuis son menu et peut changer son mot de passe');
  }
  if (ETAPES.includes('A2')) {
    // Une vraie agence s'inscrit, puis enregistre un propriétaire mandant.
    await p.evaluate(() => { localStorage.removeItem(DB.K.session); location.hash = '#/register'; }); await p.waitForTimeout(700);
    await p.evaluate(() => { const f = document.querySelector('form[data-action="register"]'); f.querySelector('input[name="role"][value="agency"]').checked = true;
      Object.entries({cni: '1999999999701', firstName: 'Awa', lastName: 'Agence', phone: '770009701', password: 'Agence-701', password2: 'Agence-701', agencyName: 'Keur Immo'}).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; }); f.requestSubmit(); }); await p.waitForTimeout(900);
    await goto(p, '#/manage/owners'); await p.waitForTimeout(600);
    await remplir('form[data-action="g9-owner"]', {name: 'Modou Diagne', phone: '771119701', cni: '1999999999702', rate: '8'}); await p.waitForTimeout(1500);
    const vu1 = await p.evaluate(() => (document.querySelector('.mdp-prov') || {}).textContent || '');
    // Fenêtre fermée trop vite : l'agence régénère un mot de passe depuis la liste.
    await p.evaluate(() => { try { closeModal(); } catch (e) {} }); await goto(p, '#/agency/dashboard'); await goto(p, '#/manage/owners'); await p.waitForTimeout(800);
    const bouton = await p.$('[data-action="mdp-regenerer"]');
    if (bouton) { await bouton.click(); await p.waitForTimeout(600); }
    T('A2g', !!vu1 && !!bouton, `mot de passe affiché à la création (${vu1}) ; l'agence peut en régénérer un depuis la liste`);
    const vu = await p.evaluate(() => ({modal: (document.querySelector('.modal') || {}).innerText || '', mdp: (document.querySelector('.mdp-prov') || {}).textContent || ''}));
    const compte = await p.evaluate(() => DB.findItem(DB.K.users, x => x.cni === '1999999999702'));
    T('A2a', /Accès créé/.test(vu.modal) && /^[A-Za-z0-9]{5}-[A-Za-z0-9]{5}$/.test(vu.mdp) && compte && compte.mdpProvisoire && !compte.demo, `l'agence voit une seule fois le mot de passe provisoire (${vu.mdp})`);
    T('A2b', !(await p.evaluate(() => localStorage.getItem(DB.K.users))).includes(vu.mdp) && await p.evaluate(([m, m1]) => { const c = DB.findItem(DB.K.users, x => x.cni === '1999999999702'); return verifierMotDePasse(c, m) && !verifierMotDePasse(c, m1) && !verifierMotDePasse(c, 'demo123'); }, [vu.mdp, vu1]), 'jamais stocké en clair ; le nouveau remplace l\'ancien ; « demo123 » ne fonctionne pas pour ce compte');
    await p.evaluate(() => { try { closeModal(); } catch (e) {} localStorage.removeItem(DB.K.session); });
    const conn = await p.evaluate(m => Auth.login('1999999999702', m), vu.mdp);
    await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
    T('A2c', conn.user && await p.evaluate(() => location.hash === '#/mot-de-passe' && !!document.querySelector('form[data-action="mdp-premier"]')), 'première connexion : il doit d\'abord choisir son mot de passe');
    await goto(p, '#/mandant/releves'); await p.waitForTimeout(500);
    T('A2d', await p.evaluate(() => location.hash === '#/mot-de-passe'), 'impossible d\'aller ailleurs avant');
    await remplir('form[data-action="mdp-premier"]', {nouveau: 'Modou-2026', confirme: 'Modou-2026'}); await p.waitForTimeout(700);
    const apres = await p.evaluate(m => { const c = DB.findItem(DB.K.users, x => x.cni === '1999999999702'); return {h: location.hash, prov: c.mdpProvisoire, nouveau: verifierMotDePasse(c, 'Modou-2026'), ancien: verifierMotDePasse(c, m)}; }, vu.mdp);
    T('A2e', apres.h !== '#/mot-de-passe' && !apres.prov && apres.nouveau && !apres.ancien, 'son mot de passe est enregistré, le provisoire ne fonctionne plus, il accède à son espace');
    // Agence de démonstration : la démo reste utilisable.
    await loginAs(p, '1900000000004'); await goto(p, '#/manage/owners'); await p.waitForTimeout(600);
    await remplir('form[data-action="g9-owner"]', {name: 'Démo Mandant', phone: '771119703', cni: '1999999999703', rate: '8'}); await p.waitForTimeout(1500);
    await goto(p, '#/agency/dashboard'); await p.waitForTimeout(1500);
    T('A2f', await p.evaluate(() => { const c = DB.findItem(DB.K.users, x => x.cni === '1999999999703'); return c && c.demo && !c.mdpProvisoire && verifierMotDePasse(c, 'demo123'); }), 'agence de démonstration : le compte créé garde « demo123 » (démo inchangée)');
  }
  if (ETAPES.includes('A3')) {
    const tid = await p.evaluate(() => DB.addItem(DB.K.properties, {ownerId: 'user_owner1', title: 'Terrain test vérification', type: 'terrain', transaction: 'terrain', price: 25000000, surface: 500, region: 'Thiès', city: 'Mbour', quartier: 'Saly', status: 'disponible', listingStatus: 'publiee', photos: [],
      foncier: {statut: 'Titre foncier (TF)', reference: 'TF 77/MB', viabilisation: ['Eau'], documents: ['Plan cadastral / bornage'], verification: 'declaratif'}}).id);
    await loginAs(p, '1900000000001'); await goto(p, '#/admin/verifications'); await p.waitForTimeout(800);
    T('A3a', await p.evaluate(() => /Terrain test vérification/.test((document.querySelector('#terrains-a-verifier') || {}).innerText || '')), 'admin : le terrain apparaît dans « Terrains : vérification foncière »');
    await p.evaluate(id => document.querySelector(`[data-action="foncier-verifier"][data-id="${id}"]`).click(), tid); await p.waitForTimeout(400);
    await p.evaluate(() => document.querySelector('form[data-action="foncier-verifier-ok"]').requestSubmit()); await p.waitForTimeout(400);
    T('A3b', await p.evaluate(id => DB.findItem(DB.K.properties, id).foncier.verification === 'declaratif' && !!document.querySelector('.modal'), tid), 'les trois contrôles sont exigés avant de marquer vérifié');
    await p.evaluate(() => { const f = document.querySelector('form[data-action="foncier-verifier-ok"]'); f.querySelectorAll('input[type=checkbox]').forEach(c => c.checked = true); f.requestSubmit(); }); await p.waitForTimeout(500);
    const v = await p.evaluate(id => ({fo: DB.findItem(DB.K.properties, id).foncier, notif: DB.getData(DB.K.notifications).some(n => n.userId === 'user_owner1' && /est vérifié par DEUKSIL/.test(n.text)), journal: DB.getData(DB.K.activity).some(a => /terrain « Terrain test vérification » vérifié/.test(a.text))}), tid);
    T('A3c', v.fo.verification === 'verifie' && v.notif && v.journal, 'terrain vérifié : annonceur prévenu, décision journalisée');
    await goto(p, '#/property/' + tid); await p.waitForTimeout(600);
    T('A3d', await p.evaluate(() => /Vérifié par DEUKSIL/.test((document.querySelector('#infos-foncieres') || {}).innerText || '')), 'la fiche publique affiche « Vérifié par DEUKSIL »');
    await loginAs(p, '1900000000003'); await goto(p, '#/owner/property/' + tid); await p.waitForTimeout(800);
    await p.click('#wiz-end button[value="draft"]'); await p.waitForTimeout(700);
    T('A3e', await p.evaluate(id => DB.findItem(DB.K.properties, id).foncier.verification === 'verifie', tid), 'modifier l\'annonce sans toucher au foncier : la vérification est conservée');
    await goto(p, '#/owner/property/' + tid); await p.waitForTimeout(800);
    await p.click('[data-action="wiz-next"]'); await p.waitForTimeout(300);
    await p.evaluate(() => { document.querySelector('#wiz [name="refFonciere"]').value = 'TF 99/MB'; });
    await p.click('#wiz-end button[value="draft"]'); await p.waitForTimeout(700);
    T('A3f', await p.evaluate(id => DB.findItem(DB.K.properties, id).foncier.verification === 'declaratif', tid), 'changer la référence foncière fait tomber la vérification');
    await loginAs(p, '1900000000001'); await goto(p, '#/admin/verifications'); await p.waitForTimeout(700);
    await p.evaluate(id => document.querySelector(`[data-action="foncier-refuser"][data-id="${id}"]`).click(), tid); await p.waitForTimeout(300);
    await p.evaluate(() => { const f = document.querySelector('form[data-action="foncier-refuser-ok"]'); f.motif.value = 'Référence introuvable aux Domaines'; f.requestSubmit(); }); await p.waitForTimeout(500);
    T('A3g', await p.evaluate(id => { const fo = DB.findItem(DB.K.properties, id).foncier; return fo.verification === 'refuse' && /introuvable/.test(fo.motif) && DB.getData(DB.K.notifications).some(n => n.userId === 'user_owner1' && /non accordée/.test(n.text)); }, tid), 'refus avec motif communiqué à l\'annonceur');
  }
  if (ETAPES.includes('A4') && fs.existsSync(JSPDF)) {
    /* jsPDF vient d'Internet (cdnjs) : servi ici depuis une copie locale. */
    await p.route('https://cdnjs.cloudflare.com/ajax/libs/jspdf/**', r => r.fulfill({body: fs.readFileSync(JSPDF), contentType: 'application/javascript'}));
    const telecharger = async sel => { const [dl] = await Promise.all([p.waitForEvent('download', {timeout: 15000}), p.click(sel)]); const f = path.join('/tmp', 'a4-' + dl.suggestedFilename()); await dl.saveAs(f);
      return {nom: dl.suggestedFilename(), texte: execSync(`pdftotext -layout "${f}" -`).toString()}; };
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(500);
    const l = await p.evaluate(() => { const u = Auth.current(), l = gMine('leases', u).find(x => x.status === 'actif' && +x.deposit > 0);
      DB.addItem(DB.K.edl, {ownerId: u.id, leaseId: l.id, kind: 'entree', date: '2026-02-01', pieces: [{etat: 'bon', rq: 'Peinture neuve'}, {etat: 'bon', rq: ''}, {etat: 'moyen', rq: 'Évier rayé'}, {etat: 'bon', rq: ''}, {etat: 'bon', rq: ''}], elec: '01234', eau: '0567', cles: 3});
      const so = DB.addItem(DB.K.edl, {ownerId: u.id, leaseId: l.id, kind: 'sortie', date: '2026-10-01', pieces: [{etat: 'moyen', rq: 'Traces au mur'}, {etat: 'bon', rq: ''}, {etat: 'mauvais', rq: 'Évier cassé'}, {etat: 'bon', rq: ''}, {etat: 'bon', rq: ''}], elec: '04567', eau: '0890', cles: 3});
      const f = honoraireBail(u, l); return {id: l.id, tenant: l.tenant, dep: l.deposit, fee: f && f.ref, sortie: so.id}; });
    await goto(p, '#/manage/leases'); await p.waitForTimeout(600);
    await p.evaluate(id => { const b = document.querySelector(`[data-action="ag-suivi"][data-id="${id}"]`); b.click(); }, l.id); await p.waitForTimeout(500);
    let r = await telecharger(`.suivi-docs [data-action="g6-pdf"][data-id="EDL-${l.sortie}"]`);
    T('A4a', /ÉTAT DES LIEUX/.test(r.texte) && /Sortie/.test(r.texte) && /Évier cassé/.test(r.texte) && /Usure normale/.test(r.texte) && r.texte.includes(l.tenant), `état des lieux de sortie (${r.nom}) : pièces, entrée et sortie comparées, compteurs`);
    r = await telecharger('.suivi-docs [data-action="g6-pdf"][data-id^="CAU-"]');
    T('A4b', /REÇU DE CAUTION/.test(r.texte) && r.texte.replace(/\s/g, '').includes(String(l.dep).replace(/\B(?=(\d{3})+(?!\d))/g, '')) && /n'est pas un loyer/.test(r.texte), `reçu de caution (${r.nom}) : montant et mention « n'est pas un loyer »`);
    await p.evaluate(() => { try { closeModal(); } catch (e) {} });
    await goto(p, '#/agency/commissions'); await p.waitForTimeout(700);
    r = await telecharger(`[data-action="g6-pdf"][data-id="${l.fee}"]`);
    T('A4c', /FACTURE/.test(r.texte) && r.texte.includes(l.fee) && /Frais de location/.test(r.texte) && /Total TTC/.test(r.texte), `facture d'honoraires ${l.fee} : désignation, HT, TVA, TTC`);
    await p.evaluate(id => { const u = Auth.current(); const x = DB.findItem(DB.K.leases, id); DB.updateItem(DB.K.leases, id, {status: 'termine', cautionStatut: 'restituee', cautionRendue: +x.deposit - 50000, cautionRendueLe: '2026-10-05', retenues: [{motif: 'Évier cassé', montant: 50000}]}); }, l.id);
    await goto(p, '#/manage/leases'); await p.waitForTimeout(500);
    const nom = await p.evaluate(id => { const f = pdfFor('CAU-' + id, Auth.current()); return f && f[1].name; }, l.id);
    await p.evaluate(id => { const b = document.createElement('button'); b.dataset.action = 'g6-pdf'; b.dataset.id = 'CAU-' + id; b.id = 'cau-test'; document.querySelector('#app .content').appendChild(b); }, l.id);
    r = await telecharger('#cau-test');
    T('A4d', /RESTITUTION DE CAUTION/.test(r.texte) && /Évier cassé/.test(r.texte) && /Montant restitué/.test(r.texte), 'caution restituée : le reçu détaille les retenues et le montant rendu');
    await loginAs(p, '1900000000012');
    T('A4e', await p.evaluate(fee => { const h = pdfFor(fee, Auth.current()); return !h || (Auth.current().member && !Auth.current().perms.includes(h[0])); }, l.fee), 'un agent (sans droit Finances) ne peut pas générer la facture d\'honoraires');
  }
  if (ETAPES.includes('A5')) {
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/clients'); await p.waitForTimeout(600);
    const ag = await p.evaluate(() => DB.findItem(DB.K.users, x => x.cni === '1900000000012').id);
    await p.evaluate(ag => DB.addItem(DB.K.demandes, {ownerId: Auth.current().id, name: 'Aminata Ba', phone: '775551234', transaction: 'location', type: 'appartement', budget: 400000, lieu: 'Ouakam', rooms: 2, agentId: ag, status: 'active', createdAt: now()}), ag);
    await p.waitForTimeout(300);
    const n0 = await p.evaluate(ag => DB.getData(DB.K.notifications).filter(n => n.userId === ag && /Aminata Ba/.test(n.text)).length, ag);
    T('A5a', n0 === 0, 'à la création de la demande : pas d\'alerte pour les biens déjà affichés');
    await p.evaluate(() => DB.addItem(DB.K.properties, {ownerId: Auth.current().id, title: 'Appartement F3 à Ouakam', type: 'appartement', transaction: 'location', price: 350000, surface: 90, rooms: 3, baths: 2, region: 'Dakar', city: 'Dakar', commune: 'Ouakam', quartier: 'Ouakam', status: 'disponible', listingStatus: 'publiee', photos: []}));
    await p.waitForTimeout(400);
    const n1 = await p.evaluate(ag => DB.getData(DB.K.notifications).filter(n => n.userId === ag && /Aminata Ba/.test(n.text) && /Ouakam/.test(n.text)), ag);
    T('A5b', n1.length === 1 && /#\/agency\/clients/.test(n1[0].link), 'nouveau bien correspondant : l\'agent qui suit la cliente est prévenu, avec un lien vers ses demandes');
    await p.evaluate(() => DB.addItem(DB.K.properties, {ownerId: Auth.current().id, title: 'Villa à Ouakam trop chère', type: 'appartement', transaction: 'location', price: 2500000, surface: 300, rooms: 5, region: 'Dakar', city: 'Dakar', quartier: 'Ouakam', status: 'disponible', listingStatus: 'publiee', photos: []}));
    await goto(p, '#/agency/dashboard'); await goto(p, '#/agency/clients'); await p.waitForTimeout(500);
    const n2 = await p.evaluate(ag => DB.getData(DB.K.notifications).filter(n => n.userId === ag && /Aminata Ba/.test(n.text)).length, ag);
    T('A5c', n2 === 1, 'hors budget : pas d\'alerte ; et pas de doublon d\'alerte en naviguant');
  }
  if (ETAPES.includes('A6')) {
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(1500);
    const fiche = await p.evaluate(() => { const o = DB.getData(DB.K.owners).find(x => x.ownerId === Auth.current().id && DB.findItem(DB.K.users, u => u.ownerRec === x.id)); return {id: o.id, cni: DB.findItem(DB.K.users, u => u.ownerRec === o.id).cni}; });
    // Une vente signée sur un bien du mandant, honoraires à la charge du vendeur.
    const vente = await p.evaluate(fid => { const u = Auth.current(); const b = DB.getData(DB.K.properties).find(x => x.clientOwnerId === fid);
      const d = DB.addItem(DB.K.deals, {ownerId: u.id, propertyId: b.id, buyer: 'Ibou Faye', offer: 50000000, price: 50000000, stage: 'signe', signedAt: ymd()}); const f = honoraireVente(u, d); return {prix: prixVente(d), ttc: f.ttc, payer: f.payer}; }, fiche.id);
    await loginAs(p, fiche.cni); await goto(p, '#/mandant/releves'); await p.waitForTimeout(800);
    const t1 = await p.evaluate(() => document.querySelector('#app .content').innerText.replace(/\s+/g, ' '));
    const enc1 = await p.evaluate(() => (document.querySelector('#app .kpis') || {}).innerText.replace(/\s+/g, ' '));
    T('A6a', /dont TVA/.test(t1), 'relevé : la TVA comprise dans la commission de gestion est indiquée');
    const net = (vente.prix - vente.ttc).toLocaleString('fr-FR').replace(/\s/g, ' ');
    T('A6b', /Ventes conclues par l'agence/.test(t1) && /Ibou Faye/.test(t1) && t1.replace(/[\s  ]/g, '').includes(String(vente.prix - vente.ttc).replace(/\B(?=(\d{3})+(?!\d))/g, '')), `relevé : vente avec honoraires à la charge du vendeur déduits (net ${vente.prix - vente.ttc})`);
    // Clôture de la relation : l'historique reste dans le relevé.
    await p.evaluate(fid => { DB.filterItems(DB.K.properties, x => x.clientOwnerId === fid).forEach(x => DB.updateItem(DB.K.properties, x.id, {clientOwnerId: '', exClientOwnerId: fid})); DB.updateItem(DB.K.owners, fid, {status: 'close', closedAt: ymd()}); }, fiche.id);
    await goto(p, '#/owner/dashboard'); await goto(p, '#/mandant/releves'); await p.waitForTimeout(800);
    const enc2 = await p.evaluate(() => (document.querySelector('#app .kpis') || {}).innerText.replace(/\s+/g, ' '));
    T('A6c', enc1 && enc1 === enc2 && !/^0 FCFA/.test(enc2), `relation close : le relevé garde son historique (« ${enc2.slice(0, 60)}… »)`);
    // Reconduction tacite
    await loginAs(p, '1900000000003');
    const bail = await p.evaluate(() => { const u = Auth.current(); const prop = myProps(u).find(x => x.transaction === 'location' && !gMine('leases', u).some(l => l.propertyId === x.id && l.status === 'actif'));
      const start = new Date(Date.now() - 400 * 864e5).toISOString().slice(0, 10);
      const l = DB.addItem(DB.K.leases, {ownerId: u.id, propertyId: prop.id, tenant: 'Pape Diouf', phone: '770004455', rent: 200000, deposit: 400000, start, months: 12, dueDay: 5, status: 'actif'}); return l.id; });
    await goto(p, '#/owner/dashboard'); await goto(p, '#/manage/leases'); await p.waitForTimeout(500);
    T('A6d', await p.evaluate(id => DB.findItem(DB.K.leases, id).months === 12, bail), 'réglage désactivé (par défaut) : un bail échu n\'est pas prolongé');
    await goto(p, '#/owner/profile'); await p.waitForTimeout(600);
    await p.evaluate(() => { const f = document.querySelector('form[data-action="regles-proprio"]'); f.reconductionTacite.checked = true; f.requestSubmit(); }); await p.waitForTimeout(500);
    await goto(p, '#/manage/leases'); await p.waitForTimeout(600);
    const r = await p.evaluate(id => { const l = DB.findItem(DB.K.leases, id); return {m: l.months, loyers: DB.filterItems(DB.K.rents, x => x.leaseId === id).length, notif: DB.getData(DB.K.notifications).some(n => /Pape Diouf reconduit/.test(n.text)), audit: gMine('audit', Auth.current()).some(a => /reconduit/.test(a.action))}; }, bail);
    T('A6e', r.m === 24 && r.loyers === 12 && r.notif && r.audit, `réglage activé : bail reconduit 12 mois, 12 échéances créées, bailleur prévenu, journalisé (${JSON.stringify(r)})`);
    await goto(p, '#/owner/dashboard'); await goto(p, '#/manage/leases'); await p.waitForTimeout(400);
    T('A6f', await p.evaluate(id => DB.findItem(DB.K.leases, id).months === 24, bail), 'pas de double reconduction en naviguant');
    await loginAs(p, '1900000000004'); await goto(p, '#/agency/settings'); await p.waitForTimeout(600);
    T('A6g', await p.evaluate(() => !!document.querySelector('form[data-action="ag-regles"] [name="reconductionTacite"]')), 'le réglage figure aussi dans les règles de l\'agence');
  }
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
