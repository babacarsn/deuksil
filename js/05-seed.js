/* ==========================================================================
   MODULE : seed.js — jeu de démonstration (100 % fictif)
   CNI fictives : format 13 chiffres commençant par 19 (aucune CNI réelle).
   ========================================================================== */
const SEED_VERSION = '1.0.0';

/* ---------- Amorçage ----------
   Le jeu de base est posé une fois (ou à la réinitialisation). Les modules
   suivants y ajoutent leurs données en déclarant une étape, au lieu
   d'envelopper seedIfNeeded : la liste ETAPES_AMORCAGE dit dans quel ordre
   tout s'exécute. Chaque étape vérifie elle-même si elle a déjà été jouée.
   Une étape « tolérante » n'interrompt pas les suivantes si elle échoue. */
const ETAPES_AMORCAGE = [];
function etapeAmorcage(nom, fn, tolerante = false) { ETAPES_AMORCAGE.push({nom, fn, tolerante}); }
function seedIfNeeded(force) {
  seedBase(force);
  for (const e of ETAPES_AMORCAGE) {
    if (!e.tolerante) { e.fn(); continue; }
    try { e.fn(); } catch (err) { console.warn(`Amorçage « ${e.nom} » ignoré :`, err); }
  }
}
function seedBase(force) {
  if (!force && localStorage.getItem(DB.K.seed) === SEED_VERSION) return;
  DB.reset();

  const U = [
    {id:'user_admin',   cni:'1900000000001', firstName:'Awa',     lastName:'Diallo',  phone:'+221 77 000 00 01', password:'admin123',  role:'admin',  status:'actif'},
    {id:'user_client1', cni:'1900000000002', firstName:'Fatou',   lastName:'Ndiaye',  phone:'+221 77 000 00 02', password:'demo123',   role:'client', status:'actif'},
    {id:'user_client2', cni:'1900000000005', firstName:'Ibrahima',lastName:'Sarr',    phone:'+221 76 000 00 05', password:'demo123',   role:'client', status:'actif'},
    {id:'user_client3', cni:'1900000000006', firstName:'Aminata', lastName:'Ba',      phone:'+221 70 000 00 06', password:'demo123',   role:'client', status:'actif'},
    {id:'user_owner1',  cni:'1900000000003', firstName:'Mamadou', lastName:'Fall',    phone:'+221 78 000 00 03', password:'demo123',   role:'owner',  status:'actif'},
    {id:'user_owner2',  cni:'1900000000007', firstName:'Seynabou',lastName:'Diop',    phone:'+221 77 000 00 07', password:'demo123',   role:'owner',  status:'actif'},
    {id:'user_agency1', cni:'1900000000004', firstName:'Cheikh',  lastName:'Gueye',   phone:'+221 33 000 00 04', password:'demo123',   role:'agency', status:'actif',
      agencyName:'Teranga Immobilier', agencyDesc:"Agence généraliste implantée à Dakar depuis 2016 : location, vente et gestion locative.", address:'Rue 10 x Corniche, Almadies, Dakar', plan:'BUSINESS'},
    {id:'user_agency2', cni:'1900000000008', firstName:'Nafissatou', lastName:'Sow',  phone:'+221 33 000 00 08', password:'demo123',   role:'agency', status:'suspendu',
      agencyName:'Sahel Properties', agencyDesc:'Spécialiste des terrains à Thiès et Mbour.', address:'Avenue Lamine Gueye, Thiès', plan:'STARTER'}
  ];
  U.forEach(u => DB.addItem(DB.K.users, {...u, registrationPaid:true, createdAt: addDays(now(), -(40 + hash(u.id) % 300))}));

  /* --- Biens : 22 annonces réparties au Sénégal --- */
  const P = [
    ['Appartement lumineux aux Almadies','appartement','location',450000,'Dakar','Dakar','Dakar','Almadies',120,3,2,'user_owner1','disponible','publiee'],
    ['Villa contemporaine avec piscine','villa','location',1200000,'Dakar','Dakar','Dakar','Ngor',280,5,4,'user_agency1','disponible','publiee'],
    ['Studio meublé à Mermoz','studio','location',150000,'Dakar','Dakar','Dakar','Mermoz',35,1,1,'user_owner1','disponible','publiee'],
    ['Appartement F3 à Sacré-Cœur 3','appartement','location',275000,'Dakar','Dakar','Dakar','Sacré-Cœur',85,2,1,'user_owner2','discussion','publiee'],
    ['Maison familiale à Yoff','maison','location',380000,'Dakar','Dakar','Dakar','Yoff',160,4,2,'user_agency1','disponible','publiee'],
    ['Chambre indépendante aux Parcelles','chambre','location',65000,'Dakar','Dakar','Dakar','Parcelles Assainies',18,1,1,'user_owner2','loue','publiee'],
    ['Bureau équipé au Plateau','bureau','location',700000,'Dakar','Dakar','Dakar','Plateau',140,0,2,'user_agency1','disponible','publiee'],
    ['Appartement neuf à Ouakam','appartement','vente',85000000,'Dakar','Dakar','Dakar','Ouakam',110,3,2,'user_owner1','disponible','publiee'],
    ['Villa duplex au Point E','villa','vente',175000000,'Dakar','Dakar','Dakar','Point E',300,6,4,'user_agency1','disponible','publiee'],
    ['Maison à rénover à Rufisque','maison','vente',42000000,'Dakar','Rufisque','Rufisque','Rufisque Est',180,4,2,'user_owner2','disponible','publiee'],
    ['Terrain 300 m² à Mbour','terrain','terrain',9000000,'Thiès','Mbour','Mbour','Mbour Centre',300,0,0,'user_owner1','disponible','publiee'],
    ['Terrain viabilisé à Saly','terrain','terrain',18000000,'Thiès','Mbour','Mbour','Saly',400,0,0,'user_agency1','disponible','publiee'],
    ['Terrain agricole à Thiès','terrain','terrain',6500000,'Thiès','Thiès','Thiès','Grand Thiès',1000,0,0,'user_owner2','disponible','publiee'],
    ['Villa de vacances à Saly','villa','location',900000,'Thiès','Mbour','Mbour','Saly',220,4,3,'user_agency1','disponible','publiee'],
    ['Appartement à Saint-Louis Sor','appartement','location',180000,'Saint-Louis','Saint-Louis','Saint-Louis','Sor',75,2,1,'user_owner2','disponible','publiee'],
    ['Maison à Touba Darou Khoudoss','maison','vente',38000000,'Diourbel','Touba','Touba','Darou Khoudoss',200,5,3,'user_owner1','disponible','publiee'],
    ['Local commercial à Kaolack','local commercial','location',250000,'Kaolack','Kaolack','Kaolack','Léona',90,0,1,'user_agency1','disponible','publiee'],
    ['Appartement vue mer à Ziguinchor','appartement','location',220000,'Ziguinchor','Ziguinchor','Ziguinchor','Boucotte',95,3,2,'user_owner2','disponible','publiee'],
    ['Studio à Pikine Nord','studio','location',90000,'Dakar','Pikine','Pikine','Pikine Nord',28,1,1,'user_owner1','disponible','publiee'],
    ['Villa avec jardin à Golf Sud','villa','vente',95000000,'Dakar','Guédiawaye','Guédiawaye','Golf Sud',260,5,3,'user_agency1','vendu','publiee'],
    ['Appartement F4 aux Almadies','appartement','location',650000,'Dakar','Dakar','Dakar','Almadies',150,4,3,'user_owner1','disponible','attente'],
    ['Terrain 500 m² à Bargny','terrain','terrain',12000000,'Dakar','Rufisque','Rufisque','Bargny',500,0,0,'user_owner2','disponible','attente']
  ];
  P.forEach((r, i) => {
    const [title, type, transaction, price, region, city, commune, quartier, surface, rooms, baths, ownerId, status, listingStatus] = r;
    DB.addItem(DB.K.properties, {
      id: 'property_' + String(i + 1).padStart(3, '0'),
      title, type, transaction, price, region, city, commune, quartier, surface, rooms, baths, ownerId, status, listingStatus,
      description: `${title}. Bien ${transaction === 'terrain' ? 'foncier' : 'immobilier'} situé à ${quartier}, ${city}. `
        + `Environnement calme, accès facile aux transports et commerces. Dossier vérifié par l'équipe DEUKSIL. `
        + `${transaction === 'location' ? 'Caution de deux mois demandée à la signature.' : 'Documents administratifs disponibles sur demande.'}`,
      amenities: AMENITIES.filter((_, k) => (hash(title) >> k) % 3 === 0).slice(0, 5),
      furnished: /meublé|studio/i.test(title), parking: hash(title) % 2 === 0,
      views: 40 + hash(title) % 420, contacts: hash(title) % 22, availableFrom: addDays(now(), hash(title) % 30),
      createdAt: addDays(now(), -(3 + hash(title) % 120))
    });
  });

  /* --- Agents d'agence --- */
  [['Ousmane','Diagne','+221 77 111 11 11','1900000000101','Agent commercial','actif'],
   ['Khady','Mbaye','+221 78 222 22 22','1900000000102','Responsable location','actif'],
   ['Moussa','Sy','+221 76 333 33 33','1900000000103','Agent terrain','inactif']]
    .forEach(([firstName, lastName, phone, cni, role, status]) =>
      DB.addItem(DB.K.agents, {agencyId:'user_agency1', firstName, lastName, phone, cni, role, status}));

  /* --- Favoris, visites, messages, notifications --- */
  ['property_001','property_003','property_011'].forEach(pid =>
    DB.addItem(DB.K.favorites, {userId:'user_client1', propertyId:pid}));
  DB.addItem(DB.K.favorites, {userId:'user_client2', propertyId:'property_002'});

  [['user_client1','property_001','user_owner1','attente','Bonjour, je souhaite visiter samedi matin.'],
   ['user_client1','property_004','user_owner2','acceptee','Disponible en fin de journée.'],
   ['user_client2','property_002','user_agency1','terminee','Visite effectuée avec l\'agent.'],
   ['user_client3','property_005','user_agency1','attente','Je viens avec ma famille.']]
    .forEach(([clientId, propertyId, ownerId, status, message], i) =>
      DB.addItem(DB.K.visits, {clientId, propertyId, ownerId, status, message,
        date: addDays(now(), 2 + i).slice(0, 10), time: ['10:00','16:30','11:00','09:30'][i],
        createdAt: addDays(now(), -(i + 1))}));

  DB.addItem(DB.K.messages, {
    participants:['user_client1','user_owner1'], propertyId:'property_001',
    items:[
      {senderId:'user_client1', text:'Bonjour, le bien des Almadies est-il toujours disponible ?', at: addDays(now(), -2)},
      {senderId:'user_owner1',  text:'Bonjour Fatou, oui il est disponible. Souhaitez-vous une visite ?', at: addDays(now(), -2)},
      {senderId:'user_client1', text:'Avec plaisir, plutôt le week-end.', at: addDays(now(), -1)}
    ]
  });
  DB.addItem(DB.K.messages, {
    participants:['user_client2','user_agency1'], propertyId:'property_002',
    items:[{senderId:'user_client2', text:'La villa de Ngor est-elle meublée ?', at: addDays(now(), -3)},
           {senderId:'user_agency1', text:'Oui, entièrement meublée et équipée.', at: addDays(now(), -3)}]
  });

  DB.addItem(DB.K.searches, {userId:'user_client1', name:'Appartement Dakar', criteria:{transaction:'location', type:'appartement', region:'Dakar', min:200000, max:500000, rooms:2}});

  /* --- Paiements & abonnements --- */
  const pay = (userId, type, amount, method, status, dayOffset) => DB.addItem(DB.K.payments, {
    ref: payRef(dayOffset), userId, type, amount, method, status, createdAt: addDays(now(), dayOffset)});


  notify('user_owner1', 'Nouvelle demande de visite pour « Appartement lumineux aux Almadies ».', '#/owner/visits');
  notify('user_client1', 'Votre demande de visite a été acceptée.', '#/client/visits');
  notify('user_admin',  '2 annonces attendent votre validation.', '#/admin/listings');

  ['Fatou Ndiaye a créé un compte client','Mamadou Fall a publié une annonce','Teranga Immobilier a publié deux annonces','Une visite a été confirmée à Sacré-Cœur']
    .forEach((text, i) => DB.addItem(DB.K.activity, {text, createdAt: addDays(now(), -i)}));

  localStorage.setItem(DB.K.seed, SEED_VERSION);
}

