create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

create type public.app_role as enum ('super_admin', 'property_manager', 'receptionist', 'guest');
create type public.unit_type as enum ('apartment', 'studio', 'room');
create type public.booking_source as enum ('website', 'phone', 'whatsapp', 'walk_in', 'staff');
create type public.booking_status as enum ('pending', 'approved', 'checked_in', 'checkout_due', 'checked_out', 'completed', 'rejected', 'cancelled', 'expired');
create type public.payment_status as enum ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed');
create type public.reservation_status as enum ('held', 'confirmed');
create type public.extension_status as enum ('pending', 'approved', 'rejected', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'guest',
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);
create table public.properties (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  address text not null default '',
  city text not null default '',
  latitude double precision,
  longitude double precision,
  timezone text not null default 'UTC',
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  check_in_time time not null default '15:00',
  checkout_time time not null default '11:00',
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.property_members (
  property_id uuid not null references public.properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null check (role in ('property_manager', 'receptionist')),
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (property_id, user_id)
);
create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  name text not null,
  unit_type public.unit_type not null,
  capacity integer not null check (capacity > 0),
  bedrooms numeric(4,1) not null default 0 check (bedrooms >= 0),
  bathrooms numeric(4,1) not null default 1 check (bathrooms >= 0),
  description text not null default '',
  base_nightly_price numeric(12,2) not null check (base_nightly_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (property_id, name)
);
create index units_property_active_idx on public.units(property_id, active);
create table public.unit_photos (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '',
  sort_order integer not null default 0
);
create table public.amenities (id uuid primary key default gen_random_uuid(), name text not null unique, icon text);
create table public.unit_amenities (
  unit_id uuid not null references public.units(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  primary key (unit_id, amenity_id)
);
create table public.unit_rate_rules (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  date_from date not null,
  date_to date not null,
  nightly_price numeric(12,2) not null check (nightly_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  priority integer not null default 0,
  check (date_to > date_from)
);
create index rate_rule_dates_idx on public.unit_rate_rules(unit_id, date_from, date_to, priority desc);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default upper(encode(extensions.gen_random_bytes(5), 'hex')),
  unit_id uuid not null references public.units(id) on delete restrict,
  guest_id uuid references auth.users(id) on delete set null,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null default '',
  check_in timestamptz not null,
  checkout timestamptz not null,
  stay daterange not null,
  source public.booking_source not null,
  status public.booking_status not null default 'pending',
  payment_status public.payment_status not null default 'pending',
  agreed_total numeric(12,2) not null check (agreed_total >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_breakdown jsonb not null default '{}'::jsonb,
  hold_expires_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  special_requests text not null default '',
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (checkout > check_in),
  check (not isempty(stay) and lower_inc(stay) and not upper_inc(stay))
);
create index bookings_guest_created_idx on public.bookings(guest_id, created_at desc);
create index bookings_unit_dates_idx on public.bookings(unit_id, check_in, checkout);
create table public.unit_reservations (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  booking_id uuid unique references public.bookings(id) on delete cascade,
  stay daterange not null,
  status public.reservation_status not null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  check (not isempty(stay) and lower_inc(stay) and not upper_inc(stay)),
  exclude using gist (unit_id with =, stay with &&) where (released_at is null)
);
create index reservations_unit_stay_idx on public.unit_reservations using gist(unit_id, stay);
create table public.unit_blocks (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete cascade,
  stay daterange not null,
  block_type text not null check (block_type in ('maintenance', 'owner_use', 'cleaning')),
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (not isempty(stay) and lower_inc(stay) and not upper_inc(stay))
);
create index blocks_unit_stay_idx on public.unit_blocks using gist(unit_id, stay);
create table public.booking_extensions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  requested_by uuid references auth.users(id) on delete set null,
  original_checkout timestamptz not null,
  requested_checkout timestamptz not null,
  status public.extension_status not null default 'pending',
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  reason text not null default '',
  created_at timestamptz not null default now(),
  check (requested_checkout > original_checkout)
);
create table public.checkin_checkout_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  action text not null check (action in ('check_in', 'check_out')),
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  notes text not null default '',
  unique (booking_id, action)
);
create table public.booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  previous_status public.booking_status,
  new_status public.booking_status not null,
  actor_id uuid references auth.users(id) on delete set null,
  reason text not null default '',
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  provider text not null,
  provider_reference text,
  provider_event_id text unique,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  verified_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  scheduled_at timestamptz not null default now(),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'sms', 'whatsapp')),
  delivery_status text not null default 'pending' check (delivery_status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  sent_at timestamptz,
  attempt_count integer not null default 0,
  last_error text,
  deduplication_key text not null unique,
  created_at timestamptz not null default now()
);
create index notifications_delivery_idx on public.notifications(delivery_status, scheduled_at) where delivery_status in ('pending', 'failed');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin
  insert into public.profiles(id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  insert into public.user_roles(user_id, role) values (new.id, 'guest');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = 'super_admin') $$;
