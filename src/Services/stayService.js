import { supabase } from '../Lib/supabase'

function explainMissingSchema(error) {
  if (error?.code === 'PGRST205' || /Could not find the table 'public\.(properties|bookings)' in the schema cache/i.test(error?.message ?? '')) {
    return new Error('Rose-Crown is connected to Supabase, but its database schema has not been deployed to this project yet.')
  }
  return error
}

export async function getProperties() {
  if (!supabase) return { data: [], error: null, configured: false }
  const { data, error } = await supabase
    .from('properties')
    .select('id,name,slug,description,address,city,timezone,currency,units(id,name,unit_type,capacity,bedrooms,bathrooms,description,base_nightly_price,currency,active,unit_photos(id,storage_path,alt_text,sort_order),unit_amenities(amenities(name)))')
    .eq('published', true)
    .order('name')
  return { data: (data ?? []).map((property) => ({
    ...property,
    units: (property.units ?? []).filter((unit) => unit.active !== false),
  })), error: explainMissingSchema(error), configured: true }
}

export async function getProperty(slug) {
  if (!supabase) return { data: null, error: null, configured: false }
  const { data, error } = await supabase
    .from('properties')
    .select('id,name,slug,description,address,city,timezone,currency,check_in_time,checkout_time,units(id,name,unit_type,capacity,bedrooms,bathrooms,description,base_nightly_price,currency,active,unit_photos(id,storage_path,alt_text,sort_order),unit_amenities(amenities(name)))')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return { data: data ? { ...data, units: (data.units ?? []).filter((unit) => unit.active) } : null, error: explainMissingSchema(error), configured: true }
}

export async function getGuestBookings() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to view bookings.') }
  const { data, error } = await supabase
    .from('bookings')
    .select('id,reference,guest_name,guest_email,guest_count,check_in,checkout,status,payment_status,agreed_total,currency,hold_expires_at,created_at,booking_extensions(id,requested_checkout,status,reason,created_at),unit:units(name,unit_type,property:properties(name,city,timezone))')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function createBookingRequest(values) {
  if (!supabase) throw new Error('Booking is unavailable until Supabase is configured.')
  const { data, error } = await supabase.rpc('create_booking_request', {
    p_unit_id: values.unitId,
    p_check_in: values.checkIn,
    p_checkout: values.checkout,
    p_guest_name: values.guestName,
    p_guest_email: values.guestEmail,
    p_guest_count: values.guestCount,
    p_guest_phone: values.guestPhone,
    p_special_requests: values.specialRequests,
  })
  if (error) throw error
  return data
}

export async function getUnitAvailability(unitId, checkIn, checkout) {
  if (!supabase) return { available: null, error: new Error('Connect Supabase to check dates.') }
  const { data, error } = await supabase.rpc('get_unit_availability', {
    p_unit_id: unitId,
    p_check_in: checkIn,
    p_checkout: checkout,
  })
  return { available: data?.[0]?.available ?? false, error }
}

