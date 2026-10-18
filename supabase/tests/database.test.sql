begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

select has_table('public', 'profiles', 'profiles exist');
select has_table('public', 'user_roles', 'role assignments exist');
select has_table('public', 'properties', 'properties exist');
select has_table('public', 'units', 'bookable units exist');
select has_table('public', 'bookings', 'booking records exist');
select has_table('public', 'unit_reservations', 'authoritative reservations exist');
select has_table('public', 'booking_extensions', 'extension requests exist');
select has_table('public', 'notifications', 'notification queue exists');
select ok((select bool_and(relrowsecurity) from pg_class where oid = any(array[
  'public.profiles'::regclass, 'public.user_roles'::regclass, 'public.properties'::regclass,
  'public.property_members'::regclass, 'public.units'::regclass, 'public.unit_photos'::regclass,
  'public.unit_amenities'::regclass, 'public.unit_rate_rules'::regclass, 'public.bookings'::regclass,
  'public.unit_reservations'::regclass, 'public.unit_blocks'::regclass, 'public.booking_extensions'::regclass,
  'public.checkin_checkout_logs'::regclass, 'public.booking_status_history'::regclass,
  'public.audit_logs'::regclass, 'public.payments'::regclass, 'public.notifications'::regclass
])), 'RLS is enabled for every public table');
select ok(not has_table_privilege('anon', 'public.bookings', 'select'), 'anonymous users cannot select guest records');
select ok(not has_table_privilege('authenticated', 'public.bookings', 'insert'), 'clients cannot insert bookings directly');
select ok(to_regprocedure('public.create_booking_request(uuid,date,date,text,text,integer,text,text)') is not null, 'public booking RPC exists');
select ok(to_regprocedure('public.create_manual_booking(uuid,date,date,text,text,text,public.booking_source,integer,text)') is not null, 'manual booking RPC exists');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.unit_reservations'::regclass and contype = 'x'), 'active reservation ranges have an exclusion constraint');
select ok(exists (select 1 from pg_constraint where conrelid = 'public.unit_rate_rules'::regclass and contype = 'x'), 'seasonal rate periods cannot overlap');

insert into public.properties(id, name, slug, timezone, currency)
values ('00000000-0000-4000-8000-000000000101', 'pgTAP fixture', 'pgtap-fixture', 'UTC', 'USD');
insert into public.units(id, property_id, name, unit_type, capacity, base_nightly_price, currency)
values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'Fixture unit', 'room', 2, 100, 'USD');
insert into public.unit_reservations(unit_id, stay, status)
values ('00000000-0000-4000-8000-000000000102', daterange(current_date + 30, current_date + 32, '[)'), 'confirmed');
select lives_ok($$insert into public.unit_reservations(unit_id, stay, status) values ('00000000-0000-4000-8000-000000000102', daterange(current_date + 32, current_date + 33, '[)'), 'confirmed')$$, 'adjacent half-open stays allow same-day turnover');
select throws_ok($$insert into public.unit_reservations(unit_id, stay, status) values ('00000000-0000-4000-8000-000000000102', daterange(current_date + 31, current_date + 34, '[)'), 'confirmed')$$, '23P01', null, 'overlapping unit reservations are rejected');

select * from finish();
rollback;
