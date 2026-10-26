-- DEUKSIL — contrôle d'un projet vide : chaque ligne doit afficher 0.
select 'auth.users' as table_, count(*) as lignes from auth.users
union all select 'storage.objects', count(*) from storage.objects
union all select format('public.%s', c.relname), (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by 1;
