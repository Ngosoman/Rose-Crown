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
      <h2>Connect your StayEase database</h2>
      <p>Add your Supabase project URL and publishable key to <code>Frontend/.env</code>, then restart the development server. Your credentials stay out of the browser bundle except for the intended public key.</p>
    </div>
  )
}

export function EmptyState({ title, body }) {
  return <div className="empty-state"><span className="empty-mark">SE</span><h3>{title}</h3><p>{body}</p></div>
}
