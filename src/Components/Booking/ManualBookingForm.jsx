import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { createManualBooking, getStaffProperties } from '../../Services/stayService'
import { ErrorState, LoadingState } from '../Common/Feedback'

const today = new Date().toISOString().slice(0, 10)

export default function ManualBookingForm({ onCreated, onClose }) {
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [values, setValues] = useState({ guestName: '', guestEmail: '', guestPhone: '', guestCount: '1', checkIn: '', checkout: '', source: 'phone', specialRequests: '' })
  const units = properties.find((property) => property.id === propertyId)?.units?.filter((unit) => unit.active) ?? []
  const selectedUnit = units.find((unit) => unit.id === unitId)

  useEffect(() => {
    let current = true
    getStaffProperties().then(({ data, error: queryError }) => {
      if (!current) return
      setProperties(data)
      setError(queryError?.message ?? '')
      if (data[0]) {
        setPropertyId(data[0].id)
        const firstUnit = data[0].units?.find((unit) => unit.active)
        if (firstUnit) setUnitId(firstUnit.id)
      }
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [])

  function change(event) {
    const { name, value } = event.target
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (!unitId || !values.checkIn || !values.checkout || values.checkout <= values.checkIn) {
      setError('Choose a unit and a valid check-in/check-out range.')
      return
    }
    if (!values.guestName.trim() || !values.guestEmail.includes('@') || !values.guestPhone.trim()) {
      setError('Guest name, valid email, and phone are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const booking = await createManualBooking({ ...values, unitId })
      toast.success(`Booking ${booking.reference} added and dates reserved.`)
      onCreated()
    } catch (reason) {
      setError(reason.message || 'The booking could not be created.')
    } finally { setBusy(false) }
  }

  return <section className="manual-booking-panel" aria-labelledby="manual-booking-title">
    <div className="manual-booking-heading"><div><span className="eyebrow">Front desk / offline guest</span><h2 id="manual-booking-title">Add a manual booking</h2><p>This creates a confirmed reservation and makes its dates unavailable immediately.</p></div><button className="icon-button" aria-label="Close manual booking form" onClick={onClose}><X size={17} /></button></div>
    {loading ? <LoadingState label="Loading assigned properties" /> : error && !properties.length ? <ErrorState message={error} /> : <form className="manual-booking-form" onSubmit={submit}>
      {error && <ErrorState message={error} />}
      <div className="form-grid"><label className="form-field"><span>Property</span><select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); const first = properties.find((property) => property.id === event.target.value)?.units?.find((unit) => unit.active); setUnitId(first?.id ?? '') }} required><option value="">Choose property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.city}</option>)}</select></label><label className="form-field"><span>Unit</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name} · Sleeps {unit.capacity}</option>)}</select></label>
        <label className="form-field"><span>Guest name</span><input name="guestName" autoComplete="name" value={values.guestName} onChange={change} required minLength="2" /></label><label className="form-field"><span>Guest email</span><input type="email" name="guestEmail" autoComplete="email" value={values.guestEmail} onChange={change} required /></label><label className="form-field"><span>Guest phone</span><input type="tel" name="guestPhone" autoComplete="tel" value={values.guestPhone} onChange={change} required /></label><label className="form-field"><span>Guests</span><select name="guestCount" value={values.guestCount} onChange={change}>{Array.from({ length: selectedUnit?.capacity ?? 1 }, (_, index) => index + 1).map((count) => <option value={count} key={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label>
        <label className="form-field"><span>Check in</span><input type="date" min={today} name="checkIn" value={values.checkIn} onChange={change} required /></label><label className="form-field"><span>Check out</span><input type="date" min={values.checkIn || today} name="checkout" value={values.checkout} onChange={change} required /></label><label className="form-field"><span>Booking source</span><select name="source" value={values.source} onChange={change}><option value="phone">Phone</option><option value="whatsapp">WhatsApp</option><option value="walk_in">Walk-in</option><option value="staff">Staff</option></select></label><label className="form-field form-field-wide"><span>Special requests <em>Optional</em></span><textarea rows="2" name="specialRequests" value={values.specialRequests} onChange={change} /></label>
      </div><div className="manual-booking-actions"><span>Price is calculated by the database from active unit rates.</span><button className="button button-dark" disabled={busy || loading}>{busy ? 'Creating reservation…' : 'Create confirmed booking'} <ArrowRight size={16} /></button></div>
    </form>}
  </section>
}
