/* ==========================================================================
   MODULE : vie.js — une démonstration qui a déjà vécu.
   À l'ouverture, l'application était techniquement juste mais vide : aucune
   intervention en cours, deux messages, aucune visite traitée. Rien ne
   montrait les échanges entre les rôles, qui sont pourtant le cœur du
   métier. On installe donc un passé plausible : conversations suivies,
   visites à différents stades, interventions en cours et terminées,
   échanges propriétaire-locataire et notifications des deux côtés.
   Les données ne sont posées qu'une fois et ne remplacent jamais
   l'existant : ce que l'utilisateur crée lui-même reste intact.
   ========================================================================== */
const VIE_FLAG = 'deuksil_vie_v1';

const ilYA = j => { const d = new Date(); d.setDate(d.getDate() - j); return d.toISOString(); };
const dansX = j => { const d = new Date(); d.setDate(d.getDate() + j); return d.toISOString().slice(0, 10); };

function seedVie() {
  if (localStorage.getItem(VIE_FLAG)) return;
  const U = r => DB.findItem(DB.K.users, u => u.role === r);
  const tous = r => DB.filterItems(DB.K.users, u => u.role === r);
  const prop = U('owner'), agence = U('agency'), admin = U('admin');
  const clients = tous('client'), loc = U('tenant');
  if (!prop || !agence || !clients.length) return;
  const c1 = clients[0], c2 = clients[1] || clients[0], c3 = clients[2] || clients[0];
  const biens = DB.filterItems(DB.K.properties, p => p.ownerId === prop.id);
  const bAg = DB.filterItems(DB.K.properties, p => p.ownerId === agence.id);
  if (!biens.length) return;
  const b1 = biens[0], b2 = biens[1] || biens[0], b3 = biens[2] || biens[0];
  const bail = loc ? DB.findItem(DB.K.leases, l => l.id === loc.leaseId) : null;

  /* --- 1. Les conversations se poursuivent -------------------------- */
  const fil = DB.findItem(DB.K.messages, m => m.participants && m.participants.includes(c1.id));
  if (fil) {
    const suite = (fil.items || []).concat([
      {senderId: c1.id, text: 'Parfait. Est-ce que samedi 10h vous conviendrait ?', at: ilYA(4)},
      {senderId: prop.id, text: 'Samedi 10h c\'est noté. Le gardien vous ouvrira, je vous rejoins sur place.', at: ilYA(4)},
      {senderId: c1.id, text: 'Merci beaucoup. Y a-t-il une place de parking ?', at: ilYA(3)},
      {senderId: prop.id, text: 'Oui, une place en sous-sol est comprise dans le loyer.', at: ilYA(3)}
    ]);
    DB.updateItem(DB.K.messages, fil.id, {items: suite});
  }
  if (bAg.length) {
    DB.addItem(DB.K.messages, {participants: [c2.id, agence.id], propertyId: bAg[0].id, items: [
      {senderId: c2.id, text: 'Bonjour, le bien est-il négociable sur le prix ?', at: ilYA(6)},
      {senderId: agence.id, text: 'Bonjour. Le propriétaire étudie toute offre sérieuse. Souhaitez-vous visiter ?', at: ilYA(6)},
      {senderId: c2.id, text: 'Oui, je suis disponible en fin de semaine.', at: ilYA(5)}
    ]});
  }

  /* --- 2. Des visites à tous les stades ------------------------------ */
  [[c1, b2, 'acceptee', 'Visite confirmée pour samedi.', dansX(3), '10:00'],
   [c2, b3, 'terminee', 'Visite effectuée, le client réfléchit.', dansX(-6), '16:30'],
   [c3, b1, 'reportee', 'Reporté à la demande du client.', dansX(7), '09:00'],
   [c2, b2, 'refusee', 'Créneau non disponible.', dansX(-2), '14:00']
  ].forEach(([cl, bn, st, msg, d, t]) => {
    DB.addItem(DB.K.visits, {clientId: cl.id, propertyId: bn.id, ownerId: bn.ownerId,
      status: st, message: msg, date: d, time: t});
  });

  /* --- 3. Des interventions en cours et terminées --------------------- */
  const inter = [
    {title: 'Fuite sous l\'évier de la cuisine', category: 'Plomberie', status: 'ouvert', cost: 0,
     note: 'Signalé par le locataire, goutte à goutte continu.'},
    {title: 'Climatiseur du salon en panne', category: 'Climatisation', status: 'en cours', cost: 45000,
     note: 'Technicien passé, pièce commandée.'},
    {title: 'Remplacement de la serrure d\'entrée', category: 'Serrurerie', status: 'résolu', cost: 28000,
     note: 'Serrure changée, deux jeux de clés remis.'}
  ];
  inter.forEach(t => DB.addItem(DB.K.tickets, {ownerId: prop.id, propertyId: b1.id,
    title: t.title, category: t.category, cost: t.cost, status: t.status,
    tenantId: loc ? loc.id : '', note: t.note}));

  /* --- 4. Le propriétaire et son locataire se parlent ----------------- */
  if (bail) {
    [['tenant', 'Bonjour, le climatiseur du salon ne refroidit plus depuis hier.', 7],
     ['owner', 'Bien reçu. J\'envoie un technicien jeudi matin, êtes-vous présent ?', 7],
     ['tenant', 'Oui je serai là jeudi matin, merci.', 6],
     ['owner', 'Le technicien a commandé la pièce, pose prévue en début de semaine.', 2]
    ].forEach(([from, text, j]) => DB.addItem(DB.K.tmsgs, {leaseId: bail.id, from, text, read: j > 3, createdAt: ilYA(j)}));
  }

  /* --- 5. Chacun retrouve ses notifications --------------------------- */
  const notifs = [
    [prop.id, 'Fuite signalée par votre locataire sur « ' + b1.title + ' ».', '#/manage/tickets'],
    [prop.id, 'Visite acceptée : ' + c1.firstName + ' ' + c1.lastName + ' samedi à 10h.', '#/owner/visits'],
    [prop.id, 'Le loyer de ce mois reste à encaisser.', '#/manage/rents'],
    [agence.id, 'Nouvelle demande de visite sur votre portefeuille.', '#/agency/visits'],
    [agence.id, 'Un client a répondu à votre message.', '#/agency/messages'],
    [c1.id, 'Votre visite de samedi 10h est confirmée.', '#/client/visits'],
    [c2.id, 'L\'agence a répondu à votre question.', '#/client/messages']
  ];
  if (loc) notifs.push([loc.id, 'Votre quittance du mois est disponible.', '#/tenant/quittances'],
                       [loc.id, 'Le propriétaire a répondu à votre signalement.', '#/tenant/messages']);
  if (admin) notifs.push([admin.id, 'Des annonces attendent votre validation.', '#/admin/listings']);
  notifs.forEach(([uid, text, link]) => DB.addItem(DB.K.notifications, {userId: uid, text, link, read: false}));

  /* --- 6. Un journal d'activité qui ne part pas de zéro --------------- */
  ['Mamadou Fall a publié une annonce aux Almadies',
   'Tacko Samb a demandé une visite',
   'Une intervention de serrurerie a été clôturée',
   'L\'agence Teranga a enregistré un nouveau mandat',
   'Un loyer de 450 000 FCFA a été encaissé'
  ].forEach(t => DB.addItem(DB.K.activity, {text: t}));

  localStorage.setItem(VIE_FLAG, '1');
}

etapeAmorcage('historique de démonstration', seedVie, true);
setTimeout(() => { try { seedVie(); } catch (e) {} }, 1400);

/* --- Robustesse : une conversation incomplète ne doit pas vider l'écran.
   Un enregistrement sans « participants » (import, donnée corrompue)
   faisait planter la messagerie entière. On les ignore. */
const _msgData = DB.getData.bind(DB);
DB.getData = function (k) {
  const d = _msgData(k);
  if (k === DB.K.messages && Array.isArray(d)) return d.filter(m => m && Array.isArray(m.participants));
  return d;
};
