/* ==========================================================================
   MODULE : autofile.js — dès qu'un document est créé (devis, proforma,
   facture, avoir, contrat, reçu, quittance) ou qu'un fichier est déposé,
   le PDF est produit puis rangé tout seul dans le bon tiroir du coffre.
   ========================================================================== */
const AUTO_CAT = {DEV:'devis', PF:'devis', FAC:'factures', AV:'avoirs'};
const b64 = blob => new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = ko; r.readAsDataURL(blob); });
const archived = ref => DB.findItem(DB.K.documents, d => d.srcRef === ref);

/* Produit le PDF et l'enregistre comme pièce du coffre. Silencieux en cas d'échec. */
async function autoFile(kind, obj) {
  const u = Auth.current(); if (!u || !obj) return null;
  const maker = {doc: pdfInvoice, contract: pdfContract, receipt: pdfReceipt, quittance: pdfQuittance}[kind];
  const ref = kind === 'receipt' ? obj.rec : kind === 'quittance' ? 'QUIT-' + obj.id : obj.ref;
  if (!maker || !ref || archived(ref)) return null;
  const cat = kind === 'contract' ? 'contrats' : kind === 'receipt' ? 'recus' : kind === 'quittance' ? 'quittances' : AUTO_CAT[obj.type];
  if (!cat) return null;
  try {
    await loadPdf();
    const issuerUser = kind === 'quittance' || kind === 'contract' ? u : u;
    const f = maker(obj, issuerUser);
    const rec = DB.addItem(DB.K.documents, {ownerId: u.id, name: f.name, mime: 'application/pdf', dataUrl: await b64(f.blob),
      cat, propertyId: obj.propertyId || '', expiry: '', srcRef: ref, auto: true});
    if (!DB.lastWriteOk) return null;
    audit('PDF archivé', f.name); return rec;
  } catch (e) { return null; }
}
/* Archive puis rafraîchit, avec un mot sur l'endroit où le document est rangé. */
function autoFileThen(kind, obj, label) {
  autoFile(kind, obj).then(rec => {
    if (rec) { toast(`${label} · PDF rangé dans « ${VCAT[rec.cat][0]} ».`); render(); }
    else if (!navigator.onLine) toast('PDF non généré : connexion Internet requise.', 'bad');
  });
}

/* Une seule ligne par document : la pièce archivée remplace l'entrée calculée. */
const _vault = vaultItems;
vaultItems = function (u) {
  const items = _vault(u), refs = new Set();
  items.forEach(i => { if (i.kind === 'up') { const d = DB.findItem(DB.K.documents, i.id); if (d && d.srcRef) { i.srcRef = d.srcRef; refs.add(d.srcRef); } } });
  return items.filter(i => i.kind === 'up' || !refs.has(i.name));
};

/* Conversion en PDF des pièces déposées en image (CNI, titre foncier…) */
async function imageToPdf(dataUrl, name) {
  await loadPdf();
  const img = await new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ko(new Error('image illisible')); i.src = dataUrl; });
  /* passage par un canvas : accepte tout format lisible par le navigateur et allège le fichier */
  const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
  const jpg = cv.toDataURL('image/jpeg', 0.82);
  const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4', compress: true});
  const r = Math.min(180 / cv.width, 245 / cv.height), w = cv.width * r, h = cv.height * r;
  doc.addImage(jpg, 'JPEG', (210 - w) / 2, 30, w, h);
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(15, 48, 87).text(T(name), 15, 20);
  doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(116, 132, 150).text('Document déposé sur DEUKSIL le ' + d8(now()), 15, 287);
  return doc.output('blob');
}
