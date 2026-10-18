# Reminders and Delivery

## Scheduled Job

`supabase/functions/process-notifications/index.ts` is deployed as an authenticated-by-secret Edge Function (`verify_jwt = false`; `x-rose-crown-cron-secret` is required). It calls `run_scheduled_jobs`, `enqueue_daily_checkout_briefings`, then claims due messages using `claim_notifications` with `FOR UPDATE SKIP LOCKED`.

Supabase Cron is active every five minutes and invokes `run_rose_crown_cron_jobs()` in PostgreSQL. It processes holds, checkout state, property-local briefings, and in-app notification status while recording each run. It does not call the Edge Function.

## Timezone Rules

Properties store IANA timezone names and local check-in/check-out times. Booking timestamps are constructed in that timezone. Reminder comparisons use the resulting absolute checkout timestamp; daily briefings and date grouping convert the current/checkout instant into the property's local timezone, including DST transitions.

Defaults are 09:00 local daily briefing, 120-minute and 30-minute pre-checkout reminders, due alert at checkout, then overdue alerts at the property's configured interval (default 60 minutes). Properties also have configurable pre-checkout offsets and overdue interval. The exact configured checkout timestamp remains in force until a staff-approved extension updates it.

## In-App and External Channels

In-app notifications are durable `notifications` rows visible under recipient/property RLS. Booking creation/status and extension events enqueue in-app messages. The grouped daily briefing includes guest/reference, unit, local checkout, status, approved extension, and next action.

Email is sent through the Resend HTTP API only when both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured as Edge Function secrets. The worker never marks an unconfigured email as sent. SMS/WhatsApp channels currently return explicit provider-not-configured failures; no provider SDK/account has been configured.

## Retries and Monitoring

The Edge Function atomically claims messages and increments attempts when invoked. Abandoned processing claims can be reclaimed after 15 minutes. Provider failures store `last_error`, reschedule with capped exponential delay, and stop after five attempts. Deduplication keys prevent duplicate event deliveries, including new checkout timestamps after an approved extension. Staff can inspect notification status and failures in the Alerts view.

Database scheduling is active and one successful job run is recorded. Outbound email/SMS/WhatsApp delivery still requires scheduling the Edge Function and configuring providers/secrets. Invocation alone is not treated as delivery success.
