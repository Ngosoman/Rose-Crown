import { useMemo, useState } from 'react'
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ArrowLeft, ArrowRight, CalendarDays } from 'lucide-react'
import { formatStayDate, humanizeStatus } from '../../Utils/format'

function dateKey(date) {
  return format(date, 'yyyy-MM-dd')
}

function localPropertyDate(value, timezone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value))
    const get = (type) => parts.find((part) => part.type === type)?.value
    return `${get('year')}-${get('month')}-${get('day')}`
  } catch {
    return format(new Date(value), 'yyyy-MM-dd')
  }
}

function bookingCoversDate(booking, key) {
  const timezone = booking.unit?.property?.timezone
  return localPropertyDate(booking.check_in, timezone) <= key && key < localPropertyDate(booking.checkout, timezone)
}

export default function BookingCalendar({ bookings }) {
  const [view, setView] = useState('month')
  const [selectedDate, setSelectedDate] = useState(() => new Date())
  const [propertyId, setPropertyId] = useState('all')
  const [unitId, setUnitId] = useState('all')
  const properties = useMemo(() => {
    const entries = new Map()
    bookings.forEach((booking) => {
      const property = booking.unit?.property
      if (property?.id) entries.set(property.id, property.name)
    })
    return [...entries].map(([id, name]) => ({ id, name }))
  }, [bookings])
  const units = useMemo(() => {
    const entries = new Map()
    bookings.forEach((booking) => {
      if (booking.unit?.id && (propertyId === 'all' || booking.unit.property_id === propertyId)) entries.set(booking.unit.id, booking.unit.name)
    })
    return [...entries].map(([id, name]) => ({ id, name }))
  }, [bookings, propertyId])
  const filtered = bookings.filter((booking) => (propertyId === 'all' || booking.unit?.property_id === propertyId) && (unitId === 'all' || booking.unit?.id === unitId))
  const monthStart = startOfMonth(selectedDate)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const monthEnd = endOfWeek(endOfMonth(selectedDate), { weekStartsOn: 1 })
  const monthDates = []
  for (let cursor = gridStart; cursor <= monthEnd; cursor = addDays(cursor, 1)) monthDates.push(cursor)
  const activeDates = view === 'day'
    ? [selectedDate]
    : view === 'week'
      ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), index))
      : monthDates.filter((date) => isSameMonth(date, selectedDate))
  const events = activeDates.map((date) => ({ date, bookings: filtered.filter((booking) => bookingCoversDate(booking, dateKey(date))) }))

  function move(amount) {
    setSelectedDate((current) => view === 'day' ? addDays(current, amount) : view === 'week' ? addWeeks(current, amount) : addMonths(current, amount))
  }

  const heading = view === 'day'
    ? format(selectedDate, 'EEEE, MMMM d, yyyy')
    : view === 'week'
      ? `${format(events[0]?.date ?? selectedDate, 'MMM d')} – ${format(events.at(-1)?.date ?? selectedDate, 'MMM d, yyyy')}`
      : format(selectedDate, 'MMMM yyyy')

  return <section className="booking-calendar" aria-label="Property bookings calendar">
    <div className="calendar-toolbar"><div className="calendar-heading"><span className="eyebrow">Reservations</span><h2>{heading}</h2></div><div className="calendar-controls"><label className="filter-control"><span className="sr-only">Filter by property</span><select aria-label="Filter by property" value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setUnitId('all') }}><option value="all">All properties</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></label><label className="filter-control"><span className="sr-only">Filter by unit</span><select aria-label="Filter by unit" value={unitId} onChange={(event) => setUnitId(event.target.value)}><option value="all">All units</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label></div></div>
    <div className="calendar-nav"><div className="calendar-nav-buttons"><button className="icon-button" aria-label="Previous period" onClick={() => move(-1)}><ArrowLeft size={16} /></button><button className="calendar-today" onClick={() => setSelectedDate(new Date())}>Today</button><button className="icon-button" aria-label="Next period" onClick={() => move(1)}><ArrowRight size={16} /></button></div><div className="segmented-control" role="tablist" aria-label="Calendar view">{['day', 'week', 'month'].map((option) => <button key={option} role="tab" aria-selected={view === option} onClick={() => setView(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}</div></div>
    {view === 'month' && <div className="month-calendar" role="grid" aria-label={format(selectedDate, 'MMMM yyyy')}><div className="calendar-weekdays" role="row">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span role="columnheader" key={day}>{day}</span>)}</div><div className="calendar-days">{monthDates.map((date) => {
      const key = dateKey(date)
      const dayBookings = filtered.filter((booking) => bookingCoversDate(booking, key))
      const isOutside = !isSameMonth(date, selectedDate)
      return <button className={`calendar-day ${isOutside ? 'is-outside' : ''} ${dateKey(selectedDate) === key ? 'is-selected' : ''}`} role="gridcell" aria-label={`${format(date, 'EEEE, MMMM d')}, ${dayBookings.length} active stays`} key={key} onClick={() => { setSelectedDate(date); setView('day') }}><span className="calendar-day-number">{format(date, 'd')}</span>{dayBookings.length > 0 && <span className="calendar-day-count">{dayBookings.length} {dayBookings.length === 1 ? 'stay' : 'stays'}</span>}{dayBookings.slice(0, 2).map((booking) => <span className={`calendar-marker status-${booking.status}`} key={booking.id}>{booking.unit?.name}: {humanizeStatus(booking.status)}</span>)}</button>
    })}</div></div>}
    {view !== 'month' && <div className="calendar-agenda">{events.map(({ date, bookings: dateBookings }) => <div className="agenda-day" key={dateKey(date)}><div className="agenda-date"><span>{format(date, 'EEE')}</span><strong>{format(date, 'MMM d')}</strong></div><div className="agenda-events">{dateBookings.length === 0 ? <span className="agenda-empty">No active stays</span> : dateBookings.map((booking) => <article className="agenda-event" key={booking.id}><span className={`status-pill status-${booking.status}`}>{humanizeStatus(booking.status)}</span><strong>{booking.guest_name}</strong><span>{booking.unit?.property?.name} · {booking.unit?.name}</span><span>{formatStayDate(booking.check_in, { hour: 'numeric', minute: '2-digit' })} check-in · {formatStayDate(booking.checkout, { hour: 'numeric', minute: '2-digit' })} checkout</span><span>Ref. {booking.reference}</span></article>)}</div></div>)}</div>}
    <div className="calendar-legend"><span><i className="legend-dot legend-pending" /> Pending request</span><span><i className="legend-dot legend-approved" /> Approved stay</span><span><i className="legend-dot legend-due" /> Checkout due</span><span><CalendarDays size={14} /> Dates shown in property-local time</span></div>
  </section>
}
