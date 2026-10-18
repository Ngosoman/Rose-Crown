# Deployment

## Local

1. Install Node.js 20.19+ (or 22.12+) and run `npm install` in `Frontend/`.
2. Set `VITE_SUPABASE_URL` and the public anon/publishable key in the ignored `.env`. Never set the service-role key in Vite.
3. For local Supabase, install the official CLI and Docker, then run:

```sh
npx supabase start
npx supabase migration up --local
npx supabase test db
npm run dev
```

Docker and psql are unavailable. Supabase CLI 2.121 was run through `npx` for Edge Function deployment; migrations were applied remotely through the authenticated dashboard SQL Editor.

## Staging

1. Create/choose a non-production Supabase project and inspect its migration history before linking. Use the actual project reference; do not infer one from this repository.
2. Review the ordered SQL, generated policy state, and storage bucket on an isolated project. Never use a production reset as a migration shortcut.
3. Set browser environment variables in the staging hosting provider and secrets in Supabase Edge Function secrets:
   - `ROSE_CROWN_CRON_SECRET`
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL` when Resend is ready
4. Deploy `process-notifications`:

```sh
npx supabase functions deploy process-notifications --project-ref <staging-project-ref>
npx supabase secrets set ROSE_CROWN_CRON_SECRET=<secret> --project-ref <staging-project-ref>
```

Set Resend secrets the same way when configured. Do not put secrets in `.env.example`, source, SQL, or build variables.
5. The shared project already has `pg_cron` enabled by migration 5 and an active `rose-crown-database-jobs-every-five-minutes` job. It calls the guarded `run_rose_crown_cron_jobs()` wrapper, which records run history and handles holds, checkout transitions, briefings, and in-app notification status. Verify `public.scheduled_job_runs` and `cron.job_run_details` after deployment.
6. The Edge Function is deployed and `ROSE_CROWN_CRON_SECRET` is stored as a server-side secret, but no scheduled HTTP invocation is configured. To activate email delivery, configure a secure secret reference for the Cron HTTP caller, schedule the function, then set Resend secrets. SMS/WhatsApp providers remain separate work.
7. Have the property owner create an Auth account, then assign that known account `super_admin` through trusted Supabase tooling. The Auth dashboard currently has no signed-up users, so super-admin access is not yet provisioned. The Listings tab now supports creating properties/units, editing amenities and seasonal rates, and uploading listing photos after an authorized manager is signed in.

## Remote Migration Workflow

The six migration files were executed as ordered transactions in the shared Rose-Crown project on the `main` branch. The dashboard records versions `20261018000100` through `20261018000600`; catalog verification found 19 public tables with RLS, 27 policies, listing authorization/audit functions, two GiST exclusion constraints, the listing bucket, an active five-minute Cron job, and a successful scheduler health run. This Supabase `main` project is the Production backend for `rose-crown.vercel.app`; these changes are live, not a staging deployment.

The migration batch and version rows were submitted directly through the Supabase SQL Editor before the CLI was provisioned; psql and Docker remain unavailable. The migration dashboard shows version rows with “Name not available”; future CLI-based migration management should first inspect and align this history. Never use `db reset`, drop existing tables, or force migration history.

`process-notifications` is deployed and `ROSE_CROWN_CRON_SECRET` is stored server-side. The current Cron schedule invokes the database wrapper directly; it does not dispatch the Edge Function. Secure Cron-to-function invocation and Resend credentials are needed for outbound email. Payment gateway, SMS, and WhatsApp configuration remain launch blockers.

## Vercel Production

Production now has `VITE_SUPABASE_URL` and the public `VITE_SUPABASE_ANON_KEY`. After saving them, the latest `main` commit was redeployed and Vercel reports the deployment Ready. The live page no longer shows database setup guidance; it shows the real empty-list state until a property is published. These are public browser variables; never configure a service-role key as a `VITE_` variable.
