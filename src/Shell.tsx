import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom'
import { User, Menu, X, Library, BarChart2, Settings, LogOut, Activity } from 'lucide-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { THEME_PRESETS, useScrollDirection } from './hooks'
import type { ThemeSettings } from './hooks'
import { HomeSearchToggle } from './SearchOverlay'
import { locales } from './locales'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'

// ─── Shell ───────────────────────────────────────────────────────────────────

export function Shell({ settings }: { settings: ThemeSettings }) {
  const theme = THEME_PRESETS[settings.theme]

  // Sync theme CSS vars to :root so body::before gradient picks them up
  useEffect(() => {
    const root = document.documentElement
    const isLight = settings.theme === 'lapis'

    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--accent-glow', theme.glow)
    const dimAlpha = theme.glow.replace(/[\d.]+\)$/, '0.15)')
    const softAlpha = theme.glow.replace(/[\d.]+\)$/, '0.08)')
    root.style.setProperty('--accent-dim', dimAlpha)
    root.style.setProperty('--accent-soft', softAlpha)

    // Light/dark adaptive tokens
    const navRgb = isLight ? '245,247,250' : '8,8,8'
    root.style.setProperty('--nav-gradient',    `linear-gradient(180deg, rgba(${navRgb},0.96) 0%, rgba(${navRgb},0) 100%)`)
    root.style.setProperty('--bg',              isLight ? '#f5f7fa'                    : '#080808')
    root.style.setProperty('--bg-elevated',     isLight ? '#eef2f8'                    : '#111111')
    root.style.setProperty('--bg-card',         isLight ? 'rgba(0,0,0,0.04)'          : 'rgba(255,255,255,0.035)')
    root.style.setProperty('--bg-card-hover',   isLight ? 'rgba(0,0,0,0.07)'          : 'rgba(255,255,255,0.065)')
    root.style.setProperty('--border',          isLight ? 'rgba(0,0,0,0.10)'          : 'rgba(255,255,255,0.08)')
    root.style.setProperty('--border-hover',    isLight ? 'rgba(0,0,0,0.22)'          : 'rgba(255,255,255,0.18)')
    root.style.setProperty('--text-primary',    isLight ? '#0d1117'                   : '#ffffff')
    root.style.setProperty('--text-secondary',  isLight ? 'rgba(0,0,0,0.60)'         : 'rgba(255,255,255,0.55)')
    root.style.setProperty('--text-tertiary',   isLight ? 'rgba(0,0,0,0.38)'         : 'rgba(255,255,255,0.30)')
    root.style.setProperty('--surface-nav',     isLight ? 'rgba(245,247,250,0.97)'   : 'rgba(10,10,10,0.97)')
    root.style.setProperty('--surface-dropdown',isLight ? 'rgba(255,255,255,0.99)'   : 'rgba(14,14,14,0.98)')
    root.style.setProperty('--shadow-dropdown', isLight ? '0 12px 48px rgba(0,0,0,0.15)' : '0 12px 48px rgba(0,0,0,0.7)')
    root.style.setProperty('--shadow-card',     isLight
      ? '0 2px 16px rgba(0,0,0,0.10), 0 0 0 1px var(--border)'
      : '0 2px 16px rgba(0,0,0,0.5),  0 0 0 1px var(--border)')

    root.classList.toggle('light-theme', isLight)
  }, [theme, settings.theme])

  return (
    <div
      className="relative min-h-screen"
      style={
        {
          color: 'var(--text-primary)',
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

      {/* Footer */}
      <footer
        className="relative z-10 flex items-center justify-center gap-4 py-6 px-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
          &copy; {new Date().getFullYear()} Baroflix
        </span>
        <span style={{ width: 1, height: 12, background: 'var(--border)', display: 'inline-block' }} />
        <Link
          to="/terms"
          className="no-bg-hover transition-colors"
          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
        >
          Terms &amp; Conditions
        </Link>
      </footer>
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
  const { profile, session, signOut } = useAuth()
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

  // ── Notification badge ──────────────────────────────────────
  const [notifCount, setNotifCount] = useState(0)

  const notifKey = session?.user?.id ? `baroflix_notif_seen_${session.user.id}` : null

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId || !notifKey) { setNotifCount(0); return }

    // Initialise the baseline timestamp on first visit so old events don't flood in
    let lastSeen = localStorage.getItem(notifKey)
    if (!lastSeen) {
      lastSeen = new Date().toISOString()
      localStorage.setItem(notifKey, lastSeen)
    }

    // Count unseen follows + profile comments
    Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true })
        .eq('following_id', userId).gt('created_at', lastSeen),
      supabase.from('profile_comments').select('*', { count: 'exact', head: true })
        .eq('profile_id', userId).gt('created_at', lastSeen),
    ]).then(([f, c]) => setNotifCount((f.count ?? 0) + (c.count ?? 0)))
      .catch(() => {})

    // Realtime: increment badge on new follow
    const ch1 = supabase.channel(`shell_notif_follows_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        () => setNotifCount(n => n + 1))
      .subscribe()

    // Realtime: increment badge on new profile comment
    const ch2 = supabase.channel(`shell_notif_comments_${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profile_comments', filter: `profile_id=eq.${userId}` },
        () => setNotifCount(n => n + 1))
      .subscribe()

    return () => {
      supabase.removeChannel(ch1)
      supabase.removeChannel(ch2)
    }
  }, [session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const clearNotifications = useCallback(() => {
    if (!notifKey) return
    localStorage.setItem(notifKey, new Date().toISOString())
    setNotifCount(0)
    // Tell the ActivityFeedPage to refresh its unread state
    window.dispatchEvent(new CustomEvent('baroflix:notif-cleared'))
  }, [notifKey])

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
          background: 'var(--nav-gradient)',
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
                  style={{ color: isActive(to) ? 'var(--text-primary)' : 'var(--text-secondary)' }}
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
              {/* Notification badge */}
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3, zIndex: 10,
                  minWidth: 17, height: 17, borderRadius: 999,
                  background: '#ef4444', border: '2px solid var(--bg, #080808)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 800, color: '#fff', padding: '0 3px',
                  pointerEvents: 'none',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
              <button
                onClick={() => { clearNotifications(); setProfileOpen(o => !o) }}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-colors"
                style={{
                  background: profile?.avatar_url ? 'transparent'
                    : profileOpen || isActive('/profile') || isActive('/user/') || isActive('/feed') || isActive('/collections') || isActive('/stats')
                      ? 'var(--accent-dim)' : 'var(--bg-card)',
                  border: `1px solid ${profileOpen || isActive('/profile') || isActive('/user/') || isActive('/feed') || isActive('/collections') || isActive('/stats')
                    ? 'var(--accent)' : 'var(--border)'}`,
                  color: 'var(--text-secondary)',
                  overflow: 'visible',
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
                      background: 'var(--surface-dropdown)',
                      border: '1px solid var(--border)',
                      backdropFilter: 'blur(24px)',
                      boxShadow: 'var(--shadow-dropdown)',
                    }}
                  >
                    {/* User info header */}
                    {profile?.username && (
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0">
                            <ProfileAvatar size="sm" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>@{profile.username}</div>
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
                          style={{ color: 'var(--text-secondary)' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
                        >
                          <Icon className="w-4 h-4 shrink-0 opacity-60" />
                          {label}
                        </Link>
                      ))}
                    </div>

                    {/* Sign out */}
                    <div className="py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors no-bg-hover"
                        style={{ color: 'var(--text-tertiary)' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)'; (e.currentTarget as HTMLElement).style.color = '#f87171' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-tertiary)' }}
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
              className="lg:hidden flex items-center justify-center w-9 h-9 rounded-full transition-colors"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
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
            background: 'var(--surface-nav)',
            backdropFilter: 'blur(20px)',
            borderLeft: '1px solid var(--border)',
          }}
        >
          {navLinks.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="text-base font-semibold transition-colors px-3 py-3 rounded-xl"
              style={{
                color: isActive(to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive(to) ? 'var(--bg-card)' : 'transparent',
              }}
            >
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div className="my-3" style={{ borderTop: '1px solid var(--border)' }} />

          {/* Profile section links */}
          {profileMenuItems.map(({ to, icon: Icon, label }) => (
            <Link
              key={to + label}
              to={to}
              className="flex items-center gap-3 text-base font-semibold transition-colors px-3 py-3 rounded-xl"
              style={{
                color: isActive(to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                background: isActive(to) ? 'var(--bg-card)' : 'transparent',
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
            style={{ color: 'var(--text-tertiary)', background: 'transparent' }}
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
