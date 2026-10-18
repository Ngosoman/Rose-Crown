import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Activity, ArrowRight, Bell, CalendarDays, Check, CircleAlert, LogOut, Plus, RefreshCw, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, supabaseConfigured } from '../../Lib/supabase'
import { decideBooking, decideExtension, deleteUnitBlock, getNotifications, getPendingExtensions, getStaffBlocks, getStaffBookings, markNotificationRead, recordCheckin, recordCheckout } from '../../Services/stayService'
import { ConfigState, EmptyState, ErrorState, LoadingState } from '../../Components/Common/Feedback'
import ManualBookingForm from '../../Components/Booking/ManualBookingForm'
import BookingCalendar from '../../Components/Calendar/BookingCalendar'
import UnitBlockForm from '../../Components/Calendar/UnitBlockForm'
import NotificationList from '../../Components/Common/NotificationList'
import { formatMoney, formatStayDate, humanizeStatus } from '../../Utils/format'

export default function StaffDashboard() {
  const [session, setSession] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(supabaseConfigured)
  const [bookings, setBookings] = useState([])
  const [notifications, setNotifications] = useState([])
  const [extensions, setExtensions] = useState([])
  const [blocks, setBlocks] = useState([])
  const [manualOpen, setManualOpen] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
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

  async function refreshNotifications() {
    const { data, error: queryError } = await getNotifications()
    setNotifications(data)
    if (queryError) setError(queryError.message)
  }

  async function refreshExtensions() {
    const { data, error: queryError } = await getPendingExtensions()
    setExtensions(data)
    if (queryError) setError(queryError.message)
  }

  async function refreshBlocks() {
    const { data, error: queryError } = await getStaffBlocks()
    setBlocks(data)
    if (queryError) setError(queryError.message)
  }

  useEffect(() => {
    if (!supabase) return undefined
    let current = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!current) return
      const currentSession = data.session
      setSession(currentSession)
      if (!currentSession) { setLoading(false); navigate('/auth', { state: { returnTo: '/manage' }, replace: true }); return }
      const { data: roleData, error: roleError } = await supabase.from('user_roles').select('role').eq('user_id', currentSession.user.id)
      const { data: membershipData, error: membershipError } = await supabase.from('property_members').select('role').eq('user_id', currentSession.user.id)
      if (!current) return
      const assignedRoles = [...(roleData ?? []), ...(membershipData ?? [])]
      setRoles(assignedRoles)
      if (roleError || membershipError) setError(roleError?.message || membershipError?.message)
      if (assignedRoles.some(({ role }) => ['super_admin', 'property_manager', 'receptionist'].includes(role))) {
        await refresh()
        await refreshNotifications()
        await refreshExtensions()
        await refreshBlocks()
      }
      setLoading(false)
    })
    const channel = supabase.channel('staff-bookings').on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, refresh).subscribe()
    const notificationChannel = supabase.channel('staff-notifications').on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, refreshNotifications).subscribe()
    const extensionChannel = supabase.channel('staff-extensions').on('postgres_changes', { event: '*', schema: 'public', table: 'booking_extensions' }, refreshExtensions).subscribe()
    const blockChannel = supabase.channel('staff-unit-blocks').on('postgres_changes', { event: '*', schema: 'public', table: 'unit_blocks' }, refreshBlocks).subscribe()
    return () => { current = false; supabase.removeChannel(channel); supabase.removeChannel(notificationChannel); supabase.removeChannel(extensionChannel); supabase.removeChannel(blockChannel) }
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

  async function checkin(booking) {
    setBusyId(booking.id)
    try {
      await recordCheckin(booking.id)
      toast.success('Check-in recorded.')
      await refresh()
    } catch (reason) { toast.error(reason.message || 'Check-in could not be recorded.') }
    finally { setBusyId('') }
  }

  async function readNotification(notificationId) {
    try { await markNotificationRead(notificationId); await refreshNotifications() }
    catch (reason) { toast.error(reason.message || 'Notification could not be updated.') }
  }

  async function decideExtensionRequest(extension, approve) {
    if (approve && !window.confirm(`Approve the new checkout date for ${extension.booking?.reference}? The stay total will be recalculated.`)) return
    const reason = approve ? '' : window.prompt('Reason for rejecting this extension request:')
    if (!approve && reason === null) return
    setBusyId(extension.id)
    try {
      await decideExtension(extension.id, approve, reason || '')
      toast.success(approve ? 'Extension approved and reservation updated.' : 'Extension rejected.')
      await refreshExtensions()
      await refresh()
    } catch (failure) { toast.error(failure.message || 'The extension could not be updated.') }
    finally { setBusyId('') }
  }

  async function removeBlock(block) {
    if (!window.confirm(`Remove the ${block.block_type.replaceAll('_', ' ')} block for ${block.unit?.name}?`)) return
    try { await deleteUnitBlock(block.id); toast.success('Date block removed.'); await refreshBlocks() }
    catch (reason) { toast.error(reason.message || 'The block could not be removed.') }
  }

  if (!supabaseConfigured) return <section className="section-wrap admin-page"><ConfigState /></section>
  if (loading) return <section className="section-wrap admin-page"><LoadingState label="Checking property access" /></section>
  if (!session) return null
  if (!isStaff) return <section className="section-wrap admin-page"><div className="access-denied"><CircleAlert size={25} /><span className="eyebrow">Restricted workspace</span><h1>Property access <em>required.</em></h1><p>This account does not have an assigned staff role. Ask a StayEase administrator to grant access to a property.</p><Link className="button button-outline" to="/">Back to StayEase</Link></div></section>

  const pending = bookings.filter((booking) => booking.status === 'pending')
  const upcoming = bookings.filter((booking) => ['approved', 'checked_in'].includes(booking.status))
  const checkoutDue = bookings.filter((booking) => booking.status === 'checkout_due')
  const shown = view === 'queue' ? pending : view === 'stays' ? upcoming : view === 'checkout' ? checkoutDue : []
  const gross = bookings.filter((booking) => !['rejected', 'cancelled', 'expired'].includes(booking.status)).reduce((sum, booking) => sum + Number(booking.agreed_total || 0), 0)

  return <section className="admin-page section-wrap">
    <div className="admin-topline"><div><span className="eyebrow">StayEase / Property desk</span><h1>Good morning, <em>{session.user.user_metadata?.full_name?.split(' ')[0] || 'team'}.</em></h1><p>Bookings and arrivals across your assigned properties.</p></div><div className="admin-top-actions"><button className="icon-button" aria-label="Refresh booking data" onClick={() => refresh()}><RefreshCw size={17} /></button><button className="icon-button" aria-label="Sign out" onClick={() => supabase.auth.signOut()}><LogOut size={17} /></button></div></div>
    {error && <ErrorState message={error} />}
    <div className="metric-grid"><div className="metric-tile"><span><CalendarDays size={16} /> Active stays</span><strong>{upcoming.length}</strong><small>Approved and checked in</small></div><div className="metric-tile"><span><Bell size={16} /> Awaiting review</span><strong>{pending.length}</strong><small>Requests awaiting a decision</small></div><div className="metric-tile"><span><CircleAlert size={16} /> Checkout due</span><strong>{checkoutDue.length}</strong><small>Checkout needs recording</small></div><div className="metric-tile"><span><Activity size={16} /> Booked value</span><strong>{formatMoney(gross, bookings[0]?.currency || 'USD')}</strong><small>Current booking totals</small></div></div>
    <div className="admin-toolbar"><div><button className="button button-dark" onClick={() => { setManualOpen(!manualOpen); setBlockOpen(false) }}>{manualOpen ? <X size={16} /> : <Plus size={16} />} {manualOpen ? 'Close manual booking' : 'Manual booking'}</button><button className="button button-outline" onClick={() => { setBlockOpen(!blockOpen); setManualOpen(false) }}>{blockOpen ? <X size={16} /> : <Plus size={16} />} {blockOpen ? 'Close block dates' : 'Block dates'}</button></div><span>Assigned property access is enforced by the database.</span></div>
    {manualOpen && <ManualBookingForm onClose={() => setManualOpen(false)} onCreated={() => { setManualOpen(false); refresh() }} />}
    {blockOpen && <UnitBlockForm onClose={() => setBlockOpen(false)} onCreated={() => { setBlockOpen(false); refreshBlocks() }} />}
    <div className="admin-workspace"><div className="workspace-heading"><div><span className="eyebrow">Operations</span><h2>{view === 'queue' ? 'Booking requests' : view === 'stays' ? 'Upcoming stays' : view === 'checkout' ? 'Checkout monitor' : view === 'calendar' ? 'Availability calendar' : view === 'extensions' ? 'Extension requests' : 'Notifications'}</h2></div><div className="workspace-actions"><div className="segmented-control" role="tablist" aria-label="Booking view"><button role="tab" aria-selected={view === 'queue'} onClick={() => setView('queue')}>Requests <span>{pending.length}</span></button><button role="tab" aria-selected={view === 'stays'} onClick={() => setView('stays')}>Upcoming</button><button role="tab" aria-selected={view === 'checkout'} onClick={() => setView('checkout')}>Checkout <span>{checkoutDue.length}</span></button><button role="tab" aria-selected={view === 'extensions'} onClick={() => setView('extensions')}>Extensions <span>{extensions.length}</span></button><button role="tab" aria-selected={view === 'calendar'} onClick={() => setView('calendar')}>Calendar</button><button role="tab" aria-selected={view === 'alerts'} onClick={() => setView('alerts')}>Alerts <span>{notifications.filter((notification) => notification.delivery_status === 'failed').length}</span></button></div></div></div>
      {view === 'alerts' ? <NotificationList notifications={notifications} onRead={readNotification} showDelivery /> : view === 'calendar' ? <BookingCalendar bookings={bookings} blocks={blocks} onDeleteBlock={removeBlock} /> : view === 'extensions' ? extensions.length === 0 ? <EmptyState title="No extension requests" body="Guest and staff extension requests will appear here for an authorized decision." /> : <div className="admin-booking-list">{extensions.map((extension) => <article className="admin-booking-row" key={extension.id}><div className="admin-booking-main"><div className="booking-date-block"><span>New</span><strong>EXT</strong></div><div className="admin-booking-details"><div className="admin-booking-title"><h3>{extension.booking?.guest_name || 'Guest request'}</h3><span className="status-pill status-pending">Pending decision</span></div><p>{extension.booking?.unit?.property?.name} · {extension.booking?.unit?.name} · Ref. {extension.booking?.reference}</p><div className="admin-booking-meta"><span>Current checkout {formatStayDate(extension.original_checkout, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span>Requested {formatStayDate(extension.requested_checkout, { month: 'short', day: 'numeric', year: 'numeric' })}</span><span>{extension.reason || 'No reason supplied'}</span></div></div></div><div className="admin-row-actions"><button className="button button-confirm" disabled={busyId === extension.id} onClick={() => decideExtensionRequest(extension, true)}><Check size={15} /> Approve</button><button className="button button-reject" disabled={busyId === extension.id} onClick={() => decideExtensionRequest(extension, false)}><X size={15} /> Reject</button></div></article>)}</div> : <>
      {shown.length === 0 && <EmptyState title={view === 'queue' ? 'All caught up' : view === 'checkout' ? 'No checkout actions due' : 'Nothing on the calendar yet'} body={view === 'queue' ? 'New guest requests will appear here.' : view === 'checkout' ? 'When an in-house guest reaches checkout time, it will be listed here for staff action.' : 'Approved stays will appear here.'} />}
      {shown.length > 0 && <div className="admin-booking-list">{shown.map((booking) => <article className="admin-booking-row" key={booking.id}><div className="admin-booking-main"><div className="booking-date-block"><span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(booking.check_in))}</span><strong>{new Intl.DateTimeFormat(undefined, { day: '2-digit' }).format(new Date(booking.check_in))}</strong></div><div className="admin-booking-details"><div className="admin-booking-title"><h3>{booking.guest_name}</h3><span className={`status-pill status-${booking.status}`}>{humanizeStatus(booking.status)}</span></div><p>{booking.unit?.property?.name || 'Property'} · {booking.unit?.name || 'Unit'} · Ref. {booking.reference}</p><div className="admin-booking-meta"><span>{formatStayDate(booking.check_in)} – {formatStayDate(booking.checkout)}</span><span>{booking.guest_email}</span><span>{humanizeStatus(booking.source)}</span></div></div><div className="admin-booking-price"><strong>{formatMoney(booking.agreed_total, booking.currency)}</strong><span>{humanizeStatus(booking.payment_status)} payment</span></div></div><div className="admin-row-actions">{booking.status === 'pending' && <><button className="button button-confirm" disabled={busyId === booking.id} onClick={() => decide(booking, true)}><Check size={15} /> Approve</button><button className="button button-reject" disabled={busyId === booking.id} onClick={() => decide(booking, false)}><X size={15} /> Reject</button></>}{booking.status === 'approved' && <button className="button button-confirm" disabled={busyId === booking.id} onClick={() => checkin(booking)}>Record check-in</button>}{['checked_in', 'checkout_due'].includes(booking.status) && <button className="button button-dark" disabled={busyId === booking.id} onClick={() => checkout(booking)}>Record checkout <ArrowRight size={15} /></button>}</div></article>)}</div>}
      </>}
    </div>
    <div className="admin-bottom-note"><span><Activity size={15} /> Changes are applied by the database booking workflow.</span><span>Signed in as {session.user.email}</span></div>
  </section>
}
