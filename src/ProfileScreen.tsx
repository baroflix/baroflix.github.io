import { useState, type FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, User, Image, Save, CheckCircle, AlertTriangle, Palette, Languages, Monitor } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase, type Profile } from './lib/supabase'
import { THEME_PRESETS } from './hooks'
import type { ThemeId } from './hooks'

export function ProfileScreen() {
  const { session, profile: contextProfile, signOut, settings, updateSettings } = useAuth()

  const [username, setUsername] = useState(contextProfile?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(contextProfile?.avatar_url ?? '')
  const [saving, setSaving] = useState(false)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(contextProfile)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

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

  const displayName = savedProfile?.username || session.user.email?.split('@')[0] || 'User'
  const theme = THEME_PRESETS[settings.theme]

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4 mb-2">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Profile & Settings</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{session.user.email}</p>
          </div>
        </div>

        {/* Avatar preview */}
        <div
          className="flex items-center gap-5 p-5"
          style={{ borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '2px solid rgba(255,255,255,0.12)' }}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
            ) : (
              <User size={28} style={{ color: 'rgba(255,255,255,0.3)' }} />
            )}
          </div>
          <div>
            <div className="font-semibold text-white text-base">{displayName}</div>
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Member since{' '}
              {new Date(session.user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
            </div>
          </div>
        </div>

        {/* Status banners */}
        {status === 'success' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
            <CheckCircle size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: '#86efac' }}>Profile saved successfully.</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <AlertTriangle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
            <span className="text-sm" style={{ color: '#fca5a5' }}>{errorMsg}</span>
          </div>
        )}

        {/* Profile form */}
        <form onSubmit={handleSave} className="flex flex-col gap-4 p-5"
          style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <label htmlFor="profile-username" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <User size={13} /> Username
            </label>
            <input id="profile-username" type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter a display name" maxLength={50}
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label htmlFor="profile-avatar" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Image size={13} /> Avatar URL
            </label>
            <input id="profile-avatar" type="url" value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, boxSizing: 'border-box' }} />
          </div>

          <button id="profile-save-btn" type="submit" disabled={saving}
            className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: 'var(--accent)', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Save size={15} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        {/* ── Theme ──────────────────────────────────────────────────────────── */}
        <section className="p-5" style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Live preview strip */}
          <div className="flex items-center gap-3 mb-5 p-3 rounded-xl"
            style={{
              background: theme.glow.replace(/0\.(35|30|28)/, '0.10'),
              border: `1px solid ${theme.glow.replace(/0\.(35|30|28)/, '0.18')}`,
            }}>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0"
              style={{ background: theme.glow.replace(/0\.(35|30|28)/, '0.15'), color: theme.accent }}>
              <Monitor className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Palette className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
                Theme
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Active: <span style={{ color: theme.accent }}>{theme.label}</span>
              </div>
            </div>
            <div className="w-6 h-6 rounded-full shrink-0 animate-pulse-glow"
              style={{ background: theme.accent, boxShadow: `0 0 12px ${theme.glow}` }} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(THEME_PRESETS).map(([id, preset]) => {
              const isActive = settings.theme === id
              return (
                <button key={id} type="button" onClick={() => updateSettings({ theme: id as ThemeId })}
                  className="text-left p-4 transition-all"
                  style={{
                    borderRadius: 14,
                    background: isActive ? preset.glow.replace(/0\.(35|30|28)/, '0.10') : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? preset.glow.replace(/0\.(35|30|28)/, '0.38') : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isActive ? `0 0 24px ${preset.glow}` : 'none',
                  }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-white">{preset.label}</span>
                    {isActive && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ background: preset.glow.replace(/0\.(35|30|28)/, '0.15'), color: preset.accent }}>
                        Active
                      </span>
                    )}
                  </div>
                  <div className="h-2 rounded-full" style={{ background: preset.accent }} />
                  <div className="h-1 rounded-full mt-1.5 opacity-40" style={{ background: preset.glow }} />
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Language ───────────────────────────────────────────────────────── */}
        <section className="p-5" style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Languages className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold text-white">Language</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {(['en', 'pl'] as const).map(lang => {
              const isActive = settings.language === lang
              return (
                <button key={lang} type="button" onClick={() => updateSettings({ language: lang })}
                  className="p-4 text-left transition-all"
                  style={{
                    borderRadius: 14,
                    background: isActive ? theme.glow.replace(/0\.(35|30|28)/, '0.10') : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? theme.accent + '60' : 'rgba(255,255,255,0.08)'}`,
                    boxShadow: isActive ? `0 0 24px ${theme.glow}` : 'none',
                  }}>
                  <div className="font-semibold text-white">{lang === 'en' ? 'English' : 'Polski'}</div>
                </button>
              )
            })}
          </div>
        </section>

        {/* Sign out */}
        <button id="profile-signout-btn" type="button" onClick={() => signOut()}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.07)',
            color: '#fca5a5',
            cursor: 'pointer',
          }}>
          Sign out
        </button>

      </div>
    </div>
  )
}
