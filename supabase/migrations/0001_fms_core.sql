-- Orbique FMS: the real database for subscriber companies (car rental companies).
-- One workspace per company. Every row carries its company id and row level security keeps companies apart:
-- a signed-in person sees only the companies they are an active member of, and only what their role's codes allow.
-- The app keeps the same data model as the phone app (app/m/CONTRACT.md): one row per record of a collection,
-- data = the JSON object as the app holds it. Safe to run more than once.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- companies and people
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$'),   -- <slug>.orbiquefms.com
  name text not null,
  plan text not null default 'trial',
  status text not null default 'active' check (status in ('active', 'paused')),
  identity jsonb not null default '{}'::jsonb,   -- name, short, code, primary, dark, accent, colours, city, lat, lng, logo
  next_no integer not null default 1,             -- next booking number (taken through take_booking_no)
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.members (
  org_id uuid not null references public.orgs on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  staff_id text not null,
  role text not null check (role in ('owner', 'manager', 'frontdesk', 'fleet', 'agent', 'accountant', 'readonly')),
  codes text[],                                   -- null = the role's codes (role_codes)
  status text not null default 'active' check (status in ('active', 'suspended')),
  invited_by uuid,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id),
  unique (org_id, staff_id)
);
create index if not exists members_user_idx on public.members (user_id);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- the codes each role has (same as ROLES in the app). '*' = everything, 'area.*' = every code of an area.
create table if not exists public.role_codes (
  role text primary key,
  name text not null,
  codes text[] not null
);
insert into public.role_codes (role, name, codes) values
  ('owner', 'Owner', array['*']),
  ('manager', 'Manager', array['bookings.*','billing.*','deposits.*','customers.*','customer_notes.*','cars.*','maintenance.*','summons.*','tracking.*','expenses.view','expenses.view_all','expenses.add','expenses.add_business','expenses.edit_own','expenses.staff_reports_all','reports.*','tasks.*','leads.*','users.view','users.view_audit','employees.view']),
  ('frontdesk', 'Front desk', array['bookings.view','bookings.create','bookings.edit','bookings.see_amounts','bookings.edit_amounts','bookings.change_status','bookings.view_documents','billing.view','billing.record_payment','billing.issue_receipt','billing.issue_invoice','billing.send','deposits.view','customers.view','customers.edit','customers.view_documents','customers.check_ic','customers.blacklist_view','customer_notes.view','customer_notes.add','cars.view','maintenance.view','summons.view','tracking.view','expenses.view','expenses.add','expenses.edit_own','tasks.view','tasks.create','tasks.assign','leads.view','leads.manage','users.view']),
  ('fleet', 'Fleet', array['bookings.view','cars.*','maintenance.*','summons.view','summons.upload','tracking.*','expenses.view','expenses.add','expenses.edit_own','tasks.view','tasks.create','customers.view']),
  ('agent', 'Driver / Agent', array['bookings.view','customers.view','cars.view','tasks.view','expenses.view','expenses.add','expenses.edit_own','tracking.view']),
  ('accountant', 'Accountant', array['bookings.view','bookings.see_amounts','bookings.see_revenue','bookings.export','billing.*','deposits.*','expenses.*','reports.*','customers.view','cars.view','cars.see_instalment','maintenance.view','maintenance.see_costs','summons.view','summons.record_payment','users.view']),
  ('readonly', 'Read-only', array['bookings.view','customers.view','cars.view','maintenance.view','summons.view','tasks.view','reports.view'])
on conflict (role) do update set name = excluded.name, codes = excluded.codes;

-- which code a collection needs to be read or changed. No row (or null) = any active member may read, and any active
-- member except Read-only may write.
create table if not exists public.coll_rules (
  coll text primary key,
  read_code text,
  write_code text
);
insert into public.coll_rules (coll, read_code, write_code) values
  ('staff', null, 'users.edit'),
  ('audit', 'users.view_audit', '-any'),          -- everyone's actions are logged; only some may read the log
  ('instalments', 'cars.see_instalment', 'cars.see_instalment'),
  ('bankIns', null, null),
  ('autoRules', null, 'tasks.assign')
on conflict (coll) do update set read_code = excluded.read_code, write_code = excluded.write_code;

-- one row per record of a collection (bookings, cars, customers ...). data = the JS object as the app holds it.
create table if not exists public.records (
  org_id uuid not null references public.orgs on delete cascade,
  coll text not null check (coll ~ '^[a-zA-Z]{2,30}$'),
  id text not null,
  data jsonb not null,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (org_id, coll, id)
);
create index if not exists records_changed_idx on public.records (org_id, updated_at);
-- booking numbers are unique inside a company (two phones cannot hand out the same KLT-00702)
create unique index if not exists records_booking_no_idx on public.records (org_id, (data->>'no')) where coll = 'bookings';
create index if not exists records_booking_start_idx on public.records (org_id, (data->>'start')) where coll = 'bookings';
create index if not exists records_customer_phone_idx on public.records (org_id, (data->>'phone')) where coll = 'customers';

