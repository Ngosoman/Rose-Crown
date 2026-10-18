# Rose-Crown

Rose-Crown is a React/Vite booking and property operations interface backed by Supabase. Property listings, booking requests, staff actions, and notifications are read from or committed to PostgreSQL; the browser does not contain demo business records.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- A Supabase project for real application data
- Supabase CLI and Docker only when running local Supabase migrations/tests

## Local Frontend

From `Frontend/`:

```sh
npm install
Copy-Item .env.example .env
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to the project URL and publishable/anon key, then restart Vite. Only the public key belongs in the frontend. Never add a service-role key to a `VITE_` variable.

If either value is missing, the interface displays setup guidance rather than inventing listings or bookings. This workspace is currently connected to the Rose-Crown Supabase URL using its public anon key; `.env` is ignored by Git.

## Scripts

- `npm run dev` starts Vite.
- `npm run build` creates the production bundle.
- `npm run preview` previews the bundle locally.
- `npm run lint` runs Oxlint.
- `npm test` runs Vitest and Testing Library.
- `npx supabase test db` runs pgTAP tests against the local Supabase database (requires Docker).

## Supabase Setup

Migrations are ordered in `supabase/migrations/`. The four migrations have been applied atomically to the shared Rose-Crown project on the `main` branch using the authenticated SQL Editor. Catalog checks verified 18 public tables with RLS, 26 policies, 15 RPCs, two exclusion constraints, and the listing bucket. The project’s dev/production designation is unknown; see [Deployment](docs/DEPLOYMENT.md).

With an authorized project and the Supabase CLI installed:

```sh
npx supabase start
npx supabase migration up --local
npx supabase test db
```

For a separate staging project, inspect its migration history first, link using that project's actual reference, then apply the reviewed migrations without resetting or overwriting existing data. The shared main project already has the four versions recorded; because the CLI was unavailable, the dashboard shows version rows without migration names. Align CLI history before any future `db push`. See [Deployment](docs/DEPLOYMENT.md).

Before the first property can be managed, an authorized operator must provision the first super admin directly through Supabase SQL Editor or a server-side administrative tool. See [Security](docs/SECURITY.md).

## Architecture

- React JSX, Vite, Tailwind CSS, React Router, React Hook Form, Zod, Lucide, Recharts, and a custom accessible calendar.
- Supabase Auth and RLS for identity/access; PostgreSQL RPCs for availability-critical work; Storage for listing photos; Realtime for view refresh.
- A 15-minute request hold and GiST exclusion constraint protect the same date-range availability rules for both website and staff-created bookings.
- A five-minute Supabase Cron job processes holds, checkout state, briefings, and in-app notification status. The deployed Edge Function claims outbound notifications when invoked; Resend requires credentials, and SMS/WhatsApp require a provider.

See [Architecture](docs/ARCHITECTURE.md), [Database Schema](docs/DATABASE_SCHEMA.md), and [Booking Workflow](docs/BOOKING_WORKFLOW.md).

## Deployment and Business Decisions

Staging/production migration steps, secret setup, cron configuration, payment-provider limitations, and unresolved cancellation, refund, fee, and operational policies are documented in `docs/`. Legal policy pages currently contain launch warnings and require jurisdiction-specific review.
