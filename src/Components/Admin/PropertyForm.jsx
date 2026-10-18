import { useState } from 'react'
import { ArrowRight, X } from 'lucide-react'

function slugify(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export default function PropertyForm({ property, onSave, onCancel, busy = false }) {
  const [values, setValues] = useState({
    name: property?.name ?? '',
    slug: property?.slug ?? '',
    description: property?.description ?? '',
    address: property?.address ?? '',
    city: property?.city ?? '',
    timezone: property?.timezone ?? 'UTC',
    currency: property?.currency ?? 'USD',
    check_in_time: property?.check_in_time?.slice(0, 5) ?? '15:00',
    checkout_time: property?.checkout_time?.slice(0, 5) ?? '11:00',
    published: property?.published ?? false,
  })

  function change(event) {
    const { name, value, checked, type } = event.target
    setValues((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  return <section className="listing-editor" aria-labelledby="property-editor-title">
    <div className="manual-booking-heading"><div><span className="eyebrow">{property ? 'Property settings' : 'New property'}</span><h2 id="property-editor-title">{property ? 'Edit property' : 'Create a property'}</h2><p>Use a valid IANA timezone, such as Africa/Nairobi or Europe/London.</p></div><button className="icon-button" aria-label="Close property editor" onClick={onCancel}><X size={17} /></button></div>
    <form className="manual-booking-form" onSubmit={(event) => { event.preventDefault(); onSave(values) }}>
      <div className="form-grid"><label className="form-field"><span>Property name</span><input name="name" value={values.name} onChange={(event) => { change(event); if (!property) setValues((current) => ({ ...current, slug: slugify(event.target.value) })) }} required maxLength="100" /></label><label className="form-field"><span>URL slug</span><input name="slug" value={values.slug} onChange={change} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength="120" /></label><label className="form-field"><span>City</span><input name="city" value={values.city} onChange={change} required maxLength="100" /></label><label className="form-field"><span>Street address</span><input name="address" value={values.address} onChange={change} maxLength="240" /></label><label className="form-field"><span>Timezone</span><input name="timezone" value={values.timezone} onChange={change} required maxLength="80" /></label><label className="form-field"><span>Default currency</span><input name="currency" value={values.currency} onChange={(event) => change({ target: { ...event.target, value: event.target.value.toUpperCase() } })} required minLength="3" maxLength="3" pattern="[A-Z]{3}" /></label><label className="form-field"><span>Check-in time</span><input type="time" name="check_in_time" value={values.check_in_time} onChange={change} required /></label><label className="form-field"><span>Checkout time</span><input type="time" name="checkout_time" value={values.checkout_time} onChange={change} required /></label><label className="form-field form-field-wide"><span>Description</span><textarea name="description" value={values.description} onChange={change} rows="3" maxLength="1600" /></label><label className="publish-toggle"><input type="checkbox" name="published" checked={values.published} onChange={change} /><span>Publish this property</span></label></div>
      <div className="listing-editor-actions"><span>Publishing makes eligible active units visible on the public site.</span><div><button className="button button-outline" type="button" onClick={onCancel}>Cancel</button><button className="button button-dark" disabled={busy}>{busy ? 'Saving…' : 'Save property'} <ArrowRight size={15} /></button></div></div>
    </form>
  </section>
}
