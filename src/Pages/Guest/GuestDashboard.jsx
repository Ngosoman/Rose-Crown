import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, CalendarDays, Clock3, RefreshCw } from 'lucide-react'
import { supabase, supabaseConfigured } from '../../Lib/supabase'
import { getGuestBookings } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, formatStayDate, humanizeStatus } from '../../Utils/format'

export default function GuestDashboard() {
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthLoading(false)
      if (!data.session) navigate('/auth', { state: { returnTo: '/my-stays' }, replace: true })
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => setSession(current))
    return () => listener.subscription.unsubscribe()
  }, [navigate])

  useEffect(() => {
    if (!session) return undefined
    let current = true
    getGuestBookings().then(({ data, error: queryError }) => {
      if (!current) return
      setBookings(data)
      setError(queryError?.message ?? '')
    }).catch((reason) => current && setError(reason.message)).finally(() => current && setLoading(false))
    const channel = supabase.channel('guest-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `guest_id=eq.${session.user.id}` }, () => {
      getGuestBookings().then(({ data, error: queryError }) => { setBookings(data); setError(queryError?.message ?? '') })
    }).subscribe()
    return () => { current = false; supabase.removeChannel(channel) }
  }, [session])

  if (!supabaseConfigured) return <section className="section-wrap dashboard-page"><ConfigState /></section>
  if (authLoading) return <section className="section-wrap dashboard-page"><LoadingState label="Checking your account" /></section>
  return <section className="section-wrap dashboard-page"><div className="page-intro dashboard-intro"><span className="eyebrow">Your StayEase</span><h1>Good to have you <em>back.</em></h1><p>Your plans and stay details, together in one place.</p></div>
    {session && <div className="dashboard-user"><span className="avatar-mark">{(session.user.user_metadata?.full_name || session.user.email || 'G')[0].toUpperCase()}</span><div><strong>{session.user.user_metadata?.full_name || 'Guest account'}</strong><span>{session.user.email}</span></div><button className="text-link" onClick={() => supabase.auth.signOut()}>Sign out</button></div>}
    {loading && <LoadingState label="Loading your stays" />}{error && <ErrorState message={error} />}
    {!loading && !error && bookings.length === 0 && <EmptyState title="No stays on the calendar yet" body="When you send a booking request while signed in, its status and details will appear here." />}
    {!loading && bookings.length > 0 && <div className="booking-history">{bookings.map((booking) => <article className="guest-booking-card" key={booking.id}><div className="guest-booking-top"><div><span className="eyebrow">{booking.unit?.property?.city || 'StayEase'}</span><h2>{booking.unit?.name || 'Stay'} <span>at {booking.unit?.property?.name || 'your property'}</span></h2></div><span className={`status-pill status-${booking.status}`}>{humanizeStatus(booking.status)}</span></div><div className="guest-booking-facts"><span><CalendarDays size={16} /> {formatStayDate(booking.check_in)} – {formatStayDate(booking.checkout)}</span><span>Ref. {booking.reference}</span><span>{formatMoney(booking.agreed_total, booking.currency)} · {humanizeStatus(booking.payment_status)} payment</span></div>{booking.status === 'pending' && <div className="hold-banner"><Clock3 size={16} /> Request pending. Hold expires {booking.hold_expires_at ? formatStayDate(booking.hold_expires_at, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'soon'}.</div>}{['approved', 'checked_in', 'checkout_due'].includes(booking.status) && <Link className="text-link" to={`/my-stays/${booking.id}`}>View stay <ArrowRight size={15} /></Link>}</article>)}</div>}
    <div className="dashboard-footer"><span><RefreshCw size={15} /> Updates reflect your booking record.</span><Link className="button button-outline" to="/stays">Explore stays <ArrowRight size={15} /></Link></div>
  </section>
}
