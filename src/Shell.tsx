import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { User, Menu, X, Library, BarChart2, Settings, LogOut, Activity } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { THEME_PRESETS, useScrollDirection } from './hooks'
import type { ThemeSettings } from './hooks'
import { HomeSearchToggle } from './SearchOverlay'
import { locales } from './locales'
import { useAuth } from './context/AuthContext'

// ─── Shell ───────────────────────────────────────────────────────────────────

export function Shell({ settings }: { settings: ThemeSettings }) {
  const theme = THEME_PRESETS[settings.theme]

  // Sync theme CSS vars to :root so body::before gradient picks them up
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--accent-glow', theme.glow)
    const dimAlpha = theme.glow.replace(/[\d.]+\)$/, '0.15)')
    const softAlpha = theme.glow.replace(/[\d.]+\)$/, '0.08)')
    root.style.setProperty('--accent-dim', dimAlpha)
    root.style.setProperty('--accent-soft', softAlpha)
    // Gate the rainbow animation — it runs on :root and causes continuous GPU
    // repaints which crash Safari on iPad when active for non-pride themes
    root.classList.toggle('pride-theme', settings.theme === 'pride')
  }, [theme, settings.theme])

  return (
    <div
      className="relative min-h-screen text-white"
      style={
        {
          '--accent': theme.accent,
          '--accent-glow': theme.glow,
          '--accent-dim': theme.glow.replace('0.35)', '0.15)').replace('0.30)', '0.12)').replace('0.28)', '0.10)'),
          '--accent-soft': theme.glow.replace('0.35)', '0.08)').replace('0.30)', '0.06)').replace('0.28)', '0.06)'),
        } as CSSProperties
      }
    >
      <NavBar language={settings.language} />
      {/* pb-safe ensures content isn't hidden behind iOS home indicator */}
      <main className="relative z-10 pb-[env(safe-area-inset-bottom,0px)]">
        <Outlet />
      </main>
    </div>
  )
}

// ─── NavBar ──────────────────────────────────────────────────────────────────

