alter table public.notifications add column read_at timestamptz;

create or replace function public.notify_booking_created()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_property_name text; v_unit_name text; v_member record; v_kind text;
begin
  select p.name, u.name into v_property_name, v_unit_name
    from public.units u join public.properties p on p.id = u.property_id where u.id = new.unit_id;
  v_kind := case when new.source = 'website' then 'booking_request' else 'manual_booking' end;
  for v_member in select pm.user_id from public.property_members pm where pm.property_id = (select property_id from public.units where id = new.unit_id) loop
    insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, channel, deduplication_key)
    values (v_member.user_id, new.id, (select property_id from public.units where id = new.unit_id), v_kind,
      case when new.source = 'website' then 'New stay request' else 'Manual stay added' end,
      new.guest_name || ' · ' || new.reference || ' · ' || v_unit_name || ' · ' || v_property_name,
      'in_app', new.id::text || ':created:staff:' || v_member.user_id::text)
    on conflict (deduplication_key) do nothing;
  end loop;
  if new.guest_id is not null then
    insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, channel, deduplication_key)
    values (new.guest_id, new.id, (select property_id from public.units where id = new.unit_id), 'booking_request_received', 'Your request is with the property', 'Reference ' || new.reference || '. This request is not confirmed until the property approves it.', 'in_app', new.id::text || ':created:guest')
    on conflict (deduplication_key) do nothing;
  end if;
  return new;
end $$;
create trigger booking_created_notifications after insert on public.bookings
for each row execute function public.notify_booking_created();

create or replace function public.notify_booking_status_changed()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.guest_id is not null then
    insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, channel, deduplication_key)
    select new.guest_id, new.id, u.property_id, 'booking_status_' || new.status::text,
      'Booking ' || replace(new.status::text, '_', ' '),
      'Your booking ' || new.reference || ' is now ' || replace(new.status::text, '_', ' ') || '.',
      'in_app', new.id::text || ':status:' || new.status::text
    from public.units u where u.id = new.unit_id
    on conflict (deduplication_key) do nothing;
  end if;
  return new;
end $$;
create trigger booking_status_notifications after update of status on public.bookings
for each row execute function public.notify_booking_status_changed();

create or replace function public.claim_notifications(p_limit integer default 50)
returns setof public.notifications language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then raise exception 'Delivery worker authorization required' using errcode = '42501'; end if;
  return query
  with candidates as (
    select n.id from public.notifications n
    where n.scheduled_at <= now() and n.delivery_status in ('pending', 'failed') and n.attempt_count < 5
    order by n.scheduled_at, n.created_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  )
  update public.notifications n set delivery_status = 'processing', attempt_count = n.attempt_count + 1
  from candidates c where n.id = c.id
  returning n.*;
end $$;

revoke all on function public.notify_booking_created() from public;
revoke all on function public.notify_booking_status_changed() from public;
revoke all on function public.claim_notifications(integer) from public;
grant execute on function public.claim_notifications(integer) to service_role;