create or replace function public.can_manage_property(p_property_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select public.is_super_admin() or exists (
  select 1 from public.property_members pm where pm.property_id = p_property_id and pm.user_id = (select auth.uid())
) $$;
revoke all on function public.is_super_admin() from public;
revoke all on function public.can_manage_property(uuid) from public;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.can_manage_property(uuid) to authenticated;

create or replace function public.create_booking_request(
  p_unit_id uuid, p_check_in date, p_checkout date,
  p_guest_name text, p_guest_email text, p_guest_phone text default '', p_special_requests text default ''
)
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare
  v_unit public.units%rowtype;
  v_property public.properties%rowtype;
  v_booking public.bookings%rowtype;
  v_total numeric(12,2) := 0;
  v_night date;
  v_rate numeric(12,2);
  v_lines jsonb := '[]'::jsonb;
begin
  if p_check_in is null or p_checkout is null or p_checkout <= p_check_in or p_checkout <= current_date then
    raise exception 'Choose a valid future stay' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_guest_name, ''))) < 2 or position('@' in coalesce(p_guest_email, '')) < 2 then
    raise exception 'Guest name and valid email are required' using errcode = '22023';
  end if;
  select * into v_unit from public.units where id = p_unit_id for update;
  if not found or not v_unit.active then raise exception 'Unit is unavailable' using errcode = 'P0001'; end if;
  select * into v_property from public.properties where id = v_unit.property_id and published;
  if not found then raise exception 'Property is unavailable' using errcode = 'P0001'; end if;
  update public.unit_reservations r set released_at = now()
    where r.unit_id = v_unit.id and r.status = 'held' and r.released_at is null
      and exists (select 1 from public.bookings b where b.id = r.booking_id and b.hold_expires_at <= now() and b.status = 'pending');
  update public.bookings set status = 'expired', updated_at = now()
    where unit_id = v_unit.id and status = 'pending' and hold_expires_at <= now();
  if exists (select 1 from public.unit_blocks b where b.unit_id = v_unit.id and b.stay && daterange(p_check_in, p_checkout, '[)'))
     or exists (select 1 from public.unit_reservations r where r.unit_id = v_unit.id and r.released_at is null and r.stay && daterange(p_check_in, p_checkout, '[)')) then
    raise exception 'Those dates are no longer available' using errcode = 'P0001';
  end if;
  for v_night in select generate_series(p_check_in, p_checkout - 1, interval '1 day')::date loop
    select coalesce((select rr.nightly_price from public.unit_rate_rules rr
      where rr.unit_id = v_unit.id and rr.date_from <= v_night and rr.date_to > v_night
      order by rr.priority desc, rr.date_from desc, rr.id limit 1), v_unit.base_nightly_price) into v_rate;
    v_total := v_total + v_rate;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('date', v_night, 'nightly_rate', v_rate));
  end loop;
  insert into public.bookings(unit_id, guest_id, guest_name, guest_email, guest_phone, check_in, checkout, stay, source, status, agreed_total, currency, price_breakdown, hold_expires_at, special_requests)
  values (v_unit.id, (select auth.uid()), trim(p_guest_name), lower(trim(p_guest_email)), coalesce(p_guest_phone, ''),
    (p_check_in + v_property.check_in_time) at time zone v_property.timezone,
    (p_checkout + v_property.checkout_time) at time zone v_property.timezone,
    daterange(p_check_in, p_checkout, '[)'), 'website', 'pending', round(v_total, 2), v_unit.currency,
    jsonb_build_object('nights', v_lines, 'subtotal', round(v_total, 2)), now() + interval '15 minutes', coalesce(p_special_requests, ''))
  returning * into v_booking;
  insert into public.unit_reservations(unit_id, booking_id, stay, status) values (v_unit.id, v_booking.id, v_booking.stay, 'held');
  insert into public.booking_status_history(booking_id, new_status, actor_id, reason)
    values (v_booking.id, 'pending', (select auth.uid()), 'Website booking request');
  return v_booking;
