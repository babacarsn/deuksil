// Partie 4 : mots de passe jamais en clair, connexion, doublons, comptes démo.
const {open, loginAs, goto} = require('./harnais.js');
(async () => {
  const {b, p} = await open(); await p.setViewportSize({width: 1280, height: 900}); await p.waitForTimeout(4800);
  let ok = 0, ko = 0; const T = (id, c, m) => { c ? ok++ : ko++; console.log(`${c ? 'OK  ' : 'ÉCHEC'} ${id}  ${m}`); };
  const brut = () => p.evaluate(() => localStorage.getItem(DB.K.users));

  // S1 — stockage
  let s = await brut();
  T('S1a', !/"password"/.test(s) && !/demo123|admin123/.test(s), 'aucun mot de passe en clair dans le stockage (jeu de démonstration converti)');
  await p.evaluate(() => { localStorage.removeItem(DB.K.session); location.hash = '#/register'; }); await p.waitForTimeout(700);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="register"]'); f.querySelector('input[name="role"][value="owner"]').checked = true;
    Object.entries({cni: '1999999999801', firstName: 'Nouveau', lastName: 'Client', phone: '770009801', password: 'Secret-801', password2: 'Secret-801'}).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; }); f.requestSubmit(); }); await p.waitForTimeout(900);
  s = await brut();
  T('S1b', /1999999999801/.test(s) && !/Secret-801/.test(s), 'inscription : le mot de passe choisi n\'est pas stocké en clair');
  T('S1c', await p.evaluate(() => Auth.login('1999999999801', 'Secret-801').user ? true : false), 'le nouveau compte se connecte avec son mot de passe');
  T('S1d', await p.evaluate(() => { const u = DB.findItem(DB.K.users, x => x.cni === '1999999999801'); return !u.demo && /^v1\$[0-9a-f]{24}\$[0-9a-f]{64}$/.test(u.pwHash); }), 'empreinte salée au bon format ; compte réel non marqué « démo »');
  T('S1e', await p.evaluate(() => { const a = DB.findItem(DB.K.users, x => x.cni === '1900000000003'), c = DB.findItem(DB.K.users, x => x.cni === '1900000000005'); return a.pwHash.split('$')[1] !== c.pwHash.split('$')[1] && a.pwHash !== c.pwHash; }), 'même mot de passe (demo123) : sels et empreintes différents d\'un compte à l\'autre');
  // changement de mot de passe d'un agent
  await loginAs(p, '1900000000012'); await goto(p, '#/agent/profil'); await p.waitForTimeout(600);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="agent-mdp"]'); f.ancien.value = 'demo123'; f.nouveau.value = 'Agent-2026'; f.confirme.value = 'Agent-2026'; f.requestSubmit(); }); await p.waitForTimeout(500);
  s = await brut();
  T('S1f', !/Agent-2026/.test(s) && await p.evaluate(() => { const m = DB.findItem(DB.K.users, x => x.cni === '1900000000012'); return verifierMotDePasse(m, 'Agent-2026') && !verifierMotDePasse(m, 'demo123'); }), 'agent : changement de mot de passe vérifié, nouveau mot de passe stocké en empreinte');
  // membre créé par le propriétaire
  await loginAs(p, '1900000000003'); await goto(p, '#/manage/team'); await p.waitForTimeout(600);
  const membre = await p.evaluate(() => { const f = document.querySelector('form[data-action="g4-member"]'); if (!f) return false;
    Object.entries({cni: '1999999999802', firstName: 'Gest', lastName: 'Ion', phone: '770009802', password: 'Membre-802'}).forEach(([k, v]) => { const i = f.querySelector(`[name="${k}"]`); if (i) i.value = v; });
    const r = f.querySelector('[name="role"]'); if (r) r.value = 'manager'; f.requestSubmit(); return true; }); await p.waitForTimeout(600);
  s = await brut();
  T('S1g', membre && /1999999999802/.test(s) && !/Membre-802/.test(s), 'membre d\'équipe créé : mot de passe stocké en empreinte');

  // S2 — connexion
  const msgs = await p.evaluate(() => [Auth.login('1900000000003', 'faux').error, Auth.login('1999999999000', 'faux').error]);
  T('S2a', msgs[0] === msgs[1] && /Identifiant ou mot de passe incorrect/.test(msgs[0]), 'même message pour un compte inconnu et un mauvais mot de passe');
  const r = await p.evaluate(() => { const out = []; for (let i = 0; i < 5; i++) out.push(Auth.login('1900000000005', 'faux' + i).error); out.push(Auth.login('1900000000005', 'demo123').error || 'connecté'); return out; });
  T('S2b', /Trop d'essais/.test(r[5]) && /Trop d'essais/.test(r[4]), `après 5 essais manqués : pause, même avec le bon mot de passe (« ${r[5]} »)`);
  T('S2c', await p.evaluate(() => !!Auth.login('1900000000006', 'demo123').user), 'les autres comptes ne sont pas bloqués');
  await p.evaluate(() => localStorage.removeItem('deuksil_essais'));
  T('S2d', await p.evaluate(() => !!Auth.login('1900000000005', 'demo123').user), 'après la pause, la connexion fonctionne');
  await p.evaluate(() => { localStorage.removeItem(DB.K.session); location.hash = '#/login'; }); await p.waitForTimeout(700);
  await p.evaluate(() => { const f = document.querySelector('form[data-action="login"]'); const set = (n, v) => { const i = f.querySelector(`[name="${n}"]`); if (i) i.value = v; }; set('cni', 'mamadou.fall@gmail.com'); set('password', 'demo123'); f.requestSubmit(); }); await p.waitForTimeout(900);
  T('S2e', await p.evaluate(() => (Auth.current() || {}).cni === '1900000000003'), 'connexion par le formulaire (adresse Gmail de démonstration + demo123)');

  // S3 — doublons
  await p.evaluate(() => { DB.addItem(DB.K.users, {cni: '1900000000003', firstName: 'Mamadou', lastName: 'Fall (doublon)', phone: '780000099', role: 'owner', status: 'actif', password: 'demo123', ownerRec: 'owner_x'}); });
  await loginAs(p, '1900000000001'); await goto(p, '#/admin/users'); await p.waitForTimeout(800);
  T('S3a', await p.evaluate(() => /doublon/i.test((document.querySelector('#doublons') || {}).innerText || '') && /Même CNI/.test(document.querySelector('#doublons').innerText)), 'admin : le doublon (même CNI) est signalé comme correspondance fiable');
  await p.evaluate(() => document.querySelector('#doublons [data-action="doublon-garder"][data-id="user_owner1"]').click()); await p.waitForTimeout(300);
  await p.evaluate(() => { const b = [...document.querySelectorAll('.modal button')].find(x => /Rapprocher/.test(x.textContent)); b.click(); }); await p.waitForTimeout(600);
  const d = await p.evaluate(() => { const x = DB.getData(DB.K.users).find(u => u.lastName === 'Fall (doublon)'); return {st: x.status, lien: x.doublonDe, garde: DB.findItem(DB.K.users, 'user_owner1').status, biens: DB.filterItems(DB.K.properties, q => q.ownerId === 'user_owner1').length, journal: DB.getData(DB.K.activity).some(a => /doublon rapproché/.test(a.text))}; });
  T('S3b', d.st === 'suspendu' && d.lien === 'user_owner1' && d.garde === 'actif' && d.biens > 0 && d.journal, 'rapprochement : le doublon est suspendu et relié, le compte gardé et ses biens intacts, décision journalisée');
  T('S3c', await p.evaluate(() => !document.querySelector('#doublons')), 'une fois rapproché, le doublon n\'est plus signalé');

  // S4 — démo
  T('S4a', await p.evaluate(() => [...document.querySelectorAll('#app table tbody tr')].some(tr => /Démo/.test(tr.innerText))), 'admin : les comptes de démonstration portent le badge « Démo »');
  T('S4b', await p.evaluate(() => { const tr = [...document.querySelectorAll('#app table tbody tr')].find(t => /Nouveau Client|Client/.test(t.innerText) && t.querySelector('[data-id]') && DB.findItem(DB.K.users, t.querySelector('[data-id]').dataset.id).cni === '1999999999801'); return tr ? !/Démo/.test(tr.innerText) : true; }), 'un compte réel n\'a pas le badge');
  console.log(`\n${ok}/${ok + ko}`, 'erreurs JS', p.errs); await b.close();
})();
