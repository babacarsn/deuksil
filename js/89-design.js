/* ==========================================================================
   MODULE : design.js — refonte visuelle d'après les maquettes « Ventes » et
   « Locataires & baux ». Ce module ne change aucune logique : il habille les
   écrans existants après chaque affichage.
     1. Fil d'Ariane en pastille (retour rond, maison avant « Gestion ») et
        menu de section sorti en dessous, en carte avec chevron.
     2. Tuiles d'indicateurs : pastille ronde, flèche « voir le détail »,
        fond teinté selon la couleur de la tuile.
     3. Formulaires en carte : en-tête avec pastille d'icône, titre et
        sous-titre, trait de séparation.
     4. Champs : icône à gauche selon ce qu'on saisit (bien, personne,
        téléphone, montant, date…), chevron dessiné pour les listes.
     5. Montants affichés avec séparateur de milliers (85 000 000) : la
        valeur lue par l'application reste le nombre brut.
     6. Aides sous les champs précédées d'un « i ».
     7. Bouton « Exporter » avec icône, bouton de l'assistant en bulle.
   Styles : css/02-refonte.css, § « Refonte d'après maquettes ».
   ========================================================================== */

/* --- Icônes pour les champs (images CSS générées depuis ICONS) ------------ */
const DS_ICONES = ['home', 'building', 'user', 'users', 'phone', 'wallet', 'calendar', 'mail', 'clock', 'file',
  'pin', 'key', 'card', 'immeuble', 'pourcent', 'layers', 'search', 'area', 'bed', 'bath', 'briefcase', 'store', 'land', 'settings', 'repeat'];
const dsUrl = (svg, coul) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/currentColor/g, coul).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" '))}")`;
(() => {
  const gris = '#7C8DA6', chev = dsUrl(icon('chevDown', 18), '#0C2745');
  const info = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#8A9BB2"/><rect x="9" y="8.4" width="2" height="6" rx="1" fill="#fff"/><circle cx="10" cy="5.8" r="1.25" fill="#fff"/></svg>')}")`;
  let css = `:root{--ds-chev:${chev};--ds-info:${info};--ds-upload:${dsUrl(icon('upload', 18), '#0C2745')}}\n`;
  DS_ICONES.forEach(n => {
    if (!ICONS[n]) return;
    const u = dsUrl(icon(n, 20), gris);
    css += `.input[data-ic="${n}"]{background-image:${u}}select.input[data-ic="${n}"]{background-image:${u},var(--ds-chev)}\n`;
  });
  document.head.insertAdjacentHTML('beforeend', `<style id="ds-icones">${css}</style>`);
})();