end $$;

create or replace function public.create_manual_booking(
  p_unit_id uuid, p_check_in date, p_checkout date, p_guest_name text, p_guest_email text,
  p_guest_phone text, p_source public.booking_source, p_special_requests text default ''
)
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare v_unit public.units%rowtype; v_property public.properties%rowtype; v_booking public.bookings%rowtype; v_total numeric(12,2) := 0; v_night date; v_rate numeric(12,2); v_lines jsonb := '[]'::jsonb;
begin
  if p_source not in ('phone', 'whatsapp', 'walk_in', 'staff') then raise exception 'Unsupported manual source' using errcode = '22023'; end if;
  if p_checkout <= p_check_in or length(trim(coalesce(p_guest_name, ''))) < 2 or position('@' in coalesce(p_guest_email, '')) < 2 then raise exception 'Valid guest details and dates are required' using errcode = '22023'; end if;
  select * into v_unit from public.units where id = p_unit_id for update;
  if not found or not v_unit.active or not public.can_manage_property(v_unit.property_id) then raise exception 'Unit unavailable or unauthorized' using errcode = '42501'; end if;
  select * into v_property from public.properties where id = v_unit.property_id;
  update public.unit_reservations r set released_at = now() where r.unit_id = v_unit.id and r.status = 'held' and r.released_at is null and exists (select 1 from public.bookings b where b.id = r.booking_id and b.hold_expires_at <= now() and b.status = 'pending');
  update public.bookings set status = 'expired', updated_at = now() where unit_id = v_unit.id and status = 'pending' and hold_expires_at <= now();
  if exists (select 1 from public.unit_blocks b where b.unit_id = v_unit.id and b.stay && daterange(p_check_in, p_checkout, '[)')) or exists (select 1 from public.unit_reservations r where r.unit_id = v_unit.id and r.released_at is null and r.stay && daterange(p_check_in, p_checkout, '[)')) then raise exception 'Those dates are unavailable' using errcode = 'P0001'; end if;
  for v_night in select generate_series(p_check_in, p_checkout - 1, interval '1 day')::date loop
    select coalesce((select rr.nightly_price from public.unit_rate_rules rr where rr.unit_id = v_unit.id and rr.date_from <= v_night and rr.date_to > v_night order by rr.priority desc, rr.date_from desc, rr.id limit 1), v_unit.base_nightly_price) into v_rate;
    v_total := v_total + v_rate; v_lines := v_lines || jsonb_build_array(jsonb_build_object('date', v_night, 'nightly_rate', v_rate));
  end loop;
  insert into public.bookings(unit_id, guest_name, guest_email, guest_phone, check_in, checkout, stay, source, status, agreed_total, currency, price_breakdown, created_by, approved_by, approved_at, special_requests)
  values (v_unit.id, trim(p_guest_name), lower(trim(p_guest_email)), coalesce(p_guest_phone, ''), (p_check_in + v_property.check_in_time) at time zone v_property.timezone, (p_checkout + v_property.checkout_time) at time zone v_property.timezone, daterange(p_check_in, p_checkout, '[)'), p_source, 'approved', round(v_total, 2), v_unit.currency, jsonb_build_object('nights', v_lines, 'subtotal', round(v_total, 2)), (select auth.uid()), (select auth.uid()), now(), coalesce(p_special_requests, '')) returning * into v_booking;
  insert into public.unit_reservations(unit_id, booking_id, stay, status) values (v_unit.id, v_booking.id, v_booking.stay, 'confirmed');
  insert into public.booking_status_history(booking_id, new_status, actor_id, reason) values (v_booking.id, 'approved', (select auth.uid()), 'Staff-created booking');
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id) values ((select auth.uid()), v_unit.property_id, 'manual_booking_created', 'booking', v_booking.id);
  return v_booking;
