-- =============================================================================
-- DEUKSIL — VIDER UN PROJET : supprime TOUTES les données (comptes, biens, baux,
-- loyers, messages, documents…) et garde la structure (tables, règles RLS,
-- fonctions, tâche planifiée, réglages app.reglages).
--
--   IRRÉVERSIBLE. Faire d'abord une sauvegarde (supabase/sauvegarde/sauvegarder.sh).
--   À n'utiliser que pour remettre à zéro un projet avant son ouverture
--   (par exemple s'il a reçu le jeu de test par erreur).
--
-- Usage (la première commande lève la protection, pour cette session seulement) :
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "set deuksil.vider = 'oui'" -f supabase/outils/vider-projet.sql
-- Puis vider les fichiers : node supabase/outils/vider-fichiers.js (Storage).
-- Contrôle : psql "$DATABASE_URL" -f supabase/outils/verifier-projet-vide.sql
-- =============================================================================
do $$
declare liste text;
begin
  if coalesce(current_setting('deuksil.vider', true), '') <> 'oui' then
    raise exception 'Protection : lancer avec  -c "set deuksil.vider = ''oui''"  (voir l''en-tête du fichier).';
  end if;
  select string_agg(format('public.%I', tablename), ', ') into liste from pg_tables where schemaname = 'public';
  execute 'truncate table ' || liste || ' restart identity cascade';
  delete from auth.users;            -- identités, sessions et facteurs MFA suivent (cascade)
  raise notice 'Projet vidé : % tables publiques et tous les comptes.', (select count(*) from pg_tables where schemaname = 'public');
end $$;
