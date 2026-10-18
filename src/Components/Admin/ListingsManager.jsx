import { useEffect, useState } from 'react'
import { ArrowLeft, ImagePlus, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../Lib/supabase'
import {
  addUnitRateRule,
  deleteUnitPhoto,
  getAmenities,
  getStaffProperties,
  listingPhotoUrl,
  replaceUnitAmenities,
  saveProperty,
  saveUnit,
  uploadUnitPhoto,
} from '../../Services/stayService'
import { EmptyState, ErrorState, LoadingState } from '../Common/Feedback'
import { formatMoney } from '../../Utils/format'
import PropertyForm from './PropertyForm'
import RateRuleForm from './RateRuleForm'
import UnitForm from './UnitForm'

export default function ListingsManager({ isSuperAdmin, canManageListings }) {
  const [properties, setProperties] = useState([])
  const [amenities, setAmenities] = useState([])
  const [selectedPropertyId, setSelectedPropertyId] = useState('')
  const [editingProperty, setEditingProperty] = useState(null)
  const [editingUnit, setEditingUnit] = useState(null)
  const [propertyEditorOpen, setPropertyEditorOpen] = useState(false)
  const [unitEditorOpen, setUnitEditorOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [photoAlt, setPhotoAlt] = useState({})
  const [rateUnitId, setRateUnitId] = useState('')
  const property = properties.find((item) => item.id === selectedPropertyId) ?? properties[0]

  async function loadListings() {
    const [propertyResult, amenityResult] = await Promise.all([getStaffProperties(), getAmenities()])
    if (propertyResult.error) throw propertyResult.error
    if (amenityResult.error) throw amenityResult.error
    return { properties: propertyResult.data, amenities: amenityResult.data }
  }

  async function refresh() {
    const result = await loadListings()
    setProperties(result.properties)
    setAmenities(result.amenities)
  }

  useEffect(() => {
    let current = true
    loadListings().then((result) => {
      if (!current) return
      setProperties(result.properties)
      setAmenities(result.amenities)
    }).catch((reason) => current && setError(reason.message || 'Listings could not be loaded.'))
      .finally(() => current && setLoading(false))
    const channel = supabase?.channel('staff-listings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => loadListings().then((result) => { setProperties(result.properties); setAmenities(result.amenities) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'units' }, () => loadListings().then((result) => { setProperties(result.properties); setAmenities(result.amenities) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_photos' }, () => loadListings().then((result) => { setProperties(result.properties); setAmenities(result.amenities) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_rate_rules' }, () => loadListings().then((result) => { setProperties(result.properties); setAmenities(result.amenities) }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_amenities' }, () => loadListings().then((result) => { setProperties(result.properties); setAmenities(result.amenities) }))
      .subscribe()
    return () => { current = false; if (channel && supabase) supabase.removeChannel(channel) }
  }, [])

  async function savePropertyDetails(values) {
    setBusy(true)
    setError('')
    try {
      const saved = await saveProperty(values, editingProperty?.id)
      await refresh()
      setSelectedPropertyId(saved.id)
      setPropertyEditorOpen(false)
      setEditingProperty(null)
      toast.success(editingProperty ? 'Property updated.' : 'Property created.')
    } catch (reason) { setError(reason.message || 'Property could not be saved.') }
    finally { setBusy(false) }
  }

  async function saveUnitDetails(values) {
    setBusy(true)
    setError('')
    try {
      const { amenityIds, ...unitValues } = values
      const saved = await saveUnit({ ...unitValues, property_id: selectedPropertyId }, editingUnit?.id)
      await replaceUnitAmenities(saved.id, amenityIds)
      await refresh()
      setUnitEditorOpen(false)
      setEditingUnit(null)
      toast.success(editingUnit ? 'Unit updated.' : 'Unit added.')
    } catch (reason) { setError(reason.message || 'Unit could not be saved.') }
    finally { setBusy(false) }
  }

  async function addPhoto(unit, event) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await uploadUnitPhoto(unit, file, photoAlt[unit.id] || '')
      await refresh()
      toast.success('Listing photo uploaded.')
      setPhotoAlt((current) => ({ ...current, [unit.id]: '' }))
    } catch (reason) { setError(reason.message || 'Photo upload failed.') }
    finally { setBusy(false); event.target.value = '' }
  }

  async function removePhoto(photo) {
    if (!window.confirm('Remove this listing photo?')) return
    setBusy(true)
    try {
      await deleteUnitPhoto(photo)
      await refresh()
      toast.success('Listing photo removed.')
    } catch (reason) { setError(reason.message || 'Photo could not be removed.') }
    finally { setBusy(false) }
  }

  async function saveRate(unit, values) {
    setBusy(true)
    setError('')
    try {
      await addUnitRateRule(values)
      await refresh()
      setRateUnitId('')
      toast.success(`Seasonal rate added for ${unit.name}.`)
    } catch (reason) { setError(reason.message || 'Rate rule conflicts with an existing rule or could not be saved.') }
    finally { setBusy(false) }
  }

  if (loading) return <LoadingState label="Loading assigned properties" />
  if (error && properties.length === 0) return <ErrorState message={error} />

  return <section className="listings-manager" aria-label="Property and unit management">
    {error && <ErrorState message={error} />}
    {!property && !propertyEditorOpen && <EmptyState title="No assigned properties yet" body={isSuperAdmin ? 'Create your first property to begin adding bookable units.' : 'Ask a super-admin to create a property and assign it to your account.'} />}
    {isSuperAdmin && <div className="listings-toolbar">{propertyEditorOpen ? <button className="button button-outline" onClick={() => { setPropertyEditorOpen(false); setEditingProperty(null) }}><ArrowLeft size={15} /> Back to listings</button> : <button className="button button-dark" onClick={() => { setEditingProperty(property ?? null); setPropertyEditorOpen(true) }}><Plus size={16} /> {property ? 'Edit property' : 'Create property'}</button>}</div>}
    {propertyEditorOpen && isSuperAdmin && <PropertyForm property={editingProperty} onSave={savePropertyDetails} onCancel={() => { setPropertyEditorOpen(false); setEditingProperty(null) }} busy={busy} />}
    {!propertyEditorOpen && properties.length > 0 && <div className="listing-property-select"><label className="form-field"><span>Property</span><select value={selectedPropertyId} onChange={(event) => setSelectedPropertyId(event.target.value)}>{properties.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.city || 'No city'}</option>)}</select></label><span><MapPin size={14} /> {property?.timezone} · {property?.currency}</span></div>}
    {property && !propertyEditorOpen && <>
      <div className="listing-property-heading"><div><span className="eyebrow">{property.published ? 'Published listing' : 'Draft listing'}</span><h2>{property.name}</h2><p>{property.description || property.address || property.city || 'No property description yet.'}</p></div>{canManageListings && <button className="button button-dark" onClick={() => { setEditingUnit(null); setUnitEditorOpen(true) }}><Plus size={16} /> Add unit</button>}</div>
      {unitEditorOpen && canManageListings && <UnitForm property={property} unit={editingUnit} amenities={amenities} onSave={saveUnitDetails} onCancel={() => { setUnitEditorOpen(false); setEditingUnit(null) }} busy={busy} />}
      {property.units.length === 0 && <EmptyState title="No bookable units" body="Add an apartment, studio, or room to this property." />}
      <div className="managed-unit-list">{property.units.map((unit) => <article className="managed-unit" key={unit.id}>
        <div className="managed-unit-heading"><div><span className="eyebrow">{unit.unit_type} · {unit.active ? 'Active' : 'Inactive'}</span><h3>{unit.name}</h3><p>Up to {unit.capacity} guests · {unit.bedrooms} bedrooms · {unit.bathrooms} bathrooms</p></div><div className="managed-unit-price"><strong>{formatMoney(unit.base_nightly_price, unit.currency)}</strong><span>base nightly rate</span>{canManageListings && <button className="icon-button" aria-label={`Edit ${unit.name}`} onClick={() => { setEditingUnit(unit); setUnitEditorOpen(true) }}><Pencil size={15} /></button>}</div></div>
        {unit.description && <p className="managed-unit-description">{unit.description}</p>}
        <div className="amenity-list">{(unit.unit_amenities ?? []).map(({ amenities: item }) => item?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div>
        <div className="managed-photos">{(unit.unit_photos ?? []).slice().sort((a, b) => a.sort_order - b.sort_order).map((photo) => <div className="managed-photo" key={photo.id}><img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || unit.name} />{canManageListings && <button className="icon-button" aria-label={`Remove photo ${photo.alt_text || unit.name}`} onClick={() => removePhoto(photo)} disabled={busy}><Trash2 size={14} /></button>}</div>)}
          {canManageListings && <><label className="photo-upload"><ImagePlus size={18} /><span>Add photo</span><input type="file" accept="image/*" disabled={busy} onChange={(event) => addPhoto(unit, event)} /></label><label className="photo-alt-field"><span>Alt text for next photo</span><input value={photoAlt[unit.id] || ''} maxLength="180" onChange={(event) => setPhotoAlt((current) => ({ ...current, [unit.id]: event.target.value }))} /></label></>}
        </div>
        {canManageListings && <div className="rate-rule-toggle"><button className="text-link" onClick={() => setRateUnitId(rateUnitId === unit.id ? '' : unit.id)}>{rateUnitId === unit.id ? 'Close seasonal pricing' : `Seasonal pricing (${unit.unit_rate_rules?.length ?? 0})`}</button></div>}
        {(unit.unit_rate_rules ?? []).length > 0 && <div className="rate-rule-list">{unit.unit_rate_rules.map((rule) => <span key={rule.id}>{rule.date_from}–{rule.date_to}: {formatMoney(rule.nightly_price, rule.currency)}</span>)}</div>}
        {canManageListings && rateUnitId === unit.id && <RateRuleForm unit={unit} busy={busy} onSave={(values) => saveRate(unit, values)} />}
      </article>)}</div>
    </>}
  </section>
}
