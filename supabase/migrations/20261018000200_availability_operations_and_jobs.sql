alter table public.properties
  add column checkout_reminder_minutes integer not null default 120 check (checkout_reminder_minutes between 0 and 1440),
  add column checkout_final_reminder_minutes integer not null default 30 check (checkout_final_reminder_minutes between 0 and 1440),
  add column overdue_alert_interval_minutes integer not null default 60 check (overdue_alert_interval_minutes between 5 and 1440),
  add column checkout_briefing_time time not null default '09:00';

alter table public.unit_rate_rules
  add constraint unit_rate_rules_no_overlap
  exclude using gist (unit_id with =, (daterange(date_from, date_to, '[)')) with &&);

create or replace function public.get_unit_availability(p_unit_id uuid, p_check_in date, p_checkout date)
returns table (unit_id uuid, available boolean)
language plpgsql security definer set search_path = ''
as $$
declare v_unit public.units%rowtype;
begin
  if p_check_in is null or p_checkout is null or p_checkout <= p_check_in or p_check_in < current_date then
    raise exception 'Choose a valid future stay' using errcode = '22023';
  end if;
  select * into v_unit from public.units where id = p_unit_id and active for update;
  if not found or not exists (select 1 from public.properties p where p.id = v_unit.property_id and p.published) then
    return query select p_unit_id, false;
    return;
  end if;
  update public.unit_reservations r set released_at = now()
    where r.unit_id = v_unit.id and r.status = 'held' and r.released_at is null
      and exists (select 1 from public.bookings b where b.id = r.booking_id and b.status = 'pending' and b.hold_expires_at <= now());
  update public.bookings set status = 'expired', updated_at = now()
    where unit_id = v_unit.id and status = 'pending' and hold_expires_at <= now();
  return query select v_unit.id,
    not exists (select 1 from public.unit_blocks b where b.unit_id = v_unit.id and b.stay && daterange(p_check_in, p_checkout, '[)'))
    and not exists (select 1 from public.unit_reservations r where r.unit_id = v_unit.id and r.released_at is null and r.stay && daterange(p_check_in, p_checkout, '[)'));
end $$;

create or replace function public.record_checkin(p_booking_id uuid, p_notes text default '')
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_property_id uuid; v_previous_status public.booking_status; v_unit_id uuid;
begin
  select b.unit_id, u.property_id into v_unit_id, v_property_id from public.units u join public.bookings b on b.unit_id = u.id where b.id = p_booking_id;
  if v_property_id is null or not public.can_manage_property(v_property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  perform 1 from public.units where id = v_unit_id for update;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if v_booking.status <> 'approved' then raise exception 'Booking is not ready for check-in' using errcode = 'P0001'; end if;
  v_previous_status := v_booking.status;
  update public.bookings set status = 'checked_in', updated_at = now() where id = v_booking.id returning * into v_booking;
  insert into public.checkin_checkout_logs(booking_id, action, actor_id, notes) values (v_booking.id, 'check_in', (select auth.uid()), coalesce(p_notes, ''));
  insert into public.booking_status_history(booking_id, previous_status, new_status, actor_id) values (v_booking.id, v_previous_status, 'checked_in', (select auth.uid()));
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id) values ((select auth.uid()), v_property_id, 'checkin_recorded', 'booking', v_booking.id);
  return v_booking;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default '')
returns public.bookings language plpgsql security definer set search_path = ''
as $$
declare v_booking public.bookings%rowtype; v_unit public.units%rowtype; v_staff boolean; v_previous_status public.booking_status; v_unit_id uuid;
begin
  select unit_id into v_unit_id from public.bookings where id = p_booking_id;
  if v_unit_id is null then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  select * into v_unit from public.units where id = v_unit_id for update;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found' using errcode = 'P0002'; end if;
  v_staff := public.can_manage_property(v_unit.property_id);
  if v_booking.guest_id is distinct from (select auth.uid()) and not v_staff then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_booking.status not in ('pending', 'approved') then raise exception 'An occupied or completed stay cannot be cancelled here' using errcode = 'P0001'; end if;
  if v_booking.status = 'approved' and not v_staff then raise exception 'Contact the property to request cancellation of an approved stay' using errcode = '42501'; end if;
  v_previous_status := v_booking.status;
  update public.bookings set status = 'cancelled', cancellation_reason = nullif(trim(p_reason), ''), updated_at = now() where id = v_booking.id returning * into v_booking;
  update public.unit_reservations set released_at = now() where booking_id = v_booking.id and released_at is null;
  update public.booking_extensions set status = 'cancelled', decided_by = (select auth.uid()), decided_at = now()
    where booking_id = v_booking.id and status = 'pending';
  insert into public.booking_status_history(booking_id, previous_status, new_status, actor_id, reason)
    values (v_booking.id, v_previous_status, 'cancelled', (select auth.uid()), coalesce(p_reason, ''));
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id, details)
    values ((select auth.uid()), v_unit.property_id, 'booking_cancelled', 'booking', v_booking.id, jsonb_build_object('reason', coalesce(p_reason, '')));
  return v_booking;
