/* =============================================================================
   00-photos-traitement.js — traitement d'une photo dans le navigateur, sans
   aucune dépendance : contrôle du vrai format et de l'intégrité, décodage avec
   l'orientation, variantes s/m/l (grand côté 480 / 960 / 1 600 px, jamais
   agrandi), WebP si le navigateur sait l'encoder, sinon JPEG.
   Utilisé par le formulaire de bien (js/99k-photos.js) et par la démonstration
   (DEMO/) : un seul code, les mêmes résultats.
   ============================================================================= */
const DEUKSIL_IMAGES = (() => {
  const VARIANTES = [['s', 480], ['m', 960], ['l', 1600]];
  const QUALITE = {webp: {s: .8, m: .82, l: .84}, jpg: {s: .8, m: .82, l: .85}};
  const OCTETS_MAX = 30 * 1024 * 1024, PIXELS_MAX = 80e6, COTE_MIN = 300;
  const commence = (b, ...o) => o.every((x, i) => b[i] === x);
  const ascii = (b, de, n) => String.fromCharCode(...b.slice(de, de + n));
  async function formatReel(f) {
    const b = new Uint8Array(await f.slice(0, 32).arrayBuffer());
    if (commence(b, 0xFF, 0xD8, 0xFF)) return 'jpeg';
    if (commence(b, 0x89, 0x50, 0x4E, 0x47)) return 'png';
    if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
    if (ascii(b, 0, 4) === 'GIF8') return 'gif';
    if (ascii(b, 4, 4) === 'ftyp') { const m = ascii(b, 8, 4); if (/^(heic|heix|hevc|heim|heis|mif1|msf1)$/.test(m)) return 'heic'; if (/^avi[fs]$/.test(m)) return 'avif'; }
    return null;
  }
  /* Fichier complet ? JPEG : après le début de l'image principale (1er marqueur SOS, en
     sautant les segments d'en-tête dont la miniature EXIF), un marqueur de fin FFD9 doit
     exister ; les données ajoutées après (« photos animées » de certains téléphones) sont
     acceptées. PNG : bloc de fin IEND présent. */
  async function complet(f, fmt) {
    if (fmt !== 'jpeg' && fmt !== 'png') return true;
    const b = new Uint8Array(await f.arrayBuffer());
    if (fmt === 'png') { for (let i = b.length - 4; i >= 8; i--) if (b[i] === 0x49 && b[i + 1] === 0x45 && b[i + 2] === 0x4E && b[i + 3] === 0x44) return true; return false; }
    let i = 2;
    while (i + 4 < b.length) {
      if (b[i] !== 0xFF) return false;
      const m = b[i + 1];
      if (m === 0xFF) { i++; continue; }                     // octet de remplissage
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { i += 2; continue; }
      if (m === 0xD9) return false;                           // fin avant toute image
      const n = (b[i + 2] << 8) | b[i + 3];
      if (m === 0xDA) { i += 2 + n; break; }                  // début des données de l'image
      i += 2 + n;
    }
    for (let j = i; j + 1 < b.length; j++) if (b[j] === 0xFF && b[j + 1] === 0xD9) return true;
    return false;
  }
  async function decoder(f) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(f, {imageOrientation: 'from-image'}); } catch (e) { /* repli ci-dessous */ }
    }
    const url = URL.createObjectURL(f);
    try {
      const img = new Image(); img.decoding = 'async'; img.src = url;
      await img.decode(); return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  /* Réduction par moitiés successives puis lissage fort : net, sans crénelage. */
  function reduire(src, w, h) {
    let cw = src.width, ch = src.height, cur = src;
    while (cw / 2 >= w * 1.15) {
      const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(cur, 0, 0, c.width, c.height);
      cur = c; cw = c.width; ch = c.height;
    }
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);   // fond blanc pour les PNG transparents (le JPEG n'a pas d'alpha)
    x.drawImage(cur, 0, 0, w, h);
    return c;
  }
  const versBlob = (c, type, q) => new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('encodage')), type, q));
  let formatSortie = null;   // 'webp' si le navigateur sait l'encoder, sinon 'jpg'
  async function choisirFormat() {
    if (formatSortie) return formatSortie;
    try { const c = document.createElement('canvas'); c.width = c.height = 2; const b = await versBlob(c, 'image/webp', .8); formatSortie = b.type === 'image/webp' ? 'webp' : 'jpg'; }
    catch (e) { formatSortie = 'jpg'; }
    return formatSortie;
  }
  class Refus extends Error {}
  /* Fichier choisi → {v: {s|m|l: {w,h,o,fichier?}}, blobs, ext, src} ou Refus (message pour l'utilisateur). */
  async function optimiser(f) {
    if (f.size > OCTETS_MAX) throw new Refus(`Fichier trop lourd (${Math.round(f.size / 1048576)} Mo, 30 Mo au plus).`);
    const fmt = await formatReel(f);
    if (!fmt) throw new Refus('Ce fichier n\'est pas une photo (JPG, PNG, WebP ou HEIC).');
    if (!(await complet(f, fmt))) throw new Refus('Photo incomplète ou endommagée : choisissez une autre copie.');
    let img;
    try { img = await decoder(f); }
    catch (e) { throw new Refus(fmt === 'heic' || fmt === 'avif' ? 'Format HEIC non lisible sur cet appareil : choisissez « Plus compatible » (JPG) dans les réglages de l\'appareil photo, ou envoyez une capture.' : 'Photo illisible ou endommagée.'); }
    const W = img.width || img.naturalWidth, H = img.height || img.naturalHeight;
    if (!W || !H) throw new Refus('Photo illisible ou endommagée.');
    if (W * H > PIXELS_MAX) throw new Refus('Photo trop grande pour être traitée sur cet appareil.');
    if (Math.max(W, H) < COTE_MIN) throw new Refus(`Photo trop petite (${W}×${H}) : ${COTE_MIN} pixels au moins.`);
    const ext = await choisirFormat(), type = ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const v = {}, blobs = {}; let prec = null;
    for (const [k, cote] of VARIANTES) {
      const r = Math.min(1, cote / Math.max(W, H)), w = Math.round(W * r), h = Math.round(H * r);
      if (prec && prec.w === w && prec.h === h) { v[k] = {w, h, o: prec.o, fichier: prec.fichier || prec.k}; continue; }   // pas de copie inutile
      const b = await versBlob(reduire(img, w, h), type, QUALITE[ext][k]);
      blobs[k] = b; v[k] = {w, h, o: b.size}; prec = {...v[k], k};
    }
    if (img.close) img.close();
    return {ext, v, blobs, src: {type: fmt, o: f.size, w: W, h: H}};
  }

  return Object.freeze({VARIANTES, QUALITE, OCTETS_MAX, PIXELS_MAX, COTE_MIN, Refus, formatReel, complet, decoder, reduire, versBlob, choisirFormat, optimiser});
})();
