# Deployment

## Local

1. Install Node.js 20.19+ (or 22.12+) and run `npm install` in `Frontend/`.
2. Copy `.env.example` to `.env` and set the project URL and public anon/publishable key. Never set the service-role key in Vite.
3. For local Supabase, install the official CLI and Docker, then run:

```sh
npx supabase start
npx supabase migration up --local
npx supabase test db
npm run dev
```

No local Docker, psql, Supabase CLI, or configured project credentials were available during implementation, so local migrations and Edge Functions have not been executed.

## Staging

1. Create/choose a non-production Supabase project and inspect its migration history before linking. Use the actual project reference; do not infer one from this repository.
2. Review the ordered SQL, generated policy state, and storage bucket on an isolated project. Never use a production reset as a migration shortcut.
3. Set browser environment variables in the staging hosting provider and secrets in Supabase Edge Function secrets:
   - `STAYEASE_CRON_SECRET`
   - `RESEND_API_KEY` and `RESEND_FROM_EMAIL` when Resend is ready
4. Deploy `process-notifications`:

```sh
npx supabase functions deploy process-notifications --project-ref <staging-project-ref>
npx supabase secrets set STAYEASE_CRON_SECRET=<secret> --project-ref <staging-project-ref>
```

Set Resend secrets the same way when configured. Do not put secrets in `.env.example`, source, SQL, or build variables.
5. Enable `pg_cron`, `pg_net`, and Vault through the Supabase-supported dashboard/extension workflow. Store the function URL and Cron secret in Vault. Schedule the endpoint every five minutes:

```sql
select cron.schedule(
  'stayease-notifications-every-five-minutes',
  '*/5 * * * *',
  $job$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'stayease_function_url') || '/functions/v1/process-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-stayease-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'stayease_cron_secret')
      ),
      body := '{}'::jsonb
    );
  $job$
);
```

Verify Cron run history, Edge Function responses, notification attempts, and delivery state. Do not treat an HTTP request being enqueued as successful email delivery.
6. Create an initial super admin using trusted Supabase tooling, then create properties, units, rates, amenities, property memberships, and storage images. Property/unit administration and image upload UI are not yet implemented in the frontend.

## Remote Migration Workflow

After linking a target project, first run `npx supabase migration list --linked` and inspect the remote schema. Apply the reviewed migrations with `npx supabase db push --linked` only after the project owner approves the target. Do not use `db reset`, drop existing tables, or force migration history. Verify the remote migration list and schema/RLS after application.

No migration has been applied to staging or production from this session. Email provider, payment gateway, SMS, and WhatsApp configuration remain separate launch blockers.