/* --- Quelle icône pour quel champ ---------------------------------------- */
const DS_MONTANTS = /^(amount|rent|deposit|price|charges|cost|offer|buy|montant|loyer|caution|value|prix|acompte|budget)$/i;
function dsIconeChamp(el) {
  const n = (el.name || '').toLowerCase(), t = (el.type || '').toLowerCase();
  const lab = ((el.closest('.field') || {}).querySelector ? (el.closest('.field').querySelector('label') || {}).textContent || '' : '').toLowerCase();
  const tout = n + ' ' + lab + ' ' + (el.dataset.action || '') + ' ' + (el.placeholder || '').toLowerCase();
  if (t === 'date' || t === 'month' || /date|start|end|échéance|mois|month/.test(n)) return 'calendar';
  if (t === 'tel' || /phone|tél|telephone|whatsapp/.test(tout)) return 'phone';
  if (t === 'email' || /mail/.test(tout)) return 'mail';
  if (DS_MONTANTS.test(n) || /fcfa|prix|montant|loyer|caution|acompte|commission \(/.test(lab)) return 'wallet';
  if (/rate|taux|pourcent|%/.test(tout)) return 'pourcent';
  if (/property|bien|logement|unit/.test(n + ' ' + lab)) return /vend|vente/.test(lab + ' ' + ((el.form && el.form.dataset.action) || '')) ? 'immeuble' : 'home';
  if (/tenant|client|buyer|acqu|locataire|person|nom|name|bc-choisir|owner|mandant|propriétaire/.test(tout)) return 'user';
  if (/months|durée|duree|days|jours/.test(tout)) return 'clock';
  if (/surface|m²/.test(tout)) return 'area';
  if (/rooms|chambres/.test(tout)) return 'bed';
  if (/city|ville|quartier|adresse|address|region|commune/.test(tout)) return 'pin';
  if (/cni|ref|référence|numero|numéro/.test(tout)) return 'card';
  if (/categor|type|kind|statut|status|cat\b/.test(tout)) return 'layers';
  if (/password|mot de passe/.test(tout)) return 'key';
  return '';
}

/* --- Montants : « 85 000 000 » à l'écran, 85000000 pour l'application ---- */
const DS_VAL = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
const dsBrut = s => String(s == null ? '' : s).replace(/[\s  ]/g, '');
const dsFormate = s => { const b = dsBrut(s); return /^\d+$/.test(b) ? b.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : b; };
function dsMontant(el) {
  if (el.dataset.montant || el.type !== 'number') return;
  const v = DS_VAL.get.call(el);
  el.dataset.montant = '1';
  el.type = 'text'; el.inputMode = 'numeric'; el.autocomplete = 'off';
  if (!el.pattern) el.pattern = '[0-9  ]*';
  Object.defineProperty(el, 'value', {configurable: true,
    get() { return dsBrut(DS_VAL.get.call(this)); },
    set(x) { DS_VAL.set.call(this, dsFormate(x)); }});
  DS_VAL.set.call(el, dsFormate(v));
}
document.addEventListener('input', e => {
  const el = e.target; if (!el.dataset || !el.dataset.montant) return;
  const avant = DS_VAL.get.call(el), pos = el.selectionStart || 0;
  const chiffresAvant = avant.slice(0, pos).replace(/\D/g, '').length;
  const neuf = dsFormate(avant.replace(/[^\d]/g, ''));
  if (neuf === avant) return;
  DS_VAL.set.call(el, neuf);
  let i = 0, c = 0; while (i < neuf.length && c < chiffresAvant) { if (/\d/.test(neuf[i])) c++; i++; }
  try { el.setSelectionRange(i, i); } catch (er) {}
}, true);
/* formData() lit les valeurs brutes, sans les espaces. */
const _formDataDs = formData;
formData = function (form) {
  const d = _formDataDs(form);
  form.querySelectorAll('[data-montant][name]').forEach(i => { if (d[i.name] != null) d[i.name] = dsBrut(d[i.name]); });
  return d;
};

/* --- Habillage après chaque affichage ------------------------------------ */
const DS_FORM_IC = [[/sale|vente|v-new|deal/, 'home'], [/lease|bail/, 'file'], [/rent|pay|loyer|fpay|t-pay|encaiss/, 'wallet'],
  [/ticket|travaux|maint/, 'settings'], [/expense|dépense|depense/, 'card'], [/doc|facture|devis/, 'layers'], [/owner|mandant|m-new|mandat/, 'user'],
  [/contract|contrat/, 'file'], [/provider|prestat/, 'briefcase'], [/unit/, 'building'], [/member|g4-|team|tenant/, 'users'], [/search|sb-/, 'search']];
function dsHabiller(root) {
  /* 1. Fil d'Ariane et menu de section */
  root.querySelectorAll('.gback:not([data-ds])').forEach(g => {
    g.dataset.ds = '1';
    const lien = g.querySelector('a.small');
    if (lien && !lien.querySelector('svg')) lien.insertAdjacentHTML('afterbegin', icon('home', 17));
    const sel = g.querySelector('select[data-action="g-goto"]');
    if (sel) { const w = document.createElement('div'); w.className = 'gsel'; g.after(w); w.appendChild(sel); }
  });
  /* 2. Tuiles d'indicateurs */
  root.querySelectorAll('.kpi-rich:not([data-ds])').forEach(k => {
    k.dataset.ds = '1';
    if (!k.closest('a')) k.insertAdjacentHTML('beforeend', `<button type="button" class="kpi-go" data-action="ds-detail" aria-label="Voir le détail : ${esc(((k.querySelector('.l') || {}).textContent || '').trim())}">${icon('arrowRight', 15)}</button>`);
  });
  /* 3. En-têtes de formulaires */
  root.querySelectorAll('form.card > h4:first-child:not([data-ds])').forEach(h => {
    h.dataset.ds = '1';
    const f = h.parentElement, act = (f.dataset.action || '') + ' ' + h.textContent.toLowerCase();
    const ic = (DS_FORM_IC.find(([re]) => re.test(act)) || [, 'plus'])[1];
    const lab = f.querySelector('.field label');
    const sous = f.dataset.sub || (lab ? lab.textContent.replace(/\*/g, '').trim() : '');
    const tete = document.createElement('div'); tete.className = 'fhead';
    tete.innerHTML = `<span class="fhead-ic" aria-hidden="true">${icon(ic, 21)}</span><div class="fhead-t"></div>`;
    h.style.margin = '0'; tete.querySelector('.fhead-t').appendChild(h.cloneNode(true));
    if (sous && sous.length < 48) tete.querySelector('.fhead-t').insertAdjacentHTML('beforeend', `<p>${esc(sous)}</p>`);
    h.replaceWith(tete); tete.insertAdjacentHTML('afterend', '<hr class="fsep">');
  });
  /* 4–6. Champs, montants, aides */
  root.querySelectorAll('.input:not([data-ds])').forEach(el => {
    el.dataset.ds = '1';
    if (el.tagName === 'TEXTAREA' || ['checkbox', 'radio', 'file', 'hidden', 'color', 'range'].includes(el.type)) return;
    if (el.closest('.sbar, .searchrow, .searchpill, .hx-search, .rfiltre, .gsel, .ai-v2')) return;
    if (el.parentElement && el.parentElement.querySelector(':scope > .ifx')) return;   /* le champ a déjà son icône (connexion) */
    if (el.type === 'number' && DS_MONTANTS.test(el.name || '')) dsMontant(el);
    const ic = dsIconeChamp(el); if (ic && ICONS[ic]) el.dataset.ic = ic;
  });
  root.querySelectorAll('.field > .small.muted:not(.fhint), .field > [data-xcl-note], .field > [data-bc-aide]').forEach(a => a.classList.add('fhint'));
  /* 7. Exporter */
  root.querySelectorAll('#app .btn:not([data-dsx])').forEach(b => {
    b.dataset.dsx = '1';
    if (!/^\s*exporter/i.test(b.textContent) || b.querySelector('svg')) return;
    b.classList.add('btn-export'); b.insertAdjacentHTML('afterbegin', icon('upload', 17));
  });
  /* Bouton de l'assistant : bulle de discussion + pastille dorée */
  document.querySelectorAll('.ai-fab:not([data-ds])').forEach(f => {
    f.dataset.ds = '1';
    f.innerHTML = `<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c-4.97 0-9 3.36-9 7.5 0 2.1 1.04 4 2.72 5.36L5 20.5l4.24-2.12c.88.21 1.8.32 2.76.32 4.97 0 9-3.36 9-7.5s-4.03-7.5-9-7.5Z" fill="#fff"/><circle cx="8.3" cy="11" r="1.3" fill="#0C2745"/><circle cx="12" cy="11" r="1.3" fill="#0C2745"/><circle cx="15.7" cy="11" r="1.3" fill="#0C2745"/></svg><i class="fab-dot"></i>`;
  });
}
/* La flèche d'une tuile amène à la liste détaillée de la page. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-action="ds-detail"]'); if (!b) return;
  e.preventDefault();
  const tuiles = b.closest('.kpis') || b.closest('.kpi-rich');
  let cible = null;
  for (let n = tuiles; n && !cible; n = n.nextElementSibling) if (n !== tuiles && (n.matches('table, .tbl, .table-wrap, .gtable, .list, .card:not(form)') || n.querySelector && n.querySelector('table'))) cible = n;
  (cible || tuiles).scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
});

(() => {
  const app = document.getElementById('app'); if (!app) return;
  /* Appliqué dans la foulée de chaque changement (pas d'écran « nu » visible). */
  let enCours = false;
  const tout = () => { if (enCours) return; enCours = true; try { dsHabiller(document); } catch (e) { console.warn('design', e); } finally { enCours = false; } };
  new MutationObserver(tout).observe(document.body, {childList: true, subtree: true});
  tout();
})();

