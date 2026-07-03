import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { Globe, AlertTriangle } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { CATALOGUE_PHRASES } from './SplashScreen'
import { Capacitor } from '@capacitor/core'
import { QRCodeSVG } from 'qrcode.react'
import { supabase } from './lib/supabase'

// ─────────────────────────────────────────────────────────────
// AuthScreen
// Matches the existing dark/glassmorphism design language.
// ─────────────────────────────────────────────────────────────
export function AuthScreen() {
  const { session, signInWithGoogle, authError, clearAuthError } = useAuth()

  const [phrase] = useState(() => CATALOGUE_PHRASES[Math.floor(Math.random() * CATALOGUE_PHRASES.length)])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tvCode, setTvCode] = useState('')
  const [tvConnected, setTvConnected] = useState(false)

  const isTv = Capacitor.isNativePlatform()
  // Capacitor runs on http://localhost, so we need the actual deployed URL (or PC's local IP for testing)
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://YOUR_WEBSITE.com'

  useEffect(() => {
    clearAuthError()
    return () => {
      clearAuthError()
    }
  }, [clearAuthError])

  useEffect(() => {
    if (!isTv) return
    
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    setTvCode(code)

    const channel = supabase.channel(`tv-auth-${code}`)
    channel.on('broadcast', { event: 'login' }, async (payload) => {
      if (payload.payload?.access_token && payload.payload?.refresh_token) {
        setTvConnected(true)
        setLoading(true)
        const { error } = await supabase.auth.setSession({ 
          access_token: payload.payload.access_token, 
          refresh_token: payload.payload.refresh_token 
        })
        if (error) {
           setError(error.message)
           setTvConnected(false)
           setLoading(false)
        }
      }
    }).subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isTv])

  async function handleGoogle() {
    setError(null)
    clearAuthError()
    setLoading(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.')
      setLoading(false)
    }
  }

  const displayError = error || authError
  const isAccessDenied = displayError?.includes('Access Denied')

  // Redirect to home if the user is already logged in
  if (session) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        background: 'radial-gradient(ellipse at 60% 0%, rgba(var(--accent-rgb, 139,92,246),0.12) 0%, transparent 60%)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0, marginBottom: '0.75rem' }}>
            <span style={{ fontFamily: "'Geist Mono Variable', 'Geist Mono', monospace", fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>baro</span>
            <span style={{ fontFamily: "'Geist Pixel', monospace", fontSize: '2rem', color: 'var(--accent)', lineHeight: 1 }}>flix</span>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' }}>
            Sign in to access {phrase}
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            padding: '2rem',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Error banner */}
          {displayError && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.875rem 1rem',
                background: isAccessDenied
                  ? 'rgba(239,68,68,0.12)'
                  : 'rgba(239,68,68,0.08)',
                border: `1px solid ${isAccessDenied ? 'rgba(239,68,68,0.5)' : 'rgba(239,68,68,0.25)'}`,
                borderLeft: `3px solid #ef4444`,
                display: 'flex',
                gap: '0.625rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle
                size={16}
                style={{ color: '#f87171', marginTop: 2, flexShrink: 0 }}
              />
              <p style={{ color: '#fca5a5', fontSize: '0.85rem', margin: 0, lineHeight: 1.5 }}>
                {displayError}
              </p>
            </div>
          )}



          {/* TV OR Web Display */}
          {isTv ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ color: 'white', marginBottom: '1.5rem', fontWeight: 600 }}>Scan to sign in</p>
              
              <div style={{ background: 'white', padding: '1rem', borderRadius: '1rem', display: 'inline-block', marginBottom: '1.5rem' }}>
                <QRCodeSVG 
                  value={`${siteUrl}/tv-login?code=${tvCode}`}
                  size={180}
                />
              </div>
              
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>
                Or visit <strong style={{color:'white'}}>{siteUrl.replace(/^https?:\/\//, '')}/tv-login</strong><br/>
                and enter code <strong style={{color:'white', letterSpacing: 2}}>{tvCode}</strong>
              </p>

              {tvConnected && (
                 <p style={{ color: '#10b981', marginTop: '1rem', fontWeight: 'bold' }}>Connecting...</p>
              )}
            </div>
          ) : (
            <button
              id="auth-submit-google"
              type="button"
              disabled={loading}
              onClick={handleGoogle}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.625rem',
                transition: 'background 0.15s',
                fontFamily: "'Geist Variable', system-ui, sans-serif",
              }}
            >
              <Globe size={16} />
              Continue with Google
            </button>
          )}
        </div>

        <p
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: 'rgba(255,255,255,0.25)',
          }}
        >
          Access is restricted to invited users only.
        </p>
      </div>
    </div>
  )
}
