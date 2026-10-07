/* ==========================================================================
   MODULE : storage.js — couche d'accès unique au localStorage
   Remplacer ces 6 méthodes par des appels API suffit pour passer en production.
   ========================================================================== */
const DB = {
  K: {
    users:'deuksil_users', properties:'deuksil_properties', favorites:'deuksil_favorites',
    visits:'deuksil_visits', messages:'deuksil_messages', notifications:'deuksil_notifications',
    payments:'deuksil_payments', subscriptions:'deuksil_subscriptions', agents:'deuksil_agents',
    searches:'deuksil_searches', activity:'deuksil_activity', documents:'deuksil_documents', session:'deuksil_current_user',
    seed:'deuksil_seed_version'
  },
  getData(k)      { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } },
  setData(k, v)   { try { localStorage.setItem(k, JSON.stringify(v)); this.lastWriteOk = true; } catch (e) { toast('Stockage local saturé : réduisez le nombre ou le poids des fichiers.', 'bad'); this.lastWriteOk = false; } return this.lastWriteOk; },
  addItem(k, item){
    const list = this.getData(k);
    item.id = item.id || uid(k.replace('deuksil_', '').replace(/s$/, ''));
    item.createdAt = item.createdAt || now(); item.updatedAt = now();
    list.push(item); this.setData(k, list); return item;
  },
  updateItem(k, id, patch) {
    const list = this.getData(k), i = list.findIndex(x => x.id === id);
    if (i < 0) return null;
    list[i] = {...list[i], ...patch, updatedAt: now()};
    this.setData(k, list); return list[i];
  },
  deleteItem(k, id) { this.setData(k, this.getData(k).filter(x => x.id !== id)); },
  findItem(k, fn)   { return this.getData(k).find(typeof fn === 'function' ? fn : x => x.id === fn) || null; },
  filterItems(k, fn){ return this.getData(k).filter(fn); },
  reset() { Object.values(this.K).forEach(k => localStorage.removeItem(k)); }
};
