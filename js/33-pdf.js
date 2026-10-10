/* ==========================================================================
   MODULE : pdf.js — documents PDF (devis, proforma, facture, avoir, reçu,
   quittance, contrat) avec le logo DEUKSIL. jsPDF chargé à la demande (cdnjs).
   ========================================================================== */
const PDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let _pdfLoad = null;
const loadJsPdf = () => window.jspdf ? Promise.resolve() : (_pdfLoad = _pdfLoad || new Promise((ok, ko) => {
  const s = document.createElement('script'); s.src = PDF_URL; s.onload = ok; s.onerror = () => { _pdfLoad = null; ko(new Error('pdf')); }; document.head.appendChild(s);
}));
/* jsPDF veut le logo en data URL : on lit le fichier une fois, au premier PDF. */
let LOGO_PDF = null;
const loadLogoPdf = () => LOGO_PDF ? Promise.resolve() : fetch(LOGO_DARK).then(r => r.blob())
  .then(b => new Promise(ok => { const f = new FileReader(); f.onload = () => { LOGO_PDF = f.result; ok(); }; f.onerror = () => ok(); f.readAsDataURL(b); }))
  .catch(() => {});
const loadPdf = () => Promise.all([loadJsPdf(), loadLogoPdf()]).then(() => {});
const logoPdf = (doc, x, y, w, h) => { if (LOGO_PDF) try { doc.addImage(LOGO_PDF, 'PNG', x, y, w, h); } catch (e) {} };
const NAVY = [15, 48, 87], GOLD = [180, 134, 63], INK = [16, 27, 38], MUT = [116, 132, 150], SOFT = [231, 237, 244];
const T = s => String(s ?? '').replace(/[\u202f\u00a0]/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/→/g, '->').replace(/²/g, '2').replace(/[^\x00-\xff\u2013\u2014]/g, '?');
const fc = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA';
const d8 = s => { const x = String(s || '').slice(0, 10).split('-'); return x.length === 3 ? `${x[2]}/${x[1]}/${x[0]}` : '—'; };
const UN = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'], DIZ = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante'];
const lt100 = n => n < 20 ? UN[n] : n < 70 ? DIZ[Math.floor(n / 10)] + (n % 10 === 1 ? ' et un' : n % 10 ? '-' + UN[n % 10] : '') : n < 80 ? 'soixante' + (n === 71 ? ' et onze' : '-' + UN[n - 60]) : 'quatre-vingt' + (n === 80 ? 's' : '-' + UN[n - 80]);
const lt1000 = n => { const c = Math.floor(n / 100), r = n % 100; let s = c ? (c > 1 ? UN[c] + ' ' : '') + 'cent' + (c > 1 && !r ? 's' : '') : ''; return r ? (s ? s + ' ' : '') + lt100(r) : s; };
function enLettres(n) {
  n = Math.round(n); if (!n) return 'zéro'; const m = Math.floor(n / 1e6), k = Math.floor(n % 1e6 / 1000), r = n % 1000, p = [];
  if (m) p.push(m > 1 ? lt1000(m) + ' millions' : 'un million'); if (k) p.push(k === 1 ? 'mille' : lt1000(k).replace(/(vingt|cent)s$/, '$1') + ' mille'); if (r) p.push(lt1000(r)); return p.join(' ');
}
const ownerLabel = u => { const P = u.member ? DB.findItem(DB.K.users, u.member.parentId) || u : u; return P.role === 'agency' ? P.agencyName : `${P.firstName} ${P.lastName}`; };
function issuer(u) {
  const i = u.docInfo || {};
  return {name: i.name || (ownerLabel(u)), address: i.address || u.address || '', phone: i.phone || (u.member ? (DB.findItem(DB.K.users, u.member.parentId) || {}).phone : u.phone) || '', email: i.email || u.email || '', ninea: i.ninea || '', rccm: i.rccm || '', bank: i.bank || '', terms: i.terms || ''};
}
const issuerLines = I => [I.name, I.address, I.phone && 'Tél : ' + I.phone, I.email, [I.ninea && 'NINEA ' + I.ninea, I.rccm && 'RCCM ' + I.rccm].filter(Boolean).join(' · ')].filter(Boolean);

