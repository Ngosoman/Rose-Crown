import { useEffect, useState } from 'react'
import { ArrowRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { createUnitBlock, getStaffProperties } from '../../Services/stayService'
import { ErrorState, LoadingState } from '../Common/Feedback'

const today = new Date().toISOString().slice(0, 10)

export default function UnitBlockForm({ onCreated, onClose }) {
  const [properties, setProperties] = useState([])
  const [propertyId, setPropertyId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [values, setValues] = useState({ start: '', end: '', type: 'maintenance', reason: '' })
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const units = properties.find((property) => property.id === propertyId)?.units?.filter((unit) => unit.active) ?? []

  useEffect(() => {
    let current = true
    getStaffProperties().then(({ data, error: queryError }) => {
      if (!current) return
      setProperties(data)
      setError(queryError?.message ?? '')
      if (data[0]) {
        setPropertyId(data[0].id)
        setUnitId(data[0].units?.find((unit) => unit.active)?.id ?? '')
      }
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (!unitId || !values.start || !values.end || values.end <= values.start) {
      setError('Choose a unit and a valid end date after the start date.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await createUnitBlock({ ...values, unitId })
      toast.success('The unit dates are blocked.')
      onCreated()
    } catch (reason) { setError(reason.message || 'The dates could not be blocked.') }
    finally { setBusy(false) }
  }

  return <section className="manual-booking-panel" aria-labelledby="unit-block-title">
    <div className="manual-booking-heading"><div><span className="eyebrow">Operations / unavailable dates</span><h2 id="unit-block-title">Block unit dates</h2><p>Blocks cannot overlap an active booking or hold.</p></div><button className="icon-button" aria-label="Close block dates form" onClick={onClose}><X size={17} /></button></div>
    {loading ? <LoadingState label="Loading assigned properties" /> : error && !properties.length ? <ErrorState message={error} /> : <form className="manual-booking-form" onSubmit={submit}>
      {error && <ErrorState message={error} />}
      <div className="form-grid"><label className="form-field"><span>Property</span><select value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setUnitId(properties.find((property) => property.id === event.target.value)?.units?.find((unit) => unit.active)?.id ?? '') }} required><option value="">Choose property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.city}</option>)}</select></label><label className="form-field"><span>Unit</span><select value={unitId} onChange={(event) => setUnitId(event.target.value)} required><option value="">Choose unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label className="form-field"><span>First unavailable night</span><input type="date" min={today} value={values.start} onChange={(event) => setValues((current) => ({ ...current, start: event.target.value }))} required /></label><label className="form-field"><span>Available again</span><input type="date" min={values.start || today} value={values.end} onChange={(event) => setValues((current) => ({ ...current, end: event.target.value }))} required /></label><label className="form-field"><span>Block type</span><select value={values.type} onChange={(event) => setValues((current) => ({ ...current, type: event.target.value }))}><option value="maintenance">Maintenance</option><option value="owner_use">Owner use</option><option value="cleaning">Cleaning</option></select></label><label className="form-field"><span>Reason <em>Optional</em></span><input maxLength="300" value={values.reason} onChange={(event) => setValues((current) => ({ ...current, reason: event.target.value }))} /></label></div>
      <div className="manual-booking-actions"><span>Saved as a half-open date range; the end date is available again.</span><button className="button button-dark" disabled={busy || loading}>{busy ? 'Saving block…' : 'Block dates'} <ArrowRight size={16} /></button></div>
    </form>}
  </section>
}
