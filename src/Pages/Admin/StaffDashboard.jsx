import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Bell, CalendarDays, Check, CircleAlert, LogOut, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, supabaseConfigured } from '../../Lib/supabase'
import { decideBooking, getStaffBookings, recordCheckout } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import { formatMoney, formatStayDate, humanizeStatus } from '../../Utils/format'

export default function StaffDashboard() {
  const [session, setSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [view, setView] = useState('queue')
  const navigate = useNavigate()
  const isStaff = roles.some(({ role }) => ['super_admin', 'property_manager', 'receptionist'].includes(role))

  async function refresh() {
    const { data, error: queryError } = await getStaffBookings()
    setBookings(data)
    setError(queryError?.message ?? '')
  }

  useEffect(() => {
    if (!supabase) { setLoading(false); return undefined }
    let current = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!current) return
      const currentSession = data.session
      setSession(currentSession)
      if (!currentSession) { setLoading(false); navigate('/auth', { state: { returnTo: '/manage' }, replace: true }); return }
      const { data: roleData, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', currentSession.user.id)
      if (!current) return
      setRoles(roleData ?? [])
      if (roleError) setError(roleError.message)
      if (roleData?.some(({ role }) => ['super_admin', 'property_manager', 'receptionist'].includes(role))) await refresh()
      setLoading(false)
    })
    const channel = supabase.channel('staff-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refresh).subscribe()
    return () => { current = false; supabase.removeChannel(channel) }
  }, [navigate])

  async function decide(booking, approve) {
    setBusyId(booking.id)
    try {
      const reason = approve ? '' : window.prompt('Reason for rejecting this request:')
      if (!approve && reason === null) return
      await decideBooking(booking.id, approve, reason || '')
      toast.success(approve ? 'Booking approved.' : 'Booking rejected.')
      await refresh()
    } catch (reason) { toast.error(reason.message || 'The booking could not be updated.') }
    finally { setBusyId('') }
  }

  async function checkout(booking) {
    if (!window.confirm(`Record checkout for ${booking.reference}? This will release the reservation.`)) return
    setBusyId(booking.id)
    try {
      await recordCheckout(booking.id)
      toast.success('Checkout recorded.')
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Checkout could not be recorded.') }
    finally { setBusyId('') }
  }

  if (!supabaseConfigured) return <section className="section-wrap admin-page"><ConfigState /></section>
  if (loading) return <section className="section-wrap admin-page"><LoadingState label="Checking property access" /></section>
  if (!session) return null
  if (!isStaff) return <section className="section-wrap admin-page"><div className="access-denied"><CircleAlert size={25} /><span className="eyebrow">Restricted workspace</span><h1>Property access <em>required.</em></h1><p>This account does not have an assigned staff role. Ask a StayEase administrator to grant access to a property.</p><Link className="button button-outline" to="/">Back to StayEase</Link></div></section>

  const pending = bookings.filter((booking) => booking.status === 'pending')
  const upcoming = bookings.filter((booking) => ['approved', 'checked_in'].includes(booking.status))
  const checkoutDue = bookings.filter((booking) => booking.status === 'checkout_due')
  const shown = view === 'queue' ? pending : view === 'stays' ? upcoming : checkoutDue
  const gross = bookings.filter((booking) => !['rejected', 'cancelled', 'expired'].includes(booking.status)).reduce((sum, booking) => sum + Number(booking.agreed_total || 0), 0)

  return <section className="admin-page section-wrap">
    <div className="admin-topline"><div><span className="eyebrow">StayEase / Property desk</span><h1>Good morning, <em>{session.user.user_metadata?.full_name?.split(' ')[0] || 'team'}.</em></h1><p>Bookings and arrivals across your assigned properties.</p></div><div className="admin-top-actions"><button className="icon-button" aria-label="Refresh booking data" onClick={() => refresh()}><RefreshCw size={17} /></button><button className="icon-button" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div></div>
    {error && <ErrorState message={error} />}
    <div className="metric-grid"><div className="metric-tile"><span><CalendarDays size={16} /> Active stays</span><strong>{upcoming.length}</strong><small>Approved and checked in</small></div><div className="metric-tile"><span><Bell size={16} /> Awaiting review</span><strong>{pending.length}</strong><small>Requests awaiting a decision</small></div><div className="metric-tile"><span><CircleAlert size={16} /> Checkout due</span><strong>{checkoutDue.length}</strong><small>Checkout needs recording</small></div><div className="metric-tile"><span><Activity size={16} /> Booked value</span><strong>{formatMoney(gross, bookings[0]?.currency || 'USD')}</strong><small>Current booking totals</small></div></div>
    <div className="admin-workspace"><div className="workspace-heading"><div><span className="eyebrow">Operations</span><h2>{view === 'queue' ? 'Booking requests' : view === 'stays' ? 'Upcoming stays' : 'Checkout monitor'}</h2></div><div className="workspace-actions"><div className="segmented-control" role="tablist" aria-label="Booking view"><button role="tab" aria-selected={view === 'queue'} onClick={() => setView('queue')}>Requests <span>{pending.length}</span></button><button role="tab" aria-selected={view === 'stays'} onClick={() => setView('stays')}>Upcoming</button><button role="tab" aria-selected={view === 'checkout'} onClick={() => setView('checkout')}>Checkout <span>{checkoutDue.length}</span></button></div></div></div>
      {shown.length === 0 && <EmptyState title={view === 'queue' ? 'All caught up' : view === 'checkout' ? 'No checkout actions due' : 'Nothing on the calendar yet'} body={view === 'queue' ? 'New guest requests will appear here.' : view === 'checkout' ? 'When an in-house guest reaches checkout time, it will be listed here for staff action.' : 'Approved stays will appear here.'} />}
      {shown.length > 0 && <div className="admin-booking-list">{shown.map((booking) => <article className="admin-booking-row" key={booking.id}><div className="admin-booking-main"><div className="booking-date-block"><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(booking.check_in))}</span><strong>{new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(new Date(booking.check_in))}</strong></div><div className="admin-booking-details"><div className="admin-booking-title"><h3>{booking.guest_name}</h3><span className={`status-pill status-${booking.status}`}>{humanizeStatus(booking.status)}</span></div><p>{booking.unit?.property?.name || 'Property'} · {booking.unit?.name || 'Unit'} · Ref. {booking.reference}</p><div className="admin-booking-meta"><span>{formatStayDate(booking.check_in)} – {formatStayDate(booking.checkout)}</span><span>{booking.guest_email}</span><span>{humanizeStatus(booking.source)}</span></div></div><div className="admin-booking-price"><strong>{formatMoney(booking.agreed_total, booking.currency)}</strong><span>{humanizeStatus(booking.payment_status)} payment</span></div></div><div className="admin-row-actions">{booking.status === 'pending' && <><button className="button button-confirm" disabled={busyId === booking.id} onClick={() => decide(booking, true)}><Check size={15} /> Approve</button><button className="button button-reject" disabled={busyId === booking.id} onClick={() => decide(booking, false)}><X size={15} /> Reject</button></>}{booking.status === 'checkout_due' && <button className="button button-dark" disabled={busyId === booking.id} onClick={() => checkout(booking)}>Record checkout <ArrowRight size={15} /></button>}</div></article>)}</div>}
    </div>
    <div className="admin-bottom-note"><span><Activity size={15} /> Changes are applied by the database booking workflow.</span><span>Signed in as {session.user.email}</span></div>
  </section>
}
