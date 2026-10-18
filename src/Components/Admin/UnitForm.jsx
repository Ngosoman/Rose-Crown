import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

export default function UnitForm({ property, unit, amenities, onSave, onCancel, busy = false }) {
  const [values, setValues] = useState({
    name: unit?.name ?? '',
    unit_type: unit?.unit_type ?? 'apartment',
    capacity: String(unit?.capacity ?? 2),
    bedrooms: String(unit?.bedrooms ?? 1),
    bathrooms: String(unit?.bathrooms ?? 1),
    description: unit?.description ?? '',
    base_nightly_price: String(unit?.base_nightly_price ?? ''),
    currency: unit?.currency ?? property.currency,
    active: unit?.active ?? true,
  })
  const [amenityIds, setAmenityIds] = useState((unit?.unit_amenities ?? []).map(({ amenity_id }) => amenity_id))

  function change(event) {
    const { name, value, checked, type } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  function toggleAmenity(id, checked) {
    setAmenityIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))
  }

  return <section className="listing-editor" aria-labelledby="unit-editor-title">
    <div className="manual-booking-heading"><div><span className="eyebrow">{property.name} / {unit ? 'Unit details' : 'New unit'}</span><h2 id="unit-editor-title">{unit ? 'Edit unit' : 'Add a unit'}</h2><p>Each unit has its own dates, capacity, photos, amenities, and price rules.</p></div><button className="icon-button" aria-label="Close unit editor" onClick={onCancel}><X size={17} /></button></div>
    <form className="manual-booking-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...values, amenityIds }) }}>
      <div className="form-grid"><label className="form-field"><span>Unit name / number</span><input name="name" value={values.name} onChange={change} required maxLength="100" /></label><label className="form-field"><span>Stay type</span><select name="unit_type" value={values.unit_type} onChange={change}><option value="apartment">Apartment</option><option value="studio">Studio</option><option value="room">Room</option></select></label><label className="form-field"><span>Guest capacity</span><input type="number" min="1" max="50" name="capacity" value={values.capacity} onChange={change} required /></label><label className="form-field"><span>Bedrooms</span><input type="number" min="0" step="0.5" name="bedrooms" value={values.bedrooms} onChange={change} required /></label><label className="form-field"><span>Bathrooms</span><input type="number" min="0" step="0.5" name="bathrooms" value={values.bathrooms} onChange={change} required /></label><label className="form-field"><span>Base nightly price</span><input type="number" min="0" step="0.01" name="base_nightly_price" value={values.base_nightly_price} onChange={change} required /></label><label className="form-field"><span>Currency</span><input name="currency" value={values.currency} onChange={(event) => setValues((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} required minLength="3" maxLength="3" pattern="[A-Z]{3}" /></label><label className="form-field form-field-wide"><span>Description</span><textarea name="description" value={values.description} onChange={change} rows="3" maxLength="1200" /></label>
        {amenities.length > 0 && <fieldset className="amenity-editor form-field-wide"><legend>Amenities</legend><div>{amenities.map((amenity) => <label key={amenity.id}><input type="checkbox" checked={amenityIds.includes(amenity.id)} onChange={(event) => toggleAmenity(amenity.id, event.target.checked)} /> {amenity.name}</label>)}</div></fieldset>}
        <label className="publish-toggle"><input type="checkbox" name="active" checked={values.active} onChange={change} /><span>Unit is active</span></label>
      </div>
      <div className="listing-editor-actions"><span>Nightly rates are checked against the property's currency and date rules.</span><div><button className="button button-outline" type="button" onClick={onCancel}>Cancel</button><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save unit'} <ArrowRight size={15} /></button></div></div>
    </form>
  </section>
}
