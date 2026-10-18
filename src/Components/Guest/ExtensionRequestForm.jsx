import { useState } from 'react'
import { toast } from 'sonner'
import { requestExtension } from '../../Services/stayService'
import { formatStayDate, humanizeStatus } from '../../Utils/format'

function nextLocalDate(timestamp, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(timestamp))
  const value = `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
}

export default function ExtensionRequestForm({ booking }) {
  const [checkoutDate, setCheckoutDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const requests = booking.booking_extensions ?? []
  const pending = requests.some((request) => request.status === 'pending')
  const minDate = nextLocalDate(booking.checkout, booking.unit?.property?.timezone)

  async function submit(event) {
    event.preventDefault()
    if (!checkoutDate || checkoutDate < minDate) {
      toast.error('Choose a date after the current checkout.')
      return
    }
    setBusy(true)
    try {
      await requestExtension(booking.id, checkoutDate, reason)
      setSubmitted(true)
      toast.success('Your extension request was sent for approval.')
    } catch (error) { toast.error(error.message || 'The extension request could not be sent.') }
    finally { setBusy(false) }
  }

  return <details className="extension-request"><summary>Request a checkout extension</summary>
    {pending && <p className="extension-pending">An extension request is awaiting the property’s decision.</p>}
    {submitted && <p className="extension-pending">Your request is in the property’s inbox.</p>}
    {!pending && !submitted && <form onSubmit={submit}><label className="form-field"><span>New checkout date</span><input type="date" min={minDate} value={checkoutDate} onChange={(event) => setCheckoutDate(event.target.value)} required /></label><label className="form-field"><span>Reason <em>Optional</em></span><input value={reason} maxLength="400" onChange={(event) => setReason(event.target.value)} /></label><button className="button button-outline" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button></form>}
    {requests.length > 0 && <div className="extension-history"><span className="eyebrow">Request history</span>{requests.map((request) => <p key={request.id}><span className={`status-pill status-${request.status}`}>{humanizeStatus(request.status)}</span> · Until {formatStayDate(request.requested_checkout, { month: 'short', day: 'numeric', year: 'numeric' })}</p>)}</div>}
  </details>
}
