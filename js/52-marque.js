/* ==========================================================================
   MODULE : marque.js — logo et signature de l'émetteur sur les documents.
   Une agence (ou un propriétaire) émet ses propres devis, factures,
   proformas, quittances et contrats : ses documents doivent porter SA
   marque, pas celle de la plateforme. L'écran Gestion › Identité alimente
   déjà le nom, le NINEA et le RCCM des PDF ; on y ajoute le logo et la
   signature, et les générateurs de PDF s'en servent.
   ========================================================================== */

/* --- Normalisation des images déposées -----------------------------------
   Une image venue du téléphone peut être énorme ou dans un encodage que
   jsPDF refuse. On la repasse par un canvas : taille bornée, PNG propre
   (la transparence d'un logo est conservée). */
function normImage(file, maxW, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxW / (img.width || maxW));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(img, 0, 0, w, h);
      try { cb(cv.toDataURL('image/png'), w, h); }
      catch (e) { toast("Image illisible, essayez un autre fichier.", 'bad'); }
    };
    img.onerror = () => toast("Ce fichier n'est pas une image valide.", 'bad');
    img.src = fr.result;
  };
  fr.onerror = () => toast('Lecture du fichier impossible.', 'bad');
  fr.readAsDataURL(file);
}

const brandOf = u => (u && u.docInfo) || {};

/* Un seul champ fichier pour toute l'application : la fenêtre de
   prévisualisation d'un document doit pouvoir l'ouvrir elle aussi. */
function brandInput() {
  let i = document.getElementById('brand-file-global');
  if (!i) {
    i = document.createElement('input');
    i.type = 'file'; i.accept = 'image/*'; i.id = 'brand-file-global';
    i.setAttribute('data-action', 'brand-file'); i.style.display = 'none';
    document.body.appendChild(i);
  }
  return i;
}

/* --- Bloc « Logo et signature » ajouté à l'onglet Identité --------------- */
function brandCard(u) {
  const b = brandOf(u);
  const vignette = (src, vide, h) => src
    ? `<div class="brand-prev" style="height:${h}px"><img src="${src}" alt=""></div>`
    : `<div class="brand-prev vide" style="height:${h}px"><span class="small muted">${vide}</span></div>`;
  return `<div class="card" style="margin-top:18px">
    <h4 style="margin-top:0">Logo et signature</h4>
    <p class="small muted">Ils remplacent la marque DEUKSIL en haut de vos devis, proformas, factures, quittances et contrats. Sans dépôt, la mise en page actuelle est conservée.</p>
    <div class="form-grid" style="margin-top:14px">
      <div class="field">
        <label>Logo de l'entreprise</label>
        ${vignette(b.logo, 'Aucun logo', 92)}
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <button type="button" class="btn ghost sm" data-action="brand-pick" data-k="logo">${b.logo ? 'Remplacer' : 'Choisir un fichier'}</button>
          ${b.logo ? `<button type="button" class="btn ghost sm" data-action="brand-del" data-k="logo">Retirer</button>` : ''}
        </div>
        <div class="small muted" style="margin-top:6px">PNG ou JPEG. Un fond transparent rend mieux à l'impression.</div>
      </div>
      <div class="field">
        <label>Signature</label>
        ${vignette(b.signature, 'Aucune signature', 92)}
        <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap">
          <button type="button" class="btn ghost sm" data-action="brand-pick" data-k="signature">${b.signature ? 'Remplacer' : 'Choisir un fichier'}</button>
          ${b.signature ? `<button type="button" class="btn ghost sm" data-action="brand-del" data-k="signature">Retirer</button>` : ''}
        </div>
        <div class="small muted" style="margin-top:6px">Signature scannée sur fond clair. Elle est apposée dans votre cadre de signature.</div>
      </div>
    </div>
  </div>`;
}

/* On ajoute le bloc à la suite du formulaire d'identité existant. */
retoucheGestion(['identity'], function (h, u) {
  if (typeof h !== 'string' || !h || (u && u.member)) return h;
  return h + brandCard(u);
});

/* --- Dépôt, enregistrement, retrait ------------------------------------- */
let _brandKey = null;
document.addEventListener('click', e => {
  const pick = e.target.closest('[data-action="brand-pick"]');
  if (pick) {
    _brandKey = pick.dataset.k;
    const inp = brandInput();
    inp.value = ''; inp.click();
    return;
  }
  const del = e.target.closest('[data-action="brand-del"]');
  if (del) {
    const u = Auth.current(); if (!u || u.member) return;
    const k = del.dataset.k, info = {...(u.docInfo || {})};
    delete info[k]; delete info[k + 'W']; delete info[k + 'H'];
    DB.updateItem(DB.K.users, u.id, {docInfo: info});
    toast(k === 'logo' ? 'Logo retiré.' : 'Signature retirée.');
    if (!majBandeau()) render();
  }
});

document.addEventListener('change', e => {
  const inp = e.target.closest('[data-action="brand-file"]');
  if (!inp || !inp.files || !inp.files[0] || !_brandKey) return;
  const u = Auth.current(); if (!u || u.member) return;
  const k = _brandKey; _brandKey = null;
  normImage(inp.files[0], k === 'logo' ? 520 : 760, (data, w, h) => {
    const info = {...(u.docInfo || {})};
    info[k] = data; info[k + 'W'] = w; info[k + 'H'] = h;
    DB.updateItem(DB.K.users, u.id, {docInfo: info});
    toast(k === 'logo' ? 'Logo enregistré.' : 'Signature enregistrée.');
    if (k !== 'logo' || !majBandeau()) render();
  });
});

