# Architecture

## Runtime

The frontend is a React 19 JSX application served by Vite. `src/App.jsx` owns the route tree; page components live under `src/Pages`, shared UI under `src/Components`, and Supabase access is centralized in `src/Services/stayService.js`. `src/Lib/supabase.js` creates a browser client only when both public variables are present.

There is no custom Express/Django API. `src/Services` invokes PostgREST for RLS-protected reads and PostgreSQL RPCs for writes that need authorization, locking, pricing, or atomic date changes.

## Data Flow

1. Public routes read only published properties and active units, listing photos, amenities, and configured rates. Search availability is an advisory RPC read; booking creation revalidates availability while holding the unit row.
2. Guest booking requests invoke `create_booking_request`. PostgreSQL calculates nightly totals, inserts the booking and a 15-minute hold, and writes history in one transaction.
3. Staff approval/manual booking/check-in/checkout/cancellation/extension/block actions invoke separate authorized RPCs. Direct client writes to booking state and reservation ranges are not granted.
4. Supabase Realtime refreshes the guest/staff display only. It is never used as an availability lock.
5. A scheduled Edge Function calls database job RPCs, atomically claims due notifications, and records delivery outcomes. In-app notifications remain in PostgreSQL; Resend is used only when credentials are configured.

## Transaction Boundaries

Interactive availability operations lock the unit before booking rows. Reservations use `[check-in, checkout)` `daterange` values and a GiST exclusion constraint on active rows. Hold cleanup is explicit; no constraint depends on current time. Extension approval updates the reservation, checkout, full-stay price, extension history, and notifications in a transaction, so an overlap rolls all changes back.

## Current Scope

The application includes public listing/search/detail, guest auth/booking/history/notifications/extension requests, a staff queue/manual booking/check-in/checkout/extension desk, and a property/unit-filtered day/week/month calendar. Property/unit editing, photo upload UI, broad analytics/reporting, payment gateway integration, and outbound SMS/WhatsApp are not implemented.

No Supabase project was configured in this workspace. Local migration files and RPCs are source code only until applied and tested against an isolated Supabase project.