export async function cancelBooking(bookingId, reason = '') {
  if (!supabase) throw new Error('Connect Supabase to manage bookings.')
  const { data, error } = await supabase.rpc('cancel_booking', {
    p_booking_id: bookingId,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function recordCheckin(bookingId, notes = '') {
  if (!supabase) throw new Error('Connect Supabase to manage bookings.')
  const { data, error } = await supabase.rpc('record_checkin', {
    p_booking_id: bookingId,
    p_notes: notes,
  })
  if (error) throw error
  return data
}

export async function requestExtension(bookingId, checkoutDate, reason = '') {
  if (!supabase) throw new Error('Connect Supabase to request an extension.')
  const { data, error } = await supabase.rpc('request_extension', {
    p_booking_id: bookingId,
    p_requested_checkout: checkoutDate,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function getPendingExtensions() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to manage extensions.') }
  const { data, error } = await supabase
    .from('booking_extensions')
    .select('id,booking_id,requested_by,original_checkout,requested_checkout,status,reason,created_at,booking:bookings!inner(reference,guest_name,guest_email,checkout,unit:units(id,name,property:properties(id,name,timezone)))')
    .eq('status', 'pending')
    .order('created_at')
  return { data: data ?? [], error }
}

export async function decideExtension(extensionId, approve, reason = '') {
  if (!supabase) throw new Error('Connect Supabase to manage extensions.')
  const { data, error } = await supabase.rpc('decide_extension', {
    p_extension_id: extensionId,
    p_approve: approve,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function getNotifications() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to view notifications.') }
  const { data, error } = await supabase
    .from('notifications')
    .select('id,booking_id,property_id,notification_type,title,body,channel,delivery_status,scheduled_at,sent_at,attempt_count,last_error,read_at,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  return { data: data ?? [], error }
}

export async function markNotificationRead(notificationId) {
  if (!supabase) throw new Error('Connect Supabase to update notifications.')
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: notificationId })
  if (error) throw error
}

export async function createManualBooking(values) {
  if (!supabase) throw new Error('Connect Supabase to create bookings.')
  const { data, error } = await supabase.rpc('create_manual_booking', {
    p_unit_id: values.unitId,
    p_check_in: values.checkIn,
    p_checkout: values.checkout,
    p_guest_name: values.guestName,
    p_guest_email: values.guestEmail,
    p_guest_phone: values.guestPhone,
    p_source: values.source,
    p_guest_count: Number(values.guestCount),
    p_special_requests: values.specialRequests || '',
  })
  if (error) throw error
  return data
}

export async function getStaffProperties() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to manage properties.') }
  const { data, error } = await supabase
    .from('properties')
    .select('id,name,city,units(id,name,capacity,active)')
    .order('name')
  return { data: data ?? [], error }
}

export async function getStaffBlocks() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to manage date blocks.') }
  const { data, error } = await supabase
    .from('unit_blocks')
    .select('id,unit_id,stay,block_type,reason,unit:units(id,name,property_id,property:properties(id,name,timezone))')
    .order('created_at', { ascending: false })
  return { data: data ?? [], error }
}

export async function createUnitBlock(values) {
  if (!supabase) throw new Error('Connect Supabase to manage date blocks.')
  const { data, error } = await supabase.rpc('create_unit_block', {
    p_unit_id: values.unitId,
    p_start: values.start,
    p_end: values.end,
    p_block_type: values.type,
    p_reason: values.reason || '',
  })
  if (error) throw error
  return data
}

export async function deleteUnitBlock(blockId) {
  if (!supabase) throw new Error('Connect Supabase to manage date blocks.')
  const { error } = await supabase.rpc('delete_unit_block', { p_block_id: blockId })
  if (error) throw error
}

export async function getStaffBookings(propertyId) {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to view bookings.') }
  let query = supabase
    .from('bookings')
    .select('id,reference,guest_name,guest_email,guest_phone,guest_count,check_in,checkout,status,payment_status,agreed_total,currency,hold_expires_at,source,unit:units(id,name,property_id,property:properties(id,name,timezone))')
    .order('check_in', { ascending: true })
  if (propertyId) query = query.eq('unit.property_id', propertyId)
  const { data, error } = await query
  return { data: data ?? [], error }
}

export async function decideBooking(bookingId, approve, reason = '') {
  if (!supabase) throw new Error('Connect Supabase to manage bookings.')
  const { data, error } = await supabase.rpc('decide_booking', {
    p_booking_id: bookingId,
    p_approve: approve,
    p_reason: reason,
  })
  if (error) throw error
  return data
}

export async function recordCheckout(bookingId, notes = '') {
  if (!supabase) throw new Error('Connect Supabase to manage bookings.')
  const { data, error } = await supabase.rpc('record_checkout', {
    p_booking_id: bookingId,
    p_notes: notes,
  })
  if (error) throw error
  return data
}

export function listingPhotoUrl(path) {
  if (!supabase || !path) return null
  const { data } = supabase.storage.from('rose-crown-listings').getPublicUrl(path)
  return data.publicUrl
}
