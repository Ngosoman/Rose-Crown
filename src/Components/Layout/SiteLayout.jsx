import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BedDouble, ChevronDown, CircleUserRound, LogOut, Menu, UserRound, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '../../Lib/supabase'

const currentYear = new Date().getFullYear()

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [superAdminUserId, setSuperAdminUserId] = useState(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const accountMenuRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!supabase) return undefined
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session?.user?.id || !supabase) return undefined
    let active = true
    supabase.from('user_roles').select('role').eq('user_id', session.user.id).then(({ data }) => {
      if (active) setSuperAdminUserId((data ?? []).some(({ role }) => role === 'super_admin') ? session.user.id : null)
    })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    if (!accountOpen) return undefined
    const closeOnOutsideClick = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountOpen(false)
    }
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setAccountOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountOpen])

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message || 'Could not sign out.')
      return
    }
    setSession(null)
    setSuperAdminUserId(null)
    setAccountOpen(false)
    setMenuOpen(false)
    navigate('/', { replace: true })
  }

  const displayName = session?.user?.user_metadata?.full_name || session?.user?.email || 'Account'
  const initial = displayName.trim().charAt(0).toUpperCase() || 'A'
  const isSuperAdmin = session?.user?.id === superAdminUserId

  return (
    <div className="app-frame">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Rose-Crown home"><span className="brand-mark"><BedDouble size={19} /></span><span>Rose-Crown</span></Link>
        <button className="icon-button mobile-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="Main navigation">
          <NavLink to="/stays" onClick={() => setMenuOpen(false)}>Find a stay</NavLink>
          <NavLink to="/my-stays" onClick={() => setMenuOpen(false)}>My stays</NavLink>
          <NavLink to="/manage" onClick={() => setMenuOpen(false)}>Property desk</NavLink>
        </nav>
        {session ? <div className="header-account-wrap" ref={accountMenuRef}>
          <button className="header-account" aria-label="Open account menu" aria-haspopup="menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}>
            <span className="account-avatar" aria-hidden="true">{initial}</span>
            <span className="header-account-copy"><strong>{displayName}</strong><small>{isSuperAdmin ? 'Administrator' : 'Signed in'}</small></span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
          {accountOpen && <div className="account-menu" role="menu" aria-label="Account menu">
            <div className="account-menu-identity"><strong>{displayName}</strong><span>{session.user.email}</span><small>{isSuperAdmin ? 'Administrator account' : 'Signed in'}</small></div>
            <Link role="menuitem" to="/profile" state={{ returnTo: location.pathname }} onClick={() => { setAccountOpen(false); setMenuOpen(false) }}><UserRound size={16} /> Manage profile</Link>
            <button role="menuitem" onClick={signOut}><LogOut size={16} /> Sign out</button>
          </div>}
        </div> : <Link className="header-account" to="/auth"><CircleUserRound size={18} /><span>Sign in</span></Link>}
      </header>
      <main><Outlet /></main>
      <footer className="site-footer"><Link className="brand brand-small" to="/"><span className="brand-mark"><BedDouble size={16} /></span><span>Rose-Crown</span></Link><p>Thoughtful stays, made simple.</p><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link></div><small>© {currentYear} Rose-Crown</small></footer>
    </div>
  )
}
