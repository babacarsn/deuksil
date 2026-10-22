/* =============================================================================
   MODULE : 99e-pro.js — finitions professionnelles sur ordinateur (≥ 901 px)
   Le design avait été pensé d'abord pour le téléphone. Sur un grand écran :
   - tableaux : montants, dates et téléphones ne se coupent plus sur 2-3 lignes,
     les boutons d'action restent sur une ligne ;
   - cases à cocher en série (biens confiés, services, permissions) : grille
     de pastilles alignées au lieu d'une ligne qui s'enroule ;
   - pages de Gestion : fil d'Ariane, choix de section et export sur UNE barre ;
   - « Suite à une visite » passe sous le titre de la page.
   Les classes posées ici ne sont stylées que dans css/03-bureau.css (≥ 901 px) :
   le mobile ne change pas, et rien n'est touché sous 901 px.
   ============================================================================= */
(() => {
  const ECRAN = window.matchMedia('(min-width: 901px)');
  const ARGENT = /^[-+−]?\s?\d[\d\s  .,]*\s?(F\s?CFA|FCFA|XOF|%)(\s*\(.*\))?$/i;
  const DATE = /^(\d{1,2}[\/.-]\d{1,2}([\/.-]\d{2,4})?(\s+\d{1,2}[:h]\d{2})?|\d{1,2}(er)?\s+[a-zéû.]{3,9}\.?\s+\d{4}|[a-zéû]{3,9}\.?\s+\d{4}|\d{1,2}\s+[a-zéû.]{3,9}\.?|\d{1,2}[:h]\d{2})$/i;
  const TEL = /^\+?\d[\d\s]{7,16}$/;
  const PERIODE = /^\d{1,2}\s+[a-zéû.]{3,9}\.?\s+\d{4}\s*(→|->|–|-|au)\s*\d{1,2}\s+[a-zéû.]{3,9}\.?\s+\d{4}$/i;

  // Icône déduite du libellé, pour les boutons qui n'en ont pas (nécessaire pour l'affichage en icône seule).
  const ICONE_LIBELLE = [[/joindre|pièce|justificatif/i, 'paperclip'], [/suivi|historique/i, 'clock'], [/mettre fin|terminer|clore|clôturer/i, 'stop'],
    [/supprimer|retirer/i, 'trash'], [/modifier|éditer/i, 'settings'], [/voir|aperçu|ouvrir|examiner/i, 'eye'], [/relancer|rappel/i, 'bell'],
    [/whatsapp|écrire|message|contacter/i, 'message'], [/suspendre|pause/i, 'stop'], [/réactiver|valider|accepter/i, 'check'], [/refuser|sans suite/i, 'close'],
    [/quittance|reçu|pdf|document|facture/i, 'file'], [/appeler/i, 'phone'], [/prolonger|renouveler/i, 'repeat'], [/encaisser|payer/i, 'money']];
  function iconeDe(txt) { const t = ICONE_LIBELLE.find(([re]) => re.test(txt)); return t && ICONS[t[1]] ? icon(t[1], 16) : ''; }

  function tableaux(racine) {
    // Ligne par ligne : une pagination ou un filtre qui remplace les lignes est repris aussi.
    racine.querySelectorAll('table tr:not([data-pro])').forEach(tr => {
      tr.dataset.pro = '1';
      if (tr.children.length >= 8) { const t = tr.closest('table'); if (t) t.classList.add('dense'); }   // beaucoup de colonnes : marges plus fines
      tr.querySelectorAll(':scope > td').forEach(td => {
        const btns = td.querySelectorAll('button, a.btn, .btn');
        if (btns.length >= 2) {
          td.classList.add('td-actions');
          // 4 actions ou plus : libellé des deux premières seulement (de la première à partir de 5), les autres en icône.
          if (btns.length >= 4) [...btns].slice(btns.length >= 5 ? 1 : 2).forEach(b => {
            if (b.classList.contains('ic-only')) return;
            const txt = (b.textContent || '').trim(); if (!txt) return;
            if (!b.querySelector('svg')) { const ic = iconeDe(txt); if (!ic) return; b.insertAdjacentHTML('afterbegin', ic); }
            b.classList.add('ic-only'); if (!b.title) b.title = txt; if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', txt);
          });
          return;
        }
        // Chaque ligne de texte de la cellule est testée (ex. « 1 200 000 FCFA » ou « 23 oct. 2026\n10:00 »).
        const lignes = (td.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
        if (lignes.length && lignes.length <= 3 && lignes.every(l => ARGENT.test(l) || DATE.test(l) || TEL.test(l) || PERIODE.test(l))) td.classList.add('nw');
        td.querySelectorAll('div, span, a, small').forEach(e => {
          if ([...e.children].some(x => x.tagName.toLowerCase() !== 'svg')) return;   // texte simple, éventuellement avec une icône
          const s = (e.textContent || '').trim();
          if (s && s.length < 26 && (ARGENT.test(s) || TEL.test(s.replace(/^\S*\s/, '')) || TEL.test(s))) e.classList.add('nw');
        });
      });
    });
  }

  // Aucun débordement : si un tableau dépasse son cadre, on essaie dans l'ordre
  // 1) marges fines, 2) boutons d'action qui passent à la ligne, 3) montants et dates qui passent à la ligne,
  // 4) affichage en cartes (comme sur téléphone). Recalculé à chaque rendu et quand la fenêtre change de taille.
  const deborde = w => w.scrollWidth > w.clientWidth + 1;
  function ajuster(racine) {
    racine.querySelectorAll('.table-wrap').forEach(w => {
      const t = w.querySelector('table'); if (!t) return;
      // Recalcul seulement si le tableau ou la fenêtre a changé : un simple clic (effet sur un bouton)
      // ne doit pas remettre la mise en page en cause pendant qu'on appuie.
      const cle = () => t.rows.length + '|' + innerWidth + '|' + w.clientWidth + '|' + (t.tBodies[0] ? t.tBodies[0].textContent.length : 0);
      if (w.dataset.cle === cle()) return;
      w.classList.remove('en-cartes'); t.classList.remove('actions-souples', 'souple');
      const fin = () => { w.dataset.cle = cle(); };
      if (!deborde(w)) return fin();
      t.classList.add('dense'); if (!deborde(w)) return fin();
      t.classList.add('actions-souples'); if (!deborde(w)) return fin();
      t.classList.add('souple'); if (!deborde(w)) return fin();
      w.classList.add('en-cartes'); fin();
    });
  }

  function choix(racine) {
    racine.querySelectorAll('div:not([data-pro-choix])').forEach(d => {
      const labels = [...d.children].filter(c => c.tagName === 'LABEL' && c.querySelector(':scope > input[type="checkbox"], :scope > input[type="radio"]'));
      if (labels.length >= 3 && labels.length === d.children.length) { d.dataset.proChoix = '1'; d.classList.add('choix'); }
    });
  }

  function barreGestion(c) {
    const gback = c.querySelector(':scope > .gback'), gsel = gback && gback.nextElementSibling;
    if (!gback || !gsel || !gsel.classList.contains('gsel') || gback.parentElement.classList.contains('gbar')) return;
    const barre = document.createElement('div'); barre.className = 'gbar';
    c.insertBefore(barre, gback);
    barre.append(gback, gsel);
    const exp = barre.nextElementSibling;
    if (exp && exp.matches('.row') && exp.children.length === 1 && exp.querySelector(':scope > .btn-export')) { barre.append(exp.firstElementChild); exp.remove(); }
  }

  // Profil et paramètres : les cartes ajoutées sous la grille (mot de passe, règles, agence…) rejoignent
  // la colonne de gauche, à côté du résumé du compte, au lieu d'occuper toute la largeur en dessous.
  const PAGES_PROFIL = /^#\/(client\/profile|owner\/profile|agency\/settings|admin\/settings)$/;
  function profil(c) {
    if (!PAGES_PROFIL.test(location.hash)) return;
    const grille = c.querySelector(':scope > .two-col'); if (!grille || grille.children.length !== 2) return;
    const suivantes = []; let e = grille.nextElementSibling;
    while (e) { if (e.matches('.card, form.card')) suivantes.push(e); e = e.nextElementSibling; }
    if (!suivantes.length) return;
    let gauche = grille.firstElementChild;
    if (!gauche.classList.contains('pro-gauche') && gauche.matches('.card, form')) {
      const col = document.createElement('div'); col.className = 'pro-gauche';
      grille.insertBefore(col, gauche); col.appendChild(gauche); gauche = col;
    } else gauche.classList.add('pro-gauche');
    suivantes.forEach(x => gauche.appendChild(x));
  }

  function suiteVisite(c) {
    const s = c.querySelector(':scope > .suite-visite'), head = c.querySelector(':scope > .page-head');
    if (s && head && (s.compareDocumentPosition(head) & Node.DOCUMENT_POSITION_FOLLOWING)) head.after(s);
  }

  function passer() {
    if (!ECRAN.matches) return;
    const c = document.querySelector('.main > .content'); if (!c) return;
    tableaux(c); choix(c); barreGestion(c); suiteVisite(c); profil(c); ajuster(c);
    const m = document.querySelector('.modal'); if (m) { tableaux(m); choix(m); }
  }
  // Appelé avant l'affichage (micro-tâche) : pas de clignotement entre l'ancienne et la nouvelle mise en page.
  let minuterie = 0;
  addEventListener('resize', () => { clearTimeout(minuterie); minuterie = setTimeout(passer, 120); });
  new MutationObserver(passer).observe(document.body, {childList: true, subtree: true});
  passer();
})();
