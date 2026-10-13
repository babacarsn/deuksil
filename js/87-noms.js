/* ==========================================================================
   MODULE : noms.js — noms des comptes féminins du jeu de démonstration.
     Awa Diallo     → Alimatou Gueye  (administratrice)
     Fatou Ndiaye   → Tacko Samb      (cliente et locataire)
     Aminata Ba     → Soda Niang      (cliente)
     Seynabou Diop  → Ndèye Sophie    (propriétaire)
   Le jeu de départ (05-seed, 31-rbac…) porte déjà les nouveaux noms. Ce
   module met à jour une seule fois les données déjà enregistrées dans un
   navigateur : comptes, baux, messages, notifications, journal… partout où
   l'ancien nom complet apparaît.
   ========================================================================== */
const NOMS_V1 = [
  ['Awa Diallo', 'Alimatou Gueye', 'Alimatou', 'Gueye'],
  ['Fatou Ndiaye', 'Tacko Samb', 'Tacko', 'Samb'],
  ['Aminata Ba', 'Soda Niang', 'Soda', 'Niang'],
  ['Seynabou Diop', 'Ndèye Sophie', 'Ndèye', 'Sophie']
];
function renommerComptes() {
  try {
    if (localStorage.getItem('deuksil_noms_v1')) return;
    const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const cles = []; for (let i = 0; i < localStorage.length; i++) cles.push(localStorage.key(i));
    cles.filter(k => /^deuksil/i.test(k) && k !== DB.K.session).forEach(k => {
      const brut = localStorage.getItem(k); if (!brut) return;
      let s = brut;
      NOMS_V1.forEach(([avant, apres, prenom, nom]) => {
        const [p0, n0] = avant.split(' ');
        s = s.replace(new RegExp(esc(avant), 'g'), apres)
             .replace(new RegExp(`"firstName":"${esc(p0)}","lastName":"${esc(n0)}"`, 'g'), `"firstName":"${prenom}","lastName":"${nom}"`);
      });
      s = s.replace(/Bonjour Fatou,/g, 'Bonjour Tacko,');
      if (s !== brut) localStorage.setItem(k, s);
    });
    /* Les comptes dont prénom et nom sont rangés dans un autre ordre. */
    DB.getData(DB.K.users).forEach(u => NOMS_V1.forEach(([avant, , prenom, nom]) => {
      if (`${u.firstName} ${u.lastName}` === avant) DB.updateItem(DB.K.users, u.id, {firstName: prenom, lastName: nom});
    }));
    localStorage.setItem('deuksil_noms_v1', '1');
  } catch (e) { /* données illisibles : on laisse en l'état */ }
}
renommerComptes();