end $$;

create or replace function public.create_unit_block(p_unit_id uuid, p_start date, p_end date, p_block_type text, p_reason text default '')
returns public.unit_blocks language plpgsql security definer set search_path = ''
as $$
declare v_unit public.units%rowtype; v_block public.unit_blocks%rowtype;
begin
  if p_end <= p_start or p_block_type not in ('maintenance', 'owner_use', 'cleaning') then raise exception 'Invalid block dates or type' using errcode = '22023'; end if;
  select * into v_unit from public.units where id = p_unit_id for update;
  if not found or not public.can_manage_property(v_unit.property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  if exists (select 1 from public.unit_reservations r where r.unit_id = v_unit.id and r.released_at is null and r.stay && daterange(p_start, p_end, '[)')) then raise exception 'Block conflicts with a reservation' using errcode = 'P0001'; end if;
  insert into public.unit_blocks(unit_id, stay, block_type, reason, created_by) values (v_unit.id, daterange(p_start, p_end, '[)'), p_block_type, coalesce(p_reason, ''), (select auth.uid())) returning * into v_block;
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id) values ((select auth.uid()), v_unit.property_id, 'unit_block_created', 'unit_block', v_block.id);
  return v_block;
end $$;

create or replace function public.delete_unit_block(p_block_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_property_id uuid;
begin
  select u.property_id into v_property_id from public.unit_blocks b join public.units u on u.id = b.unit_id where b.id = p_block_id;
  if v_property_id is null or not public.can_manage_property(v_property_id) then raise exception 'Not authorized' using errcode = '42501'; end if;
  delete from public.unit_blocks where id = p_block_id;
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id) values ((select auth.uid()), v_property_id, 'unit_block_deleted', 'unit_block', p_block_id);
end $$;

