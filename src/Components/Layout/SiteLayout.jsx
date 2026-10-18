import { Link, NavLink, Outlet } from 'react-router-dom'
import { BedDouble, CircleUserRound, Menu, X } from 'lucide-react'
import { useState } from 'react'

const currentYear = new Date().getFullYear()

export default function SiteLayout() {
  const [menuOpen, setMenuOpen] = useState(false)
  return (
    <div className="app-frame">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="StayEase home"><span className="brand-mark"><BedDouble size={19} /></span><span>StayEase</span></Link>
        <button className="icon-button mobile-menu-toggle" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button>
        <nav className={menuOpen ? 'site-nav is-open' : 'site-nav'} aria-label="Main navigation">
          <NavLink to="/stays" onClick={() => setMenuOpen(false)}>Find a stay</NavLink>
          <NavLink to="/my-stays" onClick={() => setMenuOpen(false)}>My stays</NavLink>
          <NavLink to="/manage" onClick={() => setMenuOpen(false)}>Property desk</NavLink>
        </nav>
        <Link className="header-account" to="/auth"><CircleUserRound size={18} /><span>Sign in</span></Link>
      </header>
      <main><Outlet /></main>
      <footer className="site-footer"><Link className="brand brand-small" to="/"><span className="brand-mark"><BedDouble size={16} /></span><span>StayEase</span></Link><p>Thoughtful stays, made simple.</p><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/contact">Contact</Link></div><small>© {currentYear} StayEase</small></footer>
    </div>
  )
}
