# StayEase Implementation Plan

## Inspection
- [x] Confirmed this is the untouched React 19 / Vite 8 starter; no application routes or business features exist yet.
- [x] Confirmed there are no Supabase project files, migration history, CLI, configured environment variables, or accessible Supabase MCP tools in this session.
- [x] Preserved the existing React/Vite/Tailwind setup and uncommitted Git state.
- [x] Ignore local environment secrets and generated Supabase state before adding configuration examples.

## Delivery Phases
- [x] Add React Router, Supabase client, forms/validation, accessible icons, calendar/chart dependencies, and test tooling.
- [x] Build responsive public listing/search/detail, authentication, guest requests/history/inbox/extensions, and staff booking/check-in/checkout/calendar workflows.
- [x] Add four ordered local migrations for identity, properties, units, pricing, reservations, bookings, operations, notifications, audit, RLS, storage, and transactional RPCs.
- [x] Add the notification Edge Function and idempotent database jobs for holds, checkout reminders/briefings, and delivery retries. Remote scheduling is not configured.
- [x] Add pgTAP schema/constraint checks and focused frontend tests. Frontend tests were executed; pgTAP was authored but could not run without a local database.
- [x] Create README and architecture, schema, workflow, reminder, security, deployment, decision, and testing documentation.

## Current Blockers / Verification Notes
- Remote Supabase inspection or migration application cannot be performed until an authorized project connection and CLI/configuration are provided. No remote changes have been attempted.
- Neither `supabase`, `psql`, nor `docker` is installed/available in the current environment; migrations and Edge Functions remain unexecuted/unapplied.
- Public Supabase URL and publishable key are not configured. The app must show setup guidance and must not fabricate property or booking data.
- Email, SMS, WhatsApp, and payment provider credentials are not present. In-app queues and the Resend adapter are implemented; unconfigured external delivery is recorded as failed and payments remain pending.
- Client decisions needed before policy is finalized: cancellation/refund rules, payment provider and deposit rules, cleaning turnaround, fee/tax policy, extension fee policy, staff recipients, and legal policy copy.

## Implemented Locally, Not Yet Verified Against Supabase
- Database authority: half-open reservation ranges, GiST overlap exclusion, per-unit locks, expiring 15-minute holds, server-side nightly pricing/capacity, manual reservations, approval/rejection, cancellation, blocks, extensions, and recorded check-in/checkout.
- Access: Auth-created guest profiles, server-provisioned roles, property memberships, RLS on public tables, private guest booking reads, restricted function grants, and listing Storage policies.
- Operations: property-local due/reminder processing, repeated overdue alerts, grouped 09:00 checkout briefs, in-app notification inboxes, and a retrying notification worker.
- Known product scope: property/unit CRUD, photo upload UI, payment gateway, outbound SMS/WhatsApp, richer revenue/occupancy reports, and policy-specific cancellation/refund processing still need provider/project setup and client decisions.