create or replace function public.run_scheduled_jobs(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_expired integer := 0; v_due integer := 0; v_reminders integer := 0; v_booking record; v_property record; v_staff record; v_local_now timestamp; v_day date; v_slot text; v_due_at timestamptz; v_interval integer; v_overdue_slot bigint;
begin
  if coalesce((auth.jwt() ->> 'role'), '') <> 'service_role' then raise exception 'Scheduler authorization required' using errcode = '42501'; end if;
  perform u.id
    from public.units u
    where exists (select 1 from public.bookings b where b.unit_id = u.id and b.status = 'pending' and b.hold_expires_at <= p_now)
    order by u.id
    for update;
  with expired as (
    update public.bookings b set status = 'expired', updated_at = p_now
    where b.status = 'pending' and b.hold_expires_at <= p_now returning b.id, b.unit_id
  ), released as (
    update public.unit_reservations r set released_at = p_now
    from expired e where r.booking_id = e.id and r.released_at is null returning r.booking_id
  )
  select count(*) into v_expired from released;
  insert into public.booking_status_history(booking_id, previous_status, new_status, reason)
    select b.id, 'pending', 'expired', 'Temporary hold expired' from public.bookings b
    where b.status = 'expired' and b.updated_at = p_now and b.hold_expires_at <= p_now;

  for v_booking in
    select b.*, u.name as unit_name, u.property_id, p.name as property_name, p.timezone,
      p.checkout_reminder_minutes, p.checkout_final_reminder_minutes, p.overdue_alert_interval_minutes, p.checkout_briefing_time
    from public.bookings b join public.units u on u.id = b.unit_id join public.properties p on p.id = u.property_id
    where b.status in ('approved', 'checked_in', 'checkout_due') and b.checkout > p_now - interval '1 day'
    order by u.id, b.id
    for update of u, b
  loop
    v_local_now := p_now at time zone v_booking.timezone;
    v_day := v_local_now::date;
    v_due_at := v_booking.checkout;
    v_interval := greatest(5, v_booking.overdue_alert_interval_minutes);
    if v_booking.status = 'checked_in' and v_due_at <= p_now then
      update public.bookings set status = 'checkout_due', updated_at = p_now where id = v_booking.id;
      insert into public.booking_status_history(booking_id, previous_status, new_status, reason) values (v_booking.id, 'checked_in', 'checkout_due', 'Scheduled checkout time passed; guest remains in-house');
      v_due := v_due + 1;
    end if;
    if v_booking.status = 'checked_in' and v_due_at <= p_now then
      v_slot := 'checkout_due';
    elsif v_booking.status = 'checkout_due' and v_due_at <= p_now then
      v_overdue_slot := floor(extract(epoch from (p_now - v_due_at)) / (v_interval * 60));
      v_slot := case when v_overdue_slot = 0 then null else 'overdue-' || v_overdue_slot::text end;
    elsif v_booking.status = 'checked_in' and v_booking.checkout_final_reminder_minutes > 0 and p_now >= v_due_at - make_interval(mins => v_booking.checkout_final_reminder_minutes) and p_now < v_due_at then
      v_slot := 'before-' || v_booking.checkout_final_reminder_minutes::text;
    elsif v_booking.status = 'checked_in' and v_booking.checkout_reminder_minutes > 0 and p_now >= v_due_at - make_interval(mins => v_booking.checkout_reminder_minutes) and p_now < v_due_at - make_interval(mins => v_booking.checkout_final_reminder_minutes) then
      v_slot := 'before-' || v_booking.checkout_reminder_minutes::text;
    else
      v_slot := null;
    end if;
    if v_slot is not null then
      for v_staff in select pm.user_id from public.property_members pm where pm.property_id = v_booking.property_id loop
        insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, scheduled_at, channel, deduplication_key)
        values (v_staff.user_id, v_booking.id, v_booking.property_id, case when v_slot like 'overdue-%' then 'checkout_overdue' when v_slot = 'checkout_due' then 'checkout_due' else 'checkout_reminder' end,
          case when v_slot like 'overdue-%' then 'Checkout is overdue' when v_slot = 'checkout_due' then 'Checkout is due' else 'Upcoming checkout' end,
          v_booking.guest_name || ' · ' || v_booking.reference || ' · ' || v_booking.unit_name || ' · ' || v_booking.property_name,
          p_now, 'in_app', v_booking.id::text || ':' || v_due_at::text || ':' || v_slot || ':' || v_staff.user_id::text)
        on conflict (deduplication_key) do nothing;
        v_reminders := v_reminders + 1;
      end loop;
      if v_booking.guest_id is not null then
        insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, scheduled_at, channel, deduplication_key)
        values (v_booking.guest_id, v_booking.id, v_booking.property_id, 'checkout_reminder', 'Checkout reminder', 'Your checkout time is ' || to_char(v_due_at at time zone v_booking.timezone, 'HH12:MI AM') || ' local time.', p_now, 'in_app', v_booking.id::text || ':' || v_due_at::text || ':' || v_slot || ':' || v_booking.guest_id::text)
        on conflict (deduplication_key) do nothing;
      end if;
    end if;
    if v_local_now::time >= v_booking.checkout_briefing_time and v_local_now::time < v_booking.checkout_briefing_time + interval '5 minutes' and (v_due_at at time zone v_booking.timezone)::date = v_day then
      for v_staff in select pm.user_id from public.property_members pm where pm.property_id = v_booking.property_id loop
        insert into public.notifications(recipient_id, booking_id, property_id, notification_type, title, body, scheduled_at, channel, deduplication_key)
        values (v_staff.user_id, v_booking.id, v_booking.property_id, 'daily_checkout_briefing', 'Today’s checkout briefing', v_booking.guest_name || ' · ' || v_booking.reference || ' · ' || v_booking.unit_name || ' · ' || to_char(v_due_at at time zone v_booking.timezone, 'HH12:MI AM'), p_now, 'in_app', v_booking.property_id::text || ':' || v_day::text || ':' || v_staff.user_id::text || ':' || v_booking.id::text)
        on conflict (deduplication_key) do nothing;
      end loop;
    end if;
  end loop;
  return jsonb_build_object('expired_holds', v_expired, 'checkouts_due', v_due, 'notifications_considered', v_reminders);
end $$;

revoke all on function public.get_unit_availability(uuid, date, date) from public;
revoke all on function public.record_checkin(uuid, text) from public;
revoke all on function public.cancel_booking(uuid, text) from public;
revoke all on function public.create_unit_block(uuid, date, date, text, text) from public;
revoke all on function public.delete_unit_block(uuid) from public;
revoke all on function public.run_scheduled_jobs(timestamptz) from public;
grant execute on function public.get_unit_availability(uuid, date, date) to anon, authenticated;
grant execute on function public.record_checkin(uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
grant execute on function public.create_unit_block(uuid, date, date, text, text) to authenticated;
grant execute on function public.delete_unit_block(uuid) to authenticated;
grant execute on function public.run_scheduled_jobs(timestamptz) to service_role;

revoke insert, update, delete on public.unit_blocks from authenticated;
