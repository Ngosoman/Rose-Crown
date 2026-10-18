# Security

## Authentication and Roles

Supabase Auth creates a guest profile/role only. No browser registration flow can promote a user. The first super admin must be assigned by a trusted project operator through Supabase SQL Editor or a server-side administrative tool after the intended Auth user exists:

```sql
insert into public.user_roles (user_id, role)
values ('<auth-user-uuid>', 'super_admin')
on conflict do nothing;
```

Do not expose a service-role key in the frontend or commit it. After initial setup, super admins assign property memberships using protected database tooling; the staff UI authorizes every operation again in PostgreSQL.

## RLS and Data Exposure

RLS is enabled for all application tables. Anonymous access is limited to published listing/unit/photo/amenity/rate reads and the public booking/availability RPCs. Guests read their own bookings, extensions, and notifications. Staff reads/writes are restricted to assigned properties. Payment/audit records are not public. Browser access to booking writes, reservation rows, notification delivery state, payment state, and audit inserts is withheld.

Storage bucket `rose-crown-listings` is public-read for listing images. Staff upload/update/delete checks the first storage path folder as a property UUID against property membership. Store object paths, not image bytes, in Postgres.

## RPC and Secret Boundaries

Security-definer functions set `search_path = ''`, qualify objects, validate `auth.uid()`/property membership, and have explicit execution grants. The database Cron wrapper is callable only by the scheduler owner or service role. The deployed Edge Function uses the service-role key only server-side. Service-role and provider secrets belong only in Edge Function secret storage.

The Edge Function has JWT verification disabled only because Cron uses a separate `ROSE_CROWN_CRON_SECRET` header. Rotate it if exposed. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL` only as server-side secrets. Public Vite variables may contain only the Supabase URL and publishable/anon key.

## Operational Cautions

Review actual Supabase migration history, policies, and functions before deployment. Apply first to an isolated staging project with test users. Do not reset, truncate, drop, or overwrite any existing project. Legal privacy/terms pages require jurisdiction-specific review before launch. Never log guest contact information or provider secrets.
