import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, Clock3, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { getProperties, createBookingRequest, listingPhotoUrl } from '../../Services/stayService'
import { ConfigState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, formatStayDate, getUnitImage } from '../../Utils/format'

const today = new Date().toISOString().slice(0, 10)

const bookingSchema = z.object({
  guestName: z.string().trim().min(2, 'Enter the guest name.'),
  guestEmail: z.string().trim().email('Enter a valid email address.'),
  guestPhone: z.string().trim().min(5, 'Enter a phone number.'),
  checkIn: z.string().min(1, 'Choose a check-in date.'),
  checkout: z.string().min(1, 'Choose a check-out date.'),
  specialRequests: z.string().max(800, 'Keep requests under 800 characters.'),
}).refine((value) => value.checkout > value.checkIn, { path: ['checkout'], message: 'Check-out must be after check-in.' })

export default function BookingPage() {
  const { unitId } = useParams()
  const [unit, setUnit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(null)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: { guestName: '', guestEmail: '', guestPhone: '', checkIn: '', checkout: '', specialRequests: '' },
  })

  useEffect(() => {
    let current = true
    getProperties().then(({ data, error: queryError, configured: isConfigured }) => {
      if (!current) return
      const found = data.flatMap((property) => property.units.map((candidate) => ({ ...candidate, property }))).find((candidate) => candidate.id === unitId)
      setUnit(found ?? null)
      setConfigured(isConfigured)
      setError(queryError?.message ?? '')
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    return () => { current = false }
  }, [unitId])

  const photo = useMemo(() => getUnitImage(unit), [unit])
  async function submit(values) {
    try {
      const result = await createBookingRequest({ ...values, unitId })
      setBooking(result)
      toast.success('Your request was received. This stay is not confirmed yet.')
    } catch (reason) {
      setError(reason.message || 'We could not create your booking request.')
      toast.error(reason.message || 'We could not create your booking request.')
    }
  }

  if (loading) return <section className="section-wrap booking-page"><LoadingState label="Preparing your booking" /></section>
  if (!configured) return <section className="section-wrap booking-page"><ConfigState /></section>
  if (error && !unit) return <section className="section-wrap booking-page"><ErrorState message={error} /></section>
  if (!unit) return <section className="section-wrap booking-page"><ErrorState message="This stay is not currently available for booking." /><Link to="/stays">Return to stays</Link></section>

  return <section className="booking-page section-wrap">
    <Link className="back-link" to={`/stays/${unit.property.slug}`}><ArrowLeft size={15} /> Back to {unit.property.name}</Link>
    {booking ? <div className="booking-success"><span className="success-icon"><Check size={25} /></span><span className="eyebrow">Request received</span><h1>Your stay is <em>in motion.</em></h1><p>This is a request, not a confirmed booking. The property will review it before your 15-minute hold expires.</p><div className="reference-panel"><span>Booking reference</span><strong>{booking.reference}</strong><span>Hold expires {formatStayDate(booking.hold_expires_at, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span></div><div className="success-actions"><Link className="button button-dark" to="/my-stays">View my stays <ArrowRight size={16} /></Link><Link className="text-link" to="/stays">Keep exploring</Link></div><p className="small-note">Payment status: pending. No payment has been taken.</p></div> : <div className="booking-grid">
      <div className="booking-form-column"><span className="eyebrow">Almost somewhere new</span><h1>Request this <em>stay.</em></h1><p className="booking-lede">Tell us who is traveling and when. Your request is held for 15 minutes while the host reviews it.</p>
        {error && <ErrorState message={error} />}
        <form className="booking-form" onSubmit={handleSubmit(submit)} noValidate>
          <div className="form-section-title"><span>01</span><h2>Your details</h2></div>
          <div className="form-grid"><label className="form-field"><span>Full name</span><input autoComplete="name" {...register('guestName')} aria-invalid={Boolean(errors.guestName)} />{errors.guestName && <small>{errors.guestName.message}</small>}</label><label className="form-field"><span>Email address</span><input type="email" autoComplete="email" {...register('guestEmail')} aria-invalid={Boolean(errors.guestEmail)} />{errors.guestEmail && <small>{errors.guestEmail.message}</small>}</label><label className="form-field"><span>Phone number</span><input type="tel" autoComplete="tel" {...register('guestPhone')} aria-invalid={Boolean(errors.guestPhone)} />{errors.guestPhone && <small>{errors.guestPhone.message}</small>}</label></div>
          <div className="form-section-title"><span>02</span><h2>Dates and details</h2></div>
          <div className="form-grid"><label className="form-field"><span>Check in</span><input type="date" min={today} {...register('checkIn')} aria-invalid={Boolean(errors.checkIn)} />{errors.checkIn && <small>{errors.checkIn.message}</small>}</label><label className="form-field"><span>Check out</span><input type="date" min={today} {...register('checkout')} aria-invalid={Boolean(errors.checkout)} />{errors.checkout && <small>{errors.checkout.message}</small>}</label><label className="form-field form-field-wide"><span>Anything the host should know? <em>Optional</em></span><textarea rows="3" {...register('specialRequests')} />{errors.specialRequests && <small>{errors.specialRequests.message}</small>}</label></div>
          <button className="button button-dark booking-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending request…' : 'Request this stay'} <ArrowRight size={17} /></button>
          <p className="form-privacy"><LockKeyhole size={14} /> Your details are only shared with this property.</p>
        </form>
      </div>
      <aside className="booking-summary">{photo && <img src={listingPhotoUrl(photo.storage_path)} alt={photo.alt_text || unit.name} />}<span className="eyebrow">{unit.property.city || unit.property.name}</span><h2>{unit.name}</h2><p>{unit.unit_type} · Up to {unit.capacity} guests</p><div className="summary-price"><span>Starting nightly rate</span><strong>{formatMoney(unit.base_nightly_price, unit.currency)} <small>/ night</small></strong><p>Final total is calculated by the property’s pricing rules and shown in your request record.</p></div><div className="summary-hold"><Clock3 size={16} /><span>15-minute request hold</span></div><Link className="text-link" to="/auth">Sign in to view your stays <ArrowRight size={14} /></Link></aside>
    </div>}
  </section>
}
