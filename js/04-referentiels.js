/* ==========================================================================
   MODULE : référentiels
   ========================================================================== */
const LOCATIONS = {
  'Dakar': {
    'Dakar': ['Almadies', 'Mermoz', 'Sacré-Cœur', 'Ouakam', 'Yoff', 'Plateau', 'Point E', 'Ngor', 'Parcelles Assainies'],
    'Pikine': ['Pikine Nord', 'Thiaroye', 'Guinaw Rails'],
    'Guédiawaye': ['Golf Sud', 'Wakhinane'],
    'Rufisque': ['Rufisque Est', 'Bargny']
  },
  'Thiès':     { 'Thiès': ['Randoulène', 'Mbour 1', 'Grand Thiès'], 'Mbour': ['Saly', 'Nianing', 'Mbour Centre'] },
  'Diourbel':  { 'Touba': ['Darou Khoudoss', 'Gouye Mbind'], 'Diourbel': ['Keur Ngagne'] },
  'Saint-Louis': { 'Saint-Louis': ['Sor', 'Nord', 'Pikine Saint-Louis'] },
  'Kaolack':   { 'Kaolack': ['Médina Baye', 'Léona'] },
  'Ziguinchor':{ 'Ziguinchor': ['Boucotte', 'Kandé'] }
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
