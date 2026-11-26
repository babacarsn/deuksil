/* Studio : filme l'application (banc d'essai, Supabase simulé) avec un curseur
   animé, des sous-titres et un carton de titre, puis produit une vidéo MP4
   (H.264, 1280×720, 30 i/s) et son affiche JPEG.

   Les images viennent du « screencast » de Chromium (JPEG qualité 92, une image
   à chaque changement d'écran) ; ffmpeg les assemble avec leurs durées réelles. */
const fs = require('fs'), path = require('path'), {execFileSync} = require('child_process');
const B = require('../banc/banc');
const L = 1280, H = 720;

const CSS = `
#studio-curseur{position:fixed;left:0;top:0;width:26px;height:26px;z-index:2147483646;pointer-events:none;transition:transform .55s cubic-bezier(.4,0,.2,1);transform:translate(640px,420px)}
#studio-curseur svg{filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))}
#studio-onde{position:fixed;z-index:2147483645;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #E8A33D;pointer-events:none;opacity:0}
#studio-onde.on{animation:studio-onde .55s ease-out}
@keyframes studio-onde{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(1.4)}}
#studio-legende{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483644;max-width:880px;background:rgba(12,39,69,.94);color:#fff;font:600 21px/1.35 Inter,system-ui,sans-serif;padding:12px 22px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.35);opacity:0;transition:opacity .25s;text-align:center;pointer-events:none}
#studio-legende.on{opacity:1}
#studio-legende b{color:#F2B84B}
#studio-carton{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:linear-gradient(135deg,#0C2745 0%,#16406F 100%);color:#fff;font-family:Inter,system-ui,sans-serif;text-align:center;opacity:0;transition:opacity .35s;pointer-events:none}
#studio-carton.on{opacity:1}
#studio-carton img{height:54px;margin-bottom:6px}
#studio-carton .t{font-size:44px;font-weight:700;max-width:1000px;line-height:1.15}
#studio-carton .s{font-size:22px;opacity:.85}
#studio-carton .e{margin-top:10px;font-size:15px;letter-spacing:.12em;text-transform:uppercase;color:#F2B84B}
.studio-cible{outline:3px solid #E8A33D!important;outline-offset:3px!important;border-radius:8px}
.ai-fab,.ia-fab,[class*="assistant-bulle"]{display:none!important}
`;
const CURSEUR = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5l15 9.2-6.6 1.3 3.9 7.3-2.6 1.4-3.9-7.4L4 19z" fill="#fff" stroke="#0C2745" stroke-width="1.4" stroke-linejoin="round"/></svg>';

async function installer(page) {
  await page.evaluate(([css, svg]) => {
    if (document.getElementById('studio-curseur')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const c = document.createElement('div'); c.id = 'studio-curseur'; c.innerHTML = svg; document.body.appendChild(c);
    const o = document.createElement('div'); o.id = 'studio-onde'; document.body.appendChild(o);
    const l = document.createElement('div'); l.id = 'studio-legende'; document.body.appendChild(l);
    const k = document.createElement('div'); k.id = 'studio-carton'; document.body.appendChild(k);
    // Les vidéos montrent l'adresse du site, pas celle du banc d'essai local.
    const remplacer = n => { if (n.nodeType === 3 && /localhost:\d+/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/https?:\/\/localhost:\d+/g, 'https://deuksil.vercel.app'); else if (n.childNodes) n.childNodes.forEach(remplacer); };
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(remplacer))).observe(document.body, {childList: true, subtree: true});
  }, [CSS, CURSEUR]);
}

