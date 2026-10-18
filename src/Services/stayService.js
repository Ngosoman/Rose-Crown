import { supabase } from '../Lib/supabase'

export async function getProperties() {
  if (!supabase) return { data: [], error: null, configured: false }
  const { data, error } = await supabase
    .from('properties')
    .select('id,name,slug,description,address,city,timezone,currency,units(id,name,unit_type,capacity,bedrooms,bathrooms,description,base_nightly_price,currency,unit_photos(id,storage_path,alt_text,sort_order),unit_amenities(amenities(name)))')
    .eq('published', true)
    .order('name')
  return { data: (data ?? []).map((property) => ({
    ...property,
    units: (property.units ?? []).filter((unit) => unit.active !== false),
  })), error, configured: true }
}

export async function getProperty(slug) {
  if (!supabase) return { data: null, error: null, configured: false }
  const { data, error } = await supabase
    .from('properties')
    .select('id,name,slug,description,address,city,timezone,currency,check_in_time,checkout_time,units(id,name,unit_type,capacity,bedrooms,bathrooms,description,base_nightly_price,currency,unit_photos(id,storage_path,alt_text,sort_order),unit_amenities(amenities(name)))')
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle()
  return { data: data ? { ...data, units: data.units ?? [] } : null, error, configured: true }
}

export async function getGuestBookings() {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to view bookings.') }
  const { data, error } = await supabase
    .from('bookings')
    .select('id,reference,guest_name,guest_email,check_in,checkout,status,payment_status,agreed_total,currency,hold_expires_at,created_at,unit:units(name,unit_type,property:properties(name,city))')
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
    p_guest_phone: values.guestPhone,
    p_special_requests: values.specialRequests,
  })
  if (error) throw error
  return data
}

export async function getStaffBookings(propertyId) {
  if (!supabase) return { data: [], error: new Error('Connect Supabase to view bookings.') }
  let query = supabase
    .from('bookings')
    .select('id,reference,guest_name,guest_email,guest_phone,check_in,checkout,status,payment_status,agreed_total,currency,hold_expires_at,source,unit:units(id,name,property_id,property:properties(name))')
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
  const { data } = supabase.storage.from('stayease-listings').getPublicUrl(path)
  return data.publicUrl
}
