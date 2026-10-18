/* ==========================================================================
   VUE : recherche immobilière (publique + client connecté)
   ========================================================================== */
let searchState = {transaction:'', region:'', city:'', quartier:'', type:'', min:'', max:'', rooms:'', baths:'', surface:'', furnished:false, parking:false, sort:'recent', page:1};
const PAGE_SIZE = 9;
const SORT_LABEL = {recent:'Plus récents', priceAsc:'Prix croissant', priceDesc:'Prix décroissant', viewsDesc:'Les plus vus', surfaceDesc:'Plus grande surface'};

function applySearch() {
  const s = searchState;
  const list = published().filter(p =>
    (!s.transaction || p.transaction === s.transaction || (s.transaction === 'vente' && p.transaction === 'terrain')) &&
    (!s.region || p.region === s.region) && (!s.city || p.city === s.city) && (!s.quartier || p.quartier === s.quartier) &&
    (!s.type || p.type === s.type) &&
    (!s.min || p.price >= +s.min) && (!s.max || p.price <= +s.max) &&
    (!s.rooms || p.rooms >= +s.rooms) && (!s.baths || p.baths >= +s.baths) && (!s.surface || p.surface >= +s.surface) &&
    (!s.furnished || p.furnished) && (!s.parking || p.parking) &&
    p.status !== 'loue' && p.status !== 'vendu'
  );
  const sorters = {
    recent: (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
    priceAsc: (a, b) => a.price - b.price,
    priceDesc: (a, b) => b.price - a.price,
    viewsDesc: (a, b) => (b.views || 0) - (a.views || 0),
    surfaceDesc: (a, b) => b.surface - a.surface
  };
  return list.sort(sorters[s.sort] || sorters.recent);
}
function activeChips() {
  const s = searchState, chips = [];
  if (s.transaction) chips.push(['transaction', TRANSACTION_LABEL[s.transaction]]);
  if (s.region) chips.push(['region', s.region]);
  if (s.city) chips.push(['city', s.city]);
  if (s.quartier) chips.push(['quartier', s.quartier]);
  if (s.type) chips.push(['type', s.type[0].toUpperCase() + s.type.slice(1)]);
  if (s.min) chips.push(['min', 'à partir de ' + money(+s.min)]);
  if (s.max) chips.push(['max', "jusqu'à " + money(+s.max)]);
  if (s.rooms) chips.push(['rooms', s.rooms + ' chambres min.']);
  if (s.baths) chips.push(['baths', s.baths + ' sdb min.']);
  if (s.surface) chips.push(['surface', 'à partir de ' + s.surface + ' m²']);
  if (s.furnished) chips.push(['furnished', 'Meublé']);
  if (s.parking) chips.push(['parking', 'Parking']);
  return chips;
}