-- one row per company value that is not a list of records: settings, the assistant switch, a person's preferences
create table if not exists public.blobs (
  org_id uuid not null references public.orgs on delete cascade,
  key text not null check (key ~ '^[a-zA-Z0-9:_-]{2,60}$'),
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (org_id, key)
);

-- where an imported row came from (Ventura's table and id), so an import can be run again without making copies
create table if not exists public.import_map (
  org_id uuid not null references public.orgs on delete cascade,
  source text not null,          -- 'ventura'
  source_table text not null,
  source_id text not null,
  coll text not null,
  id text not null,
  imported_at timestamptz not null default now(),
  primary key (org_id, source, source_table, source_id)
);

-- ---------------------------------------------------------------- who is who
create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function public.member_role(p_org uuid) returns text
language sql stable security definer set search_path = public as $$
  select m.role from members m where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.is_member(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(p_org) is not null;
$$;

create or replace function public.my_codes(p_org uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(case when m.role = 'owner' then array['*'] end, m.codes, r.codes, array[]::text[])
  from members m left join role_codes r on r.role = m.role
  where m.org_id = p_org and m.user_id = auth.uid() and m.status = 'active';
$$;

create or replace function public.has_code(p_org uuid, p_code text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when p_code is null then public.is_member(p_org)
    else coalesce((select '*' = any(c) or p_code = any(c) or (split_part(p_code, '.', 1) || '.*') = any(c)
                   from (select public.my_codes(p_org) c) x where c is not null), false)
  end;
$$;

-- a paused company can still read its data but cannot change it
create or replace function public.can_write(p_org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.member_role(p_org) is not null and exists (select 1 from orgs o where o.id = p_org and o.status = 'active');
$$;

create or replace function public.can_read_coll(p_org uuid, p_coll text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_member(p_org) and public.has_code(p_org, (select read_code from coll_rules where coll = p_coll));
$$;

create or replace function public.can_write_coll(p_org uuid, p_coll text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.can_write(p_org) and (
    select case when w = '-any' then true
                when w is null then public.member_role(p_org) <> 'readonly'
                else public.has_code(p_org, w) end
    from (select (select write_code from coll_rules where coll = p_coll) as w) x);
$$;

-- the company id at the start of a file path, or null when the path does not start with one
create or replace function public.path_org(p_name text) returns uuid
language sql immutable set search_path = '' as $$
  select case when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end;
$$;

-- ---------------------------------------------------------------- row level security
alter table public.orgs enable row level security;
alter table public.members enable row level security;
alter table public.platform_admins enable row level security;
alter table public.role_codes enable row level security;
alter table public.coll_rules enable row level security;
alter table public.records enable row level security;
alter table public.blobs enable row level security;
alter table public.import_map enable row level security;

drop policy if exists orgs_read on public.orgs;
create policy orgs_read on public.orgs for select to authenticated using (public.is_member(id) or public.is_platform_admin());
drop policy if exists orgs_owner_update on public.orgs;
create policy orgs_owner_update on public.orgs for update to authenticated
  using (public.member_role(id) = 'owner') with check (public.member_role(id) = 'owner');

drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated
  using ((user_id = (select auth.uid())) or public.is_member(org_id) or public.is_platform_admin());
drop policy if exists members_owner_update on public.members;
create policy members_owner_update on public.members for update to authenticated
  using (public.member_role(org_id) = 'owner' and user_id <> (select auth.uid()))
  with check (public.member_role(org_id) = 'owner' and role <> 'owner');

drop policy if exists platform_admins_read on public.platform_admins;
create policy platform_admins_read on public.platform_admins for select to authenticated
  using ((user_id = (select auth.uid())) or public.is_platform_admin());

drop policy if exists role_codes_read on public.role_codes;
create policy role_codes_read on public.role_codes for select to authenticated using (true);
drop policy if exists coll_rules_read on public.coll_rules;
create policy coll_rules_read on public.coll_rules for select to authenticated using (true);

drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (public.can_read_coll(org_id, coll));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (public.can_write_coll(org_id, coll));
drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated
  using (public.can_write_coll(org_id, coll)) with check (public.can_write_coll(org_id, coll));
-- no delete policy: the app marks records deleted (deleted = true)

drop policy if exists blobs_read on public.blobs;
create policy blobs_read on public.blobs for select to authenticated
  using (public.is_member(org_id) and (key not like 'prefs:%' or key = 'prefs:' || (select staff_id from members m where m.org_id = blobs.org_id and m.user_id = (select auth.uid()))));
drop policy if exists blobs_insert on public.blobs;
create policy blobs_insert on public.blobs for insert to authenticated
  with check (public.can_write(org_id) and (
    (key like 'prefs:%' and key = 'prefs:' || (select staff_id from members m where m.org_id = blobs.org_id and m.user_id = (select auth.uid())))
    or (key not like 'prefs:%' and public.member_role(org_id) in ('owner', 'manager'))));
drop policy if exists blobs_update on public.blobs;
create policy blobs_update on public.blobs for update to authenticated
  using (public.can_write(org_id) and (
    (key like 'prefs:%' and key = 'prefs:' || (select staff_id from members m where m.org_id = blobs.org_id and m.user_id = (select auth.uid())))
    or (key not like 'prefs:%' and public.member_role(org_id) in ('owner', 'manager'))))
  with check (public.can_write(org_id));
-- import_map: no policies, only the service role (the import) reads and writes it

-- stamp who changed a row and when (the client cannot fake it)
create or replace function public.stamp_change() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if auth.uid() is not null then new.updated_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists records_stamp on public.records;
create trigger records_stamp before insert or update on public.records for each row execute function public.stamp_change();
drop trigger if exists blobs_stamp on public.blobs;
create trigger blobs_stamp before insert or update on public.blobs for each row execute function public.stamp_change();

-- ---------------------------------------------------------------- realtime (other phones see changes at once)
alter table public.records replica identity full;
alter table public.blobs replica identity full;
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.records; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.blobs; exception when duplicate_object then null; end;
  end if;
end $$;

-- ---------------------------------------------------------------- functions the app calls
-- who am I: platform admin flag and my companies
create or replace function public.my_context() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'userId', auth.uid(),
    'email', (select email from auth.users where id = auth.uid()),
    'platformAdmin', public.is_platform_admin(),
    'workspaces', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'slug', o.slug, 'name', o.name, 'plan', o.plan, 'status', o.status,
                                          'identity', o.identity, 'role', m.role, 'staffId', m.staff_id,
                                          'codes', public.my_codes(o.id), 'memberStatus', m.status) order by o.name)
      from members m join orgs o on o.id = m.org_id where m.user_id = auth.uid()), '[]'::jsonb)
  );
$$;

-- the next booking number of a company, handed out once (no two phones get the same number)
create or replace function public.take_booking_no(p_org uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.can_write(p_org) then raise exception 'not allowed' using errcode = '42501'; end if;
  update orgs set next_no = greatest(next_no, coalesce((select max((data->>'no')::int) from records where org_id = p_org and coll = 'bookings'), 0) + 1) + 1
    where id = p_org returning next_no - 1 into n;
  return n;
end $$;

-- platform admin: rental companies with counts only (never customer details or money)
create or replace function public.platform_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'name', o.name, 'plan', o.plan, 'status', o.status, 'createdAt', o.created_at,
      'members', (select count(*) from members m where m.org_id = o.id and m.status = 'active'),
      'cars', (select count(*) from records r where r.org_id = o.id and r.coll = 'cars' and not r.deleted and coalesce(r.data->>'status', 'active') = 'active'),
      'bookings', (select count(*) from records r where r.org_id = o.id and r.coll = 'bookings' and not r.deleted),
      'lastActivity', (select max(r.updated_at) from records r where r.org_id = o.id)
    ) order by o.created_at)
    from orgs o), '[]'::jsonb);
