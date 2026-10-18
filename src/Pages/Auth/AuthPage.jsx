import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, BedDouble, LockKeyhole } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, supabaseConfigured } from '../../Lib/supabase'
import { ConfigState } from '../../Components/Common/Feedback'
import PasswordField from '../../Components/Common/PasswordField'

export default function AuthPage() {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const requestedReturnTo = location.state?.returnTo
  const safeReturnTo = typeof requestedReturnTo === 'string'
    && requestedReturnTo.startsWith('/')
    && !requestedReturnTo.startsWith('//')
    ? requestedReturnTo
    : '/my-stays'
  const guestDestination = safeReturnTo === '/manage' ? '/my-stays' : safeReturnTo

  async function submit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'sign-up') {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (authError) throw authError
        if (!data.session) {
          toast.success('Check your email to finish creating your account.')
          setMode('sign-in')
        } else navigate(guestDestination, { replace: true })
      } else if (mode === 'reset') {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth` })
        if (authError) throw authError
        toast.success('If an account exists, a reset link is on its way.')
        setMode('sign-in')
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        const userId = data.user?.id ?? data.session?.user?.id
        if (!userId) throw new Error('Could not verify the signed-in account.')

        const [roleResult, membershipResult] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', userId),
          supabase.from('property_members').select('role').eq('user_id', userId),
        ])
        if (roleResult.error || membershipResult.error) {
          throw roleResult.error || membershipResult.error
        }

        const roles = [...(roleResult.data ?? []), ...(membershipResult.data ?? [])]
        const isStaff = roles.some(({ role }) => ['super_admin', 'property_manager', 'receptionist'].includes(role))
        navigate(isStaff ? '/manage' : guestDestination, { replace: true })
      }
    } catch (reason) {
      setError(reason.message || 'Authentication failed.')
    } finally { setBusy(false) }
  }

  if (!supabaseConfigured) return <section className="auth-page section-wrap"><ConfigState /></section>
  return <section className="auth-page section-wrap">
    <div className="auth-art"><span className="brand brand-light"><span className="brand-mark"><BedDouble size={18} /></span>Rose-Crown</span><span className="eyebrow eyebrow-light">Your stays, all together</span><h1>Somewhere good<br />is waiting.</h1><p>Sign in to see your requests, stay details and messages from your host.</p><div className="auth-art-index">ROSE_CROWN / GUEST ACCESS</div></div>
    <div className="auth-form-wrap"><div className="auth-form-head"><span className="eyebrow">{mode === 'sign-up' ? 'New here' : mode === 'reset' ? 'Account recovery' : 'Welcome back'}</span><h2>{mode === 'sign-up' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in to Rose-Crown'}</h2><p>{mode === 'reset' ? 'We’ll send a secure reset link to your inbox.' : 'Manage upcoming stays and keep in touch with your host.'}</p></div>
      <form onSubmit={submit} className="auth-form">{mode === 'sign-up' && <label className="form-field"><span>Your name</span><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength="2" /></label>}<label className="form-field"><span>Email address</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>{mode !== 'reset' && <PasswordField label="Password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} />}
        {error && <p className="field-error" role="alert">{error}</p>}<button className="button button-dark auth-submit" disabled={busy}>{busy ? 'Please wait…' : mode === 'sign-up' ? 'Create account' : mode === 'reset' ? 'Send reset link' : 'Sign in'} <ArrowRight size={16} /></button>
      </form><div className="auth-links">{mode === 'sign-in' && <button className="plain-button" onClick={() => setMode('reset')}>Forgot password?</button>}<p>{mode === 'sign-up' ? 'Already have an account?' : 'New to Rose-Crown?'} <button className="plain-button" onClick={() => { setError(''); setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up') }}>{mode === 'sign-up' ? 'Sign in' : 'Create an account'}</button></p></div><div className="auth-security"><LockKeyhole size={14} /> Your account is protected by Supabase authentication.</div><Link className="text-link auth-back" to="/">Back to exploring</Link>
    </div>
  </section>
}
