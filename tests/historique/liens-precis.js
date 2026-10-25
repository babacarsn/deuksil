// Chaque raccourci mène à la bonne section, déjà filtrée : on clique comme un
// utilisateur, puis on vérifie ce qui est réellement affiché.
const {open, loginAs, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  await p.evaluate(() => { window.__toasts = []; const t = toast; toast = function (m, ton) { window.__toasts.push([String(m), ton || 'ok']); return t.apply(this, arguments); }; });
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const cliquer = async (re, ou = '#app') => {
    const h = await p.evaluateHandle(([re, ou]) => [...document.querySelectorAll(ou + ' a[href], ' + ou + ' button')].find(a => a.offsetParent && new RegExp(re, 'i').test(a.innerText.replace(/\s+/g, ' '))), [re.source, ou]);
    const el = h.asElement(); if (!el) return null;
    const href = await el.evaluate(a => a.getAttribute('href'));
    await p.evaluate(() => { window.__toasts = []; });
    await el.click(); await p.waitForTimeout(900); return href || '(bouton)';
  };
  const visibles = () => p.evaluate(() => [...document.querySelectorAll('#app .content table tbody tr')].filter(tr => tr.style.display !== 'none' && !tr.closest('.modal')).map(tr => [...tr.querySelectorAll('.badge')].map(b => b.textContent.trim()).join('/') + ' ' + tr.textContent.replace(/\s+/g, ' ').slice(0, 60)));
  const refus = () => p.evaluate(() => window.__toasts.some(t => t[1] === 'bad'));
  const focus = () => p.evaluate(() => { const a = document.activeElement; const f = a && a.closest('form, .card'); return f ? (f.querySelector('h3, h4') || {}).textContent || f.dataset.action : ''; });

  // Propriétaire
  await loginAs(p, '1900000000003'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(800);
  let h = await cliquer(/\d+ loyers? en retard/);
  let v = await visibles();
  T('P1', /manage\/rents\?f=retard/.test(h) && v.length && v.every(x => /En retard/.test(x)), `« loyers en retard » → loyers filtrés (${v.length} lignes, toutes en retard)`);
  T('P1b', await p.evaluate(() => (document.querySelector('.rchip.on') || {}).dataset.id === 'retard'), 'le bouton « En retard » est actif');
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(300); await goto(p, '#/manage/rents'); await p.waitForTimeout(600);
  T('P2', (await visibles()).length > (v.length), 'en revenant sur Loyers sans précision, tout est de nouveau affiché');
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/demandes? de maintenance/); v = await visibles();
  console.log('   P3', h, v);
  T('P3', /tickets\?f=encours/.test(h) && v.length && v.every(x => !/Fermé|Résolu/.test(x)), `« demandes de maintenance » → travaux en cours seulement (${v.length})`);
  T('P3b', await p.evaluate(() => /Filtré/.test((document.querySelector('.lien-filtre') || {}).textContent || '')), 'bandeau « Filtré : En cours · Tout afficher »');
  await p.click('[data-action="lien-tout"]'); await p.waitForTimeout(300);
  T('P3c', (await visibles()).length > v.length && !(await p.$('.lien-filtre')), '« Tout afficher » rétablit la liste');
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/contrats? à renouveler/); v = await visibles();
  T('P4', /contracts\?f=renouveler/.test(h) && v.length && v.every(x => /xpir/.test(x)), `« contrat à renouveler » → contrats qui expirent (${v.length})`);
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/demandes? de visite.*confirmer|confirmer ou refuser/); v = await visibles();
  T('P5', /visits\?f=confirmer/.test(h) && v.length && v.every(x => /En attente/.test(x)), `« demande de visite à confirmer » → visites en attente (${v.length})`);
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/^Ajouter un locataire/);
  T('P6', /leases\?form=/.test(h) && /Nouveau bail/i.test(await focus()), `« Ajouter un locataire » → formulaire « Nouveau bail » prêt (focus : ${await focus()})`);
  await goto(p, '#/owner/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/^Ajouter un document/);
  T('P7', /coffre\?ouvrir=g7-add/.test(h) && !!(await p.$('.modal')), '« Ajouter un document » → fenêtre d\'ajout ouverte');
  await goto(p, '#/manage'); await p.waitForTimeout(700);
  h = await cliquer(/Messages locataires/);
  T('P8', h === '#/owner/messages' && await p.evaluate(() => location.hash === '#/owner/messages'), '« Messages locataires » (Gestion) → Messages directement');

  // Gestionnaire (membre sans droit Finances)
  await loginAs(p, '1900000000011'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(800);
  const liensRefus = await p.evaluate(() => [...document.querySelectorAll('#app a[href]')].map(a => a.getAttribute('href')).filter(h => /manage\/(finance|fpay|docs|expenses|reports)(\?|$)/.test(h)));
  T('G1', !liensRefus.length, `aucun lien vers une page interdite (${liensRefus.join(', ') || 'aucun'})`);
  h = await cliquer(/Voir le détail des revenus|Total encaissé/);
  T('G2', !(await refus()), `le raccourci revenus ne mène plus à « Accès non autorisé » (${h})`);

  // Agence
  await loginAs(p, '1900000000004'); await goto(p, '#/agency/dashboard'); await p.waitForTimeout(800);
  h = await cliquer(/demandes? de visite.*confirmer|confirmer ou refuser/); v = await visibles();
  T('A1', /visits\?f=confirmer/.test(h) && v.every(x => /En attente/.test(x)), `agence : visites à confirmer (${v.length})`);
  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/^Créer une facture/);
  T('A2', /docs\?ouvrir=g2-new/.test(h) && await p.evaluate(() => /facture/i.test((document.querySelector('.modal') || {}).textContent || '')), '« Créer une facture » → fenêtre de facture ouverte');
  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/^Ajouter un propriétaire/);
  T('A3', /owners\?form=/.test(h) && /propriétaire/i.test(await focus()), `« Ajouter un propriétaire » → formulaire prêt (${await focus()})`);
  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/Encaissé ce mois/); v = await visibles();
  T('A4', /rents\?f=paye/.test(h) && v.every(x => /Payé/.test(x)), `« Encaissé ce mois » → loyers encaissés (${v.length})`);

  await goto(p, '#/agency/dashboard'); await p.waitForTimeout(700);
  h = await cliquer(/^Encaisser un loyer/); v = await visibles();
  T('A5', /f=nonpaye/.test(h) && v.length && v.every(x => /En retard|À venir/.test(x)) && v.some(x => /En retard/.test(x)), `« Encaisser un loyer » → loyers non payés, retards compris (${v.length})`);
  await goto(p, '#/manage'); await p.waitForTimeout(600);
  T('A6', await p.evaluate(() => [...document.querySelectorAll('#app a[href^="#/manage/"]')].every(a => !a.getAttribute('href').includes('?'))), 'les rubriques de Gestion ouvrent la rubrique entière (sans filtre)');
  T('A7', await p.evaluate(() => [...document.querySelectorAll('.sidebar a[href], .tabbar a[href]')].every(a => !a.getAttribute('href').includes('?'))), 'le menu n\'est pas filtré');
  // Admin
  await loginAs(p, '1900000000001'); await goto(p, '#/admin/dashboard'); await p.waitForTimeout(800);
  h = await cliquer(/comptes? suspendus?/); v = await visibles();
  T('D1', /users\?f=suspendu/.test(h) && v.length && v.every(x => /suspendu/.test(x)), `« comptes suspendus » → utilisateurs suspendus (${v.length})`);

  // Locataire
  await loginAs(p, '1900000000002'); await goto(p, '#/tenant/home'); await p.waitForTimeout(800);
  h = await cliquer(/Loyer de \S+ \d{4} en retard/); v = await visibles();
  T('L1', /tenant\/rents\?q=/.test(h) && v.length === 1, `« Loyer de … en retard » → la ligne de ce mois (${v.length} ligne : ${v[0] || ''})`);
  await goto(p, '#/tenant/home'); await p.waitForTimeout(700);
  h = await cliquer(/^Loyers en retard/); v = await visibles();
  T('L2', /f=retard/.test(h) && v.length && v.every(x => /En retard/.test(x)), `« Loyers en retard » → loyers en retard (${v.length})`);
  await goto(p, '#/tenant/home'); await p.waitForTimeout(700);
  h = await cliquer(/Fin du bail/);
  T('L3', h === '#/coffre/contrats', `« Fin du bail » → ses contrats (${h})`);

  // Mandant : bail bientôt échu → le bail de la personne
  await loginAs(p, '1900000000201'); await goto(p, '#/owner/dashboard'); await p.waitForTimeout(800);
  h = await cliquer(/bail bientôt échu/); v = await visibles();
  T('M1', /leases\?q=/.test(h) && v.length === 1, `« bail bientôt échu » → ce bail seulement (${v.length})`);
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
