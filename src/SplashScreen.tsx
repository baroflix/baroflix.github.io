import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocalStorageState, STORAGE_KEYS, defaultSettings, THEME_PRESETS } from './hooks'

// ─────────────────────────────────────────────────────────────
// SplashScreen
//
// Shown once per browser session on first load.
// Uses sessionStorage so it only fires on the very first page
// visit — subsequent navigations within the same tab skip it.
// ─────────────────────────────────────────────────────────────

const SESSION_KEY = 'baroflix.splash_shown'

export const CATALOGUE_PHRASES = [
  "your private catalogue",
  "your personal theater",
  "your digital library",
  "your entertainment hub",
  "your streaming vault",
  "your exclusive cinema",
  "your ultimate watchlist",
  "your media collection",
  "your binge-watching sanctuary",
  "your cinematic universe"
];

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [settings] = useLocalStorageState(STORAGE_KEYS.settings, defaultSettings)
  const theme = THEME_PRESETS[settings.theme] || THEME_PRESETS['scarlet']
  
  const [phrase] = useState(() => CATALOGUE_PHRASES[Math.floor(Math.random() * CATALOGUE_PHRASES.length)]);
  const [visible, setVisible] = useState(() => {
    // Don't show during hot-module reload in dev
    try {
      return !window.sessionStorage.getItem(SESSION_KEY)
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!visible) return

    // Mark as shown so it won't appear again this tab session
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1')
    } catch { }

    // Auto-dismiss after 2.6 s total (logo fades in for 0.9 s, holds, then exit)
    const timer = window.setTimeout(() => setVisible(false), 2600)
    return () => window.clearTimeout(timer)
  }, [visible])

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: 'easeInOut' }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#080808',
              gap: '1.25rem',
            }}
          >
            {/* Radial ambient glow behind the logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: 'absolute',
                width: 480,
                height: 480,
                borderRadius: '50%',
                background: `radial-gradient(circle, ${theme.glow.replace(/0\.(35|30|28)/, '0.18')} 0%, transparent 70%)`,
                filter: 'blur(40px)',
                pointerEvents: 'none',
              }}
            />

            {/* Logo text */}
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.88 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
              style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 0 }}
            >
              <span style={{
                fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace",
                fontWeight: 700,
                fontSize: 'min(13vw, 72px)',
                letterSpacing: '-0.04em',
                color: '#ffffff',
                lineHeight: 1,
              }}>baro</span>
              <span style={{
                fontFamily: "'Geist Pixel', monospace",
                fontSize: 'min(13vw, 72px)',
                color: theme.accent,
                lineHeight: 1,
              }}>flix</span>
            </motion.div>

            {/* Animated underline bar */}
            <motion.div
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
              style={{
                height: 2,
                width: 64,
                background: theme.accent,
                transformOrigin: 'left',
                position: 'relative',
              }}
            />

            {/* Subtle tagline */}
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 0.45, y: 0 }}
              transition={{ duration: 0.6, delay: 0.65 }}
              style={{
                fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace",
                fontSize: '0.7rem',
                letterSpacing: '0.2em',
                color: 'white',
                textTransform: 'uppercase',
                position: 'relative',
              }}
            >
              {phrase.charAt(0).toUpperCase() + phrase.slice(1)}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App content renders underneath immediately so it's ready when splash exits */}
      {children}
    </>
  )
}