/* ==========================================================================
   Suite : fiches de biens, boutons d'action et filtres (maquette « Mes biens »)
   ========================================================================== */
Object.assign(ICONS, {
  crayon: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/><path d="M4 22h8"/>',
  pause: '<path d="M8.5 5v14"/><path d="M15.5 5v14"/>',
  lecture: '<path d="M7 5l12 7-12 7V5z"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9"/><path d="M10 13h4"/>',
  tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9z"/><circle cx="7.5" cy="7.5" r="1.3"/>',
  envoyer: '<path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4 18-7z"/>',
  telecharger: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'
});
/* Le libellé (ou l'action) d'un bouton donne son icône. */
const DS_BOUTONS = [
  [/^(ouvrir|voir|consulter|détail|aperçu)/i, 'eye'], [/^modifier|^éditer|^editer/i, 'crayon'],
  [/mettre en pause|^suspendre/i, 'pause'], [/^(réactiver|reprendre|remettre en ligne|publier)/i, 'lecture'],
  [/^archiver/i, 'archive'], [/^(supprimer|retirer)/i, 'trash'], [/^quittance|^reçu|^facture|^contrat|^relevé/i, 'file'],
  [/^encaisser|^payer|^enregistrer le paiement|^reverser/i, 'wallet'], [/^relancer|^rappeler/i, 'bell'],
  [/^télécharger|^telecharger|^pdf/i, 'telecharger'], [/^envoyer|^partager/i, 'envoyer'], [/^ajouter|^nouveau|^nouvelle|^créer/i, 'plus'],
  [/^accepter|^valider|^confirmer|^marquer payé/i, 'check'], [/^refuser|^annuler|^rejeter/i, 'close'], [/^appeler/i, 'phone'],
  [/^renouveler|^prolonger/i, 'repeat'], [/^message|^écrire|^contacter|^répondre/i, 'message'], [/^planifier|^programmer/i, 'calendar']
];
const DS_PUCES = {tous: 'home', location: 'pin', vente: 'tag', terrain: 'land', retard: 'alert', venir: 'clock', encaiss: 'checkCircle',
  pay: 'checkCircle', ouvert: 'clock', cours: 'clock', termin: 'checkCircle', actif: 'checkCircle', brouillon: 'file', attente: 'clock', publi: 'eye'};
