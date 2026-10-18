import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bath, BedDouble, MapPin, Users } from 'lucide-react'
import { getProperty, listingPhotoUrl } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, getUnitImage } from '../../Utils/format'

export default function PropertyPage() {
  const { slug } = useParams()
  const [searchParams] = useSearchParams()
  const [property, setProperty] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    getProperty(slug).then(({ data, error: queryError, configured: isConfigured }) => {
      if (!current) return
      setProperty(data)
      setConfigured(isConfigured)
      setError(queryError?.message ?? '')
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [slug])
  const selectedUnit = searchParams.get('unit')
  const bookingQuery = new URLSearchParams()
  for (const key of ['checkIn', 'checkout', 'guests']) {
    const value = searchParams.get(key)
    if (value) bookingQuery.set(key, value)
  }
  const bookingSuffix = bookingQuery.toString()

  if (loading) return <section className="section-wrap property-page"><LoadingState label="Loading this property" /></section>
  if (!configured) return <section className="section-wrap property-page"><ConfigState /></section>
  if (error) return <section className="section-wrap property-page"><ErrorState message={error} /></section>
  if (!property) return <section className="section-wrap property-page"><EmptyState title="We couldn't find that stay" body="It may have moved or no longer be available." /><Link className="text-link" to="/stays"><ArrowLeft size={15} /> Back to stays</Link></section>

  return <section className="property-page section-wrap">
    <Link className="back-link" to="/stays"><ArrowLeft size={15} /> All stays</Link>
    <div className="property-heading"><div><span className="eyebrow"><MapPin size={13} /> {property.city || property.address || 'StayEase collection'}</span><h1>{property.name}</h1></div><p>{property.description}</p></div>
    <div className="property-gallery">{property.units.slice(0, 3).map((unit, index) => {
      const photo = getUnitImage(unit)
      return <div className={`gallery-tile gallery-tile-${index + 1}`} key={unit.id}>{photo ? <img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || unit.name} /> : <div className="image-empty"><span>{unit.name} / {unit.unit_type}</span></div>}</div>
    })}{property.units.length === 0 && <div className="gallery-empty">No units are currently published.</div>}</div>
    <div className="property-detail-layout"><div className="property-about"><span className="eyebrow">The property</span><h2>A slower pace, <em>by design.</em></h2><p>{property.description || 'A thoughtfully prepared place for your next stay.'}</p><div className="house-rules"><div><span>Check in</span><strong>{property.check_in_time?.slice(0, 5) ?? '15:00'}</strong></div><div><span>Check out</span><strong>{property.checkout_time?.slice(0, 5) ?? '11:00'}</strong></div><div><span>Local time</span><strong>{property.timezone}</strong></div></div></div>
      <div className="unit-list"><div className="unit-list-heading"><div><span className="eyebrow">Choose your space</span><h2>Available stays</h2></div><span>{property.units.length} {property.units.length === 1 ? 'option' : 'options'}</span></div>
        {property.units.map((unit) => <article className={`unit-option ${selectedUnit === unit.id ? 'unit-highlight' : ''}`} key={unit.id}><div className="unit-option-main"><div><span className="eyebrow">{unit.unit_type}</span><h3>{unit.name}</h3></div><strong>{formatMoney(unit.base_nightly_price, unit.currency)}<small> / night</small></strong></div><div className="unit-facts"><span><Users size={15} /> Up to {unit.capacity}</span><span><BedDouble size={15} /> {unit.bedrooms} bedrooms</span><span><Bath size={15} /> {unit.bathrooms} baths</span></div><p>{unit.description || 'A private, considered space for your stay.'}</p><div className="amenity-list">{(unit.unit_amenities ?? []).map(({ amenities }) => amenities?.name).filter(Boolean).map((name) => <span key={name}>{name}</span>)}</div><Link className="button button-dark unit-book" to={`/book/${unit.id}${bookingSuffix ? `?${bookingSuffix}` : ''}`}>Choose dates <ArrowRight size={16} /></Link></article>)}
        {property.units.length === 0 && <EmptyState title="No stays available yet" body="Please check back soon for published spaces at this property." />}
      </div>
    </div>
  </section>
}