function pdfBegin(kind, ref, date, title) {
  const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4', compress: true}); doc.setProperties({title: title || ref, creator: 'DEUKSIL', author: 'DEUKSIL'});
  logoPdf(doc, 15, 10, 13, 13.6);
  doc.setFont('helvetica', 'bold').setFontSize(17).setTextColor(...NAVY).text('DEUKSIL', 31, 17.5);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUT).text('Plateforme immobilière du Sénégal', 31, 22);
  doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY).text(T(kind), 195, 18, {align: 'right'});
  doc.setFontSize(10).setTextColor(...GOLD).text(T(ref), 195, 24, {align: 'right'});
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUT).text('Date : ' + d8(date), 195, 29, {align: 'right'});
  doc.setDrawColor(...GOLD).setLineWidth(.6).line(15, 33, 195, 33); return [doc, 40];
}
function pdfParties(doc, y, A, B) {
  const w = 87; doc.setFontSize(9); const wrap = p => p.lines.flatMap((l, i) => doc.splitTextToSize(T(l), w - 8).map(t => [t, !i])), LA = wrap(A), LB = wrap(B), h = Math.max(LA.length, LB.length) * 4.4 + 11;
  [[A, 15, LA], [B, 108, LB]].forEach(([p, x, L]) => {
    doc.setFillColor(...SOFT).roundedRect(x, y, w, h, 2, 2, 'F'); doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(...GOLD).text(T(p.t).toUpperCase(), x + 4, y + 5.5);
    L.forEach(([t, b], i) => { doc.setFont('helvetica', b ? 'bold' : 'normal').setFontSize(9).setTextColor(...INK).text(t, x + 4, y + 11 + i * 4.4); });
  }); return y + h + 6;
}
function pdfTable(doc, y, cols, rows) {
  const x0 = 15, head = () => { doc.setFillColor(...NAVY).rect(x0, y, 180, 8, 'F'); doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(8.5); let x = x0;
    cols.forEach(c => { doc.text(T(c.h), c.a === 'r' ? x + c.w - 2 : x + 2, y + 5.3, {align: c.a === 'r' ? 'right' : 'left'}); x += c.w; }); y += 8; };
  head();
  rows.forEach((r, i) => {
    doc.setFont('helvetica', 'normal').setFontSize(8.5); const wr = r.map((v, j) => doc.splitTextToSize(T(v), cols[j].w - 4)), h = Math.max(7, Math.max(...wr.map(w => w.length)) * 4.2 + 2.6);
    if (y + h > 272) { doc.addPage(); y = 20; head(); }
    if (i % 2) doc.setFillColor(247, 249, 251).rect(x0, y, 180, h, 'F');
    doc.setTextColor(...INK); let x = x0; wr.forEach((w, j) => { const c = cols[j]; doc.text(w, c.a === 'r' ? x + c.w - 2 : x + 2, y + 5, {align: c.a === 'r' ? 'right' : 'left'}); x += c.w; });
    doc.setDrawColor(225, 231, 238).setLineWidth(.2).line(x0, y + h, x0 + 180, y + h); y += h;
  }); return y + 5;
}
function pdfPara(doc, y, title, text) {
  if (y > 255) { doc.addPage(); y = 20; }
  if (title) { doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY).text(T(title), 15, y); y += 5; }
  doc.setFont('helvetica', 'normal').setFontSize(8.8).setTextColor(...INK);
  doc.splitTextToSize(T(text), 180).forEach(l => { if (y > 276) { doc.addPage(); y = 20; } doc.text(l, 15, y); y += 4.4; }); return y + 3;
}
function pdfTotals(doc, y, rows) {
  if (y + rows.length * 6.5 + 4 > 276) { doc.addPage(); y = 20; }
  rows.forEach(([l, v, strong]) => {
    if (strong) doc.setFillColor(...NAVY).roundedRect(110, y - 4.6, 85, 7.4, 1.5, 1.5, 'F');
    doc.setFont('helvetica', strong ? 'bold' : 'normal').setFontSize(strong ? 10 : 9).setTextColor(...(strong ? [255, 255, 255] : INK)); doc.text(T(l), 113, y); doc.text(T(v), 192, y, {align: 'right'}); y += 6.5;
  }); return y + 3;
}
function pdfSign(doc, y, a, b) {
  if (y > 235) { doc.addPage(); y = 20; }
  [[a, 15], [b, 108]].forEach(([t, x]) => { doc.setDrawColor(...MUT).setLineWidth(.3).roundedRect(x, y, 87, 32, 2, 2); doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...NAVY).text(T(t), x + 4, y + 6); doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUT).text('Signature précédée de « Lu et approuvé »', x + 4, y + 11); }); return y + 38;
}
function pdfPill(doc, x, y, text, rgb) { doc.setFont('helvetica', 'bold').setFontSize(8); const w = doc.getTextWidth(T(text)) + 8; doc.setFillColor(...rgb).roundedRect(x - w, y - 4.5, w, 6.5, 3, 3, 'F'); doc.setTextColor(255, 255, 255).text(T(text), x - w / 2, y, {align: 'center'}); }
function pdfEnd(doc, u, name) {
  const n = doc.getNumberOfPages(), I = issuer(u);
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setDrawColor(...GOLD).setLineWidth(.4).line(15, 284, 195, 284); doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUT);
    doc.text(T([I.name, I.ninea && 'NINEA ' + I.ninea, I.rccm && 'RCCM ' + I.rccm, I.phone].filter(Boolean).join('  ·  ')), 15, 289); doc.text(`Document généré par DEUKSIL  ·  Page ${i}/${n}`, 195, 289, {align: 'right'}); }
  return {name: name + '.pdf', blob: doc.output('blob')};
}