/* Prise de vue d'une scène. scenario(t) reçoit les gestes du « réalisateur ». */
async function filmer({id, qui = null, hash = '#/', titre, espace, scenario, preparer, sortie, fonctions}) {
  const s = await B.ouvrir({qui, hash, viewport: {width: L, height: H}, attente: 700, preparer, fonctions});
  const {page} = s;
  await installer(page);
  const cdp = await s.ctx.newCDPSession(page);
  const images = []; let fin = null;
  cdp.on('Page.screencastFrame', async f => {
    images.push({t: f.metadata.timestamp, data: f.data});
    try { await cdp.send('Page.screencastFrameAck', {sessionId: f.sessionId}); } catch (e) {}
  });
  const attendre = ms => page.waitForTimeout(ms);
  let pos = {x: 640, y: 420};
  const t = {
    page, D: s.D, ID: s.ID, attendre,
    async legende(texte, duree) {
      await page.evaluate(x => { const l = document.getElementById('studio-legende'); l.innerHTML = x; l.classList.add('on'); }, texte);
      await attendre(duree || Math.max(1700, texte.replace(/<[^>]+>/g, '').length * 55));
    },
    async sansLegende() { await page.evaluate(() => document.getElementById('studio-legende').classList.remove('on')); await attendre(250); },
    async carton(t1, t2, etiquette, duree = 2600) {
      await page.evaluate(([a, b, e]) => { const k = document.getElementById('studio-carton'); k.innerHTML = `<img src="img/logo-d-blanc.png" alt=""><div class="e">${e || ''}</div><div class="t">${a}</div>${b ? `<div class="s">${b}</div>` : ''}`; k.classList.add('on'); }, [t1, t2, etiquette]);
      await attendre(duree);
      await page.evaluate(() => document.getElementById('studio-carton').classList.remove('on'));
      await attendre(400);
    },
    /* Trouve un élément : sélecteur CSS, ou {texte, dans} (texte visible exact ou partiel). */
    async trouver(cible) { try { return await t._trouver(cible); } catch (e) { e.message = 'cible ' + JSON.stringify(cible) + ' : ' + e.message.split('\n')[0]; throw e; } },
    async _trouver(cible) {
      let loc;
      if (typeof cible === 'string') loc = page.locator(cible).first();
      else {
        const base = cible.dans ? page.locator(cible.dans) : page;
        const tous = base.locator(cible.role || 'a, button, label, [role="tab"], .chip, summary, [data-action]:not(form)', {hasText: cible.texte}).filter({visible: true});
        await tous.first().waitFor({state: 'visible', timeout: 6000});
        // Le plus petit élément qui contient le texte (le bouton, pas son conteneur).
        const tailles = await tous.evaluateAll(els => els.map(e => e.textContent.trim().length));
        const i = tailles.indexOf(Math.min(...tailles));
        loc = tous.nth(i);
      }
      await loc.waitFor({state: 'visible', timeout: 6000});
      await loc.scrollIntoViewIfNeeded();
      await attendre(150);
      return loc;
    },
    async vers(loc) {
      const b = await loc.boundingBox(); if (!b) return;
      pos = {x: Math.round(b.x + Math.min(b.width / 2, 60)), y: Math.round(b.y + b.height / 2)};
      await page.evaluate(p => { document.getElementById('studio-curseur').style.transform = `translate(${p.x - 4}px,${p.y - 2}px)`; }, pos);
      await attendre(650);
    },
    async clic(cible, legende, opts = {}) {
      if (legende) await t.legende(legende, 1400);
      const loc = await t.trouver(cible);
      await t.vers(loc);
      await loc.evaluate(el => el.classList.add('studio-cible'));
      await attendre(350);
      await page.evaluate(p => { const o = document.getElementById('studio-onde'); o.style.left = p.x + 'px'; o.style.top = p.y + 'px'; o.classList.remove('on'); void o.offsetWidth; o.classList.add('on'); }, pos);
      await loc.evaluate(el => el.classList.remove('studio-cible')).catch(() => {});
      // Un élément qui bouge encore (animation, rafraîchissement) : clic forcé après 2 s.
      if (opts.direct) await loc.evaluate(el => el.click());
      else try { await loc.click({timeout: 2000}); }
      catch (e) { try { await loc.evaluate(el => el.click()); } catch (e2) { e2.message = 'clic ' + JSON.stringify(cible) + ' : ' + e2.message.split('\n').slice(0, 6).join(' / '); throw e2; } }
      await attendre(700);
    },
    async saisir(cible, texte, {lent = 38} = {}) {
      const loc = await t.trouver(cible);
      await t.vers(loc);
      await loc.click();
      const type = await loc.evaluate(el => el.type);
      if (['date', 'time', 'month', 'datetime-local'].includes(type)) { await loc.fill(String(texte)); await loc.dispatchEvent('change'); await attendre(500); return; }
      await loc.fill('');
      await loc.pressSequentially(String(texte), {delay: lent});
      await attendre(300);
    },
    async choisir(cible, valeur) {
      const loc = await t.trouver(cible);
      await t.vers(loc);
      await loc.selectOption(valeur);
      await attendre(500);
    },
    /* Geste facultatif : seulement si l'élément est là (sinon on continue). */
    async siPresent(cible, geste) {
      const sel = typeof cible === 'string' ? page.locator(cible) : (cible.dans ? page.locator(cible.dans) : page).locator(cible.role || 'a, button, label, [data-action]:not(form)', {hasText: cible.texte});
      if (await sel.filter({visible: true}).count()) { await geste(); return true; } return false;
    },
    async cocher(cible) { const loc = await t.trouver(cible); await t.vers(loc); await loc.check({force: true}); await attendre(350); },
    async fermer() { await page.keyboard.press('Escape'); await attendre(500); const x = page.locator('.modal [data-action="close-modal"]').filter({visible: true}); if (await x.count()) { await x.first().click(); await attendre(400); } },
    async aller(hash, ms = 900) { await page.evaluate(h => { location.hash = h; }, hash); await attendre(ms); },
    async defiler(y, ms = 900) { await page.evaluate(v => window.scrollTo({top: v, behavior: 'smooth'}), y); await attendre(ms); },
    async defilerVers(cible) { const loc = await t.trouver(cible); await loc.evaluate(el => el.scrollIntoView({behavior: 'smooth', block: 'center'})); await attendre(900); },
    async affiche() { await t.sansLegende(); fs.writeFileSync(path.join(sortie, id + '.jpg'), await page.screenshot({type: 'jpeg', quality: 86})); }
  };
  await cdp.send('Page.startScreencast', {format: 'jpeg', quality: 92, maxWidth: L, maxHeight: H, everyNthFrame: 1});
  const debut = Date.now();
  let erreur = null;
  try {
    await t.carton(titre, espace ? 'Espace ' + espace : '', 'Tutoriel DEUKSIL');
    await scenario(t);
    await t.sansLegende();
    await t.carton('C\'est fait !', 'Retrouvez ce tutoriel à tout moment dans « Aide ».', '', 2200);
  } catch (e) { erreur = e; try { fs.writeFileSync(path.join(sortie, '..', '..', 'tests', 'videos', `erreur-${id}.png`), await page.screenshot()); } catch (x) {} }
  await attendre(300);
  fin = Date.now() / 1000;
  await cdp.send('Page.stopScreencast').catch(() => {});
  const err = s.erreurs.filter(x => !/ERR_FAILED|TUNNEL|404/.test(x));
  await s.fermer();
  if (erreur) { erreur.message = `[${id}] ${erreur.message}`; throw erreur; }
  return assembler(id, images, fin, sortie, err, (Date.now() - debut) / 1000);
}

