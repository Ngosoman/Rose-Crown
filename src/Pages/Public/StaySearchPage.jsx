import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPin, SlidersHorizontal } from 'lucide-react'
import { getProperties, getUnitAvailability, listingPhotoUrl } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, getUnitImage } from '../../Utils/format'

export default function StaySearchPage() {
  const [params] = useSearchParams()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [availability, setAvailability] = useState(null)
  const [unitType, setUnitType] = useState('all')
  const [currency, setCurrency] = useState('all')
  const [priceLimit, setPriceLimit] = useState('')
  const [selectedAmenities, setSelectedAmenities] = useState([])
  const city = params.get('city') ?? ''
  const checkIn = params.get('checkIn') ?? ''
  const checkout = params.get('checkout') ?? ''
  const guests = Number(params.get('guests') || 1)
  const currencies = useMemo(() => [...new Set(properties.flatMap((property) => property.units.map((unit) => unit.currency)))].sort(), [properties])
  const amenities = useMemo(() => [...new Set(properties.flatMap((property) => property.units.flatMap((unit) => (unit.unit_amenities ?? []).map(({ amenities: item }) => item?.name).filter(Boolean))))].sort(), [properties])
  const dateKey = checkIn && checkout > checkIn ? `${checkIn}:${checkout}` : ''
  const availabilityData = availability?.dateKey === dateKey ? availability.units : null
  const checkingDates = Boolean(dateKey && properties.length > 0 && !availabilityData)

  useEffect(() => {
    let current = true
    getProperties().then(({ data, error: queryError, configured: isConfigured }) => {
      if (!current) return
      setProperties(data)
      setConfigured(isConfigured)
      setError(queryError?.message ?? '')
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [])

  useEffect(() => {
    if (!dateKey || properties.length === 0) return undefined
    let current = true
    const units = properties.flatMap((property) => property.units)
    Promise.all(units.map(async (unit) => {
      const result = await getUnitAvailability(unit.id, checkIn, checkout)
      if (result.error) throw result.error
      return [unit.id, result.available]
    })).then((entries) => current && setAvailability({ dateKey, units: Object.fromEntries(entries) }))
      .catch((reason) => current && setError(reason.message))
    return () => { current = false }
  }, [properties, checkIn, checkout, dateKey])

  const results = useMemo(() => properties.flatMap((property) => property.units
    .filter((unit) => unit.capacity >= guests && (unitType === 'all' || unit.unit_type === unitType))
    .filter((unit) => currency === 'all' || unit.currency === currency)
    .filter((unit) => !priceLimit || Number(unit.base_nightly_price) <= Number(priceLimit))
    .filter((unit) => selectedAmenities.every((name) => unit.unit_amenities?.some(({ amenities: item }) => item?.name === name)))
    .filter((unit) => !dateKey || availabilityData?.[unit.id] === true)
    .map((unit) => ({ ...unit, property })))
    .filter(({ property }) => !city || `${property.city} ${property.name} ${property.address}`.toLowerCase().includes(city.toLowerCase())), [properties, guests, unitType, city, dateKey, availabilityData, currency, priceLimit, selectedAmenities])

  function propertyHref(slug, unitId = '') {
    const query = new URLSearchParams()
    if (checkIn) query.set('checkIn', checkIn)
    if (checkout) query.set('checkout', checkout)
    if (guests) query.set('guests', String(guests))
    if (unitId) query.set('unit', unitId)
    const suffix = query.toString()
    return `/stays/${slug}${suffix ? `?${suffix}` : ''}`
  }

  return <section className="search-page section-wrap">
    <div className="page-intro"><span className="eyebrow">Stay collection</span><h1>Find your <em>somewhere.</em></h1><p>Small, considered places that make getting away feel effortless.</p></div>
    <div className="results-toolbar"><div><strong>{loading ? '—' : results.length}</strong> stays {city && <span>in <b>{city}</b></span>}{checkIn && checkout && <span className="date-range-label"> · {checkIn} — {checkout}</span>}</div><label className="filter-control"><SlidersHorizontal size={16} /><span className="sr-only">Filter by stay type</span><select aria-label="Filter by stay type" value={unitType} onChange={(event) => setUnitType(event.target.value)}><option value="all">All stay types</option><option value="apartment">Apartments</option><option value="studio">Studios</option><option value="room">Rooms</option></select></label></div>
    <div className="expanded-filters"><label className="filter-control"><span>Currency</span><select aria-label="Filter by currency" value={currency} onChange={(event) => setCurrency(event.target.value)}><option value="all">All currencies</option>{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select></label><label className="filter-control"><span>Max starting rate</span><input type="number" min="0" inputMode="decimal" placeholder="Any" aria-label="Maximum starting nightly rate" value={priceLimit} onChange={(event) => setPriceLimit(event.target.value)} /></label><details className="amenity-filter"><summary>Amenities{selectedAmenities.length > 0 ? ` (${selectedAmenities.length})` : ''}</summary><div className="amenity-options">{amenities.length === 0 ? <span>No amenities published</span> : amenities.map((name) => <label key={name}><input type="checkbox" checked={selectedAmenities.includes(name)} onChange={(event) => setSelectedAmenities((current) => event.target.checked ? [...current, name] : current.filter((item) => item !== name))} /> {name}</label>)}</div></details><button className="plain-button clear-filters" onClick={() => { setUnitType('all'); setCurrency('all'); setPriceLimit(''); setSelectedAmenities([]) }}>Clear filters</button></div>
    {loading && <LoadingState label="Loading stays" />}
    {!loading && !configured && <ConfigState />}
    {!loading && error && <ErrorState message={error} />}
    {!loading && checkingDates && <LoadingState label="Checking those dates with each property" />}
    {!loading && configured && !error && !checkingDates && results.length === 0 && <EmptyState title="No stays found just yet" body="Try different dates, a nearby city, fewer guests, or another stay type." />}
    <div className="search-results">{results.map((unit) => {
      const photo = getUnitImage(unit)
      return <article className="result-row" key={unit.id}><Link to={propertyHref(unit.property.slug, unit.id)} className="result-photo">{photo ? <img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || unit.name} /> : <div className="image-empty"><span>{unit.property.city || 'Rose-Crown'}</span></div>}</Link><div className="result-info"><span className="eyebrow"><MapPin size={12} /> {unit.property.city || unit.property.name}</span><Link to={propertyHref(unit.property.slug, unit.id)}><h2>{unit.name} <span>at {unit.property.name}</span></h2></Link><p>{unit.description || `${unit.unit_type} · ${unit.bedrooms} bedrooms · Up to ${unit.capacity} guests`}</p><div className="amenity-list">{(unit.unit_amenities ?? []).slice(0, 3).map(({ amenities }) => amenities?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div></div><div className="result-action"><strong>{formatMoney(unit.base_nightly_price, unit.currency)}</strong><span>starting / night</span><Link className="button button-outline" to={propertyHref(unit.property.slug, unit.id)}>View stay <ArrowRight size={15} /></Link></div></article>
    })}</div>
    {(checkIn || checkout) && <div className="inline-note">Your selected dates are checked securely when you request a booking. A request is not confirmed until the host approves it.</div>}
  </section>
}
