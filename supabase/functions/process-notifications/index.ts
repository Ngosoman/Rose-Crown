import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-stayease-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

type Notification = {
  id: string
  recipient_id: string
  booking_id: string | null
  notification_type: string
  title: string
  body: string
  channel: 'in_app' | 'email' | 'sms' | 'whatsapp'
  attempt_count: number
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  const projectUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecret = Deno.env.get('STAYEASE_CRON_SECRET')
  if (!projectUrl || !serviceRoleKey || !cronSecret) return json({ error: 'Worker secrets are not configured.' }, 503)
  if (request.headers.get('x-stayease-cron-secret') !== cronSecret) return json({ error: 'Unauthorized.' }, 401)

  const admin = createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: jobs, error: jobError } = await admin.rpc('run_scheduled_jobs', { p_now: new Date().toISOString() })
  if (jobError) return json({ error: 'Scheduled job execution failed.' }, 500)

  const { data: notifications, error: claimError } = await admin.rpc('claim_notifications', { p_limit: 50 })
  if (claimError) return json({ error: 'Notification claim failed.' }, 500)

  const results: Array<{ id: string; status: string }> = []
  for (const notification of (notifications ?? []) as Notification[]) {
    const outcome = await deliver(admin, notification)
    const patch = outcome.sent
      ? { delivery_status: 'sent', sent_at: new Date().toISOString(), last_error: null }
      : {
          delivery_status: notification.attempt_count >= 5 ? 'failed' : 'pending',
          scheduled_at: new Date(Date.now() + Math.min(240, 5 * (2 ** (notification.attempt_count - 1))) * 60_000).toISOString(),
          last_error: outcome.error?.slice(0, 500) ?? 'Delivery failed.',
        }
    const { error: updateError } = await admin.from('notifications').update(patch).eq('id', notification.id)
    results.push({ id: notification.id, status: updateError ? 'update_failed' : patch.delivery_status })
  }

  return json({ jobs, processed: results.length, results })
})

async function deliver(admin: ReturnType<typeof createClient>, notification: Notification) {
  if (notification.channel === 'in_app') return { sent: true }
  if (notification.channel === 'sms' || notification.channel === 'whatsapp') {
    return { sent: false, error: `${notification.channel} delivery provider is not configured.` }
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  const sender = Deno.env.get('RESEND_FROM_EMAIL')
  if (!apiKey || !sender) return { sent: false, error: 'Email provider credentials are not configured.' }

  const { data: booking } = notification.booking_id
    ? await admin.from('bookings').select('guest_id,guest_email,guest_name').eq('id', notification.booking_id).maybeSingle()
    : { data: null }
  const email = booking?.guest_id === notification.recipient_id
    ? booking.guest_email
    : (await admin.auth.admin.getUserById(notification.recipient_id)).data.user?.email
  if (!email) return { sent: false, error: 'Recipient email is unavailable.' }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject: notification.title,
        text: notification.body,
      }),
    })
    if (!response.ok) return { sent: false, error: `Email provider returned HTTP ${response.status}.` }
    return { sent: true }
  } catch {
    return { sent: false, error: 'Could not reach the email provider.' }
  }
}
