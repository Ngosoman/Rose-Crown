# Reminders and Delivery

## Scheduled Job

`supabase/functions/process-notifications/index.ts` is an authenticated-by-secret Edge Function (`verify_jwt = false`; `x-stayease-cron-secret` is required). It calls `run_scheduled_jobs`, `enqueue_daily_checkout_briefings`, then claims due messages using `claim_notifications` with `FOR UPDATE SKIP LOCKED`.

Configure Supabase Cron to invoke the function every five minutes. Example setup is in [Deployment](DEPLOYMENT.md). No schedule has been installed in a Supabase project from this workspace.

## Timezone Rules

Properties store IANA timezone names and local check-in/check-out times. Booking timestamps are constructed in that timezone. Reminder comparisons use the resulting absolute checkout timestamp; daily briefings and date grouping convert the current/checkout instant into the property's local timezone, including DST transitions.

Defaults are 09:00 local daily briefing, 120-minute and 30-minute pre-checkout reminders, due alert at checkout, then overdue alerts at the property's configured interval (default 60 minutes). Properties also have configurable pre-checkout offsets and overdue interval. The exact configured checkout timestamp remains in force until a staff-approved extension updates it.

## In-App and External Channels

In-app notifications are durable `notifications` rows visible under recipient/property RLS. Booking creation/status and extension events enqueue in-app messages. The grouped daily briefing includes guest/reference, unit, local checkout, status, approved extension, and next action.

Email is sent through the Resend HTTP API only when both `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are configured as Edge Function secrets. The worker never marks an unconfigured email as sent. SMS/WhatsApp channels currently return explicit provider-not-configured failures; no provider SDK/account has been configured.

## Retries and Monitoring

Workers atomically claim messages and increment attempts. Abandoned processing claims can be reclaimed after 15 minutes. Provider failures store `last_error`, reschedule with capped exponential delay, and stop after five attempts. Deduplication keys prevent duplicate event deliveries, including new checkout timestamps after an approved extension. Staff can inspect notification status and failures in the Alerts view.

Actual email/SMS/WhatsApp delivery and scheduled job history require a deployed function, secrets, and Cron configuration. Invocation alone is not treated as delivery success.
