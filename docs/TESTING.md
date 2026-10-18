# Testing

## Frontend

Run in `Frontend/`:

```sh
npm test
npm run lint
npm run build
```

The Vitest/Testing Library suite covers booking form validation, formatting, loading/error/empty/configuration states, and that the guest dashboard does not fabricate records without a backend. The current frontend suite passed 11 tests during implementation.

## Database

The pgTAP suite is in `supabase/tests/database.test.sql`. With Docker and the Supabase CLI installed, start a fresh local Supabase stack, apply migrations, then run:

```sh
npx supabase start
npx supabase migration up --local
npx supabase test db
```

The SQL tests cover core tables, RLS enablement, blocked direct booking writes, RPC presence, range exclusion, and half-open same-day turnover. They do not yet exercise authenticated cross-guest isolation, concurrent RPC calls, provider events, DST boundaries, extension conflicts, or full notification retries. Those require an isolated local Supabase database and should be added/run before production approval.

No PostgreSQL/Supabase runtime or CLI was available in the current environment, so pgTAP and migration execution are not reported as passing. A frontend build is not database verification.

## Staging Acceptance

Use isolated test Auth users and properties in staging to verify: concurrent overlapping web/manual requests; hold expiry and approval races; guest/property RLS isolation; extension conflict rollback and repricing; recorded checkout before release; due/overdue idempotency across timezone/DST boundaries; and provider retry/failure reporting. Never seed fabricated test records in production.
