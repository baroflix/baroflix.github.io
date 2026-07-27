import { useState, type FormEvent, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft, User, Image, Save, CheckCircle, AlertTriangle,
  Palette, Languages, Monitor, Globe, FileText, Pin, X, Eye, EyeOff, ChevronDown,
  Volume2, RefreshCw, Shield, Keyboard, Info,
} from 'lucide-react'
import { useAuth } from './context/AuthContext'
import { supabase, type Profile, type PinnedItem } from './lib/supabase'

import { THEME_PRESETS, STORAGE_KEYS, EMBED_PROVIDERS } from './hooks'
import type { ThemeId, EmbedProviderId, WatchHistoryEntry } from './hooks'
import { locales } from './locales'

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

const LANGUAGE_OPTIONS = [
  { code: 'en', label: 'English', flag: 'gb' },
  { code: 'pl', label: 'Polski', flag: 'pl' },
]

function LanguageDropdown({
  value, onChange, accentColor,
}: { value: string; onChange: (code: string) => void; accentColor: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = LANGUAGE_OPTIONS.find(o => o.code === value) ?? LANGUAGE_OPTIONS[0]

  const onOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
  }, [])
  useEffect(() => {
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [onOutside])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 transition-all"
        style={{  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: 'var(--text-primary)' }}
      >
        <span className={`fi fi-${selected.flag}`} style={{ width: 22, height: 16,  flexShrink: 0, display: 'inline-block' }} />
        <span className="flex-1 text-left text-sm font-medium">{selected.label}</span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: 'var(--text-tertiary)', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-50 overflow-hidden"
          style={{  background: 'var(--surface-dropdown)', border: '1px solid rgba(255,255,255,0.10)', boxShadow: 'var(--shadow-dropdown)' }}>
          {LANGUAGE_OPTIONS.map(opt => {
            const isActive = opt.code === value
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => { onChange(opt.code); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors"
                style={{
                  background: isActive ? `${accentColor}18` : 'transparent',
                  color: isActive ? accentColor : 'var(--text-primary)',
                  borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                }}
              >
                <span className={`fi fi-${opt.flag}`} style={{ width: 22, height: 16,  flexShrink: 0, display: 'inline-block' }} />
                <span className="font-medium">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ClientToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="no-bg-hover"
      style={{
        width: 44, height: 24,  flexShrink: 0,
        background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
        border: 'none', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: checked ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%',
        background: '#fff',
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

export function ProfileScreen() {
  const { session, profile: contextProfile, signOut, settings, updateSettings } = useAuth()
  const lang = settings.language ?? 'en'
  const t = locales[lang].profile
  const ts = locales[lang].settings

  const [activeTab, setActiveTab] = useState<'general' | 'profile' | 'client'>('profile')
  const isElectron = !!window.__electronBridge?.isElectron

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

  type ClientSettings = {
    discordEnabled: boolean; cloudflareDns: boolean; hardwareAcceleration: boolean
    volumeBoost: number; pipShortcut: string; customUrl: string
  }
  const [clientSettings, setClientSettings] = useState<ClientSettings | null>(null)
  const [clientSaved, setClientSaved] = useState(false)
  const [appVersion, setAppVersion] = useState('')
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'not-available' | 'error'>('idle')

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
    if (!isElectron) return
    window.__electronBridge!.getSettings().then(s => setClientSettings(s))
    window.__electronBridge!.getAppVersion().then(v => setAppVersion(v))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleShortcutKey(e: React.KeyboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const keys: string[] = []
    if (e.ctrlKey || e.metaKey) keys.push('CommandOrControl')
    if (e.shiftKey) keys.push('Shift')
    if (e.altKey) keys.push('Alt')
    let k = e.key
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(k)) return
    if (k === ' ') k = 'Space'
    else if (k.length === 1) k = k.toUpperCase()
    else if (k.startsWith('Arrow')) k = k.replace('Arrow', '')
    keys.push(k)
    setClientSettings(prev => prev ? { ...prev, pipShortcut: keys.join('+') } : prev)
  }

  function saveClientSettings() {
    if (!clientSettings) return
    window.__electronBridge!.saveSettings(clientSettings)
    setClientSaved(true)
    setTimeout(() => setClientSaved(false), 2500)
  }

  async function checkUpdates() {
    setUpdateStatus('checking')
    const result = await window.__electronBridge!.checkForUpdates().catch(() => 'error' as const)
    setUpdateStatus(result)
    if (result !== 'available') setTimeout(() => setUpdateStatus('idle'), 5000)
  }

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
  function tabStyle(tab: 'general' | 'profile' | 'client') {
    const active = activeTab === tab
    return {
      flex: 1,
      padding: '8px 0',
      
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
          style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
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
            display: 'flex', gap: 4, padding: 4, 
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <button type="button" style={tabStyle('general')} onClick={() => setActiveTab('general')}>
            {t.tabs.general}
          </button>
          <button type="button" style={tabStyle('profile')} onClick={() => setActiveTab('profile')}>
            {t.tabs.profile}
          </button>
          {isElectron && (
            <button type="button" style={tabStyle('client')} onClick={() => setActiveTab('client')}>
              {t.tabs.client}
            </button>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            GENERAL TAB — theme + language (instant apply, no save needed)
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'general' && (
          <>
            {/* Theme */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
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
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Languages className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">{ts.language}</h2>
              </div>
              <LanguageDropdown
                value={settings.language ?? 'en'}
                onChange={code => updateSettings({ language: code as 'en' | 'pl' })}
                accentColor={theme.accent}
              />
            </section>
            {/* Embed Provider */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">Video Provider</h2>
              </div>
              <p className="text-xs mb-5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                Switch provider if the current one is down or not working.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(Object.entries(EMBED_PROVIDERS) as [EmbedProviderId, { label: string; description: string }][]).map(([id, p]) => {
                  const isActive = (settings.embedProvider ?? 'vidsrc') === id
                  return (
                    <button key={id} type="button" onClick={() => updateSettings({ embedProvider: id })}
                      className="p-4 text-left transition-all"
                      style={{
                        
                        background: isActive ? theme.glow.replace(/0\.(35|30|28)/, '0.10') : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? theme.accent + '60' : 'rgba(255,255,255,0.08)'}`,
                        boxShadow: isActive ? `0 0 24px ${theme.glow}` : 'none',
                      }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-semibold text-white">{p.label}</span>
                        {isActive && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                            style={{ background: theme.glow.replace(/0\.(35|30|28)/, '0.15'), color: theme.accent }}>
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.description}</div>
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
              style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>

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
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',}} />
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
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',}} />
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
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',}} />
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
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',}} />
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
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',  fontFamily: 'inherit' }} />
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
                    width: 44, height: 24,  flexShrink: 0,
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
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
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
                      <div style={{ aspectRatio: '2/3',  overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
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
                          aspectRatio: '2/3',  overflow: 'hidden',
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

        {/* ══════════════════════════════════════════════════════════════════
            CLIENT TAB — Electron desktop app settings
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'client' && isElectron && clientSettings && (
          <div className="flex flex-col gap-5">

            {/* Playback */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Volume2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">playback</h2>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">volume boost</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>amplify beyond the normal maximum — 100% = stream level</div>
                  </div>
                  <span className="text-sm font-bold ml-4" style={{ color: 'var(--accent)', minWidth: 44, textAlign: 'right', fontFamily: 'ui-monospace,monospace' }}>
                    {clientSettings.volumeBoost}%
                  </span>
                </div>
                <input
                  type="range" min={100} max={300} step={10}
                  value={clientSettings.volumeBoost}
                  onChange={e => setClientSettings(prev => prev ? { ...prev, volumeBoost: parseInt(e.target.value, 10) } : prev)}
                  className="w-full"
                  style={{
                    WebkitAppearance: 'none', appearance: 'none', height: 5,
                     outline: 'none', cursor: 'pointer',
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${(clientSettings.volumeBoost - 100) / 2}%, rgba(255,255,255,0.15) ${(clientSettings.volumeBoost - 100) / 2}%, rgba(255,255,255,0.15) 100%)`,
                  }}
                />
              </div>
            </section>

            {/* Integrations & toggles */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-5">
                <Shield className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">integrations & system</h2>
              </div>

              {[
                {
                  key: 'discordEnabled' as const,
                  label: 'discord rich presence',
                  hint: 'show what you\'re watching on Discord',
                },
                {
                  key: 'cloudflareDns' as const,
                  label: 'cloudflare DNS (1.1.1.1)',
                  hint: 'bypass ISP-level blocks — requires restart',
                },
                {
                  key: 'hardwareAcceleration' as const,
                  label: 'hardware acceleration',
                  hint: 'GPU rendering for smooth 4K playback — requires restart',
                },
              ].map(({ key, label, hint }, i, arr) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4"
                  style={{
                    padding: '12px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <div>
                    <div className="text-sm font-medium text-white">{label}</div>
                    <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{hint}</div>
                  </div>
                  <ClientToggle
                    checked={clientSettings[key] as boolean}
                    onChange={v => setClientSettings(prev => prev ? { ...prev, [key]: v } : prev)}
                  />
                </div>
              ))}
            </section>

            {/* PiP shortcut */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Keyboard className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">shortcuts</h2>
              </div>
              <div className="text-sm font-medium text-white mb-1">picture-in-picture</div>
              <div className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.38)' }}>click the box and press a key combination</div>
              <input
                type="text"
                readOnly
                value={clientSettings.pipShortcut}
                onKeyDown={handleShortcutKey}
                className="w-full text-center outline-none"
                style={{
                  padding: '9px 12px', background: 'rgba(255,255,255,0.06)',
                  border: '1px dashed rgba(255,255,255,0.25)', 
                  fontFamily: 'ui-monospace,monospace', fontSize: 13, fontWeight: 600,
                  color: 'var(--accent)', cursor: 'pointer',
                }}
                onFocus={e => (e.target.style.borderStyle = 'solid')}
                onBlur={e => (e.target.style.borderStyle = 'dashed')}
              />
            </section>

            {/* App version */}
            <section className="p-5" style={{  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Info className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <h2 className="text-base font-semibold text-white">app info</h2>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">baroflix desktop</div>
                  <div className="text-xs mt-0.5" style={{
                    color: updateStatus === 'available' ? 'var(--accent)' : 'rgba(255,255,255,0.38)',
                  }}>
                    {updateStatus === 'available' && 'update available — downloading…'}
                    {updateStatus === 'not-available' && `v${appVersion} — up to date ✓`}
                    {updateStatus === 'error' && `v${appVersion} — couldn't check`}
                    {(updateStatus === 'idle' || updateStatus === 'checking') && (appVersion ? `v${appVersion}` : '')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={checkUpdates}
                  disabled={updateStatus === 'checking'}
                  className="flex items-center gap-1.5 text-xs font-semibold transition-colors"
                  style={{
                    padding: '6px 12px',  flexShrink: 0,
                    background: 'transparent', border: '1px solid var(--accent)',
                    color: 'var(--accent)', cursor: updateStatus === 'checking' ? 'default' : 'pointer',
                    opacity: updateStatus === 'checking' ? 0.5 : 1,
                  }}
                >
                  <RefreshCw className={`w-3 h-3 ${updateStatus === 'checking' ? 'animate-spin' : ''}`} />
                  {updateStatus === 'checking' ? 'checking…' : 'check for updates'}
                </button>
              </div>
            </section>

            {/* Save */}
            <button
              type="button"
              onClick={saveClientSettings}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 24px var(--accent-glow)',
              }}
            >
              <Save size={15} />
              save client settings
            </button>
            {clientSaved && (
              <div className="text-center text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>
                ✓ saved
              </div>
            )}

          </div>
        )}

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
