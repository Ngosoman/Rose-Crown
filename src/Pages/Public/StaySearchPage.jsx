import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowRight, MapPin, SlidersHorizontal } from 'lucide-react'
import { getProperties, listingPhotoUrl } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, getUnitImage } from '../../Utils/format'

export default function StaySearchPage() {
  const [params] = useSearchParams()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [unitType, setUnitType] = useState('all')
  const city = params.get('city') ?? ''
  const checkIn = params.get('checkIn') ?? ''
  const checkout = params.get('checkout') ?? ''
  const guests = Number(params.get('guests') || 1)

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

  const results = useMemo(() => properties.flatMap((property) => property.units
    .filter((unit) => unit.capacity >= guests && (unitType === 'all' || unit.unit_type === unitType))
    .map((unit) => ({ ...unit, property })))
    .filter(({ property }) => !city || `${property.city} ${property.name} ${property.address}`.toLowerCase().includes(city.toLowerCase())), [properties, guests, unitType, city])

  return <section className="search-page section-wrap">
    <div className="page-intro"><span className="eyebrow">Stay collection</span><h1>Find your <em>somewhere.</em></h1><p>Small, considered places that make getting away feel effortless.</p></div>
    <div className="results-toolbar"><div><strong>{loading ? '—' : results.length}</strong> stays {city && <span>in <b>{city}</b></span>}{checkIn && checkout && <span className="date-range-label"> · {checkIn} — {checkout}</span>}</div><label className="filter-control"><SlidersHorizontal size={16} /><span className="sr-only">Filter by stay type</span><select aria-label="Filter by stay type" value={unitType} onChange={(event) => setUnitType(event.target.value)}><option value="all">All stay types</option><option value="apartment">Apartments</option><option value="studio">Studios</option><option value="room">Rooms</option></select></label></div>
    {loading && <LoadingState label="Loading stays" />}
    {!loading && !configured && <ConfigState />}
    {!loading && error && <ErrorState message={error} />}
    {!loading && configured && !error && results.length === 0 && <EmptyState title="No stays found just yet" body="Try a nearby city, fewer guests, or a different stay type." />}
    <div className="search-results">{results.map((unit) => {
      const photo = getUnitImage(unit)
      return <article className="result-row" key={unit.id}><Link to={`/stays/${unit.property.slug}`} className="result-photo">{photo ? <img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || unit.name} /> : <div className="image-empty"><span>{unit.property.city || 'StayEase'}</span></div>}</Link><div className="result-info"><span className="eyebrow"><MapPin size={12} /> {unit.property.city || unit.property.name}</span><Link to={`/stays/${unit.property.slug}`}><h2>{unit.name} <span>at {unit.property.name}</span></h2></Link><p>{unit.description || `${unit.unit_type} · ${unit.bedrooms} bedrooms · Up to ${unit.capacity} guests`}</p><div className="amenity-list">{(unit.unit_amenities ?? []).slice(0, 3).map(({ amenities }) => amenities?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div></div><div className="result-action"><strong>{formatMoney(unit.base_nightly_price, unit.currency)}</strong><span>starting / night</span><Link className="button button-outline" to={`/stays/${unit.property.slug}?unit=${unit.id}`}>View stay <ArrowRight size={15} /></Link></div></article>
    })}</div>
    {(checkIn || checkout) && <div className="inline-note">Your selected dates are checked securely when you request a booking. A request is not confirmed until the host approves it.</div>}
  </section>
}
