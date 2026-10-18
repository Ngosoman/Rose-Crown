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

No local Docker, psql, or Supabase CLI are available. The frontend has been connected to the shared project; migrations were applied remotely through the authenticated dashboard SQL Editor.

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
5. Enable `pg_cron`, `pg_net`, and Vault through the Supabase-supported dashboard/extension workflow. Store the function URL and Cron secret in Vault. Schedule the endpoint every five minutes:

```sql
select cron.schedule(
  'rose-crown-notifications-every-five-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'rose-crown_function_url') || '/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-rose-crown-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'rose-crown_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);
```

Verify Cron run history, Edge Function responses, notification attempts, and delivery state. Do not treat an HTTP request being enqueued as successful email delivery.
6. Create an initial super admin using trusted Supabase tooling, then create properties, units, rates, amenities, property memberships, and storage images. Property/unit administration and image upload UI are not yet implemented in the frontend.

## Remote Migration Workflow

The four local migration files were executed as one transaction in the shared Rose-Crown project on the `main` branch. The dashboard records versions `20261018000100` through `20261018000400`; catalog verification found 18 public tables with RLS, 26 policies, 15 expected RPCs, two GiST exclusion constraints, and the public listing bucket. The project’s development/production designation is not known, so treat this as an applied shared environment, not as a certified staging deployment.

The migration batch and version rows were submitted directly through the Supabase SQL Editor because the CLI/psql/Docker are unavailable. Migration dashboard version rows show “Name not available”; future CLI-based migration management should first inspect and align this history. Never use `db reset`, drop existing tables, or force migration history.

`process-notifications` has not been deployed. `pg_cron`, `pg_net`, and Vault scheduling have not been enabled/configured. Deploy the function, set `ROSE_CROWN_CRON_SECRET` (and optional Resend secrets), configure the five-minute schedule, then verify run and delivery history. Payment gateway, SMS, and WhatsApp configuration remain launch blockers.
