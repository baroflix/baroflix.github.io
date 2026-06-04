import { Link, useLocation, Outlet } from 'react-router-dom'
import { Settings as SettingsIcon, User, Menu, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { THEME_PRESETS, useScrollDirection } from './hooks'
import type { ThemeSettings } from './hooks'
import { HomeSearchToggle } from './SearchOverlay'
import { locales } from './locales'

// ─── Shell ───────────────────────────────────────────────────────────────────

export function Shell({ settings }: { settings: ThemeSettings }) {
  const theme = THEME_PRESETS[settings.theme]
  const location = useLocation()
  const isHome = location.pathname === '/'

  // Sync theme CSS vars to :root so body::before gradient picks them up
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--accent-glow', theme.glow)
    const dimAlpha = theme.glow.replace(/[\d.]+\)$/, '0.15)')
    const softAlpha = theme.glow.replace(/[\d.]+\)$/, '0.08)')
    root.style.setProperty('--accent-dim', dimAlpha)
    root.style.setProperty('--accent-soft', softAlpha)
  }, [theme])

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
      {!isHome && <NavBar language={settings.language} />}
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
  const location = useLocation()
  const lang = language || 'en'
  const t = locales[lang].nav
  const isElectron = /electron/i.test(navigator.userAgent)

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  const navLinks = [
    { to: '/', label: t.home },
    { to: '/browse', label: t.browse },
    { to: '/sports', label: t.sports },
    { to: '/collections', label: t.collections },
    { to: '/coming-soon', label: t.comingSoon },
    { to: '/stats', label: t.stats },
  ]

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-transform duration-300"
        style={{
          transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
          background: 'linear-gradient(180deg, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.0) 100%)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 sm:px-6 py-4 sm:py-6 gap-4">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <Link to="/" className="no-bg-hover shrink-0">
              <img
                  src="/1x/Asset 1.webp"
                  alt="Baroflix"
                  className="block h-10 w-auto"
              />
            </Link>

            {/* Left nav — desktop */}
            <nav className="hidden lg:flex items-center gap-6">
              {navLinks.map(({ to, label }) => (
                <Link key={to} to={to} className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
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
                className="hidden lg:flex items-center justify-center px-4 h-10 rounded-full text-sm font-bold text-white transition-all hover:brightness-110 mr-2"
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
            {/* Settings + Profile — desktop only */}
            <div className="hidden lg:flex items-center gap-2">
              <Link
                to="/settings"
                className="flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                aria-label="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
              <Link
                to="/profile"
                className="flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white transition-colors"
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                aria-label="Profile"
              >
                <User className="w-4 h-4" />
              </Link>
            </div>

            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white transition-colors"
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
          className="absolute top-0 right-0 h-full w-72 flex flex-col pt-24 pb-8 px-6 gap-1 transition-transform duration-300"
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
              className="text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
            >
              {label}
            </Link>
          ))}

          {/* Divider */}
          <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

          {/* Settings */}
          <Link
            to="/settings"
            className="flex items-center gap-3 text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
          >
            <SettingsIcon className="w-4 h-4 shrink-0" />
            Settings
          </Link>

          {/* Profile */}
          <Link
            to="/profile"
            className="flex items-center gap-3 text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
          >
            <User className="w-4 h-4 shrink-0" />
            Profile
          </Link>

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
