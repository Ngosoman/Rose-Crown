create or replace function public.can_manage_listings(p_property_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.property_members pm
    where pm.property_id = p_property_id
      and pm.user_id = (select auth.uid())
      and pm.role = 'property_manager'
  )
$$;
revoke all on function public.can_manage_listings(uuid) from public;
grant execute on function public.can_manage_listings(uuid) to authenticated;

drop policy units_assigned_write on public.units;
create policy units_assigned_write on public.units for all to authenticated
using (public.can_manage_listings(property_id))
with check (public.can_manage_listings(property_id));

drop policy rates_assigned_write on public.unit_rate_rules;
create policy rates_assigned_write on public.unit_rate_rules for all to authenticated
using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)))
with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)));

drop policy photos_assigned_write on public.unit_photos;
create policy photos_assigned_write on public.unit_photos for all to authenticated
using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)))
with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)));

revoke insert, update, delete on public.unit_amenities from authenticated;
drop policy if exists unit_amenities_assigned_write on public.unit_amenities;
create policy unit_amenities_assigned_write on public.unit_amenities for all to authenticated
using (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)))
with check (exists (select 1 from public.units u where u.id = unit_id and public.can_manage_listings(u.property_id)));

drop policy listing_photos_staff_insert on storage.objects;
create policy listing_photos_staff_insert on storage.objects for insert to authenticated
with check (bucket_id = 'rose-crown-listings' and public.can_manage_listings(((storage.foldername(name))[1])::uuid));

drop policy listing_photos_staff_update on storage.objects;
create policy listing_photos_staff_update on storage.objects for update to authenticated
using (bucket_id = 'rose-crown-listings' and public.can_manage_listings(((storage.foldername(name))[1])::uuid))
with check (bucket_id = 'rose-crown-listings' and public.can_manage_listings(((storage.foldername(name))[1])::uuid));

drop policy listing_photos_staff_delete on storage.objects;
create policy listing_photos_staff_delete on storage.objects for delete to authenticated
using (bucket_id = 'rose-crown-listings' and public.can_manage_listings(((storage.foldername(name))[1])::uuid));

create or replace function public.replace_unit_amenities(p_unit_id uuid, p_amenity_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if p_amenity_ids is null or cardinality(p_amenity_ids) > 30 then
    raise exception 'Choose no more than 30 amenities' using errcode = '22023';
  end if;
  perform 1 from public.units where id = p_unit_id and public.can_manage_listings(property_id) for update;
  if not found then raise exception 'Unit unavailable or not authorized' using errcode = '42501'; end if;
  if exists (
    select 1 from unnest(p_amenity_ids) selected(id)
    where not exists (select 1 from public.amenities a where a.id = selected.id)
  ) then raise exception 'An amenity does not exist' using errcode = '22023'; end if;
  delete from public.unit_amenities where unit_id = p_unit_id;
  insert into public.unit_amenities(unit_id, amenity_id)
    select p_unit_id, selected.id from unnest(p_amenity_ids) selected(id)
    on conflict (unit_id, amenity_id) do nothing;
end $$;
revoke all on function public.replace_unit_amenities(uuid, uuid[]) from public;
grant execute on function public.replace_unit_amenities(uuid, uuid[]) to authenticated;

create or replace function public.audit_listing_mutation()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb;
  v_property_id uuid;
  v_unit_id uuid;
  v_entity_id uuid;
begin
  if tg_op = 'DELETE' then v_row := to_jsonb(old); else v_row := to_jsonb(new); end if;
  if tg_table_name = 'properties' then
    v_property_id := (v_row ->> 'id')::uuid;
    v_entity_id := v_property_id;
  elsif tg_table_name = 'units' then
    v_property_id := (v_row ->> 'property_id')::uuid;
    v_entity_id := (v_row ->> 'id')::uuid;
  else
    v_unit_id := (v_row ->> 'unit_id')::uuid;
    v_entity_id := coalesce((v_row ->> 'id')::uuid, v_unit_id);
    select u.property_id into v_property_id from public.units u where u.id = v_unit_id;
  end if;
  insert into public.audit_logs(actor_id, property_id, action, entity_type, entity_id, details)
  values ((select auth.uid()), v_property_id, lower(tg_op), tg_table_name, v_entity_id,
    jsonb_build_object('name', v_row ->> 'name', 'block_type', v_row ->> 'block_type'));
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke all on function public.audit_listing_mutation() from public;

create trigger audit_property_mutation after insert or update or delete on public.properties
for each row execute function public.audit_listing_mutation();
create trigger audit_unit_mutation after insert or update or delete on public.units
for each row execute function public.audit_listing_mutation();
create trigger audit_unit_rate_mutation after insert or update or delete on public.unit_rate_rules
for each row execute function public.audit_listing_mutation();
create trigger audit_unit_photo_mutation after insert or update or delete on public.unit_photos
for each row execute function public.audit_listing_mutation();
create trigger audit_unit_amenity_mutation after insert or delete on public.unit_amenities
for each row execute function public.audit_listing_mutation();
