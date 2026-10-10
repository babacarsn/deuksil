/* ==========================================================================
   MODULE : jeu-de-test.js — davantage de monde pour tester.
   Le jeu de base ne comptait que deux propriétaires, un locataire et une
   vingtaine de biens, presque tous à Dakar. On ajoute, une seule fois et
   sans rien effacer :
   - 4 propriétaires, répartis sur le territoire ;
   - 26 biens couvrant les 14 régions (location, vente, terrain) ;
   - 9 locataires, chacun avec son bail, ses loyers (payés, en retard) et
     son compte pour se connecter.
   Tous les comptes ont le mot de passe demo123. Données 100 % fictives.
   « Réinitialiser la démonstration » les recrée avec le reste.
   ========================================================================== */
DB.K.jeuTest = 'deuksil_jeu_test_v1';

const JT_PROPRIETAIRES = [
  // cni, prénom, nom, téléphone, adresse
  ['1900000000201', 'Ousmane', 'Ndiaye', '+221 77 201 20 01', 'Cité Lamy, Thiès'],
  ['1900000000202', 'Mariama', 'Sow', '+221 76 202 20 02', 'Sor, Saint-Louis'],
  ['1900000000203', 'Abdoulaye', 'Diatta', '+221 78 203 20 03', 'Boucotte, Ziguinchor'],
  ['1900000000204', 'Khadija', 'Mbengue', '+221 70 204 20 04', 'Mermoz, Dakar']
];

/* propriétaire (cni) ; titre ; type ; transaction ; prix ; région ; ville ; quartier ; surface ; ch. ; sdb ; locataire (index) */
const JT_BIENS = [
  ['1900000000204', 'Appartement F3 à Fann', 'appartement', 'location', 400000, 'Dakar', 'Dakar', 'Fann', 105, 3, 2, 0],
  ['1900000000204', 'Studio meublé à Liberté 6', 'studio', 'location', 130000, 'Dakar', 'Dakar', 'Liberté 6', 30, 1, 1, 1],
  ['1900000000204', 'Villa R+1 à Keur Massar', 'villa', 'vente', 48000000, 'Dakar', 'Keur Massar', 'Keur Massar Nord', 250, 5, 3],
  ['1900000000204', 'Appartement F2 à Grand Yoff', 'appartement', 'location', 200000, 'Dakar', 'Dakar', 'Grand Yoff', 65, 2, 1],
  ['1900000000204', 'Terrain 250 m² à Diamniadio', 'terrain', 'terrain', 15000000, 'Dakar', 'Rufisque', 'Diamniadio', 250, 0, 0],
  ['1900000000201', 'Maison à Cité Lamy', 'maison', 'location', 230000, 'Thiès', 'Thiès', 'Cité Lamy', 170, 4, 2, 2],
  ['1900000000201', 'Appartement à Mboro', 'appartement', 'location', 120000, 'Thiès', 'Tivaouane', 'Mboro', 80, 2, 1],
  ['1900000000201', 'Villa pieds dans l\'eau à Somone', 'villa', 'vente', 120000000, 'Thiès', 'Mbour', 'Somone', 320, 5, 4],
  ['1900000000201', 'Chambre meublée à Bambey', 'chambre', 'location', 45000, 'Diourbel', 'Bambey', 'Bambey Centre', 16, 1, 1, 3],
  ['1900000000201', 'Maison à Mbacké', 'maison', 'vente', 28000000, 'Diourbel', 'Mbacké', 'Mbacké Centre', 210, 5, 2],
  ['1900000000201', 'Terrain 400 m² à Fatick', 'terrain', 'terrain', 4500000, 'Fatick', 'Fatick', 'Fatick Centre', 400, 0, 0],
  ['1900000000201', 'Maison avec cour à Sokone', 'maison', 'location', 110000, 'Fatick', 'Foundiougne', 'Sokone', 140, 3, 1, 4],
  ['1900000000202', 'Appartement colonial à Saint-Louis Nord', 'appartement', 'location', 210000, 'Saint-Louis', 'Saint-Louis', 'Nord', 90, 2, 1, 5],
  ['1900000000202', 'Maison à Richard-Toll', 'maison', 'location', 150000, 'Saint-Louis', 'Dagana', 'Richard-Toll', 150, 3, 2],
  ['1900000000202', 'Local commercial à Louga', 'local commercial', 'location', 180000, 'Louga', 'Louga', 'Louga Centre', 70, 0, 1, 6],
  ['1900000000202', 'Terrain 600 m² à Kébémer', 'terrain', 'terrain', 3500000, 'Louga', 'Kébémer', 'Kébémer Centre', 600, 0, 0],
  ['1900000000202', 'Villa à Ourossogui', 'villa', 'vente', 35000000, 'Matam', 'Matam', 'Ourossogui', 240, 4, 3],
  ['1900000000202', 'Maison à Kanel', 'maison', 'location', 90000, 'Matam', 'Kanel', 'Kanel Centre', 130, 3, 1],
  ['1900000000203', 'Villa à Lyndiane', 'villa', 'location', 300000, 'Ziguinchor', 'Ziguinchor', 'Lyndiane', 200, 4, 3, 7],
  ['1900000000203', 'Case de vacances à Cap Skirring', 'maison', 'vente', 55000000, 'Ziguinchor', 'Oussouye', 'Cap Skirring', 160, 3, 2],
  ['1900000000203', 'Appartement à Sédhiou', 'appartement', 'location', 100000, 'Sédhiou', 'Sédhiou', 'Sédhiou Centre', 70, 2, 1],
  ['1900000000203', 'Terrain 500 m² à Kolda', 'terrain', 'terrain', 3000000, 'Kolda', 'Kolda', 'Sikilo', 500, 0, 0],
  ['1900000000203', 'Maison à Vélingara', 'maison', 'location', 85000, 'Kolda', 'Vélingara', 'Vélingara Centre', 120, 3, 1],
  ['1900000000004', 'Appartement F3 à Tambacounda', 'appartement', 'location', 160000, 'Tambacounda', 'Tambacounda', 'Médina Coura', 85, 3, 1, 8],
  ['1900000000004', 'Villa à Kédougou', 'villa', 'location', 250000, 'Kédougou', 'Kédougou', 'Kédougou Centre', 190, 4, 2],
  ['1900000000003', 'Bureau à Kaffrine', 'bureau', 'location', 150000, 'Kaffrine', 'Kaffrine', 'Kaffrine Centre', 60, 0, 1]
];