function dsBoutonsEtFiltres(root) {
  /* Boutons d'action sans icône */
  root.querySelectorAll('#app .btn:not([data-dsb]), #app .linkbtn:not([data-dsb])').forEach(b => {
    b.dataset.dsb = '1';
    if (b.querySelector('svg') || b.closest('.hx, .hx-search, .searchpill, .sbar, .pd-actions, .qa-grid, .tab-fab')) return;
    const txt = b.textContent.trim(); if (!txt || txt.length > 32) return;
    const m = DS_BOUTONS.find(([re]) => re.test(txt)); if (!m || !ICONS[m[1]]) return;
    b.insertAdjacentHTML('afterbegin', icon(m[1], b.classList.contains('sm') ? 17 : 18)); b.classList.add('btn-ic');
  });
  /* Puces de filtre : icône selon le filtre */
  root.querySelectorAll('.rchip:not([data-dsp])').forEach(c => {
    c.dataset.dsp = '1'; if (c.querySelector('svg')) return;
    const cle = ((c.dataset.id || '') + ' ' + c.textContent).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const k = Object.keys(DS_PUCES).find(x => cle.includes(x)); if (!k || !ICONS[DS_PUCES[k]]) return;
    c.insertAdjacentHTML('afterbegin', icon(DS_PUCES[k], 18));
  });
  /* Barre « Filtrer cette liste » : réglages à droite (décoratif) */
  root.querySelectorAll('.tfilter:not([data-dsf])').forEach(t => {
    t.dataset.dsf = '1';
    t.insertAdjacentHTML('beforeend', `<span class="tfilter-reg" aria-hidden="true">${icon('sliders', 20)}</span>`);
  });
  /* Listes déroulantes d'état dans les fiches */
  root.querySelectorAll('.table-wrap select:not(.input):not([data-dss])').forEach(s => { s.dataset.dss = '1'; s.classList.add('ds-sel'); });
}
const _dsHabiller1 = dsHabiller;
dsHabiller = function (root) { _dsHabiller1(root); dsBoutonsEtFiltres(root); };

/* Tuiles simples (kpi) : même présentation que les tuiles à icône. L'icône
   est choisie d'après le libellé du chiffre. */
