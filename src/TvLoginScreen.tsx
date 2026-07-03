import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Globe, CheckCircle, Loader2, AlertTriangle } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'

export function TvLoginScreen() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const { session, signInWithGoogle, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<'idle' | 'broadcasting' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!code || !session) return
    
    // User is logged in and we have a code. Let's broadcast!
    setStatus('broadcasting')
    const channel = supabase.channel(`tv-auth-${code}`)
    
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        channel.send({
          type: 'broadcast',
          event: 'login',
          payload: { 
            access_token: session.access_token, 
            refresh_token: session.refresh_token 
          },
        }).then(() => {
          setStatus('success')
        }).catch((err) => {
          setStatus('error')
          setErrorMsg(err.message)
        })
      }
    })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [code, session])

  if (!code) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <p>Invalid or missing TV code.</p>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', background: 'radial-gradient(ellipse at 60% 0%, rgba(var(--accent-rgb, 139,92,246),0.12) 0%, transparent 60%)' }}>
      <div style={{ width: '100%', maxWidth: 420, textAlign: 'center', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',  padding: '2rem', backdropFilter: 'blur(16px)' }}>
        
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', marginBottom: '1rem' }}>TV Login</h1>
        
        {authLoading ? (
          <Loader2 className="animate-spin" size={32} style={{ color: 'white', margin: '0 auto' }} />
        ) : !session ? (
          <>
            <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '2rem' }}>
              Sign in to connect your TV (Code: <strong>{code}</strong>)
            </p>
            <button
              onClick={signInWithGoogle}
              style={{ width: '100%', padding: '0.7rem',  border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 500, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem' }}
            >
              <Globe size={16} />
              Continue with Google
            </button>
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 1rem' }} />
            <p style={{ color: 'white', fontWeight: 600 }}>Successfully connected!</p>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginTop: '0.5rem' }}>You can now close this tab and return to your TV.</p>
          </>
        ) : status === 'error' ? (
          <>
             <AlertTriangle size={48} style={{ color: '#ef4444', margin: '0 auto 1rem' }} />
             <p style={{ color: '#fca5a5' }}>Failed to connect to TV: {errorMsg}</p>
          </>
        ) : (
          <>
            <Loader2 className="animate-spin" size={32} style={{ color: 'white', margin: '0 auto 1rem' }} />
            <p style={{ color: 'rgba(255,255,255,0.7)' }}>Connecting to your TV...</p>
          </>
        )}
      </div>
    </div>
  )
}
