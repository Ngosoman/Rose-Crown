import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { getProperties, listingPhotoUrl } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, getUnitImage } from '../../Utils/format'

const heroImage = 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=2200&q=85'

export default function HomePage() {
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [destination, setDestination] = useState('')
  const [checkIn, setCheckIn] = useState('')
  const [checkout, setCheckout] = useState('')
  const [guests, setGuests] = useState('2')
  const navigate = useNavigate()

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

  const featured = useMemo(() => properties.filter((property) => property.units.length > 0).slice(0, 3), [properties])
  function search(event) {
    event.preventDefault()
    const params = new URLSearchParams()
    if (destination.trim()) params.set('city', destination.trim())
    if (checkIn) params.set('checkIn', checkIn)
    if (checkout) params.set('checkout', checkout)
    if (guests) params.set('guests', guests)
    navigate(`/stays?${params.toString()}`)
  }

  return (
    <>
      <section className="home-hero" style={{ '--hero-image': `url("${heroImage}")` }}>
        <div className="hero-copy"><span className="eyebrow eyebrow-light"><Sparkles size={13} /> A better kind of getaway</span><h1>Find your place<br />to <em>slow down.</em></h1><p>Independent stays with room to breathe, chosen for how you want to feel.</p></div>
        <div className="hero-side-note"><span>01 / 03</span><span>Spaces that feel like yours</span></div>
        <form className="search-panel" onSubmit={search}>
          <label className="search-field"><span><MapPin size={16} /> Destination</span><input aria-label="Destination" placeholder="City or neighborhood" value={destination} onChange={(event) => setDestination(event.target.value)} /></label>
          <label className="search-field"><span><CalendarDays size={16} /> Check in</span><input aria-label="Check in" type="date" min={new Date().toISOString().slice(0, 10)} value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></label>
          <label className="search-field"><span><CalendarDays size={16} /> Check out</span><input aria-label="Check out" type="date" min={checkIn || new Date().toISOString().slice(0, 10)} value={checkout} onChange={(event) => setCheckout(event.target.value)} /></label>
          <label className="search-field guests-field"><span><Users size={16} /> Guests</span><select aria-label="Guests" value={guests} onChange={(event) => setGuests(event.target.value)}>{[1, 2, 3, 4, 5, 6, 7, 8].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'guest' : 'guests'}</option>)}</select></label>
          <button className="button button-dark search-submit" type="submit"><Search size={18} /><span>Explore stays</span></button>
        </form>
      </section>
      <section className="trust-strip" aria-label="Booking highlights"><div><ShieldCheck size={20} /><span>Every stay, thoughtfully reviewed</span></div><div><Sparkles size={20} /><span>Independent places with character</span></div><div><ArrowUpRight size={20} /><span>Book directly with our local hosts</span></div></section>
      <section className="featured-section section-wrap">
        <div className="section-heading"><div><span className="eyebrow">A good place to begin</span><h2>Somewhere <em>special.</em></h2></div><Link className="text-link" to="/stays">View all stays <ArrowRight size={16} /></Link></div>
        {loading && <LoadingState label="Finding available stays" />}
        {!loading && !configured && <ConfigState />}
        {!loading && error && <ErrorState message={error} />}
        {!loading && configured && !error && featured.length === 0 && <EmptyState title="New stays are on their way" body="Published places will appear here as soon as they are added to StayEase." />}
        {!loading && featured.length > 0 && <div className="property-grid">{featured.map((property, index) => {
          const firstUnit = property.units[0]
          const photo = getUnitImage(firstUnit)
          return <Link className={`property-card property-card-${index + 1}`} to={`/stays/${property.slug}`} key={property.id}>
            <div className="property-image">{photo ? <img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || firstUnit.name} /> : <div className="image-empty"><span>StayEase / {property.city || 'Stay'}</span></div>}<span className="image-count">{property.units.length} {property.units.length === 1 ? 'stay' : 'stays'}</span></div>
            <div className="property-card-copy"><div><span className="eyebrow">{property.city || 'A local favorite'}</span><h3>{property.name}</h3></div><ArrowUpRight size={18} /></div>
            <p className="property-summary">{firstUnit.description || property.description || `${firstUnit.unit_type} · Sleeps ${firstUnit.capacity}`}</p>
            <div className="property-card-meta"><span>{firstUnit.unit_type} · Up to {firstUnit.capacity} guests</span><span>From {formatMoney(firstUnit.base_nightly_price, firstUnit.currency)} <small>/ night</small></span></div>
          </Link>
        })}</div>}
      </section>
      <section className="closing-band"><div className="closing-inner"><span className="eyebrow">Make room for a little more</span><h2>Good stays make<br />good <em>stories.</em></h2><Link className="button button-light" to="/stays">Find your stay <ArrowRight size={17} /></Link></div><div className="closing-index">STAYEASE / 2026</div></section>
    </>
  )
}
