import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, type Profile } from '../lib/supabase'
import { STORAGE_KEYS, defaultSettings } from '../hooks'
import type { ThemeSettings, ThemeId, LanguageId } from '../hooks'

// ─────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────
interface AuthContextValue {
  /** The raw Supabase session (null when signed out) */
  session: Session | null
  /** Resolved profile row for the current user */
  profile: Profile | null
  /** True while the initial session is being resolved */
  loading: boolean
  /** Any error from the auth redirect allowlist check */
  authError: string | null
  /** Clear current authentication errors */
  clearAuthError: () => void
  /** The synchronized user theme and language settings */
  settings: ThemeSettings
  /** Update user settings locally and in the database */
  updateSettings: (newSettings: Partial<ThemeSettings>) => Promise<void>
  /** Sign in with email + password */
  signInWithEmail: (email: string, password: string) => Promise<void>
  /** Sign in via Google OAuth (redirects) */
  signInWithGoogle: () => Promise<void>
  /** Sign out the current user */
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// ─────────────────────────────────────────────────────────────
// Helper: verify email is in the allowlist
// ─────────────────────────────────────────────────────────────
async function assertEmailAllowed(email: string): Promise<void> {
  const { data, error } = await supabase
    .from('allowed_emails')
    .select('email')
    .eq('email', email)
    .maybeSingle()

  if (error) {
    throw new Error(`Allowlist check failed: ${error.message}`)
  }

  if (!data) {
    // Force sign-out before throwing so no partial session remains
    await supabase.auth.signOut()
    throw new Error(
      'Access Denied: Your account is not on the authorized access list.'
    )
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: fetch profile row
// ─────────────────────────────────────────────────────────────
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, theme, language, watch_history, watch_progress, watchlist, ratings, custom_lists, visit_count, updated_at, full_name, country, banner_url, bio, is_public, pinned_items, created_at')
    .eq('id', userId)
    .maybeSingle()

  return data ?? null
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  const [settings, setSettings] = useState<ThemeSettings>(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEYS.settings)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.theme === 'midnight') parsed.theme = 'scarlet'
        if (!parsed.language) parsed.language = 'en'
        return parsed
      }
    } catch {}
    return defaultSettings
  })

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const updateSettings = useCallback(
    async (newSettings: Partial<ThemeSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...newSettings }
        window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next))

        // If logged in, update database profile
        if (session?.user?.id) {
          supabase
            .from('profiles')
            .update({ theme: next.theme, language: next.language })
            .eq('id', session.user.id)
            .then(({ error }) => {
              if (error) console.error('Failed to sync settings to profile:', error)
            })
        }
        return next
      })
    },
    [session]
  )

  // Called every time auth state changes (sign-in, sign-out, token refresh).
  // Pass incrementVisit=true only on initial page load to avoid counting token refreshes.
  const handleSession = useCallback(async (newSession: Session | null, incrementVisit = false) => {
    setAuthError(null)

    if (!newSession) {
      setSession(null)
      setProfile(null)
      return
    }

    try {
      await assertEmailAllowed(newSession.user.email ?? '')
      const prof = await fetchProfile(newSession.user.id)
      setSession(newSession)
      setProfile(prof)

      if (incrementVisit) {
        supabase.rpc('increment_visit_count', { uid: newSession.user.id }).then()
      }

      if (prof) {
        const dbTheme = prof.theme as ThemeId | null
        const dbLang = prof.language as LanguageId | null
        const dbHistory = prof.watch_history
        const dbProgress = prof.watch_progress
        const dbRatings = prof.ratings
        const dbCustomLists = prof.custom_lists

        // 1. Sync theme/language
        if (dbTheme || dbLang) {
          setSettings((current) => {
            const next = {
              theme: dbTheme || current.theme,
              language: dbLang || current.language,
            }
            window.localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(next))
            return next
          })
        } else {
          let currentLocal = defaultSettings
          try {
            const stored = window.localStorage.getItem(STORAGE_KEYS.settings)
            if (stored) currentLocal = JSON.parse(stored)
          } catch {}

          supabase
            .from('profiles')
            .update({ theme: currentLocal.theme, language: currentLocal.language })
            .eq('id', newSession.user.id)
            .then(({ error }) => {
              if (error) console.error('Failed to sync initial local settings to database:', error)
            })
        }

        // 2. Sync watch history
        if (dbHistory && Array.isArray(dbHistory) && dbHistory.length > 0) {
          window.localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(dbHistory))
          window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.history}`, { detail: dbHistory }))
        } else {
          try {
            const localHist = window.localStorage.getItem(STORAGE_KEYS.history)
            if (localHist) {
              supabase
                .from('profiles')
                .update({ watch_history: JSON.parse(localHist) })
                .eq('id', newSession.user.id)
                .then()
            }
          } catch {}
        }

        // 3. Sync watch progress
        if (dbProgress && typeof dbProgress === 'object' && Object.keys(dbProgress).length > 0) {
          window.localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(dbProgress))
          window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.progress}`, { detail: dbProgress }))
        } else {
          try {
            const localProg = window.localStorage.getItem(STORAGE_KEYS.progress)
            if (localProg) {
              supabase
                .from('profiles')
                .update({ watch_progress: JSON.parse(localProg) })
                .eq('id', newSession.user.id)
                .then()
            }
          } catch {}
        }

        // 5. Sync ratings
        if (dbRatings && typeof dbRatings === 'object' && Object.keys(dbRatings).length > 0) {
          window.localStorage.setItem(STORAGE_KEYS.ratings, JSON.stringify(dbRatings))
          window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.ratings}`, { detail: dbRatings }))
        } else {
          try {
            const localRatings = window.localStorage.getItem(STORAGE_KEYS.ratings)
            if (localRatings) {
              supabase
                .from('profiles')
                .update({ ratings: JSON.parse(localRatings) })
                .eq('id', newSession.user.id)
                .then()
            }
          } catch {}
        }

        // 6. Sync custom lists
        if (dbCustomLists && Array.isArray(dbCustomLists) && dbCustomLists.length > 0) {
          window.localStorage.setItem(STORAGE_KEYS.customLists, JSON.stringify(dbCustomLists))
          window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.customLists}`, { detail: dbCustomLists }))
        } else {
          try {
            const localLists = window.localStorage.getItem(STORAGE_KEYS.customLists)
            if (localLists) {
              supabase
                .from('profiles')
                .update({ custom_lists: JSON.parse(localLists) })
                .eq('id', newSession.user.id)
                .then()
            }
          } catch {}
        }
      }
    } catch (err) {
      // assertEmailAllowed already called signOut; just clear state
      setSession(null)
      setProfile(null)
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.')
      throw err // re-throw so sign-in functions can surface the error
    }
  }, [])

  useEffect(() => {
    // Restore existing session on mount — increment visit counter on page load
    supabase.auth.getSession().then(({ data }) => {
      handleSession(data.session, /* incrementVisit */ true).finally(() => setLoading(false))
    })

    // Subscribe to future changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        handleSession(newSession).catch(() => {
          /* errors surfaced via setAuthError in handleSession */
        })
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [handleSession])

  // ── Public API ────────────────────────────────────────────
  const signInWithEmail = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw new Error(error.message)
      // handleSession is called by onAuthStateChange, but we also
      // call it here to surface allowlist errors immediately.
      await handleSession(data.session)
    },
    [handleSession]
  )

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + import.meta.env.BASE_URL,
      },
    })
    if (error) throw new Error(error.message)
    // Allowlist check happens in onAuthStateChange after redirect
  }, [])

  // Listen for local changes to history, progress, and watchlist to sync with DB
  useEffect(() => {
    if (!session?.user?.id) return

    const handleHistory = (e: Event) => {
      const detail = (e as CustomEvent).detail
      supabase
        .from('profiles')
        .update({ watch_history: detail })
        .eq('id', session.user.id)
        .then()
    }
    const handleProgress = (e: Event) => {
      const detail = (e as CustomEvent).detail
      supabase
        .from('profiles')
        .update({ watch_progress: detail })
        .eq('id', session.user.id)
        .then()
    }
    const handleRatings = (e: Event) => {
      const detail = (e as CustomEvent).detail
      supabase
        .from('profiles')
        .update({ ratings: detail })
        .eq('id', session.user.id)
        .then()
    }
    const handleCustomLists = (e: Event) => {
      const detail = (e as CustomEvent).detail
      supabase
        .from('profiles')
        .update({ custom_lists: detail })
        .eq('id', session.user.id)
        .then()
    }

    window.addEventListener(`local-storage-${STORAGE_KEYS.history}`, handleHistory)
    window.addEventListener(`local-storage-${STORAGE_KEYS.progress}`, handleProgress)
    window.addEventListener(`local-storage-${STORAGE_KEYS.ratings}`, handleRatings)
    window.addEventListener(`local-storage-${STORAGE_KEYS.customLists}`, handleCustomLists)

    return () => {
      window.removeEventListener(`local-storage-${STORAGE_KEYS.history}`, handleHistory)
      window.removeEventListener(`local-storage-${STORAGE_KEYS.progress}`, handleProgress)
      window.removeEventListener(`local-storage-${STORAGE_KEYS.ratings}`, handleRatings)
      window.removeEventListener(`local-storage-${STORAGE_KEYS.customLists}`, handleCustomLists)
    }
  }, [session])

  // Presence heartbeat: update last_seen_at every 60 s while logged in
  useEffect(() => {
    if (!session?.user?.id) return
    const userId = session.user.id
    const beat = () => {
      supabase.from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId)
        .then()
    }
    beat() // mark online immediately on login
    const timer = setInterval(beat, 60_000)
    return () => clearInterval(timer)
  }, [session?.user?.id])

  // Keep a ref so signOut can read the latest userId without adding session to its deps
  const sessionUserIdRef = useRef<string | undefined>(undefined)
  useEffect(() => { sessionUserIdRef.current = session?.user?.id }, [session?.user?.id])

  const signOut = useCallback(async () => {
    // Clear now_watching before signing out so profile shows offline immediately
    const uid = sessionUserIdRef.current
    if (uid) {
      supabase.from('profiles').update({ now_watching: null }).eq('id', uid).then()
    }
    await supabase.auth.signOut()
    setSession(null)
    setProfile(null)

    // Clear user data on sign out
    window.localStorage.removeItem(STORAGE_KEYS.history)
    window.localStorage.removeItem(STORAGE_KEYS.progress)
    window.localStorage.removeItem(STORAGE_KEYS.ratings)
    window.localStorage.removeItem(STORAGE_KEYS.customLists)

    // Update local react state to clear out the UI
    window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.history}`, { detail: [] }))
    window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.progress}`, { detail: {} }))
    window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.ratings}`, { detail: {} }))
    window.dispatchEvent(new CustomEvent(`local-storage-${STORAGE_KEYS.customLists}`, { detail: [] }))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        authError,
        clearAuthError,
        settings,
        updateSettings,
        signInWithEmail,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