/* cni ; prénom ; nom ; téléphone ; début du bail (il y a N mois) ; loyers impayés en fin de période */
const JT_LOCATAIRES = [
  ['1900000000301', 'Astou', 'Faye', '+221 77 301 30 01', 7, 0],
  ['1900000000302', 'Pape', 'Sarr', '+221 76 302 30 02', 4, 1],
  ['1900000000303', 'Ndèye', 'Thiam', '+221 78 303 30 03', 10, 0],
  ['1900000000304', 'Modou', 'Ka', '+221 70 304 30 04', 3, 2],
  ['1900000000305', 'Coumba', 'Sène', '+221 77 305 30 05', 6, 0],
  ['1900000000306', 'Babacar', 'Gaye', '+221 76 306 30 06', 9, 1],
  ['1900000000307', 'Rokhaya', 'Diouf', '+221 78 307 30 07', 5, 0],
  ['1900000000308', 'Lamine', 'Badji', '+221 77 308 30 08', 8, 0],
  ['1900000000309', 'Aïda', 'Kane', '+221 70 309 30 09', 2, 1]
];

const jtSansAccent = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
const jtMail = (p, n) => (typeof emailLibre === 'function' ? emailLibre : b => b + '@gmail.com')(jtSansAccent(p) + '.' + jtSansAccent(n));
const jtMois = (d, k) => { const x = new Date(d.getFullYear(), d.getMonth() + k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`; };

function seedJeuDeTest() {
  if (localStorage.getItem(DB.K.jeuTest)) return;
  const parCni = cni => DB.findItem(DB.K.users, u => u.cni === cni);

  /* 1. Propriétaires */
  JT_PROPRIETAIRES.forEach(([cni, firstName, lastName, phone, address], i) => {
    if (parCni(cni)) return;
    DB.addItem(DB.K.users, {cni, firstName, lastName, phone, address, password: 'demo123', role: 'owner', status: 'actif',
      registrationPaid: true, agencyName: '', agencyDesc: '', email: jtMail(firstName, lastName),
      createdAt: addDays(now(), -(60 + i * 37))});
  });

  /* 2. Biens */
  const crees = JT_BIENS.map((b, i) => {
    const [cni, title, type, transaction, price, region, city, quartier, surface, rooms, baths] = b;
    const owner = parCni(cni); if (!owner) return null;
    return DB.addItem(DB.K.properties, {
      ownerId: owner.id, title, type, transaction, price, region, city, commune: city, quartier, surface, rooms, baths,
      status: 'disponible', listingStatus: 'publiee', photos: [],
      description: `${title}. ${transaction === 'terrain' ? 'Parcelle' : 'Bien'} situé à ${quartier}, ${city} (région de ${region}). `
        + `${transaction === 'location' ? 'Caution de deux mois demandée à la signature.' : 'Documents administratifs disponibles sur demande.'}`,
      amenities: AMENITIES.filter((_, k) => (hash(title) >> k) % 3 === 0).slice(0, 5),
      furnished: /meublé|meublée/i.test(title), parking: hash(title) % 2 === 0,
      views: 25 + hash(title) % 300, contacts: hash(title) % 15,
      availableFrom: addDays(now(), hash(title) % 20).slice(0, 10),
      createdAt: addDays(now(), -(5 + (i * 7) % 150))
    });
  });

  /* 3. Locataires : bail, loyers, compte */
  const auj = new Date(now());
  JT_BIENS.forEach((b, i) => {
    const idx = b[11], bien = crees[i];
    if (idx === undefined || !bien) return;
    const [cni, firstName, lastName, phone, depuis, impayes] = JT_LOCATAIRES[idx];
    if (parCni(cni)) return;
    const debut = new Date(auj.getFullYear(), auj.getMonth() - depuis, 1);
    const start = `${jtMois(debut, 0)}-01`, months = 12, dueDay = 5;
    const bail = DB.addItem(DB.K.leases, {ownerId: bien.ownerId, propertyId: bien.id, tenant: `${firstName} ${lastName}`,
      phone, rent: bien.price, deposit: bien.price * 2, start, months, dueDay, status: 'actif', createdAt: start + 'T09:00:00.000Z'});
    /* loyers échus : tous payés sauf les « impayes » derniers */
    const echus = depuis + 1;   // du mois de début au mois courant inclus
    for (let k = 0; k < months; k++) {
      const month = jtMois(debut, k), paye = k < echus - impayes && k < echus;
      const jour = String(2 + (k + idx) % 6).padStart(2, '0');
      DB.addItem(DB.K.rents, {ownerId: bien.ownerId, leaseId: bail.id, month, amount: bien.price,
        paidAt: paye ? [`${month}-${jour}T10:00:00.000Z`, now()].sort()[0] : null});   // jamais dans le futur
    }
    DB.updateItem(DB.K.properties, bien.id, {status: 'loue'});
    DB.addItem(DB.K.users, {cni, firstName, lastName, phone, password: 'demo123', role: 'tenant', status: 'actif',
      registrationPaid: true, leaseId: bail.id, leaseIds: [bail.id], ownerRef: bien.ownerId,
      email: jtMail(firstName, lastName), agencyName: '', address: '', agencyDesc: '',
      createdAt: start + 'T09:00:00.000Z'});
  });

  localStorage.setItem(DB.K.jeuTest, '1');
}
etapeAmorcage('jeu de test étendu', seedJeuDeTest, true);

/* Quelques-uns de ces comptes sur l'écran de connexion */
if (typeof DEMO_ACCOUNTS !== 'undefined') {
  DEMO_ACCOUNTS.splice(3, 0,
    ['Propriétaire à Thiès (6 biens, 2 locataires)', '1900000000201', 'demo123'],
    ['Propriétaire à Saint-Louis, Louga et Matam', '1900000000202', 'demo123'],
    ['Locataire en retard de 2 loyers', '1900000000304', 'demo123'],
    ['Locataire à jour', '1900000000301', 'demo123']);
}