function assembler(id, images, fin, sortie, err, secondes) {
  const dossier = path.join(sortie, '.images-' + id);
  fs.rmSync(dossier, {recursive: true, force: true}); fs.mkdirSync(dossier, {recursive: true});
  const lignes = [];
  images.forEach((im, i) => {
    const f = path.join(dossier, String(i).padStart(5, '0') + '.jpg');
    fs.writeFileSync(f, Buffer.from(im.data, 'base64'));
    const d = Math.max(0.001, ((images[i + 1] ? images[i + 1].t : fin) - im.t));   // le filtre fps=30 garde le rythme réel
    lignes.push(`file '${f}'`, `duration ${d.toFixed(4)}`);
  });
  lignes.push(`file '${path.join(dossier, String(images.length - 1).padStart(5, '0') + '.jpg')}'`);
  fs.writeFileSync(path.join(dossier, 'liste.txt'), lignes.join('\n'));
  const tmp = path.join(sortie, id + '.tmp.mp4'), out = path.join(sortie, id + '.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(dossier, 'liste.txt'),
    '-vf', `scale=${L}:${H}:force_original_aspect_ratio=decrease,pad=${L}:${H}:(ow-iw)/2:(oh-ih)/2:color=0x0C2745,fps=30,format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-tune', 'stillimage', '-movflags', '+faststart', '-an', tmp]);
  fs.renameSync(tmp, out);
  fs.rmSync(dossier, {recursive: true, force: true});
  const duree = +execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]).toString().trim();
  return {id, images: images.length, duree, taille: fs.statSync(out).size, erreurs: err};
}
module.exports = {filmer, arreter: B.arreter, ID: B.ID};