end $$;

create or replace function public.decide_booking(p_booking_id uuid, p_approve boolean, p_reason text default '')
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_property_id uuid;
begin
  select u.property_id into v_property_id from public.units u join public.bookings b on b.unit_id = u.id where b.id = p_booking_id;
  if v_property_id is null or not public.can_manage_property(v_property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  perform 1 from public.units where id = v_booking.unit_id for update;
  if v_booking.status <> 'pending' then raise exception 'Booking is no longer pending' using errcode = 'P0001'; end if;
  if p_approve and v_booking.hold_expires_at <= now() then
    update public.unit_reservations set released_at = now() where booking_id = v_booking.id and released_at is null;
    update public.bookings set status = 'expired', updated_at = now() where id = v_booking.id returning * into v_booking;
  elsif p_approve then
    update public.bookings set status = 'approved', approved_by = (select auth.uid()), approved_at = now(), updated_at = now() where id = v_booking.id returning * into v_booking;
    update public.unit_reservations set status = 'confirmed' where booking_id = v_booking.id and released_at is null;
  else
    update public.bookings set status = 'rejected', cancellation_reason = nullif(trim(p_reason), ''), updated_at = now() where id = v_booking.id returning * into v_booking;
    update public.unit_reservations set released_at = now() where booking_id = v_booking.id and released_at is null;
  end if;
  insert into public.booking_status_history(booking_id, previous_status, new_status, actor_id, reason) values (v_booking.id, 'pending', v_booking.status, (select auth.uid()), coalesce(p_reason, ''));
  return v_booking;
end $$;

create or replace function public.record_checkout(p_booking_id uuid, p_notes text default '')
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_property_id uuid;
begin
  select u.property_id into v_property_id from public.units u join public.bookings b on b.unit_id = u.id where b.id = p_booking_id;
  if v_property_id is null or not public.can_manage_property(v_property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  perform 1 from public.units where id = v_booking.unit_id for update;
  if v_booking.status not in ('checked_in', 'checkout_due') then raise exception 'Booking is not checked in' using errcode = 'P0001'; end if;
  update public.bookings set status = 'checked_out', updated_at = now() where id = v_booking.id returning * into v_booking;
  update public.unit_reservations set released_at = now() where booking_id = v_booking.id and released_at is null;
  insert into public.checkin_checkout_logs(booking_id, action, actor_id, notes) values (v_booking.id, 'check_out', (select auth.uid()), coalesce(p_notes, ''));
  insert into public.booking_status_history(booking_id, previous_status, new_status, actor_id) values (v_booking.id, 'checkout_due', 'checked_out', (select auth.uid()));
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id) values ((select auth.uid()), v_property_id, 'checkout_recorded', 'booking', v_booking.id);
  return v_booking;
end $$;

create or replace function public.request_extension(p_booking_id uuid, p_requested_checkout date, p_reason text default '')
returns public.booking_extensions language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_property public.properties%rowtype; v_extension public.booking_extensions%rowtype;
begin
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  if v_booking.guest_id <> (select auth.uid()) and not exists (select 1 from public.units u where u.id = v_booking.unit_id and public.can_manage_property(u.property_id)) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_booking.status not in ('approved', 'checked_in', 'checkout_due') then raise exception 'Booking cannot be extended' using errcode = 'P0001'; end if;
  select p.* into v_property from public.properties p join public.units u on u.property_id = p.id where u.id = v_booking.unit_id;
  insert into public.booking_extensions(booking_id, requested_by, original_checkout, requested_checkout, reason) values (v_booking.id, (select auth.uid()), v_booking.checkout, (p_requested_checkout + v_property.checkout_time) at time zone v_property.timezone, coalesce(p_reason, '')) returning * into v_extension;
  return v_extension;
end $$;

create or replace function public.decide_extension(p_extension_id uuid, p_approve boolean, p_reason text default '')
returns public.booking_extensions language plpgsql security definer set search_path = ''
as $$
declare v_extension public.booking_extensions%rowtype; v_booking public.bookings%rowtype; v_unit public.units%rowtype; v_property public.properties%rowtype; v_new_checkout date; v_old_checkout date;
begin
  select * into v_extension from public.booking_extensions where id = p_extension_id for update;
  if not found then raise exception 'Extension not found' using errcode = 'P0002'; end if;
  select * into v_booking from public.bookings where id = v_extension.booking_id for update;
  select * into v_unit from public.units where id = v_booking.unit_id for update;
  if not public.can_manage_property(v_unit.property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_extension.status <> 'pending' or v_booking.checkout <> v_extension.original_checkout then raise exception 'Extension is no longer current' using errcode = 'P0001'; end if;
  if p_approve then
    select * into v_property from public.properties where id = v_unit.property_id;
    v_old_checkout := (v_booking.checkout at time zone v_property.timezone)::date;
    v_new_checkout := (v_extension.requested_checkout at time zone v_property.timezone)::date;
    if exists (select 1 from public.unit_blocks b where b.unit_id = v_unit.id and b.stay && daterange(v_old_checkout, v_new_checkout, '[)')) then raise exception 'New dates conflict with a block' using errcode = 'P0001'; end if;
    update public.unit_reservations set stay = daterange(lower(stay), v_new_checkout, '[)') where booking_id = v_booking.id and released_at is null;
    update public.bookings set checkout = v_extension.requested_checkout, stay = daterange(lower(stay), v_new_checkout, '[)'), status = case when status = 'checkout_due' then 'checked_in'::public.booking_status else status end, updated_at = now() where id = v_booking.id;
    update public.booking_extensions set status = 'approved', decided_by = (select auth.uid()), decided_at = now() where id = v_extension.id returning * into v_extension;
  else
    update public.booking_extensions set status = 'rejected', decided_by = (select auth.uid()), decided_at = now(), reason = concat_ws(' ', reason, nullif(trim(p_reason), '')) where id = v_extension.id returning * into v_extension;
  end if;
  return v_extension;
end $$;

revoke all on function public.create_booking_request(uuid, date, date, text, text, text, text) from public;
revoke all on function public.create_manual_booking(uuid, date, date, text, text, text, public.booking_source, text) from public;
revoke all on function public.decide_booking(uuid, boolean, text) from public;
revoke all on function public.record_checkout(uuid, text) from public;
revoke all on function public.request_extension(uuid, date, text) from public;
revoke all on function public.decide_extension(uuid, boolean, text) from public;
grant execute on function public.create_booking_request(uuid, date, date, text, text, text, text) to anon, authenticated;
grant execute on function public.create_manual_booking(uuid, date, date, text, text, text, public.booking_source, text) to authenticated;
grant execute on function public.decide_booking(uuid, boolean, text) to authenticated;
grant execute on function public.record_checkout(uuid, text) to authenticated;
grant execute on function public.request_extension(uuid, date, text) to authenticated;
grant execute on function public.decide_extension(uuid, boolean, text) to authenticated;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.properties enable row level security;
alter table public.property_members enable row level security;
alter table public.units enable row level security;
alter table public.unit_photos enable row level security;
alter table public.amenities enable row level security;
alter table public.unit_amenities enable row level security;
alter table public.unit_rate_rules enable row level security;
alter table public.bookings enable row level security;
alter table public.unit_reservations enable row level security;
alter table public.unit_blocks enable row level security;
alter table public.booking_extensions enable row level security;
alter table public.checkin_checkout_logs enable row level security;
alter table public.booking_status_history enable row level security;
alter table public.audit_logs enable row level security;
alter table public.payments enable row level security;
alter table public.notifications enable row level security;

create policy profiles_read_self on public.profiles for select to authenticated using (id = (select auth.uid()) or public.is_super_admin());
create policy profiles_update_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy roles_read_self on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or public.is_super_admin());
create policy roles_admin_write on public.user_roles for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy properties_read_published on public.properties for select using (published or (auth.uid() is not null and public.can_manage_property(id)));
create policy properties_super_admin_write on public.properties for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy members_read_self on public.property_members for select to authenticated using (user_id = (select auth.uid()) or public.is_super_admin());
create policy members_admin_write on public.property_members for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());
create policy units_read_public_or_assigned on public.units for select using ((active and exists (select 1 from public.properties p where p.id = property_id and p.published)) or (auth.uid() is not null and public.can_manage_property(property_id)));
create policy units_assigned_write on public.units for all to authenticated using (public.can_manage_property(property_id)) with check (public.can_manage_property(property_id));
create policy photos_read_public_or_assigned on public.unit_photos for select using (exists (select 1 from public.units u join public.properties p on p.id = u.property_id where u.id = unit_id and ((u.active and p.published) or (auth.uid() is not null and public.can_manage_property(p.id)))));
create policy photos_assigned_write on public.unit_photos for all to authenticated using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id))) with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy amenities_public_read on public.amenities for select using (true);
create policy unit_amenities_public_read on public.unit_amenities for select using (exists (select 1 from public.units u join public.properties p on p.id = u.property_id where u.id = unit_id and ((u.active and p.published) or (auth.uid() is not null and public.can_manage_property(p.id)))));
create policy rates_read_public_or_assigned on public.unit_rate_rules for select using (exists (select 1 from public.units u join public.properties p on p.id = u.property_id where u.id = unit_id and ((u.active and p.published) or (auth.uid() is not null and public.can_manage_property(p.id)))));
create policy rates_assigned_write on public.unit_rate_rules for all to authenticated using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id))) with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy bookings_guest_or_staff_read on public.bookings for select to authenticated using (guest_id = (select auth.uid()) or exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy reservations_guest_or_staff_read on public.unit_reservations for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and b.guest_id = (select auth.uid())) or exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy blocks_staff_read on public.unit_blocks for select to authenticated using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy blocks_staff_write on public.unit_blocks for all to authenticated using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id))) with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_property(u.property_id)));
create policy extensions_guest_or_staff_read on public.booking_extensions for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.guest_id = (select auth.uid()) or exists (select 1 from public.units u where u.id = b.unit_id and public.can_manage_property(u.property_id)))));
create policy checkin_staff_read on public.checkin_checkout_logs for select to authenticated using (exists (select 1 from public.bookings b join public.units u on u.id = b.unit_id where b.id = booking_id and public.can_manage_property(u.property_id)));
create policy history_guest_or_staff_read on public.booking_status_history for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.guest_id = (select auth.uid()) or exists (select 1 from public.units u where u.id = b.unit_id and public.can_manage_property(u.property_id)))));
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_super_admin());
create policy payments_guest_or_staff_read on public.payments for select to authenticated using (exists (select 1 from public.bookings b where b.id = booking_id and (b.guest_id = (select auth.uid()) or exists (select 1 from public.units u where u.id = b.unit_id and public.can_manage_property(u.property_id)))));
create policy notifications_recipient_or_staff_read on public.notifications for select to authenticated using (recipient_id = (select auth.uid()) or (property_id is not null and public.can_manage_property(property_id)));

