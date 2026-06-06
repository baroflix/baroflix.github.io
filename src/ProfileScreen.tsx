import { useState, type FormEvent, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, User, Image, Save, CheckCircle, AlertTriangle,
  Palette, Languages, Monitor, Globe, FileText, Pin, X, Eye, EyeOff,
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase, type Profile, type PinnedItem } from './lib/supabase'
import { THEME_PRESETS, STORAGE_KEYS } from './hooks'
import type { ThemeId, WatchHistoryEntry } from './hooks'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

export function ProfileScreen() {
  const { session, profile: contextProfile, signOut, settings, updateSettings } = useAuth()

  const [username, setUsername] = useState(contextProfile?.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(contextProfile?.avatar_url ?? '')
  const [fullName, setFullName] = useState(contextProfile?.full_name ?? '')
  const [country, setCountry] = useState(contextProfile?.country ?? '')
  const [bannerUrl, setBannerUrl] = useState(contextProfile?.banner_url ?? '')
  const [bio, setBio] = useState(contextProfile?.bio ?? '')
  const [isPublic, setIsPublic] = useState<boolean>(contextProfile?.is_public ?? true)
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>(contextProfile?.pinned_items ?? [])

  const [saving, setSaving] = useState(false)
  const [savedProfile, setSavedProfile] = useState<Profile | null>(contextProfile)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const [recentHistory, setRecentHistory] = useState<WatchHistoryEntry[]>([])

  // Load recent watch history for pinning
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.history)
      if (raw) {
        const hist = JSON.parse(raw) as WatchHistoryEntry[]
        const sorted = [...hist].sort((a, b) => (b.watchedAt || 0) - (a.watchedAt || 0))
        setRecentHistory(sorted.slice(0, 12))
      }
    } catch {}
  }, [])

  // Sync from context (on login or external change)
  useEffect(() => {
    if (contextProfile) {
      setUsername(contextProfile.username ?? '')
      setAvatarUrl(contextProfile.avatar_url ?? '')
      setFullName(contextProfile.full_name ?? '')
      setCountry(contextProfile.country ?? '')
      setBannerUrl(contextProfile.banner_url ?? '')
      setBio(contextProfile.bio ?? '')
      setIsPublic(contextProfile.is_public ?? true)
      setPinnedItems(contextProfile.pinned_items ?? [])
      setSavedProfile(contextProfile)
    }
  }, [contextProfile])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!session) return
    setSaving(true)
    setStatus('idle')

    const updates: Record<string, unknown> = {
      username: username.trim() || null,
      avatar_url: avatarUrl.trim() || null,
      full_name: fullName.trim() || null,
      country: country.trim() || null,
      banner_url: bannerUrl.trim() || null,
      bio: bio.trim() || null,
      is_public: isPublic,
      pinned_items: pinnedItems,
      updated_at: new Date().toISOString(),
    }

    // Set created_at on first save (uses auth join date)
    if (!savedProfile?.created_at) {
      updates.created_at = session.user.created_at
    }

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
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

  // Pin helpers
  function pinKey(item: { mediaType: string; id: number }) {
    return `${item.mediaType}-${item.id}`
  }
  function isPinned(item: { mediaType: string; id: number }) {
    return pinnedItems.some(p => pinKey(p) === pinKey(item))
  }
  function togglePin(item: WatchHistoryEntry) {
    if (isPinned(item)) {
      setPinnedItems(prev => prev.filter(p => pinKey(p) !== pinKey(item)))
    } else if (pinnedItems.length < 4) {
      const next: PinnedItem = {
        mediaType: item.mediaType as 'movie' | 'tv' | 'anime',
        id: item.id,
        title: item.title,
        posterPath: item.posterPath ?? null,
      }
      setPinnedItems(prev => [...prev, next])
    }
  }
  function removePin(item: PinnedItem) {
    setPinnedItems(prev => prev.filter(p => pinKey(p) !== pinKey(item)))
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

  // Items not already pinned that can be added
  const unpinnedHistory = recentHistory.filter(h => !isPinned(h))

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
            {savedProfile?.username && (
              <Link
                to={`/user/${savedProfile.username}`}
                className="text-xs mt-0.5 inline-flex items-center gap-1"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                View public profile →
              </Link>
            )}
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

        {/* ── Basic profile form ─────────────────────────────────────────── */}
        <form onSubmit={handleSave} className="flex flex-col gap-4 p-5"
          style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Username */}
          <div>
            <label htmlFor="profile-username" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <User size={13} /> Username
            </label>
            <input id="profile-username" type="text" value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. bartlomiej" maxLength={50}
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
          </div>

          {/* Full name */}
          <div>
            <label htmlFor="profile-fullname" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <User size={13} /> Full Name
            </label>
            <input id="profile-fullname" type="text" value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name (optional)" maxLength={80}
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
          </div>

          {/* Country */}
          <div>
            <label htmlFor="profile-country" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Globe size={13} /> Country <span style={{ color: 'rgba(255,255,255,0.3)' }}>(2-letter code, e.g. PL, US)</span>
            </label>
            <input id="profile-country" type="text" value={country}
              onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="PL" maxLength={2}
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
          </div>

          {/* Avatar URL */}
          <div>
            <label htmlFor="profile-avatar" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Image size={13} /> Avatar URL
            </label>
            <input id="profile-avatar" type="url" value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
          </div>

          {/* Banner URL */}
          <div>
            <label htmlFor="profile-banner" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <Image size={13} /> Banner Image URL
            </label>
            <input id="profile-banner" type="url" value={bannerUrl}
              onChange={(e) => setBannerUrl(e.target.value)}
              placeholder="https://… (wide banner image)"
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="profile-bio" className="flex items-center gap-1.5 text-xs mb-1.5"
              style={{ color: 'rgba(255,255,255,0.5)' }}>
              <FileText size={13} /> About me
            </label>
            <textarea id="profile-bio" value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people a bit about yourself…" maxLength={500} rows={3}
              className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors resize-none"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontFamily: 'inherit' }} />
            <p className="text-right mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{bio.length}/500</p>
          </div>

          {/* Public toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                {isPublic ? <Eye size={14} style={{ color: 'var(--accent)' }} /> : <EyeOff size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                Public profile
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {isPublic ? 'Visible to other users' : 'Only visible to you'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsPublic(v => !v)}
              className="no-bg-hover"
              style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: isPublic ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'background 0.2s',
              }}
            >
              <div
                style={{
                  position: 'absolute', top: 3,
                  left: isPublic ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#fff',
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>

          <button id="profile-save-btn" type="submit" disabled={saving}
            className="flex items-center justify-center gap-2 mt-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{ background: 'var(--accent)', opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Save size={15} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>

        {/* ── Pinned Favorites ──────────────────────────────────────────── */}
        <section className="p-5" style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Pin size={15} style={{ color: 'var(--accent)' }} />
            <h2 className="text-base font-semibold text-white">Pinned Favorites</h2>
            <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {pinnedItems.length}/4
            </span>
          </div>
          <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Showcase up to 4 titles on your public profile. Pick from your recent history below.
          </p>

          {/* Current pins */}
          {pinnedItems.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-5">
              {pinnedItems.map(item => (
                <div key={`${item.mediaType}-${item.id}`} style={{ position: 'relative' }}>
                  <div style={{
                    aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden',
                    background: 'rgba(255,255,255,0.06)',
                  }}>
                    {item.posterPath ? (
                      <img src={`${POSTER_BASE}${item.posterPath}`} alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <User size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removePin(item)}
                    title={`Unpin "${item.title}"`}
                    style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.75)', border: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#fff', padding: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                  <p style={{
                    margin: '3px 0 0', fontSize: 10, color: 'rgba(255,255,255,0.5)',
                    textAlign: 'center', lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {item.title}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* History candidates */}
          {pinnedItems.length < 4 && unpinnedHistory.length > 0 && (
            <>
              <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Add from recent history:
              </p>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                {unpinnedHistory.map(item => (
                  <button
                    key={`${item.mediaType}-${item.id}`}
                    type="button"
                    onClick={() => togglePin(item)}
                    title={`Pin "${item.title}"`}
                    style={{
                      flexShrink: 0, width: 52,
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: 0, textAlign: 'center',
                      opacity: pinnedItems.length >= 4 ? 0.4 : 1,
                    }}
                    disabled={pinnedItems.length >= 4}
                  >
                    <div style={{
                      aspectRatio: '2/3', borderRadius: 6, overflow: 'hidden',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      marginBottom: 3,
                    }}>
                      {item.posterPath ? (
                        <img src={`${POSTER_BASE}${item.posterPath}`} alt={item.title}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <User size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
                        </div>
                      )}
                    </div>
                    <p style={{
                      margin: 0, fontSize: 9, color: 'rgba(255,255,255,0.5)',
                      lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {item.title}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {pinnedItems.length === 0 && unpinnedHistory.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Watch some titles first, then come back to pin your favorites.
            </p>
          )}

          {pinnedItems.length > 0 && (
            <p className="text-xs mt-3 text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Don't forget to click <strong>Save changes</strong> above to apply.
            </p>
          )}
        </section>

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