end $$;

create or replace function public.set_org_status(p_org uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update orgs set status = p_status where id = p_org;
end $$;

create or replace function public.set_org_plan(p_org uuid, p_plan text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  update orgs set plan = p_plan where id = p_org;
end $$;

-- ---------------------------------------------------------------- grants
grant usage on schema public to anon, authenticated;
revoke all on public.orgs, public.members, public.platform_admins, public.role_codes, public.coll_rules, public.records, public.blobs, public.import_map from anon;
grant select, insert, update on public.records, public.blobs to authenticated;
grant select on public.orgs, public.members, public.platform_admins, public.role_codes, public.coll_rules to authenticated;
revoke update on public.orgs from authenticated;
grant update (name, identity) on public.orgs to authenticated;
revoke update on public.members from authenticated;
grant update (role, codes, status) on public.members to authenticated;
revoke all on public.import_map from authenticated;

do $$
declare fn text;
begin
  foreach fn in array array[
    'my_context()', 'platform_overview()', 'set_org_status(uuid, text)', 'set_org_plan(uuid, text)', 'take_booking_no(uuid)',
    'is_member(uuid)', 'can_write(uuid)', 'member_role(uuid)', 'is_platform_admin()', 'my_codes(uuid)', 'has_code(uuid, text)',
    'can_read_coll(uuid, text)', 'can_write_coll(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on function public.%s from anon', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function public.%s to authenticated', fn); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then execute format('grant execute on function public.%s to service_role', fn); end if;
  end loop;
end $$;

-- ---------------------------------------------------------------- files (photos, slips, documents)
-- one private bucket; the first folder of every path is the company id, and only that company's members can reach it
do $$ begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('company-files', 'company-files', false) on conflict (id) do nothing;
    execute 'drop policy if exists company_files_read on storage.objects';
    execute $p$create policy company_files_read on storage.objects for select to authenticated
      using (bucket_id = 'company-files' and coalesce(public.is_member(public.path_org(name)), false))$p$;
    execute 'drop policy if exists company_files_insert on storage.objects';
    execute $p$create policy company_files_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'company-files' and coalesce(public.can_write(public.path_org(name)), false))$p$;
  end if;
end $$;
