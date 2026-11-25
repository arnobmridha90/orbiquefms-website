-- After a load: what is in FMS for one company. Compare with the "report" part of ventura_export.py's JSON.
-- Replace ventura with the company's slug.
with o as (select id from public.orgs where slug = 'ventura')
select 'rows' as what, coll as detail, count(*)::text as value from public.records, o where org_id = o.id and not deleted group by coll
union all
select 'payments', it->>'kind', sum((it->>'amt')::numeric)::text
from public.records r, o, jsonb_array_elements(r.data->'payments') p, jsonb_array_elements(p->'items') it
where r.org_id = o.id and r.coll = 'bookings' and not coalesce((p->>'voided')::boolean, false) group by it->>'kind'
union all
select 'expenses', 'total (not deleted)', sum((data->>'amt')::numeric)::text from public.records, o
where org_id = o.id and coll = 'expenses' and not coalesce((data->>'voided')::boolean, false)
union all
select 'bookings', 'booking numbers ' || min((data->>'no')::int) || ' to ' || max((data->>'no')::int), count(*)::text from public.records, o
where org_id = o.id and coll = 'bookings'
order by 1, 2;
