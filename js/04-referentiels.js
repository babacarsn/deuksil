/* ==========================================================================
   MODULE : référentiels
   ========================================================================== */
/* Les 14 régions du Sénégal, leurs départements (niveau « ville » des
   formulaires) et quelques quartiers ou communes. Les entrées d'origine
   sont conservées telles quelles : les biens déjà saisis restent valides. */
const LOCATIONS = {
  'Dakar': {
    'Dakar': ['Almadies', 'Mermoz', 'Sacré-Cœur', 'Ouakam', 'Yoff', 'Plateau', 'Point E', 'Ngor', 'Parcelles Assainies',
              'Fann', 'Médina', 'Liberté 6', 'HLM', 'Grand Yoff', 'Ouest Foire', 'Mamelles', 'Sicap Baobab'],
    'Pikine': ['Pikine Nord', 'Thiaroye', 'Guinaw Rails', 'Pikine Est', 'Dalifort', 'Mbao'],
    'Guédiawaye': ['Golf Sud', 'Wakhinane', 'Sam Notaire', 'Ndiarème Limamoulaye'],
    'Rufisque': ['Rufisque Est', 'Bargny', 'Diamniadio', 'Sangalkam', 'Sébikotane', 'Bambilor'],
    'Keur Massar': ['Keur Massar Nord', 'Keur Massar Sud', 'Malika', 'Yeumbeul Nord', 'Jaxaay']
  },
  'Diourbel': {
    'Touba': ['Darou Khoudoss', 'Gouye Mbind', 'Darou Marnane'],
    'Diourbel': ['Keur Ngagne', 'Diourbel Centre'],
    'Bambey': ['Bambey Centre', 'Lambaye'],
    'Mbacké': ['Mbacké Centre', 'Taïf']
  },
  'Fatick': {
    'Fatick': ['Fatick Centre', 'Diakhao', 'Djilor'],
    'Foundiougne': ['Foundiougne Centre', 'Sokone', 'Toubacouta'],
    'Gossas': ['Gossas Centre', 'Colobane']
  },
  'Kaffrine': {
    'Kaffrine': ['Kaffrine Centre', 'Diamagadio'],
    'Birkelane': ['Birkelane Centre'],
    'Koungheul': ['Koungheul Centre'],
    'Malem-Hodar': ['Malem-Hodar Centre']
  },
  'Kaolack': {
    'Kaolack': ['Médina Baye', 'Léona', 'Kasnack', 'Ndorong'],
    'Nioro du Rip': ['Nioro Centre', 'Keur Madiabel'],
    'Guinguinéo': ['Guinguinéo Centre']
  },
  'Kédougou': {
    'Kédougou': ['Kédougou Centre', 'Dandé'],
    'Saraya': ['Saraya Centre'],
    'Salémata': ['Salémata Centre']
  },
  'Kolda': {
    'Kolda': ['Sikilo', 'Doumassou', 'Gadapara'],
    'Vélingara': ['Vélingara Centre'],
    'Médina Yoro Foulah': ['Médina Yoro Foulah Centre']
  },
  'Louga': {
    'Louga': ['Louga Centre', 'Artillerie', 'Keur Serigne Louga'],
    'Linguère': ['Linguère Centre', 'Dahra'],
    'Kébémer': ['Kébémer Centre', 'Darou Mousty']
  },
  'Matam': {
    'Matam': ['Matam Centre', 'Ourossogui'],
    'Kanel': ['Kanel Centre', 'Waoundé'],
    'Ranérou-Ferlo': ['Ranérou Centre']
  },
  'Saint-Louis': {
    'Saint-Louis': ['Sor', 'Nord', 'Pikine Saint-Louis', 'Guet Ndar', 'Hydrobase'],
    'Dagana': ['Dagana Centre', 'Richard-Toll', 'Ross Béthio'],
    'Podor': ['Podor Centre', 'Ndioum']
  },
  'Sédhiou': {
    'Sédhiou': ['Sédhiou Centre', 'Marsassoum'],
    'Bounkiling': ['Bounkiling Centre'],
    'Goudomp': ['Goudomp Centre', 'Samine']
  },
  'Tambacounda': {
    'Tambacounda': ['Dépôt', 'Pont', 'Abattoirs', 'Médina Coura'],
    'Bakel': ['Bakel Centre', 'Kidira'],
    'Goudiry': ['Goudiry Centre'],
    'Koumpentoum': ['Koumpentoum Centre']
  },
  'Thiès': {
    'Thiès': ['Randoulène', 'Mbour 1', 'Grand Thiès', 'Cité Lamy', 'Nguinth'],
    'Mbour': ['Saly', 'Nianing', 'Mbour Centre', 'Somone', 'Ngaparou', 'Joal-Fadiouth'],
    'Tivaouane': ['Tivaouane Centre', 'Mboro', 'Pire']
  },
  'Ziguinchor': {
    'Ziguinchor': ['Boucotte', 'Kandé', 'Lyndiane', 'Tilène', 'Santhiaba'],
    'Bignona': ['Bignona Centre', 'Diouloulou'],
    'Oussouye': ['Oussouye Centre', 'Cap Skirring']
  }
};
const PROPERTY_TYPES = ['appartement','villa','maison','studio','chambre','terrain','bureau','local commercial'];
const AMENITIES = ['Climatisation','Parking','Groupe électrogène','Ascenseur','Piscine','Sécurité 24h','Cuisine équipée','Balcon','Jardin','Eau et électricité','Titre foncier','Meublé'];
const TRANSACTION_LABEL = {location:'Location', vente:'Vente', terrain:'Terrain'};
const STATUS_LABEL = {disponible:'Disponible', discussion:'En discussion', loue:'Loué', vendu:'Vendu', archive:'Archivé'};
const STATUS_TONE  = {disponible:'ok', discussion:'warn', loue:'info', vendu:'info', archive:''};
const LISTING_LABEL = {brouillon:'Brouillon', attente:'En attente de validation', publiee:'Publiée', refusee:'Refusée', pause:'En pause', archivee:'Archivée'};
const LISTING_TONE  = {brouillon:'', attente:'warn', publiee:'ok', refusee:'bad', pause:'info', archivee:''};
const VISIT_LABEL = {attente:'En attente', acceptee:'Acceptée', refusee:'Refusée', reportee:'Reportée', terminee:'Terminée'};
const VISIT_TONE  = {attente:'warn', acceptee:'ok', refusee:'bad', reportee:'info', terminee:''};
