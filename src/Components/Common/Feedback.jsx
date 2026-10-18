import { AlertCircle, LoaderCircle } from 'lucide-react'

export function LoadingState({ label = 'Loading your stay' }) {
  return <div className="loading-state" role="status"><LoaderCircle className="spin" size={20} /> <span>{label}</span></div>
}

export function ErrorState({ message = 'Something went wrong. Please try again.' }) {
  return <div className="notice notice-error" role="alert"><AlertCircle size={18} /> <span>{message}</span></div>
}

export function ConfigState() {
  return (
    <div className="config-state">
      <span className="eyebrow">One last connection</span>
      <h2>Connect your Rose-Crown database</h2>
      <p>For the live site, add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to Vercel Project Settings → Environment Variables, then redeploy. Locally, put them in <code>Frontend/.env</code> and restart Vite. Use only the publishable key in the browser; never use the service-role key here.</p>
    </div>
  )
}

export function EmptyState({ title, body }) {
  return <div className="empty-state"><span className="empty-mark">SE</span><h3>{title}</h3><p>{body}</p></div>
}
