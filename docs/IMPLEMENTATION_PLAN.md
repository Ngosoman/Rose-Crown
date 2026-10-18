# Rose-Crown Implementation Plan

## Inspection
- [x] Confirmed this is the untouched React 19 / Vite 8 starter; no application routes or business features exist yet.
- [x] At initial repository inspection, there were no local Supabase files, migration history, configured environment variables, or accessible Supabase MCP tools.
- [x] Before deployment, inspected the shared Rose-Crown project: healthy `main` branch, no app migrations or public tables, and pgcrypto already installed in `extensions`.
- [x] Preserved the existing React/Vite/Tailwind setup and uncommitted Git state.
- [x] Ignore local environment secrets and generated Supabase state before adding configuration examples.

## Delivery Phases
- [x] Add React Router, Supabase client, forms/validation, accessible icons, calendar/chart dependencies, and test tooling.
- [x] Build responsive public listing/search/detail, authentication, guest requests/history/inbox/extensions, and staff booking/check-in/checkout/calendar workflows.
- [x] Add five ordered migrations for identity, properties, units, pricing, reservations, bookings, operations, notifications, audit, RLS, storage, RPCs, and Cron.
- [x] Deploy the notification Edge Function and schedule database-side hold/checkout/briefing jobs every five minutes. Outbound delivery remains unscheduled.
- [x] Add pgTAP schema/constraint checks and focused frontend tests. Frontend tests were executed; pgTAP was authored but could not run without a local database.
- [x] Create README and architecture, schema, workflow, reminder, security, deployment, decision, and testing documentation.

## Current Blockers / Verification Notes
- The five ordered SQL migrations were applied atomically through the authenticated Supabase SQL Editor to the shared Rose-Crown project on `main`; dashboard history and live catalog checks confirm versions 20261018000100 through 20261018000500.
- Supabase `main` is the Production backend for `rose-crown.vercel.app`. Migrations were applied after the user authorized proceeding; no reset, drop, truncate, or user-data migration was performed.
- Supabase CLI 2.121 was provisioned through `npx`; psql and Docker are unavailable and pgTAP was not run. The Edge Function is deployed, its server-side cron secret is set, and the database Cron schedule is active. Outbound channel delivery is not scheduled.
- The ignored local `.env` contains the project URL and public anon key; Auth health returned HTTP 200. Public `properties` reads and the availability RPC return HTTP 200; anonymous booking reads return HTTP 401 as expected.
- Vercel Production now has `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the latest `main` deployment is Ready and the live page shows the real empty-list state instead of setup guidance.
- Email, SMS, WhatsApp, and payment provider credentials are not present. In-app queues and the Resend adapter are implemented; unconfigured external delivery is recorded as failed and payments remain pending.
- Client decisions needed before policy is finalized: cancellation/refund rules, payment provider and deposit rules, cleaning turnaround, fee/tax policy, extension fee policy, staff recipients, and legal policy copy.

## Implemented and Remotely Verified
- Database authority: half-open reservation ranges, GiST overlap exclusion, per-unit locks, expiring 15-minute holds, server-side nightly pricing/capacity, manual reservations, approval/rejection, cancellation, blocks, extensions, and recorded check-in/checkout.
- Access: Auth-created guest profiles, server-provisioned roles, property memberships, RLS on all 19 public tables, restricted function grants, and listing Storage policies. Catalog verification reports 26 policies.
- RPCs and constraints: all 16 expected booking/operations/scheduler RPCs and both exclusion constraints are present. Anonymous booking-table reads are denied; the public availability RPC executes.
- Operations SQL: property-local due/reminder processing, grouped 09:00 checkout briefings, in-app notification queue, and five-minute database Cron are installed; one successful run is recorded. The Auth dashboard has no visible signed-up users, so no super-admin has been provisioned.
- Known product scope: property/unit CRUD, photo upload UI, payment gateway, outbound SMS/WhatsApp, richer revenue/occupancy reports, and policy-specific cancellation/refund processing still need provider/project setup and client decisions.