# Database Schema

All application tables are in `public`; RLS is enabled on every public table in the migrations. UUID identifiers, foreign keys, timestamps, currency checks, indexes, deletion rules, and access policies are defined in the ordered migration files.

## Identity and Access

- `profiles` extends `auth.users`; an Auth trigger creates a guest profile and a guest role for new users.
- `user_roles` stores platform roles: `super_admin`, `property_manager`, `receptionist`, `guest`.
- `property_members` assigns property-scoped manager/receptionist roles. Ordinary users cannot grant themselves roles or memberships.

## Listings and Pricing

- `properties` contains public listing content, city/address, IANA timezone, currency, check-in/out times, briefing/reminder settings, and publication state.
- `units` belongs to one property and contains type, capacity, rooms, base nightly price/currency, and active state.
- `unit_photos` stores Storage paths; `amenities` and `unit_amenities` describe facilities.
- `unit_rate_rules` stores date-bounded nightly prices. Rate ranges may not overlap, and rate currency must match unit currency. Uncovered nights use the base rate.
- `unit_blocks` holds maintenance, owner-use, and cleaning date ranges. Staff create/delete blocks through guarded RPCs.

## Reservations and Bookings

- `bookings` stores a unique reference, guest snapshots, optional Auth user, guest count, property-local check-in/out instants, `[)` stay range, source, booking/payment states, agreed total and nightly breakdown, hold expiry, approval/creator actors, and cancellation reason.
- `unit_reservations` is authoritative for held and confirmed ranges. An active GiST exclusion constraint rejects overlapping ranges for a unit; released rows remain as history.
- `booking_extensions` stores requester, original/requested checkout, decision actor/time, status, and reason. A unit may have one pending extension.
- `booking_status_history`, `checkin_checkout_logs`, and `audit_logs` retain operational changes.

## Payments and Notifications

- `payments` stores provider references, unique provider-event IDs, amount/currency, verification/refund timestamps, and a separate payment status. There is no payment provider integration yet; nothing is marked paid by a redirect.
- `notifications` stores recipient, optional booking/property, schedule, channel, delivery state, retries, error, deduplication key, processing lease, and read time.

## RPCs

`create_booking_request`, `create_manual_booking`, `get_unit_availability`, `decide_booking`, `cancel_booking`, `create_unit_block`, `delete_unit_block`, `record_checkin`, `record_checkout`, `request_extension`, `decide_extension`, `run_scheduled_jobs`, `enqueue_daily_checkout_briefings`, `claim_notifications`, and `mark_notification_read` are defined in migrations. Security-definer functions set an empty `search_path`, schema-qualify tables/functions, validate identity/property access, and restrict execution grants.

## Important Invariants

- Reservation ranges are half-open, `[check-in, checkout)`, allowing same-day turnover at range boundaries.
- Expired holds are released by explicit transactional jobs before conflicting decisions; an index predicate never checks the current time.
- Database RPCs calculate prices and check capacity; the browser cannot submit an authoritative total.
- Guest snapshots are visible only to the owning Auth user or staff assigned to the property's row-level security scope. Anonymous guests can submit a request but do not get a dashboard identity unless they sign in during submission.
- Schema files are not evidence of deployment. Remote migration status must be inspected and recorded after connecting an authorized project.
