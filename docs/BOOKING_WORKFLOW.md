# Booking Workflow

## Website Request

1. The guest selects a published unit, dates, and party size. Search availability is a display hint only.
2. The guest submits contact details. `create_booking_request` locks the unit, checks active holds/reservations and blocks, checks capacity and property-local future dates, and calculates each night from non-overlapping rate rules or the base price.
3. PostgreSQL writes the pending booking, agreed amount/breakdown, a `[check-in, checkout)` reservation hold expiring after 15 minutes, history, and notifications atomically.
4. The UI shows the booking reference and hold expiration. It explicitly states that the request is not confirmed and no payment was taken.
5. An assigned staff member approves or rejects using `decide_booking`. An expired hold cannot be approved; rejection releases it. The exclusion constraint remains the final concurrency guard.

Anonymous website requests are supported. Their contact snapshots are staff-visible but not exposed to other guests. Dashboard access and in-app guest notifications require a registered, signed-in guest at submission time.

## Manual Booking

Assigned staff select property, unit, dates, guest details, party size, and one of phone/WhatsApp/walk-in/staff. `create_manual_booking` follows the same unit lock, expiration cleanup, block/reservation checks, capacity and price calculation, then writes an approved booking and permanent reservation in one transaction. This immediately blocks conflicting web requests.

## Check-in, Checkout, and Holds

Staff record check-in explicitly. The scheduled checkout job changes a checked-in booking to `checkout_due` at the property-local timestamp but keeps its reservation active. Staff must record actual checkout; only then is the log/audit written and the reservation released. A scheduled time never implies the guest has left.

Holds expire after 15 minutes. Scheduled cleanup and availability-critical transactions release expired reservation rows and write an expired status. Cleanup never relies on a time-dependent index predicate.

## Extensions

A registered guest or assigned staff member can request a later checkout. The original checkout remains unchanged until staff approval. Approval locks the unit and booking, checks blocks and overlapping reservations, extends the authoritative range, recalculates the whole stay at current configured rates, records the decision, and schedules reminders against the new checkout. A conflict aborts the entire transaction. A pending extension is cancelled if the booking is cancelled.

## Cancellation

Guests can cancel pending website requests. Staff can cancel pending or approved bookings only before check-in; checked-in/checkout-due stays are rejected by the RPC so an occupied unit is never released. Approved-stay cancellation windows/refunds still need a client policy and have not been automated.

## Payment

Payment status is independent of booking status. No provider is connected, so the website leaves payment pending and does not accept browser redirects as proof of payment.
