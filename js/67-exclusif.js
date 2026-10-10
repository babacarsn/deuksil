/* ==========================================================================
   MODULE : exclusif.js — un bien, un engagement à la fois.
   Trois portes étaient ouvertes : l'écran Ventes proposait une villa déjà
   vendue et des biens déjà engagés dans un dossier en cours ; l'écran Baux
   proposait un appartement déjà loué. On pouvait donc vendre deux fois le
   même bien, le louer à deux personnes, ou le vendre alors qu'il est occupé.
   Une seule règle décide désormais, et elle est appliquée deux fois : à
   l'affichage des listes, et de nouveau à l'enregistrement — un écran resté
   ouvert ne doit pas permettre ce que la liste refuse.
   ========================================================================== */

const VENDABLE = ['vente', 'terrain'];

const bauxDuBien = p => DB.getData(DB.K.leases)
  .filter(l => l.propertyId === (p.id || p) && l.status === 'actif');
const unitesDuBien = p => DB.getData(DB.K.units)
  .filter(x => x.propertyId === (p.id || p) && x.status !== 'archivee');
const venteOuverte = p => DB.getData(DB.K.deals)
  .find(d => d.propertyId === (p.id || p) && d.stage !== 'signe');
const venteConclue = p => DB.getData(DB.K.deals)
  .find(d => d.propertyId === (p.id || p) && d.stage === 'signe');

/* Pourquoi ce bien n'est pas disponible — en clair, pas en code. */
function motifIndisponible(p, quoi) {
  if (!p) return 'Bien introuvable.';
  if (p.status === 'vendu' || venteConclue(p)) {
    const d = venteConclue(p);
    return `${p.title} est déjà vendu${d && d.buyer ? ' à ' + d.buyer : ''}.`;
  }
  if (p.status === 'archive') return `${p.title} est archivé.`;

  if (quoi === 'vente') {
    if (!VENDABLE.includes(p.transaction)) {
      return `${p.title} est publié en location. Modifiez son annonce en « Vente » `
        + `avant de le mettre en vente.`;
    }
    const baux = bauxDuBien(p);
    if (baux.length) {
      return `${p.title} est loué à ${baux[0].tenant}. Un bien ne peut pas être vendu `
        + `et loué en même temps : mettez fin au bail d'abord.`;
    }
    const d = venteOuverte(p);
    if (d) return `${p.title} fait déjà l'objet d'un dossier de vente avec ${d.buyer}.`;
    return '';
  }

  if (p.transaction !== 'location') {
    return `${p.title} est publié en vente. Modifiez son annonce en « Location » `
      + `avant d'établir un bail.`;
  }
  if (venteOuverte(p)) {
    return `${p.title} fait l'objet d'un dossier de vente en cours.`;
  }
  const us = unitesDuBien(p);
  if (us.length) {
    return us.some(x => x.status === 'libre') ? ''
      : `Toutes les unités de ${p.title} sont occupées.`;
  }
  const baux = bauxDuBien(p).filter(l => !l.unitId);
  if (baux.length) {
    return `${p.title} est déjà loué à ${baux[0].tenant}. Mettez fin à ce bail `
      + `avant d'en établir un nouveau.`;
  }
  return '';
}

const disponiblePour = (p, quoi) => !motifIndisponible(p, quoi);
const biensVendables = u => myProps(u).filter(p => disponiblePour(p, 'vente'));
const biensLouables = u => myProps(u).filter(p => disponiblePour(p, 'location'));

/* --- 1. Les listes ne proposent que ce qui est possible ----------------- */
/* L'écran des baux est construit par l'application de base : on retire ses
   options plutôt que de réécrire tout l'écran. */
function filtrerChoixBien(form, quoi) {
  if (!form || form.dataset.xcl) return;
  const sel = form.querySelector('[name="propertyId"]');
  if (!sel || !sel.options.length) return;
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  form.dataset.xcl = '1';
  let retires = 0;
  [...sel.options].forEach(o => {
    if (!o.value) return;
    if (!disponiblePour(gProp(o.value), quoi)) { o.remove(); retires++; }
  });
  if (!sel.options.length || ![...sel.options].some(o => o.value)) {
    sel.innerHTML = `<option value="">${quoi === 'vente'
      ? 'Aucun bien disponible à la vente' : 'Aucun bien libre à la location'}</option>`;
  }
  if (retires && !sel.closest('.field').querySelector('[data-xcl-note]')) {
    const n = document.createElement('div');
    n.className = 'small muted';
    n.style.marginTop = '5px';
    n.setAttribute('data-xcl-note', '');
    n.textContent = quoi === 'vente'
      ? `${retires} bien${retires > 1 ? 's sont écartés' : ' est écarté'} : déjà vendu, loué, `
        + `ou engagé dans un dossier en cours.`
      : `${retires} bien${retires > 1 ? 's sont écartés' : ' est écarté'} : déjà loué, `
        + `en vente, ou vendu.`;
    sel.after(n);
  }
}

new MutationObserver(() => requestAnimationFrame(() => {
  try {
    filtrerChoixBien(document.querySelector('.main form[data-action="g-lease"]'), 'location');
    filtrerChoixBien(document.querySelector('.main form[data-action="v-new"]'), 'vente');
  } catch (e) {}
})).observe(document.body, {childList: true, subtree: true});

/* --- 2. Et l'enregistrement le refuse aussi ---------------------------- */
/* Un écran ouvert depuis dix minutes ne connaît pas le bail signé entre
   temps : on revérifie au moment d'écrire. */
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="g-lease"], form[data-action="v-new"]');
  if (!f) return;
  const u = Auth.current();
  if (!u || !['owner', 'agency'].includes(u.role)) return;
  const quoi = f.dataset.action === 'v-new' ? 'vente' : 'location';
  const sel = f.querySelector('[name="propertyId"]');
  if (!sel) return;
  const motif = motifIndisponible(gProp(sel.value), quoi);
  if (motif) {
    e.preventDefault(); e.stopImmediatePropagation();
    formError(f, motif);
    toast(motif, 'bad');
  }
}, true);

/* La location d'une unité passe par un autre formulaire. */
document.addEventListener('submit', e => {
  const f = e.target.closest('form[data-action="g8-lease"]');
  if (!f) return;
  const x = DB.findItem(DB.K.units, f.dataset.id);
  if (!x) return;
  if (x.status === 'occupée' || DB.getData(DB.K.leases).some(l => l.unitId === x.id && l.status === 'actif')) {
    e.preventDefault(); e.stopImmediatePropagation();
    toast(`L'unité ${x.ref} est déjà louée.`, 'bad');
  }
}, true);

/* --- 3. On ne bascule pas un bien occupé en vente ----------------------- */
const _savePropertyX = saveProperty;
saveProperty = function (form, id, intent) {
  if (id) {
    const avant = DB.findItem(DB.K.properties, id);
    const d = formData(form);
    if (avant && d.transaction && d.transaction !== avant.transaction) {
      const baux = bauxDuBien(avant);
      if (VENDABLE.includes(d.transaction) && baux.length) {
        return formError(form, `${avant.title} est loué à ${baux[0].tenant} : il ne peut pas `
          + `passer en vente tant que le bail est en cours.`);
      }
      if (d.transaction === 'location' && (avant.status === 'vendu' || venteConclue(avant))) {
        return formError(form, `${avant.title} a été vendu : il ne peut plus être mis en location.`);
      }
      if (d.transaction === 'location' && venteOuverte(avant)) {
        return formError(form, `${avant.title} fait l'objet d'un dossier de vente en cours.`);
      }
    }
  }
  return _savePropertyX(form, id, intent);
};
