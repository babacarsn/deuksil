-- Coût en écriture des index 0800 : 20 000 insertions dans rents et notifications,
-- avec puis sans les index ajoutés (index supprimés DANS la transaction, annulée).
-- Base de TEST uniquement. Lancer : psql -f cout-ecriture.sql
\timing off
create or replace function pg_temp.mesurer(sans_index boolean) returns table (table_ text, ms numeric)
language plpgsql as $$
declare t0 timestamptz; l record;
begin
  if sans_index then
    drop index public.rents_owner_idx, public.rents_property_idx, public.rents_impayes_idx, public.notifications_user_date_idx;
  end if;
  select * into l from public.leases order by id limit 1;
  t0 := clock_timestamp();
  insert into public.rents (owner_id, lease_id, property_id, month, amount)
  select l.owner_id, l.id, l.property_id, to_char(date '2100-01-01' + make_interval(months => i), 'YYYY-MM'), 1000 from generate_series(1, 20000) i;
  table_ := 'rents (20 000 lignes)'; ms := round(extract(epoch from clock_timestamp() - t0) * 1000, 1); return next;
  t0 := clock_timestamp();
  insert into public.notifications (user_id, text) select l.owner_id, 'mesure ' || i from generate_series(1, 20000) i;
  table_ := 'notifications (20 000 lignes)'; ms := round(extract(epoch from clock_timestamp() - t0) * 1000, 1); return next;
end $$;
begin; select 'avec index' as cas, * from pg_temp.mesurer(false); rollback;
begin; select 'sans index' as cas, * from pg_temp.mesurer(true); rollback;
begin; select 'avec index' as cas, * from pg_temp.mesurer(false); rollback;
begin; select 'sans index' as cas, * from pg_temp.mesurer(true); rollback;
select indexrelname as index, pg_size_pretty(pg_relation_size(indexrelid)) as taille
  from pg_stat_user_indexes where schemaname = 'public' and indexrelname in
  ('rents_owner_idx','rents_property_idx','rents_impayes_idx','notifications_user_date_idx','conversations_participants_gin','conversation_messages_conv_idx','properties_publiees_date_idx','profiles_lease_ids_gin');
select pg_size_pretty(sum(pg_relation_size(indexrelid))) as total_index_0800 from pg_stat_user_indexes
 where schemaname = 'public' and (indexrelname like '%\_idx' or indexrelname like '%\_gin');
