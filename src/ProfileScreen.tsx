import { useState, type FormEvent, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, User, Image, Save, CheckCircle, AlertTriangle,
  Palette, Languages, Monitor, Globe, FileText, Pin, X, Eye, EyeOff, Trophy,
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase, type Profile, type PinnedItem } from './lib/supabase'
import { checkAndAwardMilestones } from './lib/milestones'
import { THEME_PRESETS, STORAGE_KEYS } from './hooks'
import type { ThemeId, WatchHistoryEntry } from './hooks'
import { locales } from './locales'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

export function ProfileScreen() {
  const { session, profile: contextProfile, signOut, settings, updateSettings } = useAuth()
  const lang = settings.language ?? 'en'
  const t = locales[lang].profile
  const ts = locales[lang].settings

  const [activeTab, setActiveTab] = useState<'general' | 'profile'>('profile')

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

  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle')
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [recentHistory, setRecentHistory] = useState<WatchHistoryEntry[]>([])

  const [milestoneStatus, setMilestoneStatus] = useState<'idle' | 'running' | 'done'>('idle')
  const [newBadgeCount, setNewBadgeCount] = useState(0)

  async function handleRecalculateMilestones() {
    if (!session?.user?.id || !contextProfile) return
    setMilestoneStatus('running')
    setNewBadgeCount(0)
    try {
      const hist = contextProfile.watch_history ?? []
      const prog = contextProfile.watch_progress ?? {}
      // Fetch current badges fresh from DB so we don't re-award ones just added
      const { data: currentBadges } = await supabase
        .from('user_badges')
        .select('id, user_id, badge_type, awarded_at')
        .eq('user_id', session.user.id)
      const awarded = await checkAndAwardMilestones(
        session.user.id,
        hist,
        prog,
        currentBadges ?? [],
      )
      setNewBadgeCount(awarded.length)
    } catch (err) {
      console.error('[milestones] recalculate failed:', err)
    }
    setMilestoneStatus('done')
    setTimeout(() => setMilestoneStatus('idle'), 4000)
  }

  useEffect(() => {
    const trimmed = username.trim()
    if (trimmed === (savedProfile?.username ?? '') || trimmed.length < 2) {
      setUsernameStatus('idle')
      return
    }
    setUsernameStatus('checking')
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current)
    usernameCheckTimer.current = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', trimmed)
        .neq('id', session?.user?.id ?? '')
        .maybeSingle()
      setUsernameStatus(data ? 'taken' : 'available')
    }, 700)
    return () => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current)
    }
  }, [username, savedProfile?.username, session?.user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (error.code === '23505' || error.message?.includes('duplicate key') || error.message?.includes('unique')) {
        setErrorMsg(t.status.usernameTaken)
      } else {
        setErrorMsg(error.message)
      }
    } else {
      setStatus('success')
      setSavedProfile(data as Profile)
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

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
        <p style={{ color: 'rgba(255,255,255,0.4)' }}>{t.notSignedIn}</p>
      </div>
    )
  }

  const displayName = savedProfile?.username || session.user.email?.split('@')[0] || 'User'
  const theme = THEME_PRESETS[settings.theme]
  const unpinnedHistory = recentHistory.filter(h => !isPinned(h))

  // ── Tab styles ──────────────────────────────────────────────────────────────
  function tabStyle(tab: 'general' | 'profile') {
    const active = activeTab === tab
    return {
      flex: 1,
      padding: '8px 0',
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      border: 'none',
      cursor: 'pointer',
      transition: 'all 0.18s',
      background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
      color: active ? '#fff' : 'rgba(255,255,255,0.4)',
    } as React.CSSProperties
  }

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6 pb-16">
      <div className="max-w-lg mx-auto space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-2">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-full transition-colors shrink-0"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">{t.title}</h1>
            <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{session.user.email}</p>
          </div>
        </div>

        {/* ── Avatar card ─────────────────────────────────────────────────── */}
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
              {t.memberSince}{' '}
              {new Date(session.user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })}
            </div>
            {savedProfile?.username && (
              <Link
                to={`/user/${savedProfile.username}`}
                className="text-xs mt-0.5 inline-flex items-center gap-1"
                style={{ color: 'var(--accent)', textDecoration: 'none' }}
              >
                {t.viewPublicProfile}
              </Link>
            )}
          </div>
        </div>

        {/* ── Tab switcher ────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', gap: 4, padding: 4, borderRadius: 14,
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <button type="button" style={tabStyle('general')} onClick={() => setActiveTab('general')}>
            {t.tabs.general}
          </button>
          <button type="button" style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>
            {t.tabs.profile}
          </button>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GENERAL TAB — theme + language (instant apply, no save needed)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'general' && (
          <>
            {/* Theme */}
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
                    {ts.themePreset}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {ts.activeTheme}: <span style={{ color: theme.accent }}>{theme.label}</span>
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
                            {t.general.active}
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

            {/* Language */}
            <section className="p-5" style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Languages className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">{ts.language}</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['en', 'pl'] as const).map(l => {
                  const isActive = settings.language === l
                  return (
                    <button key={l} type="button" onClick={() => updateSettings({ language: l })}
                      className="p-4 text-left transition-all"
                      style={{
                        borderRadius: 14,
                        background: isActive ? theme.glow.replace(/0\.(35|30|28)/, '0.10') : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? theme.accent + '60' : 'rgba(255,255,255,0.08)'}`,
                        boxShadow: isActive ? `0 0 24px ${theme.glow}` : 'none',
                      }}>
                      <div className="font-semibold text-white">{l === 'en' ? 'English' : 'Polski'}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PROFILE TAB — all profile settings + save button at bottom
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSave} className="flex flex-col gap-5">

            {/* Status banners */}
            {status === 'success' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <CheckCircle size={15} style={{ color: '#4ade80', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: '#86efac' }}>{t.status.saved}</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <AlertTriangle size={15} style={{ color: '#f87171', flexShrink: 0 }} />
                <span className="text-sm" style={{ color: '#fca5a5' }}>{errorMsg}</span>
              </div>
            )}

            {/* ── Profile fields ──────────────────────────────────────────── */}
            <section className="flex flex-col gap-4 p-5"
              style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

              {/* Username */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="profile-username" className="flex items-center gap-1.5 text-xs"
                    style={{ color: 'rgba(255,255,255,0.5)' }}>
                    <User size={13} /> {t.form.username}
                  </label>
                  {usernameStatus === 'checking' && (
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{t.form.usernameChecking}</span>
                  )}
                  {usernameStatus === 'available' && (
                    <span className="text-xs font-semibold" style={{ color: '#4ade80' }}>{t.form.usernameAvailable}</span>
                  )}
                  {usernameStatus === 'taken' && (
                    <span className="text-xs font-semibold" style={{ color: '#f87171' }}>{t.form.usernameTaken}</span>
                  )}
                </div>
                <input id="profile-username" type="text" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t.form.usernamePlaceholder} maxLength={50}
                  className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: `1px solid ${usernameStatus === 'taken' ? 'rgba(248,113,113,0.5)' : usernameStatus === 'available' ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 10,
                  }} />
              </div>

              {/* Full name */}
              <div>
                <label htmlFor="profile-fullname" className="flex items-center gap-1.5 text-xs mb-1.5"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <User size={13} /> {t.form.fullName}
                </label>
                <input id="profile-fullname" type="text" value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t.form.fullNamePlaceholder} maxLength={80}
                  className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
              </div>

              {/* Country */}
              <div>
                <label htmlFor="profile-country" className="flex items-center gap-1.5 text-xs mb-1.5"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <Globe size={13} /> {t.form.country}{' '}
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>({t.form.countryHint})</span>
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
                  <Image size={13} /> {t.form.avatarUrl}
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
                  <Image size={13} /> {t.form.bannerUrl}
                </label>
                <input id="profile-banner" type="url" value={bannerUrl}
                  onChange={(e) => setBannerUrl(e.target.value)}
                  placeholder={t.form.bannerUrlPlaceholder}
                  className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }} />
              </div>

              {/* Bio */}
              <div>
                <label htmlFor="profile-bio" className="flex items-center gap-1.5 text-xs mb-1.5"
                  style={{ color: 'rgba(255,255,255,0.5)' }}>
                  <FileText size={13} /> {t.form.bio}
                </label>
                <textarea id="profile-bio" value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t.form.bioPlaceholder} maxLength={500} rows={3}
                  className="w-full px-3.5 py-2.5 text-sm text-white outline-none transition-colors resize-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontFamily: 'inherit' }} />
                <p className="text-right mt-1 text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>{bio.length}/500</p>
              </div>

              {/* Public toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium text-white">
                    {isPublic
                      ? <Eye size={14} style={{ color: 'var(--accent)' }} />
                      : <EyeOff size={14} style={{ color: 'rgba(255,255,255,0.4)' }} />}
                    {t.form.publicProfile}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    {isPublic ? t.form.visibleToOthers : t.form.onlyVisibleToYou}
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
                  <div style={{
                    position: 'absolute', top: 3,
                    left: isPublic ? 23 : 3,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            </section>

            {/* ── Pinned Favorites ────────────────────────────────────────── */}
            <section className="p-5" style={{ borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Pin size={15} style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">{t.pins.title}</h2>
                <span className="text-xs ml-auto" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {pinnedItems.length}/4
                </span>
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {t.pins.subtitle}
              </p>

              {pinnedItems.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mb-5">
                  {pinnedItems.map(item => (
                    <div key={`${item.mediaType}-${item.id}`} style={{ position: 'relative' }}>
                      <div style={{ aspectRatio: '2/3', borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                        {item.posterPath ? (
                          <img
                            src={item.posterPath.startsWith('http') ? item.posterPath : `${POSTER_BASE}${item.posterPath}`}
                            alt={item.title}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={18} style={{ color: 'rgba(255,255,255,0.2)' }} />
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => removePin(item)} title={`Unpin "${item.title}"`}
                        style={{
                          position: 'absolute', top: 3, right: 3,
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'rgba(0,0,0,0.75)', border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: '#fff', padding: 0,
                        }}>
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

              {pinnedItems.length < 4 && unpinnedHistory.length > 0 && (
                <>
                  <p className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    {t.pins.addFromHistory}
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
                            <img
                              src={item.posterPath.startsWith('http') ? item.posterPath : `${POSTER_BASE}${item.posterPath}`}
                              alt={item.title}
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
                  {t.pins.noHistory}
                </p>
              )}
            </section>

            {/* ── Save button ─────────────────────────────────────────────── */}
            <button
              id="profile-save-btn"
              type="submit"
              disabled={saving || usernameStatus === 'taken'}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 24px var(--accent-glow)',
                opacity: saving || usernameStatus === 'taken' ? 0.5 : 1,
                cursor: saving || usernameStatus === 'taken' ? 'not-allowed' : 'pointer',
              }}>
              <Save size={15} />
              {saving ? t.form.saving : t.form.saveChanges}
            </button>

          </form>
        )}

        {/* ── Recalculate milestone badges ────────────────────────────────── */}
        <button
          type="button"
          onClick={handleRecalculateMilestones}
          disabled={milestoneStatus === 'running'}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          style={{
            border: '1px solid rgba(251,191,36,0.25)',
            background: milestoneStatus === 'done' ? 'rgba(74,222,128,0.08)' : 'rgba(251,191,36,0.07)',
            color: milestoneStatus === 'done' ? '#86efac' : '#fcd34d',
            cursor: milestoneStatus === 'running' ? 'not-allowed' : 'pointer',
            opacity: milestoneStatus === 'running' ? 0.7 : 1,
          }}
        >
          {milestoneStatus === 'running' ? (
            <>
              <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
              Checking milestones…
            </>
          ) : milestoneStatus === 'done' ? (
            <>
              <CheckCircle size={14} />
              {newBadgeCount > 0 ? `${newBadgeCount} new badge${newBadgeCount > 1 ? 's' : ''} awarded!` : 'All milestones up to date'}
            </>
          ) : (
            <>
              <Trophy size={14} />
              Recalculate Milestone Badges
            </>
          )}
        </button>

        {/* ── Sign out ────────────────────────────────────────────────────── */}
        <button
          id="profile-signout-btn"
          type="button"
          onClick={() => signOut()}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            border: '1px solid rgba(239,68,68,0.25)',
            background: 'rgba(239,68,68,0.07)',
            color: '#fca5a5',
            cursor: 'pointer',
          }}>
          {t.signOut}
        </button>

      </div>
    </div>
  )
}