/* Devis, proforma, facture, avoir */
function pdfInvoice(d, u) {
  const I = issuer(u), p = gProp(d.propertyId), kind = {DEV: 'DEVIS', PF: 'PROFORMA', FAC: 'FACTURE', AV: 'AVOIR'}[d.type], fac = d.type === 'FAC';
  const [doc, y0] = pdfBegin(kind, d.ref, d.createdAt, d.ref); let y = y0;
  const [st, tone] = dState(d); pdfPill(doc, 195, 38, st, {ok: [31, 122, 77], bad: [185, 56, 56], warn: [180, 134, 63], info: [15, 48, 87]}[tone] || MUT); y += 6;
  y = pdfParties(doc, y, {t: 'Émetteur', lines: issuerLines(I)}, {t: fac ? 'Facturé à' : 'Destinataire', lines: [d.client, d.clientAddress, d.clientPhone && 'Tél : ' + d.clientPhone, p && 'Bien : ' + p.title + (p.quartier ? ', ' + p.quartier : '') + (p.city ? ', ' + p.city : '')].filter(Boolean)});
  const parent = d.parentId && DB.findItem(DB.K.docs, d.parentId);
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUT).text(T([`Émis le ${d8(d.createdAt)}`, fac ? `Échéance : ${d8(d.due)}` : d.type !== 'AV' ? `Valable jusqu'au : ${d8(d.due)}` : '', parent && `Réf. liée : ${parent.ref}`].filter(Boolean).join('   ·   ')), 15, y); y += 6;
  y = pdfTable(doc, y, [{h: 'Désignation', w: 92}, {h: 'Qté', w: 18, a: 'r'}, {h: 'Prix unitaire', w: 35, a: 'r'}, {h: 'Total', w: 35, a: 'r'}], d.items.map(i => [i.label, String(i.qty), fc(i.price), fc(i.qty * i.price)]));
  const sub = d.items.reduce((t, i) => t + i.qty * i.price, 0), rem = sub * (d.discount || 0) / 100, ht = sub - rem, tva = ht * (d.tax || 0) / 100, rows = [['Sous-total', fc(sub)]];
  if (d.discount) rows.push([`Remise (${d.discount} %)`, '- ' + fc(rem)]); if (d.tax) rows.push(['Total HT', fc(ht)], [`TVA (${d.tax} %)`, fc(tva)]);
  rows.push([d.tax ? 'Total TTC' : 'Total', fc(dTot(d)), !fac]);
  if (fac) { const cr = dCred(d), pd = dPaid(d); if (cr) rows.push(['Avoirs', '- ' + fc(cr)]); rows.push(['Déjà payé', fc(pd)], ['Reste à payer', fc(dRest(d)), true]); }
  y = pdfTotals(doc, y + 2, rows);
  if (fac) { const pays = DB.getData(DB.K.fpay).filter(x => x.docId === d.id); if (pays.length) { doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY).text('Paiements reçus', 15, y); y = pdfTable(doc, y + 3, [{h: 'Paiement', w: 42}, {h: 'Reçu', w: 42}, {h: 'Date', w: 30}, {h: 'Mode', w: 30}, {h: 'Montant', w: 36, a: 'r'}], pays.map(x => [x.ref, x.rec, d8(x.createdAt), x.method, fc(x.amount)])); } }
  y = pdfPara(doc, y, 'Conditions et modes de paiement', I.terms || (fac ? 'Paiement à réception, avant la date d\'échéance. Modes acceptés : espèces, virement bancaire, Wave, Orange Money, carte bancaire.' : 'Offre valable jusqu\'à la date indiquée. Les prix sont exprimés en francs CFA (FCFA).'));
  if (I.bank) y = pdfPara(doc, y, 'Coordonnées de paiement', I.bank);
  if (d.type === 'AV') y = pdfPara(doc, y, 'Objet', 'Avoir émis en réduction de la facture ' + (parent ? parent.ref : '') + '. Le montant est déduit du solde dû par le client.');
  if (d.type === 'DEV' || d.type === 'PF') y = pdfSign(doc, y, 'Bon pour accord (client)', 'Cachet et signature de l\'émetteur');
  return pdfEnd(doc, u, d.ref);
}
/* Reçu de paiement */
function pdfReceipt(p, u) {
  const I = issuer(u), d = DB.findItem(DB.K.docs, p.docId), [doc, y0] = pdfBegin('REÇU DE PAIEMENT', p.rec, p.createdAt, p.rec); let y = y0;
  y = pdfParties(doc, y, {t: 'Reçu par', lines: issuerLines(I)}, {t: 'Reçu de', lines: [p.client, d && d.clientPhone && 'Tél : ' + d.clientPhone].filter(Boolean)});
  doc.setFillColor(...SOFT).roundedRect(15, y, 180, 26, 2, 2, 'F'); doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUT).text('MONTANT REÇU', 20, y + 7);
  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(...NAVY).text(fc(p.amount), 20, y + 18); y += 34;
  y = pdfTable(doc, y, [{h: 'Détail', w: 70}, {h: 'Information', w: 110}], [['Référence du paiement', p.ref], ['Facture concernée', p.docRef], ['Mode de paiement', p.method], ['Date du paiement', d8(p.createdAt)], ['Reste à payer sur la facture', d ? fc(dRest(d)) : '—']]);
  y = pdfPara(doc, y, null, `Arrêté le présent reçu à la somme de ${enLettres(p.amount)} francs CFA.`);
  y = pdfSign(doc, y + 4, 'Cachet et signature de l\'émetteur', 'Le payeur'); return pdfEnd(doc, u, p.rec);
}
/* Quittance de loyer */
function pdfQuittance(r, u) {
  const I = issuer(u), l = DB.findItem(DB.K.leases, r.leaseId) || {}, p = gProp(l.propertyId) || {}, ref = `QL-${r.month.replace('-', '')}-${String(l.id || r.id).slice(-4).toUpperCase()}`;
  const [doc, y0] = pdfBegin('QUITTANCE DE LOYER', ref, r.paidAt, ref); let y = y0;
  y = pdfParties(doc, y, {t: 'Bailleur', lines: issuerLines(I)}, {t: 'Locataire', lines: [l.tenant, l.phone && 'Tél : ' + l.phone, p.title && 'Bien : ' + p.title, [p.quartier, p.city].filter(Boolean).join(', ')].filter(Boolean)});
  y = pdfTable(doc, y, [{h: 'Désignation', w: 120}, {h: 'Montant', w: 60, a: 'r'}], [[`Loyer de ${monthLabel(r.month)}`, fc(r.amount)]]);
  y = pdfTotals(doc, y + 2, [['Total payé', fc(r.amount), true]]);
  y = pdfPara(doc, y + 2, null, `Je soussigné(e), ${I.name}, bailleur, reconnais avoir reçu de ${l.tenant} la somme de ${fc(r.amount)} (${enLettres(r.amount)} francs CFA) au titre du loyer de la période ${monthLabel(r.month)}, payé le ${d8(r.paidAt)}. La présente quittance annule tout reçu antérieur pour la même période et ne dispense pas le locataire du paiement des loyers suivants.`);
  y = pdfSign(doc, y + 4, 'Le bailleur (cachet et signature)', 'Le locataire'); return pdfEnd(doc, u, ref);
}
/* Contrats */
function contractArticles(c, p, me) {
  const bien = p ? `${p.title} (${[p.quartier, p.city].filter(Boolean).join(', ')}${p.surface ? ', ' + p.surface + ' m²' : ''}${p.rooms ? ', ' + p.rooms + ' pièces' : ''})` : 'le bien désigné par les parties', per = `du ${d8(c.start)} au ${d8(c.end)}`;
  const A = {
    location: [['Objet', `${me} (le Bailleur) donne en location à ${c.party} (le Locataire) : ${bien}, à usage d'habitation sauf mention contraire.`], ['Durée', `Le bail est conclu ${per}. Il se renouvelle selon les conditions convenues entre les parties.`],
      ['Loyer et charges', `Le loyer mensuel est de ${fc(c.amount)}${c.charges ? `, auquel s'ajoutent ${fc(c.charges)} de charges mensuelles` : ''}, payable au plus tard le 5 de chaque mois, contre quittance.`], ['Dépôt de garantie', c.deposit ? `Le Locataire verse ${fc(c.deposit)} à titre de dépôt de garantie, restitué en fin de bail après état des lieux, déduction faite des sommes éventuellement dues.` : 'Aucun dépôt de garantie n\'est prévu.'],
      ['Obligations du Locataire', 'Payer le loyer aux échéances, user paisiblement du bien, l\'entretenir, ne pas sous-louer sans accord écrit, répondre des dégradations survenues pendant la location, souscrire une assurance habitation.'], ['Obligations du Bailleur', 'Délivrer un bien en bon état, en assurer la jouissance paisible, réaliser les grosses réparations.'], ['Résiliation', 'Chaque partie peut résilier le bail en respectant le préavis convenu et les dispositions légales en vigueur.']],
    mandat: [['Objet', `${c.party} (le Mandant) confie à ${me} (le Mandataire) la gestion de : ${bien}.`], ['Durée', `Le mandat est conclu ${per}.`], ['Missions', 'Rechercher des locataires, établir les baux, encaisser les loyers, assurer le suivi technique et administratif, et rendre compte régulièrement au Mandant.'], ['Rémunération', `Le Mandataire perçoit des honoraires de ${fc(c.amount)}${c.charges ? ` et ${fc(c.charges)} de frais` : ''}, selon les modalités convenues.`], ['Reddition de comptes', 'Un relevé des loyers encaissés, des dépenses et du solde reversé est remis au Mandant à chaque période convenue.'], ['Résiliation', 'Le mandat peut être résilié par écrit en respectant le préavis convenu.']],
    vente: [['Objet', `${me} (le Vendeur) s'engage à vendre à ${c.party} (l'Acquéreur) : ${bien}.`], ['Prix', `Le prix de vente est fixé à ${fc(c.amount)}${c.deposit ? `, dont ${fc(c.deposit)} versés à titre d'acompte` : ''}.`], ['Calendrier', `Les parties s'engagent ${per} à finaliser la vente, notamment par acte authentique devant notaire.`], ['Titre de propriété', 'Le Vendeur déclare être propriétaire du bien et libre de toute charge non déclarée. L\'Acquéreur est invité à faire contrôler le titre foncier et la situation du bien par un notaire avant tout paiement définitif.'], ['Frais', 'Les frais d\'acte, droits d\'enregistrement et honoraires sont répartis selon l\'accord des parties ou les usages.']],
    prestation: [['Objet', `${me} (le Client) confie à ${c.party} (le Prestataire) la réalisation de prestations concernant : ${bien}.`], ['Durée', `La prestation est exécutée ${per}.`], ['Prix et paiement', `Le prix convenu est de ${fc(c.amount)}${c.deposit ? `, avec un acompte de ${fc(c.deposit)}` : ''}, payable selon les modalités convenues.`], ['Obligations', 'Le Prestataire exécute sa mission avec diligence et dans les règles de l\'art. Le Client donne accès au bien et règle les sommes dues.'], ['Résiliation', 'Résiliation possible par écrit en cas de manquement grave, après mise en demeure restée sans effet.']]
  }[c.type];
  const art = [...A]; if (c.conditions) art.push(['Conditions particulières', c.conditions]); art.push(['Droit applicable', 'Le présent contrat est soumis au droit sénégalais. À défaut d\'accord amiable, les tribunaux compétents du lieu du bien seront saisis.']); return art;
}
function pdfContract(c, u) {
  const I = issuer(u), p = gProp(c.propertyId), [doc, y0] = pdfBegin(CTYPE[c.type].toUpperCase(), c.ref, c.createdAt, c.ref); let y = y0;
  pdfPill(doc, 195, 38, c.status, {actif: [31, 122, 77], 'expiré': [185, 56, 56], 'résilié': [185, 56, 56]}[c.status] || MUT); y += 6;
  const role = {location: ['Le Bailleur', 'Le Locataire'], mandat: ['Le Mandataire', 'Le Mandant'], vente: ['Le Vendeur', 'L\'Acquéreur'], prestation: ['Le Client', 'Le Prestataire']}[c.type];
  y = pdfParties(doc, y, {t: role[0], lines: issuerLines(I)}, {t: role[1], lines: [c.party, p && p.title, p && [p.quartier, p.city].filter(Boolean).join(', ')].filter(Boolean)});
  contractArticles(c, p, I.name).forEach(([t, x], i) => { y = pdfPara(doc, y, `Article ${i + 1} — ${t}`, x); });
  y = pdfPara(doc, y + 2, null, `Fait à ${(p && p.city) || 'Dakar'}, le ${d8(c.start)}, en deux exemplaires originaux. Modèle généré par DEUKSIL à titre indicatif : il ne remplace pas l\'avis d\'un professionnel du droit (notaire, avocat).`); pdfSign(doc, y, role[0], role[1]); return pdfEnd(doc, u, c.ref);
}

/* Boutons, génération et aperçu après création */
let pdfBtn = name => `<button class="btn" data-action="g6-pdf" data-id="${esc(name)}">${icon('file', 16)} Télécharger le PDF</button>`;
function pdfFor(name, u) {
  const L = u.role === 'tenant' ? DB.findItem(DB.K.leases, u.leaseId) : null, adm = u.role === 'admin';
  const iss = x => adm ? DB.findItem(DB.K.users, x.ownerId) : L ? DB.findItem(DB.K.users, L.ownerId) : u;
  const own = x => adm || (L ? x.ownerId === L.ownerId : x.ownerId === u.id); let m;
  if (/^(DEV|PF|FAC|AV)-/.test(name)) { if (L) return; const d = DB.findItem(DB.K.docs, x => x.ref === name && own(x)); return d && ['finances', pdfInvoice, d, iss(d)]; }
  if (/^REC-/.test(name)) { if (L) return; const p = DB.findItem(DB.K.fpay, x => x.rec === name && own(x)); return p && ['finances', pdfReceipt, p, iss(p)]; }
  if (/^CTR-/.test(name)) { const c = DB.findItem(DB.K.contracts, x => x.ref === name && own(x) && (!L || (x.type === 'location' && x.propertyId === L.propertyId && sameName(x.party, L.tenant)))); return c && ['gestion', pdfContract, c, iss(c)]; }
  if (m = name.match(/^QUIT-(.+)$/)) { const r = DB.findItem(DB.K.rents, x => x.id === m[1] && own(x) && (!L || (x.leaseId === L.id && x.paidAt))); return r && ['gestion', pdfQuittance, r, iss(r)]; }
}
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-action="g6-pdf"]'), u = Auth.current(); if (!el || !u) return;
  const hit = pdfFor(el.dataset.id, u); if (!hit) { toast('Document introuvable.', 'bad'); return; }
  if (u.member && !u.perms.includes(hit[0])) { toast('Action non autorisée pour votre profil.', 'bad'); return; }
  el.disabled = true; const label = el.innerHTML; el.textContent = 'Génération…';
  try { await loadPdf(); const f = hit[1](hit[2], hit[3] || u); await saveFile(f.name, f.blob); audit('PDF généré', f.name); }
  catch (err) { toast('PDF indisponible : une connexion Internet est nécessaire.', 'bad'); }
  el.disabled = false; el.innerHTML = label;
});
function showCreated(kind, key) {
  const u = Auth.current(); if (!u) return;
  setTimeout(() => {
    if (kind === 'doc') { const d = DB.findItem(DB.K.docs, x => x.ref === key); if (d) modal(d.ref, `<div class="card pad-s">${docHtml(d, u)}</div><div style="margin-top:12px">${pdfBtn(d.ref)}</div>`); }
    if (kind === 'rec') { const p = DB.findItem(DB.K.fpay, x => x.rec === key); if (p) modal('Reçu ' + p.rec, `<div class="card pad-s"><b>REÇU ${p.rec}</b><p>Reçu de <b>${esc(p.client)}</b> : <b>${money(p.amount)}</b> (${esc(p.method)}) pour la facture ${esc(p.docRef)}.</p></div><div style="margin-top:12px">${pdfBtn(p.rec)}</div>`); }
    if (kind === 'ctr') { const c = DB.findItem(DB.K.contracts, x => x.ref === key); if (c) modal(c.ref, `<div class="card pad-s">${contractHtml(c, u)}</div><div style="margin-top:12px">${pdfBtn(c.ref)}</div>`); }
    if (kind === 'quit') { const r = DB.findItem(DB.K.rents, x => x.id === key); if (r) gReceipt(r); }
  }, 40);
}

