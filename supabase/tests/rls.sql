-- Row level security checks for 0001_fms_core.sql. Run on a plain local Postgres with tests/supabase_stub.sql loaded.
-- Every check raises an exception when it fails; the script ends with 'RLS OK'.
\set ON_ERROR_STOP 1
begin;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner-a@test'), ('00000000-0000-0000-0000-0000000000a2', 'agent-a@test'),
  ('00000000-0000-0000-0000-0000000000a3', 'readonly-a@test'), ('00000000-0000-0000-0000-0000000000b1', 'owner-b@test');
insert into orgs (id, slug, name) values ('00000000-0000-0000-0000-00000000000a', 'co-a', 'Company A'), ('00000000-0000-0000-0000-00000000000b', 'co-b', 'Company B');
insert into members (org_id, user_id, staff_id, role) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 's1', 'owner'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 's4', 'agent'),
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 's9', 'readonly'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 's1', 'owner');
insert into records (org_id, coll, id, data) values
  ('00000000-0000-0000-0000-00000000000a', 'bookings', 'b1', '{"no":1}'), ('00000000-0000-0000-0000-00000000000a', 'audit', 'a1', '{}'),
  ('00000000-0000-0000-0000-00000000000a', 'instalments', 'i1', '{}'), ('00000000-0000-0000-0000-00000000000b', 'bookings', 'b1', '{"no":1}');

set local role authenticated;
-- owner of A
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a1';
do $$ begin
  if (select count(*) from records) <> 3 then raise exception 'owner A should see 3 rows of A only, saw %', (select count(*) from records); end if;
  if (select count(*) from orgs) <> 1 then raise exception 'owner A sees another company'; end if;
  insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'staff', 's5', '{}');
  if public.take_booking_no('00000000-0000-0000-0000-00000000000a') <> 2 then raise exception 'booking number should be 2'; end if;
  if public.take_booking_no('00000000-0000-0000-0000-00000000000a') <> 3 then raise exception 'booking number should be 3'; end if;
end $$;
-- owner A cannot write into B
do $$ begin
  begin
    insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000b', 'bookings', 'x', '{"no":9}');
    raise exception 'owner A wrote into B';
  exception when insufficient_privilege then null; end;
end $$;
-- agent of A: no audit log, no instalments, cannot change staff, can add a booking
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a2';
do $$ begin
  if exists (select 1 from records where coll in ('audit', 'instalments')) then raise exception 'agent reads audit or instalments'; end if;
  if (select count(*) from records where coll = 'bookings') <> 1 then raise exception 'agent should see the booking'; end if;
  insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'bookings', 'b2', '{"no":2}');
  insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'audit', 'a2', '{}');
  begin
    insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'staff', 's6', '{}');
    raise exception 'agent added a staff row';
  exception when insufficient_privilege then null; end;
  begin
    insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'bookings', 'b3', '{"no":1}');
    raise exception 'duplicate booking number accepted';
  exception when unique_violation then null; end;
end $$;
-- read-only of A: reads, cannot write bookings, may still log
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000a3';
do $$ begin
  if (select count(*) from records where coll = 'bookings') <> 2 then raise exception 'read-only should see 2 bookings'; end if;
  begin
    insert into records (org_id, coll, id, data) values ('00000000-0000-0000-0000-00000000000a', 'bookings', 'b4', '{"no":4}');
    raise exception 'read-only added a booking';
  exception when insufficient_privilege then null; end;
end $$;
-- a stranger sees nothing
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ff';
do $$ begin
  if exists (select 1 from records) or exists (select 1 from orgs) then raise exception 'stranger sees data'; end if;
end $$;
-- anon sees nothing at all
reset request.jwt.claim.sub;
set local role anon;
do $$ begin
  begin perform 1 from records; raise exception 'anon can read records'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'RLS OK';
