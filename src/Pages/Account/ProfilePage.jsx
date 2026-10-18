import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Save, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { ConfigState, LoadingState } from '../../Components/Common/Feedback'
import PasswordField from '../../Components/Common/PasswordField'
import { supabase, supabaseConfigured } from '../../Lib/supabase'

export default function ProfilePage() {
  const [session, setSession] = useState(null)
  const [values, setValues] = useState({ displayName: '', phone: '' })
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      const currentSession = data.session
      if (!currentSession) {
        navigate('/auth', { state: { returnTo: '/profile' }, replace: true })
        return
      }
      setSession(currentSession)
      const { data: profile, error: profileError } = await supabase.from('profiles').select('display_name,phone').eq('id', currentSession.user.id).maybeSingle()
      if (!active) return
      if (profileError) setError(profileError.message)
      setValues({
        displayName: profile?.display_name || currentSession.user.user_metadata?.full_name || '',
        phone: profile?.phone || '',
      })
      setLoading(false)
    }).catch((reason) => {
      if (active) {
        setError(reason.message || 'Could not load your profile.')
        setLoading(false)
      }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) navigate('/auth', { state: { returnTo: '/profile' }, replace: true })
      else setSession(nextSession)
    })
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [navigate])

  async function saveProfile(event) {
    event.preventDefault()
    if (!session) return
    setSavingProfile(true)
    setError('')
    try {
      const displayName = values.displayName.trim()
      const phone = values.phone.trim()
      const { error: profileError } = await supabase.from('profiles').update({ display_name: displayName, phone }).eq('id', session.user.id)
      if (profileError) throw profileError
      const { data, error: authError } = await supabase.auth.updateUser({ data: { full_name: displayName } })
      if (authError) throw authError
      if (data.user) setSession((current) => ({ ...current, user: data.user }))
      setValues({ displayName, phone })
      toast.success('Profile updated.')
    } catch (reason) {
      setError(reason.message || 'Your profile could not be updated.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.')
      return
    }
    setSavingPassword(true)
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword })
      if (passwordError) throw passwordError
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password changed.')
    } catch (reason) {
      setError(reason.message || 'Your password could not be changed.')
    } finally {
      setSavingPassword(false)
    }
  }

  if (!supabaseConfigured) return <section className="section-wrap profile-page"><ConfigState /></section>
  if (loading) return <section className="section-wrap profile-page"><LoadingState label="Loading your profile" /></section>

  const requestedReturnTo = location.state?.returnTo
  const returnTo = typeof requestedReturnTo === 'string' && requestedReturnTo.startsWith('/') && !requestedReturnTo.startsWith('//') ? requestedReturnTo : '/'
  const returnLabel = returnTo === '/manage' ? 'Back to property desk' : returnTo === '/my-stays' ? 'Back to my stays' : 'Back to exploring'

  return <section className="section-wrap profile-page">
    <Link className="text-link profile-back" to={returnTo}><ArrowLeft size={15} /> {returnLabel}</Link>
    <div className="page-intro profile-heading"><span className="eyebrow">Account settings</span><h1>Manage your <em>profile.</em></h1><p>Update the details and password for your Rose-Crown account.</p></div>
    {error && <p className="field-error profile-error" role="alert">{error}</p>}
    <div className="profile-layout">
      <section className="profile-panel" aria-labelledby="profile-details-title">
        <div className="profile-panel-heading"><span className="profile-panel-icon"><UserRound size={18} /></span><div><h2 id="profile-details-title">Personal details</h2><p>Your account identity and contact information.</p></div></div>
        <form className="profile-form" onSubmit={saveProfile}>
          <label className="form-field"><span>Email address</span><input type="email" value={session?.user?.email || ''} readOnly /></label>
          <label className="form-field"><span>Display name</span><input autoComplete="name" value={values.displayName} onChange={(event) => setValues((current) => ({ ...current, displayName: event.target.value }))} required minLength="2" maxLength="100" /></label>
          <label className="form-field"><span>Phone number</span><input type="tel" autoComplete="tel" value={values.phone} onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))} maxLength="30" /></label>
          <button className="button button-dark" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'} <Save size={15} /></button>
        </form>
      </section>
      <section className="profile-panel" aria-labelledby="profile-security-title">
        <div className="profile-panel-heading"><span className="profile-panel-icon"><LockKeyhole size={18} /></span><div><h2 id="profile-security-title">Password</h2><p>Choose a new password for your account.</p></div></div>
        <form className="profile-form" onSubmit={changePassword}>
          <PasswordField label="New password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <PasswordField label="Confirm new password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <button className="button button-outline" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change password'} <LockKeyhole size={15} /></button>
        </form>
      </section>
    </div>
  </section>
}