function payRef(dayOffset = 0) {
  const d = new Date(Date.now() + dayOffset * 86400000);
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `DZL-${ymd}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}
function notify(userId, text, link) { DB.addItem(DB.K.notifications, {userId, text, read: false, link: link || ''}); }
function roleLink(userId, path) { const u = DB.findItem(DB.K.users, userId); return `#/${u ? u.role : 'client'}/${path}`; }
function logActivity(text) { DB.addItem(DB.K.activity, {text}); }

/* Nettoyage en cascade : ce que les messages de confirmation promettent doit être réellement fait. */
function cascadeDeleteProperty(propertyId) {
  DB.getData(DB.K.units).filter(x => x.propertyId === propertyId).forEach(x => DB.deleteItem(DB.K.units, x.id));
  DB.getData(DB.K.tickets).filter(x => x.propertyId === propertyId).forEach(x => DB.deleteItem(DB.K.tickets, x.id));
  /* Un bail en cours est clôturé à la date du jour : les loyers échus impayés restent dus. */
  DB.getData(DB.K.leases).filter(l => l.propertyId === propertyId && l.status === 'actif').forEach(l => terminerBail(l, ymd()));
  DB.getData(DB.K.favorites).filter(f => f.propertyId === propertyId).forEach(f => DB.deleteItem(DB.K.favorites, f.id));
  DB.getData(DB.K.visits).filter(v => v.propertyId === propertyId).forEach(v => DB.deleteItem(DB.K.visits, v.id));
  DB.deleteItem(DB.K.properties, propertyId);
}
function cascadeDeleteUser(userId) {
  const mine = DB.getData(DB.K.leases).filter(l => l.ownerId === userId).map(l => l.id);
  DB.getData(DB.K.tmsgs).filter(m => mine.includes(m.leaseId)).forEach(m => DB.deleteItem(DB.K.tmsgs, m.id));
  ['leases', 'rents', 'units', 'tickets', 'docs', 'fpay', 'expenses', 'contracts', 'providers', 'owners', 'audit', 'iassets', 'programs', 'lots'].forEach(k => DB.getData(DB.K[k]).filter(x => x.ownerId === userId).forEach(x => DB.deleteItem(DB.K[k], x.id)));
  DB.getData(DB.K.users).filter(x => x.parentId === userId || x.ownerRef === userId).forEach(x => DB.deleteItem(DB.K.users, x.id));
  DB.filterItems(DB.K.properties, p => p.ownerId === userId).forEach(p => cascadeDeleteProperty(p.id));
  DB.getData(DB.K.messages).filter(t => t.participants.includes(userId)).forEach(t => DB.deleteItem(DB.K.messages, t.id));
  DB.getData(DB.K.favorites).filter(f => f.userId === userId).forEach(f => DB.deleteItem(DB.K.favorites, f.id));
  DB.getData(DB.K.visits).filter(v => v.clientId === userId || v.ownerId === userId).forEach(v => DB.deleteItem(DB.K.visits, v.id));
  DB.getData(DB.K.notifications).filter(n => n.userId === userId).forEach(n => DB.deleteItem(DB.K.notifications, n.id));
  DB.getData(DB.K.searches).filter(s => s.userId === userId).forEach(s => DB.deleteItem(DB.K.searches, s.id));
  DB.getData(DB.K.documents).filter(d => d.ownerId === userId).forEach(d => DB.deleteItem(DB.K.documents, d.id));
  DB.getData(DB.K.agents).filter(a => a.agencyId === userId).forEach(a => DB.deleteItem(DB.K.agents, a.id));
  DB.deleteItem(DB.K.users, userId);
}
/* Vérifications de propriété : ce qu'un backend devra imposer côté serveur, modélisé ici côté client. */
function ownsProperty(propertyId, u) {
  const p = DB.findItem(DB.K.properties, propertyId);
  if (!p) { toast('Ce bien est introuvable.', 'bad'); return null; }
  if (p.ownerId !== u.id) { toast('Ce bien ne vous appartient pas.', 'bad'); return null; }
  return p;
}
function ownsAgent(agentId, u) {
  const a = DB.findItem(DB.K.agents, agentId);
  if (!a) { toast('Cet agent est introuvable.', 'bad'); return null; }
  if (a.agencyId !== u.id) { toast('Cet agent ne fait pas partie de votre agence.', 'bad'); return null; }
  return a;
}
