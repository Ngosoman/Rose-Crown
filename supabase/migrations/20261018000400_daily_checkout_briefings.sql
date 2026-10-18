create or replace function public.enqueue_daily_checkout_briefings(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_property record; v_staff record; v_day date; v_body text; v_created integer := 0;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role' then raise exception 'Scheduler authorization required' using errcode = '42501'; end if;
  for v_property in
    select p.id, p.name, p.timezone, p.checkout_briefing_time
    from public.properties p
    where (p_now at time zone p.timezone)::time >= p.checkout_briefing_time
      and (p_now at time zone p.timezone)::time < p.checkout_briefing_time + interval '5 minutes'
  loop
    v_day := (p_now at time zone v_property.timezone)::date;
    select string_agg(
      concat_ws(' | ',
        b.guest_name || ' / ' || b.reference,
        u.name,
        to_char(b.checkout at time zone v_property.timezone, 'HH12:MI AM'),
        'Status: ' || replace(b.status::text, '_', ' '),
        case when ext.requested_checkout is not null then 'Approved extension to ' || to_char(ext.requested_checkout at time zone v_property.timezone, 'HH12:MI AM') else null end,
        case when b.status in ('checked_in', 'checkout_due') then 'Action: record checkout' else 'Action: confirm arrival status' end
      ), E'\n' order by b.checkout, u.name
    ) into v_body
    from public.bookings b
    join public.units u on u.id = b.unit_id
    left join lateral (
      select e.requested_checkout
      from public.booking_extensions e
      where e.booking_id = b.id and e.status = 'approved'
      order by e.decided_at desc limit 1
    ) ext on true
    where u.property_id = v_property.id
      and b.status in ('approved', 'checked_in', 'checkout_due')
      and (b.checkout at time zone v_property.timezone)::date = v_day;
    if v_body is null then continue; end if;
    for v_staff in select pm.user_id from public.property_members pm where pm.property_id = v_property.id loop
      insert into public.notifications(recipient_id, property_id, notification_type, title, body, scheduled_at, channel, deduplication_key)
      values (v_staff.user_id, v_property.id, 'daily_checkout_briefing', 'Today''s checkout briefing for ' || v_property.name,
        v_body, p_now, 'in_app', v_property.id::text || ':' || v_day::text || ':checkout-briefing:' || v_staff.user_id::text)
      on conflict (deduplication_key) do nothing;
      if found then v_created := v_created + 1; end if;
    end loop;
  end loop;
  return v_created;
end $$;

revoke all on function public.enqueue_daily_checkout_briefings(timestamptz) from public;
grant execute on function public.enqueue_daily_checkout_briefings(timestamptz) to service_role;