const DS_KPI_IC = [
  [/recevoir/i, 'wallet'], [/déjà versé|deja verse|versée|versé$/i, 'checkCircle'],
  [/taux|%/i, 'pourcent'], [/occup/i, 'key'], [/libre|vacant|disponible/i, 'door'], [/unité|unite/i, 'immeuble'], [/tiroir/i, 'layers'], [/expir|bientôt|bientot/i, 'clock'],
  [/impay|retard|reste|à encaisser|a encaisser|\bdû\b/i, 'alert'], [/encaiss|reçu|recu|payé|paye|perçu|percu/i, 'wallet'], [/factur/i, 'layers'],
  [/dépense|depense|charge|coût|cout/i, 'card'], [/résultat|resultat|bénéfice|benefice|net|rentab/i, 'barres'],
  [/commission|taux|%/i, 'pourcent'], [/revers|solde/i, 'repeat'], [/caution|dépôt|depot/i, 'key'],
  [/bail|baux|contrat|mandat/i, 'file'], [/locataire|client|propriétaire|proprietaire|membre/i, 'users'],
  [/bien|logement|annonce|unité|unite/i, 'home'], [/visite|rendez|échéance|echeance|mois/i, 'calendar'],
  [/vente|dossier/i, 'briefcase'], [/travaux|ticket|intervention|maintenance/i, 'settings'], [/vue|consult/i, 'eye'],
  [/message/i, 'message'], [/document|fichier|pièce|piece/i, 'file']
];
function dsTuiles(root) {
  root.querySelectorAll('.kpis .kpi:not([data-dsk])').forEach(k => {
    k.dataset.dsk = '1';
    const lab = ((k.querySelector('.l') || {}).textContent || '').trim();
    const ic = (DS_KPI_IC.find(([re]) => re.test(lab)) || [, 'chart'])[1];
    const t = k.dataset.tone || 'brand';
    k.classList.add('kpi-rich', 'kpi-conv');
    k.insertAdjacentHTML('afterbegin', `<div class="kpi-icon">${icon(ICONS[ic] ? ic : 'chart', 19)}</div>`);
    if (!k.closest('a') && !k.querySelector('.kpi-go'))
      k.insertAdjacentHTML('beforeend', `<button type="button" class="kpi-go" data-action="ds-detail" aria-label="Voir le détail : ${esc(lab)}">${icon('arrowRight', 15)}</button>`);
    k.dataset.ds = '1';
  });
}
const _dsHabiller2 = dsHabiller;
dsHabiller = function (root) { dsTuiles(root); _dsHabiller2(root); };

/* Tableaux de bord : mêmes codes que les maquettes (flèche ronde sur les
   tuiles et les actions rapides, qui sont déjà des liens). */
function dsTableaux(root) {
  root.querySelectorAll('a.pd-mini:not([data-dsd]), a.quick-card:not([data-dsd])').forEach(a => {
    a.dataset.dsd = '1';
    if (!a.querySelector('.ds-go')) a.insertAdjacentHTML('beforeend', `<span class="ds-go" aria-hidden="true">${icon('arrowRight', 15)}</span>`);
  });
}
const _dsHabiller3 = dsHabiller;
dsHabiller = function (root) { _dsHabiller3(root); dsTableaux(root); };

/* Listes des tableaux de bord (Mon patrimoine, Mon portefeuille, Mon
   logement, Plateforme) : une icône dans une pastille ronde à la place de
   la photo, choisie d'après le titre de la ligne, chacune dans sa couleur. */
const DS_LISTE_IC = [
  [/mon propriétaire|mon proprietaire/i, 'message', 'ok'], [/locataire|bail|baux/i, 'users', 'ok'], [/vente/i, 'tag', 'gold'], [/document|coffre|quittance/i, 'file', 'info'],
  [/mandant|propriétaire|proprietaire/i, 'user', 'brand'], [/biens gérés|biens geres/i, 'immeuble', 'info'],
  [/intervention|travaux|demande/i, 'settings', 'gold'], [/utilisateur|compte/i, 'users', 'brand'], [/annonce/i, 'megaphone', 'ok'],
  [/signalement/i, 'alert', 'bad'], [/vérification|verification/i, 'checkCircle', 'info'], [/message/i, 'message', 'info'],
  [/logement|appartement|maison|villa|studio|bien/i, 'home', 'brand']
];
function dsListes(root) {
  root.querySelectorAll('.pd-item:not([data-dsl])').forEach(it => {
    it.dataset.dsl = '1';
    const th = it.querySelector('.pd-thumb'); if (!th) return;
    const titre = ((it.querySelector('.pd-item-txt b') || {}).textContent || '').trim();
    const [, ic, ton] = DS_LISTE_IC.find(([re]) => re.test(titre)) || [, 'home', 'brand'];
    th.className = 'pd-thumb pd-thumb-ic'; th.dataset.tone = ton;
    th.innerHTML = icon(ICONS[ic] ? ic : 'home', 24);
  });
}
const _dsHabiller4 = dsHabiller;
dsHabiller = function (root) { _dsHabiller4(root); dsListes(root); };