function NavBar({ language }: { language?: 'en' | 'pl' }) {
  const hidden = useScrollDirection()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [theatreActive, setTheatreActive] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const profileRef = useRef<HTMLDivElement>(null)
  const lang = language || 'en'
  const t = locales[lang].nav
  const isElectron = /electron/i.test(navigator.userAgent)

  // Close mobile menu and profile dropdown on route change
  useEffect(() => { setMobileOpen(false); setProfileOpen(false) }, [location.pathname])

  // Close profile dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false)
      }
    }
    if (profileOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [profileOpen])

  // Hide navbar when a page activates theatre mode via body class
  useEffect(() => {
    const sync = () => setTheatreActive(document.body.classList.contains('theatre-mode'))
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  async function handleSignOut() {
    setProfileOpen(false)
    await signOut()
    navigate('/auth')
  }

  const navLinks = [
    { to: '/browse', label: t.browse },
    { to: '/sports', label: t.sports },
  ]

  const profileMenuItems = [
    { to: profile?.username ? `/user/${profile.username}` : '/profile', icon: User, label: 'My Profile' },
    { to: '/feed', icon: Activity, label: 'Activity Feed' },
    { to: '/collections', icon: Library, label: 'My Collection' },
    { to: '/stats', icon: BarChart2, label: 'My Stats' },
    { to: '/profile', icon: Settings, label: 'Settings' },
  ]

  /** Avatar shown in the button and dropdown header */
  function ProfileAvatar({ size }: { size: 'sm' | 'lg' }) {
    const dim = size === 'lg' ? 28 : 36
    const fontSize = size === 'lg' ? 11 : 14
    if (profile?.avatar_url) {
      return (
        <img
          src={profile.avatar_url}
          alt={profile.username ?? 'Avatar'}
          style={{ width: dim, height: dim, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
        />
      )
    }
    if (profile?.username) {
      return (
        <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: dim, height: dim, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          color: 'var(--accent)', fontSize, fontWeight: 700, lineHeight: 1,
          fontFamily: 'Inter, sans-serif',
        }}>
          {profile.username[0].toUpperCase()}
        </span>
      )
    }
    return <User className={size === 'lg' ? 'w-3.5 h-3.5 opacity-50' : 'w-4 h-4'} />
  }

  function isActive(to: string) {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300"
        style={{
          transform: (hidden || theatreActive) ? 'translateY(-100%)' : 'translateY(0)',
          background: 'linear-gradient(180deg, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.0) 100%)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 sm:px-6 py-4 sm:py-5 gap-4">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="no-bg-hover shrink-0">
              <img
                src="/1x/Asset 1.webp"
                alt="Baroflix"
                className="block h-9 w-auto"
              />
            </Link>

            {/* Left nav — desktop */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="text-sm font-semibold transition-colors"
                  style={{ color: isActive(to) ? '#fff' : 'rgba(255,255,255,0.6)' }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            {!isElectron && (
              <Link
                to="/download"
                className="hidden lg:flex items-center justify-center px-4 h-9 rounded-full text-sm font-bold text-white transition-all hover:brightness-110 mr-2"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 20px var(--accent-dim)',
                }}
              >
                {t.downloadApp}
              </Link>
            )}
            {/* Search — always visible */}
            <HomeSearchToggle />
            {/* Profile dropdown — desktop only */}
            <div ref={profileRef} className="hidden lg:block relative">
              <button
                onClick={() => setProfileOpen(o => !o)}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                style={{
                  background: profile?.avatar_url ? 'transparent'
                    : profileOpen || isActive('/profile') || isActive('/user/') || isActive('/feed') || isActive('/collections') || isActive('/stats')
                      ? 'var(--accent-dim)' : 'rgba(255,255,255,0.08)',
                  border: `1px solid ${profileOpen || isActive('/profile') || isActive('/user/') || isActive('/feed') || isActive('/collections') || isActive('/stats')
                    ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
                  color: 'rgba(255,255,255,0.85)',
                  overflow: profile?.avatar_url ? 'hidden' : 'visible',
                  padding: 0,
                }}
                aria-label="Profile menu"
              >
                <ProfileAvatar size="lg" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-52 rounded-2xl overflow-hidden z-[60]"
                    style={{
                      background: 'rgba(14,14,14,0.98)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      backdropFilter: 'blur(24px)',
                      boxShadow: '0 12px 48px rgba(0,0,0,0.7)',
                    }}
                  >
                    {/* User info header */}
                    {profile?.username && (
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0">
                            <ProfileAvatar size="sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">@{profile.username}</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Menu items */}
                    <div className="py-1.5">
                      {profileMenuItems.map(({ to, icon: Icon, label }) => (
                        <Link
                          key={to + label}
                          to={to}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-bg-hover"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#fff' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)' }}
                        >
                          <Icon className="w-4 h-4 shrink-0 opacity-60" />
                          {label}
                        </Link>
                      ))}
                    </div>

                    {/* Sign out */}
                    <div className="py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-bg-hover"
                        style={{ color: 'rgba(255,255,255,0.45)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)' }}
                      >
                        <LogOut className="w-4 h-4 shrink-0 opacity-60" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-full text-white/70 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className="fixed inset-0 z-40 lg:hidden pointer-events-none"
        aria-hidden={!mobileOpen}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 transition-opacity duration-300"
          style={{ opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none' }}
          onClick={() => setMobileOpen(false)}
        />

        {/* Panel */}
        <nav
          className="absolute top-0 right-0 h-full w-72 flex flex-col pt-20 pb-8 px-5 gap-1 transition-transform duration-300"
          style={{
            transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)',
            pointerEvents: mobileOpen ? 'auto' : 'none',
            background: 'rgba(10,10,10,0.97)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-base font-semibold transition-colors px-3 py-3 rounded-xl"
              style={{
                color: isActive(to) ? '#fff' : 'rgba(255,255,255,0.6)',
                background: isActive(to) ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* Profile section links */}
          {profileMenuItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to + label}
              to={to}
              className="flex items-center gap-3 text-base font-semibold transition-colors px-3 py-3 rounded-xl"
              style={{
                color: isActive(to) ? '#fff' : 'rgba(255,255,255,0.6)',
                background: isActive(to) ? 'rgba(255,255,255,0.07)' : 'transparent',
              }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          ))}

          {/* Sign out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 text-base font-semibold transition-colors px-3 py-3 rounded-xl w-full"
            style={{ color: 'rgba(255,255,255,0.4)', background: 'transparent' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            Sign Out
          </button>

          {!isElectron && (
            <Link
              to="/download"
              className="mt-4 flex items-center justify-center px-4 h-11 rounded-full text-sm font-bold text-white transition-all hover:brightness-110"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 20px var(--accent-dim)',
              }}
            >
              {t.downloadApp}
            </Link>
          )}
        </nav>
      </div>

    </>
  )
}