/* --- En-tête des PDF : la marque de l'émetteur -------------------------- */
const _pdfBegin = pdfBegin;
pdfBegin = function (kind, ref, date, title) {
  const u = Auth.current(), b = brandOf(u);
  if (!u || !b.logo) return _pdfBegin(kind, ref, date, title);

  const I = issuer(u);
  const doc = new window.jspdf.jsPDF({unit: 'mm', format: 'a4', compress: true});
  doc.setProperties({title: title || ref, creator: 'DEUKSIL', author: I.name || 'DEUKSIL'});

  /* Le logo tient dans un cadre de 26 x 16 mm, proportions conservées. */
  const maxW = 26, maxH = 16;
  const rw = b.logoW || 1, rh = b.logoH || 1;
  const k = Math.min(maxW / rw, maxH / rh);
  const lw = Math.max(4, rw * k), lh = Math.max(4, rh * k);
  try { doc.addImage(b.logo, 'PNG', 15, 10 + (maxH - lh) / 2, lw, lh); }
  catch (e) { logoPdf(doc, 15, 10, 13, 13.6); }

  /* Le titre du document est posé en premier : on en déduit la place
     restante pour le nom de l'émetteur, qui sinon chevauchait le titre. */
  doc.setFont('helvetica', 'bold').setFontSize(19).setTextColor(...NAVY);
  const wKind = doc.getTextWidth(T(kind));
  doc.text(T(kind), 195, 18, {align: 'right'});

  const xt = 15 + lw + 5;
  const dispo = Math.max(24, 195 - wKind - 6 - xt);
  let nom = T(I.name || 'DEUKSIL'), taille = 14;
  doc.setFont('helvetica', 'bold');
  while (taille > 8 && doc.setFontSize(taille).getTextWidth(nom) > dispo) taille -= 0.5;
  if (doc.setFontSize(taille).getTextWidth(nom) > dispo) {
    while (nom.length > 4 && doc.getTextWidth(nom + '...') > dispo) nom = nom.slice(0, -1);
    nom += '...';
  }
  doc.setFontSize(taille).setTextColor(...NAVY).text(nom, xt, 17.5);
  if (I.address) doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUT)
     .text(T(I.address), xt, 22);
  doc.setFontSize(10).setTextColor(...GOLD).text(T(ref), 195, 24, {align: 'right'});
  doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...MUT).text('Date : ' + d8(date), 195, 29, {align: 'right'});
  doc.setDrawColor(...GOLD).setLineWidth(.6).line(15, 33, 195, 33);
  return [doc, 40];
};

/* --- Cadres de signature : on appose celle de l'émetteur ---------------- */
const _pdfSign = pdfSign;
pdfSign = function (doc, y, a, b) {
  const u = Auth.current(), br = brandOf(u);
  const yy = _pdfSign(doc, y, a, b);
  if (!u || !br.signature) return yy;

  /* Le cadre de l'émetteur est celui dont l'intitulé porte son nom ; à
     défaut, le premier (par convention celui de la partie émettrice). */
  const nom = (issuer(u).name || '').toLowerCase();
  const dansA = nom && String(a || '').toLowerCase().includes(nom);
  const dansB = nom && String(b || '').toLowerCase().includes(nom);
  const x = dansB && !dansA ? 108 : 15;

  /* Le cadre dessiné par pdfSign fait 87 x 32 mm à partir de (x, yTop). */
  const yTop = yy - 38;
  const maxW = 56, maxH = 15;
  const rw = br.signatureW || 1, rh = br.signatureH || 1;
  const k = Math.min(maxW / rw, maxH / rh);
  try { doc.addImage(br.signature, 'PNG', x + 4, yTop + 14, Math.max(6, rw * k), Math.max(4, rh * k)); }
  catch (e) {}
  return yy;
};


/* --- Choix du logo au moment de générer un document ---------------------
   L'agence voit, juste avant de télécharger, la marque qui sera apposée et
   peut la changer sans quitter la fenêtre. */
function brandStrip() {
  const u = Auth.current(); if (!u || u.member) return '';
  const b = brandOf(u), nom = (issuer(u).name || '').trim();
  return `<div class="brand-strip" id="brand-strip">
    ${b.logo
      ? `<img src="${b.logo}" alt="">
         <div style="min-width:0"><b class="small">${esc(nom || 'Votre logo')}</b>
           <div class="small muted">Logo apposé sur ce document</div></div>`
      : `<span class="brand-none">${icon('image', 17)}</span>
         <div style="min-width:0"><b class="small">Aucun logo</b>
           <div class="small muted">Le document porte la marque DEUKSIL</div></div>`}
    <div class="row" style="gap:7px;margin-left:auto;flex-wrap:wrap">
      <button type="button" class="btn ghost sm" data-action="brand-pick" data-k="logo">${b.logo ? 'Changer' : 'Ajouter'}</button>
      ${b.logo ? `<button type="button" class="btn ghost sm" data-action="brand-del" data-k="logo">Retirer</button>` : ''}
    </div>
  </div>`;
}

const _pdfBtn = pdfBtn;
pdfBtn = name => brandStrip() + _pdfBtn(name);

/* Dans une fenêtre ouverte, on rafraîchit le bandeau sur place : un rendu
   complet refermerait la fenêtre et ferait perdre le document consulté. */
function majBandeau() {
  const vieux = document.getElementById('brand-strip');
  if (!vieux) return false;
  const tmp = document.createElement('div'); tmp.innerHTML = brandStrip();
  if (tmp.firstElementChild) vieux.replaceWith(tmp.firstElementChild);
  return true;
}
