import { useState, type FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, User, Image, Save, CheckCircle, AlertTriangle } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase, type Profile } from './lib/supabase'

// ─────────────────────────────────────────────────────────────
// ProfileScreen
// Lets the signed-in user view and update their username and
// avatar URL. Saves to public.profiles via upsert.
// ─────────────────────────────────────────────────────────────
export function ProfileScreen() {
  const { session, profile: contextProfile, signOut } = useAuth()

  const [username, setUsername] = useState(contextProfile?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(contextProfile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(contextProfile)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Sync form if context profile loads after mount
  useEffect(() => {
    if (contextProfile) {
      setUsername(contextProfile.username ?? '')
      setAvatarUrl(contextProfile.avatar_url ?? '')
      setSavedProfile(contextProfile)
    }
  }, [contextProfile])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setStatus('idle')

    const { data, error } = await supabase
      .from('profiles')
      .update({
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id)
      .select()
      .single()

    setSaving(false)

    if (error) {
      setStatus('error')
      setErrorMsg(error.message)
    } else {
      setStatus('success')
      setSavedProfile(data as Profile)
      // Auto-clear success banner
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>Not signed in.</p>
      </div>
    )
  }

  const displayName =
    savedProfile?.username || session.user.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)',
              textDecoration: 'none',
              flexShrink: 0,
            }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'white', margin: 0, letterSpacing: '-0.03em' }}>
              Profile
            </h1>
            <p style={{ margin: 0, marginTop: 2, fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
              {session.user.email}
            </p>
          </div>
        </div>

        {/* Avatar preview */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1.25rem',
            marginBottom: '2rem',
            padding: '1.25rem',
            borderRadius: 16,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.12)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.display = 'none'
                }}
              />
            ) : (
              <User size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, color: 'white', fontSize: '1rem' }}>{displayName}</div>
            <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              Member since{' '}
              {new Date(session.user.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
              })}
            </div>
          </div>
        </div>

        {/* Status banners */}
        {status === 'success' && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: 'rgba(34,197,94,0.1)',
              border: '1px solid rgba(34,197,94,0.3)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <CheckCircle size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
            <span style={{ color: '#86efac', fontSize: '0.85rem' }}>Profile saved successfully.</span>
          </div>
        )}
        {status === 'error' && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem 1rem',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <AlertTriangle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
            <span style={{ color: '#fca5a5', fontSize: '0.85rem' }}>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form
          onSubmit={handleSave}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '1.5rem',
            borderRadius: 20,
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Username */}
          <div>
            <label
              htmlFor="profile-username"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem' }}
            >
              <User size={13} />
              Username
            </label>
            <input
              id="profile-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a display name"
              maxLength={50}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Avatar URL */}
          <div>
            <label
              htmlFor="profile-avatar"
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '0.4rem' }}
            >
              <Image size={13} />
              Avatar URL
            </label>
            <input
              id="profile-avatar"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                color: 'white',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            id="profile-save-btn"
            type="submit"
            disabled={saving}
            style={{
              marginTop: '0.25rem',
              padding: '0.65rem',
              borderRadius: 10,
              border: 'none',
              background: 'var(--accent, #8b5cf6)',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              transition: 'opacity 0.2s',
            }}
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        {/* Sign out */}
        <button
          id="profile-signout-btn"
          type="button"
          onClick={() => signOut()}
          style={{
            marginTop: '1rem',
            width: '100%',
            padding: '0.65rem',
            borderRadius: 10,
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.07)',
            color: '#fca5a5',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'background 0.2s',
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