/* Onglet « Mes informations » : émetteur des documents */
GTABS.push(['identity', 'Mes informations']);
routes.find(r => /manage/.test(r.re.source)).re = /^\/manage\/(leases|rents|tickets|deals|docs|fpay|expenses|finance|audit|contracts|providers|team|identity)$/;
vueGestion(['identity'], function (u, tab) {
  if (u.member) return ''; const I = {...issuer(u), seuil: (u.docInfo || {}).seuil}, f = (k, l, ph) => `<div class="field"><label>${l}</label><input class="input" name="${k}" value="${esc(I[k] || '')}" placeholder="${ph || ''}"></div>`;
  return `<form class="card" data-action="g4-identity"><h4 style="margin-top:0">Informations de l'émetteur</h4><p class="small muted">Elles figurent sur tous vos PDF (factures, devis, reçus, quittances, contrats).</p><div class="form-grid">
    ${f('name', 'Nom ou raison sociale')}${f('address', 'Adresse', 'Quartier, ville')}${f('phone', 'Téléphone')}${f('email', 'E-mail')}${f('ninea', 'NINEA')}${f('rccm', 'RCCM')}
    ${u.role === 'agency' ? `<div class="field"><label>Seuil de validation d'un devis (FCFA)</label><input class="input" type="number" min="0" name="seuil" value="${esc(I.seuil == null ? 100000 : I.seuil)}"><div class="small muted" style="margin-top:4px">Au-delà, un devis sur un bien géré attend l'accord du propriétaire.</div></div>` : ''}</div>
    <div class="field"><label>Coordonnées de paiement (RIB, Wave, Orange Money…)</label><textarea name="bank">${esc(I.bank)}</textarea></div>
    <div class="field"><label>Conditions de paiement (facultatif)</label><textarea name="terms">${esc(I.terms)}</textarea></div><button class="btn">Enregistrer</button></form>`;
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-action="g4-identity"]'), u = Auth.current(); if (!f || !u || u.member) return;
  e.preventDefault(); const d = formData(f), info = {}; ['name', 'address', 'phone', 'email', 'ninea', 'rccm', 'bank', 'terms'].forEach(k => info[k] = String(d[k] || '').trim().slice(0, 400));
  if (u.role === 'agency') info.seuil = Math.max(0, +d.seuil || 0);
  DB.updateItem(DB.K.users, u.id, {docInfo: info}); audit('Informations émetteur modifiées', info.name); toast('Informations enregistrées.'); render();
});
