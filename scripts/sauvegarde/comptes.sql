-- Les comptes qui prouvent qu'une restauration est complète : une ligne
-- « nom<TAB>nombre » par table de `public`, plus les connexions
-- (`auth.users`) et les fichiers du stockage par bucket. Lancé sur la
-- production au moment de la copie, puis sur la base restaurée : les deux
-- sorties doivent être IDENTIQUES (`restaurer.sh` les compare).
\pset format unaligned
\pset fieldsep '\t'
\pset tuples_only on
select format('public.%s', c.relname) as nom,
       (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text::bigint
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r'
union all
select 'auth.users', count(*) from auth.users
union all
select format('storage.objects:%s', b.id), count(o.id)
  from storage.buckets b left join storage.objects o on o.bucket_id = b.id
 group by b.id
 order by 1;
