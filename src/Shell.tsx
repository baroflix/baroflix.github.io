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
    root.style.setProperty('--text-ghost',      isLight ? 'rgba(0,0,0,0.08)'  : 'rgba(255,255,255,0.06)')

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
      <main className="relative z-10 pb-[env(safe-area-inset-bottom,0px)] page-content">
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
          {locales[settings.language ?? 'en'].shell.termsAndConditions}
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
  const ts = locales[lang].shell
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
    { to: profile?.username ? `/user/${profile.username}` : '/profile', icon: User, label: ts.myProfile },
    { to: '/feed', icon: Activity, label: ts.activityFeed },
    { to: '/collections', icon: Library, label: ts.myCollection },
    { to: '/stats', icon: BarChart2, label: ts.myStats },
    { to: '/profile', icon: Settings, label: ts.settings },
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
          width: dim, height: dim, flexShrink: 0,
          background: 'var(--accent-dim)', border: '1px solid var(--accent)',
          color: 'var(--accent)', fontSize, fontWeight: 700, lineHeight: 1,
          fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace",
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
            <Link to="/" className="no-bg-hover shrink-0 flex items-baseline gap-0" aria-label="Baroflix home">
              <span style={{ fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace", fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.04em', color: 'var(--text-primary)', lineHeight: 1 }}>baro</span>
              <span className="font-pixel" style={{ fontSize: '1.3rem', color: 'var(--accent)', lineHeight: 1 }}>flix</span>
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
                className="hidden lg:flex items-center justify-center px-4 h-9 text-sm font-bold text-white transition-all hover:brightness-110 mr-2"
                style={{ background: 'var(--accent)' }}
              >
                {t.downloadApp}
              </Link>
            )}
            {/* Discord */}
            <a
              href="https://discord.gg/zx7PUSt3uN"
              target="_blank"
              rel="noreferrer"
              aria-label="Discord"
              className="flex items-center justify-center w-9 h-9 transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
            {/* GitHub */}
            <a
              href="https://github.com/baroflix/"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub"
              className="flex items-center justify-center w-9 h-9 transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
              </svg>
            </a>
            {/* Search — always visible */}
            <HomeSearchToggle />
            {/* Profile dropdown — desktop only */}
            <div ref={profileRef} className="hidden lg:block relative">
              {/* Notification badge */}
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: -3, right: -3, zIndex: 10,
                  minWidth: 17, height: 17,
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
                className="flex items-center justify-center w-9 h-9 transition-colors"
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
                    className="absolute right-0 top-full mt-2 w-52 overflow-hidden z-[60]"
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
                        {ts.signOut}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden flex items-center justify-center w-9 h-9 transition-colors"
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
              className="text-base font-semibold transition-colors px-3 py-3"
              style={{
                color: isActive(to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: isActive(to) ? '2px solid var(--accent)' : '2px solid transparent',
                paddingLeft: 12,
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
              className="flex items-center gap-3 text-base font-semibold transition-colors px-3 py-3"
              style={{
                color: isActive(to) ? 'var(--text-primary)' : 'var(--text-secondary)',
                borderLeft: isActive(to) ? '2px solid var(--accent)' : '2px solid transparent',
                paddingLeft: 12,
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
            className="flex items-center gap-3 text-base font-semibold transition-colors px-3 py-3 w-full"
            style={{ color: 'var(--text-tertiary)', background: 'transparent', borderLeft: '2px solid transparent' }}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {ts.signOut}
          </button>

          {!isElectron && (
            <Link
              to="/download"
              className="mt-4 flex items-center justify-center px-4 h-11 text-sm font-bold text-white transition-all hover:brightness-110"
              style={{ background: 'var(--accent)' }}
            >
              {t.downloadApp}
            </Link>
          )}
        </nav>
      </div>

    </>
  )
}
