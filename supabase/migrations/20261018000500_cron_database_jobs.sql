create extension if not exists pg_cron with schema pg_catalog;

create table public.scheduled_job_runs (
  id bigint generated always as identity primary key,
  job_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'failed')),
  result jsonb,
  error_message text
);
alter table public.scheduled_job_runs enable row level security;
revoke all on public.scheduled_job_runs from public, anon, authenticated;

create or replace function public.run_rose_crown_cron_jobs()
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_run_id bigint;
  v_run_at timestamptz := now();
  v_job_result jsonb;
  v_briefings integer;
  v_in_app_count integer;
begin
  if coalesce((select auth.jwt() ->> 'role'), '') <> 'service_role'
    and session_user not in ('postgres', 'supabase_admin') then
    raise exception 'Scheduler authorization required' using errcode = '42501';
  end if;

  insert into public.scheduled_job_runs(job_name, started_at, status)
  values ('rose-crown-database-jobs', v_run_at, 'running')
  returning id into v_run_id;

  begin
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    v_job_result := public.run_scheduled_jobs(v_run_at);
    v_briefings := public.enqueue_daily_checkout_briefings(v_run_at);

    update public.notifications
      set delivery_status = 'sent', sent_at = v_run_at, processing_started_at = null, last_error = null
      where channel = 'in_app' and delivery_status = 'pending' and scheduled_at <= v_run_at;
    get diagnostics v_in_app_count = row_count;

    update public.scheduled_job_runs
      set completed_at = now(), status = 'succeeded',
          result = jsonb_build_object('jobs', v_job_result, 'briefings_created', v_briefings, 'in_app_notifications_marked_sent', v_in_app_count)
      where id = v_run_id;
    return (select result from public.scheduled_job_runs where id = v_run_id);
  exception when others then
    update public.scheduled_job_runs
      set completed_at = now(), status = 'failed', error_message = left(sqlerrm, 1000)
      where id = v_run_id;
    return jsonb_build_object('run_id', v_run_id, 'status', 'failed', 'error', left(sqlerrm, 1000));
  end;
end
$$;

revoke all on function public.run_rose_crown_cron_jobs() from public;
grant execute on function public.run_rose_crown_cron_jobs() to service_role, postgres;

select cron.schedule(
  'rose-crown-database-jobs-every-five-minutes',
  '*/5 * * * *',
  'select public.run_rose_crown_cron_jobs();'
);
