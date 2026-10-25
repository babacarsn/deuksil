-- Nombre de lignes par table (comparaison sauvegarde / restauration).
select 'auth.users' as table_, count(*) as lignes from auth.users
union all select 'auth.identities', count(*) from auth.identities
union all select format('public.%s', c.relname), (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;