revoke all on all tables in schema public from anon, authenticated;
grant select on public.properties, public.units, public.unit_photos, public.amenities, public.unit_amenities, public.unit_rate_rules to anon, authenticated;
grant select on public.profiles, public.user_roles, public.property_members, public.bookings, public.unit_reservations, public.unit_blocks, public.booking_extensions, public.checkin_checkout_logs, public.booking_status_history, public.audit_logs, public.payments, public.notifications to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
grant insert, update, delete on public.properties, public.units, public.unit_photos, public.unit_amenities, public.unit_rate_rules, public.unit_blocks, public.property_members, public.user_roles to authenticated;

insert into storage.buckets(id, name, public) values ('stayease-listings', 'stayease-listings', true) on conflict (id) do nothing;
create policy listing_photos_public_read on storage.objects for select using (bucket_id = 'stayease-listings');
create policy listing_photos_staff_insert on storage.objects for insert to authenticated with check (bucket_id = 'stayease-listings' and public.can_manage_property(((storage.foldername(name))[1])::uuid));
create policy listing_photos_staff_update on storage.objects for update to authenticated using (bucket_id = 'stayease-listings' and public.can_manage_property(((storage.foldername(name))[1])::uuid)) with check (bucket_id = 'stayease-listings' and public.can_manage_property(((storage.foldername(name))[1])::uuid));
create policy listing_photos_staff_delete on storage.objects for delete to authenticated using (bucket_id = 'stayease-listings' and public.can_manage_property(((storage.foldername(name))[1])::uuid));