/* Textes d'exemple (placeholders) dans les champs qui n'en ont pas, d'après
   le nom du champ ou son libellé. Les champs déjà remplis ne changent pas. */
const DS_EXEMPLES = [
  [/cni/i, 'Ex. 1234567890123 (13 chiffres)'], [/mail/i, 'exemple@mail.sn'], [/phone|tél|telephone|whatsapp/i, '77 000 00 00'],
  [/password|mot de passe/i, '8 caractères minimum'], [/iban|rib|compte bancaire/i, 'SN08 …'],
  [/firstname|prénom|prenom/i, 'Ex. Awa'], [/lastname|^nom$|\bnom\b(?! complet)/i, 'Ex. Diop'],
  [/address|adresse/i, 'Ex. Rue 10 x Corniche, Almadies, Dakar'],
  [/tenant|locataire|buyer|acqu|client|name|nom complet|société|societe|propriétaire|proprietaire|vendeur|fournisseur|prestataire/i, 'Ex. Mamadou Diallo'], [/quartier|lieu/i, 'Ex. Almadies, Mermoz…'], [/city|ville/i, 'Ex. Dakar'],
  [/rate|taux|commission|%/i, 'Ex. 8'], [/surface|m²/i, 'Ex. 120'], [/rooms|chambres/i, 'Ex. 3'], [/baths|salle/i, 'Ex. 2'],
  [/months|durée|duree/i, 'Ex. 12'], [/days|jours/i, 'Ex. 30'], [/dueday|jour d'échéance|echeance/i, 'Ex. 5'],
  [/deposit|caution/i, 'Ex. 500 000'], [/cost|coût|cout|dépense|depense/i, 'Ex. 25 000'], [/price|prix de vente/i, 'Ex. 85 000 000'],
  [/rent|loyer|price|prix|amount|montant|deposit|caution|charges|cost|coût|offer|offre|budget|acompte|value|valeur|retenue|fcfa/i, 'Ex. 250 000'],
  [/ref|référence|reference|numéro|numero|transaction/i, 'Ex. N° de transaction'], [/title|titre|problème|probleme|objet/i, 'Ex. Fuite d\'eau dans la cuisine'],
  [/motif|raison/i, 'Ex. Peinture de la chambre'], [/hours|heures/i, 'Ex. Lun–Sam, 9h–18h'], [/compteur|elec|\beau\b/i, 'Ex. 004512'],
  [/note|remarque|comment|description|message|desc/i, 'Écrivez ici…'], [/cles|clés/i, 'Ex. 2']
];
function dsExemples(root) {
  root.querySelectorAll('#app input.input:not([placeholder]):not([data-dse]), #app textarea:not([placeholder]):not([data-dse]), .modal input.input:not([placeholder]):not([data-dse]), .modal textarea:not([placeholder]):not([data-dse])').forEach(el => {
    el.dataset.dse = '1';
    if (['date', 'month', 'time', 'checkbox', 'radio', 'file', 'hidden', 'color', 'range'].includes(el.type)) return;
    const lab = ((el.closest('.field') || {}).querySelector ? ((el.closest('.field').querySelector('label') || {}).textContent || '') : '').replace(/\*/g, '').trim();
    const cle = (el.name || '') + ' ' + lab;
    if (el.type === 'password') {
      el.placeholder = /ancien|actuel|current/i.test(el.name + ' ' + lab + ' ' + (el.autocomplete || '')) ? 'Votre mot de passe actuel'
        : /confirm|password2/i.test(el.name + ' ' + lab) ? 'Retapez le nouveau mot de passe' : '8 caractères minimum';
      return;
    }
    const m = DS_EXEMPLES.find(([re]) => re.test(el.name || '')) || DS_EXEMPLES.find(([re]) => re.test(lab));
    if (m) el.placeholder = m[1];
    else if (lab) el.placeholder = lab.length < 40 ? lab + '…' : '';
  });
}
const _dsHabiller5 = dsHabiller;
dsHabiller = function (root) { _dsHabiller5(root); dsExemples(root); };
