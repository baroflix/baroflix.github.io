import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { MediaDetails, MediaItem, MediaKind, CollectionDetails } from './types'
import {
  fetchRecommendations,
  fetchTitleDetails,
  fetchTrendingTitles,
  fetchTopRatedMovies,
  fetchTopRatedTv,
  fetchClassics,
  fetchCollection,
  fetchByGenre,
  hasTmdbCredentials,
  mediaTypeFromItem,
  searchTitles,
} from './lib/tmdb'
import { fetchTrendingAnime, searchAnime as searchAnilist, fetchAnimeDetails } from './lib/anilist'

// ─── Types ──────────────────────────────────────────────────────────────────

export type ThemeId = 'scarlet' | 'emerald' | 'aurora' | 'oxide' | 'pearl' | 'fuchsia' | 'amethyst' | 'lapis'

export type LanguageId = 'en' | 'pl'

export type EmbedProviderId = 'videasy' | 'vidsrc' | 'embedsu' | '2embed'

export const EMBED_PROVIDERS: Record<EmbedProviderId, { label: string; description: string }> = {
  videasy:  { label: 'Videasy',  description: 'Next episode, episode selector' },
  vidsrc:   { label: 'VidSrc',   description: 'Popular fallback source' },
  embedsu:  { label: 'Embed.su', description: 'Alternative source' },
  '2embed': { label: '2Embed',   description: 'Alternative source' },
}

export type ThemeSettings = {
  theme: ThemeId
  language: LanguageId
  embedProvider: EmbedProviderId
}

export type WatchHistoryEntry = {
  mediaType: MediaKind
  id: number
  title: string
  posterPath?: string | null
  backdropPath?: string | null
  season?: number
  episode?: number
  watchedAt: number
}

export type WatchlistEntry = {
  mediaType: MediaKind
  id: number
  title: string
  posterPath?: string | null
  backdropPath?: string | null
  addedAt: number
}

export type RatingEntry = {
  rating: number
  id: number
  mediaType: string
  title: string
  posterPath?: string | null
  backdropPath?: string | null
  addedAt: number
}

export type ReminderEntry = {
  mediaType: MediaKind
  id: number
  title: string
  posterPath?: string | null
  releaseDate?: string
  addedAt: number
}

export type HomeState = {
  featured: MediaItem | null
  gallery: MediaItem[]
  recommendations: MediaItem[]
  searchResults: MediaItem[]
  loading: boolean
  error: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

export type CustomList = {
  id: string
  name: string
  coverImage?: string | null
  items: WatchlistEntry[]
}

export const STORAGE_KEYS = {
  settings: 'baroflix.settings',
  history: 'baroflix.history',
  catalog: 'baroflix.home_catalog',
  progress: 'baroflix.progress',
  reminders: 'baroflix.reminders',
  ratings: 'baroflix.ratings',
  customLists: 'baroflix.custom_lists',
  watchedEpisodes: 'baroflix.watched_episodes',
  recentSearches: 'baroflix.recent_searches',
} as const

export const THEME_PRESETS: Record<ThemeId, { label: string; accent: string; glow: string; surface: string }> = {
  scarlet:  { label: 'Scarlet',  accent: '#ff3d3d', glow: 'rgba(255,61,61,0.30)',   surface: 'rgba(28,16,18,0.9)' },
  emerald:  { label: 'Emerald',  accent: '#10b981', glow: 'rgba(16,185,129,0.30)',  surface: 'rgba(6,30,22,0.9)'  },
  aurora:   { label: 'Aurora',   accent: '#22d3ee', glow: 'rgba(34,211,238,0.28)',  surface: 'rgba(7,25,33,0.9)'  },
  oxide:    { label: 'Oxide',    accent: '#f59e0b', glow: 'rgba(245,158,11,0.28)',  surface: 'rgba(35,20,6,0.9)'  },
  pearl:    { label: 'Pearl',    accent: '#ffffff', glow: 'rgba(255,255,255,0.30)', surface: 'rgba(20,20,20,0.9)'  },
  fuchsia:  { label: 'Fuchsia',  accent: '#ec4899', glow: 'rgba(236,72,153,0.30)',  surface: 'rgba(36,10,24,0.9)'  },
  amethyst: { label: 'Amethyst', accent: '#a855f7', glow: 'rgba(168,85,247,0.30)',  surface: 'rgba(24,10,36,0.9)'  },
  lapis:    { label: 'Lapis',    accent: '#1d4ed8',  glow: 'rgba(29,78,216,0.25)',   surface: 'rgba(245,247,250,0.97)' },
}

export const defaultSettings: ThemeSettings = {
  theme: 'scarlet',
  language: 'en',
  embedProvider: 'videasy',
}

const defaultHomeState: HomeState = {
  featured: null,
  gallery: [],
  recommendations: [],
  searchResults: [],
  loading: true,
  error: null,
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function useLocalStorageState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key)
      if (stored) {
        const parsed = JSON.parse(stored) as any
        // Migrate old users off removed themes
        if (key === STORAGE_KEYS.settings && parsed) {
          if (parsed.theme === 'midnight' || parsed.theme === 'pride') {
            parsed.theme = 'scarlet'
          }
          if (!parsed.language) {
            parsed.language = 'en'
          }
        }
        return parsed as T
      }
      return initialValue
    } catch {
      return initialValue
    }
  })

  const setStoredValue = useCallback(
    (newValue: T | ((val: T) => T)) => {
      setValue((current) => {
        const resolvedValue =
          newValue instanceof Function ? newValue(current) : newValue
        try {
          window.localStorage.setItem(key, JSON.stringify(resolvedValue))
          window.dispatchEvent(
            new CustomEvent(`local-storage-${key}`, { detail: resolvedValue })
          )
        } catch (err) {
          console.error('useLocalStorageState error:', err)
        }
        return resolvedValue
      })
    },
    [key]
  )

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<T>
      setValue(customEvent.detail)
    }
    window.addEventListener(`local-storage-${key}`, handleSync)
    return () => window.removeEventListener(`local-storage-${key}`, handleSync)
  }, [key])

  return [value, setStoredValue] as const
}

export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay)
    return () => window.clearTimeout(timer)
  }, [delay, value])
  return debounced
}

export function useRotatingItems(items: MediaItem[]) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    if (!items.length) return
    const timer = window.setInterval(() => setIndex((c) => (c + 1) % items.length), 6500)
    return () => window.clearInterval(timer)
  }, [items])
  return items.length ? [...items.slice(index), ...items.slice(0, index)] : []
}

export function useWatchHistory() {
  const [history] = useLocalStorageState<WatchHistoryEntry[]>(STORAGE_KEYS.history, [])
  return history
}

export function useProgressStore() {
  const [progress, setProgress] = useLocalStorageState<Record<string, number>>(STORAGE_KEYS.progress, {})

  useEffect(() => {
    const handler = () => {
      const raw = window.localStorage.getItem(STORAGE_KEYS.progress)
      if (raw) setProgress(JSON.parse(raw))
    }
    window.addEventListener('progress-updated', handler)
    return () => window.removeEventListener('progress-updated', handler)
  }, [setProgress])

  return progress
}

/**
 * Write a single progress entry directly to localStorage and fire the
 * progress-updated event so all live useProgressStore subscribers update.
 * Pass seconds=0 to remove the entry entirely.
 */
export function writeProgressEntry(key: string, seconds: number) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.progress)
    const current: Record<string, number> = raw ? JSON.parse(raw) : {}
    if (seconds <= 0) {
      delete current[key]
    } else {
      current[key] = seconds
    }
    window.localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(current))
    window.dispatchEvent(new Event('progress-updated'))
  } catch {}
}

/**
 * Add a key to the watched-episodes list directly in localStorage and
 * notify all live useWatchedEpisodes subscribers. Safe to call outside React.
 */
export function writeWatchedEntry(key: string) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.watchedEpisodes)
    const current: string[] = raw ? JSON.parse(raw) : []
    if (!current.includes(key)) {
      current.push(key)
      window.localStorage.setItem(STORAGE_KEYS.watchedEpisodes, JSON.stringify(current))
      window.dispatchEvent(new Event('watched-episodes-updated'))
    }
  } catch {}
}

/**
 * Add many keys to the watched-episodes list in a single localStorage write.
 * Dispatches watched-episodes-updated once so all subscribers re-sync.
 */
export function writeBulkWatched(keys: string[]) {
  if (!keys.length) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.watchedEpisodes)
    const current: string[] = raw ? JSON.parse(raw) : []
    const currentSet = new Set(current)
    const toAdd = keys.filter(k => !currentSet.has(k))
    if (toAdd.length > 0) {
      window.localStorage.setItem(STORAGE_KEYS.watchedEpisodes, JSON.stringify([...current, ...toAdd]))
      window.dispatchEvent(new Event('watched-episodes-updated'))
    }
  } catch {}
}

/**
 * Remove many keys from the watched-episodes list in a single localStorage write.
 * Dispatches watched-episodes-updated once so all subscribers re-sync.
 */
export function removeBulkWatched(keys: string[]) {
  if (!keys.length) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.watchedEpisodes)
    const current: string[] = raw ? JSON.parse(raw) : []
    const toRemove = new Set(keys)
    const next = current.filter(k => !toRemove.has(k))
    if (next.length !== current.length) {
      window.localStorage.setItem(STORAGE_KEYS.watchedEpisodes, JSON.stringify(next))
      window.dispatchEvent(new Event('watched-episodes-updated'))
    }
  } catch {}
}

/**
 * Tracks manually-marked-as-watched episodes.
 * Key format: "${mediaType}-${id}-${season}-${episodeNumber}"
 * Returns [watchedSet, toggle(key)]
 * Also reacts to external writeWatchedEntry() calls via the
 * watched-episodes-updated event.
 */
export function useWatchedEpisodes() {
  const [watched, setWatched] = useLocalStorageState<string[]>(STORAGE_KEYS.watchedEpisodes, [])

  // Re-sync when the player (or any external code) writes watched entries
  useEffect(() => {
    const handler = () => {
      const raw = window.localStorage.getItem(STORAGE_KEYS.watchedEpisodes)
      if (raw) setWatched(JSON.parse(raw))
    }
    window.addEventListener('watched-episodes-updated', handler)
    return () => window.removeEventListener('watched-episodes-updated', handler)
  }, [setWatched])

  const watchedSet = useMemo(() => new Set(watched), [watched])
  const toggle = useCallback((key: string) => {
    setWatched(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  }, [setWatched])
  return [watchedSet, toggle] as const
}

export function useReminders() {
  return useLocalStorageState<ReminderEntry[]>(STORAGE_KEYS.reminders, [])
}

export function useRatings() {
  return useLocalStorageState<Record<string, any>>(STORAGE_KEYS.ratings, {})
}

export function useCustomLists() {
  return useLocalStorageState<CustomList[]>(STORAGE_KEYS.customLists, [])
}

export function useBrowseData() {
  const [data, setData] = useState<{
    movies: MediaItem[]
    tv: MediaItem[]
    classics: MediaItem[]
    action: MediaItem[]
    comedy: MediaItem[]
    scifi: MediaItem[]
    animation: MediaItem[]
    loading: boolean
  }>({ 
    movies: [], 
    tv: [], 
    classics: [], 
    action: [], 
    comedy: [], 
    scifi: [], 
    animation: [], 
    loading: true 
  })

  useEffect(() => {
    if (!hasTmdbCredentials) return
    const controller = new AbortController()
    
    Promise.all([
      fetchTopRatedMovies(controller.signal),
      fetchTopRatedTv(controller.signal),
      fetchClassics(controller.signal),
      fetchByGenre(28, 'movie', controller.signal),
      fetchByGenre(35, 'movie', controller.signal),
      fetchByGenre(878, 'movie', controller.signal),
      fetchByGenre(16, 'tv', controller.signal),
    ]).then(([movies, tv, classics, action, comedy, scifi, animation]) => {
      if (!controller.signal.aborted) {
        setData({ 
          movies, 
          tv, 
          classics, 
          action, 
          comedy, 
          scifi, 
          animation, 
          loading: false 
        })
      }
    }).catch(() => {
      if (!controller.signal.aborted) {
        setData(p => ({ ...p, loading: false }))
      }
    })

    return () => controller.abort()
  }, [])

  return data
}

export function useCollectionDetails(id: string | undefined) {
  const [details, setDetails] = useState<CollectionDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !hasTmdbCredentials) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    
    fetchCollection(id, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          setDetails(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load collection.')
          setLoading(false)
        }
      })
      
    return () => controller.abort()
  }, [id])

  return { details, loading, error }
}

export function useScrollDirection() {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setHidden(y > 80 && y > lastY.current)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return hidden
}

export function useHomeCatalog(query: string): HomeState {
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  
  const [state, setState] = useState<HomeState>(() => {
    try {
      const cached = window.localStorage.getItem(STORAGE_KEYS.catalog)
      if (cached && !query) {
        const parsed = JSON.parse(cached)
        return { ...defaultHomeState, ...parsed, loading: false }
      }
    } catch {}
    return defaultHomeState
  })

  useEffect(() => {
    const controller = new AbortController()

    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setState((c) => ({ ...c, loading: true, error: null }))
      }
    })

    async function load() {
      try {
        const [trending, recommendations, animeTrending] = await Promise.all([
          hasTmdbCredentials ? fetchTrendingTitles(controller.signal).catch(() => []) : Promise.resolve([]),
          hasTmdbCredentials ? fetchRecommendations(controller.signal).catch(() => []) : Promise.resolve([]),
          fetchTrendingAnime(controller.signal).catch(() => []),
        ])

        if (controller.signal.aborted) return

        let searchResults: MediaItem[] = []
        let featured = trending.find(hasArtwork) ?? animeTrending.find(hasArtwork) ?? recommendations.find(hasArtwork) ?? trending[0] ?? animeTrending[0] ?? null

        if (debouncedQuery.length >= 2) {
          const [tmdbSearch, anilistSearch] = await Promise.all([
            hasTmdbCredentials ? searchTitles(debouncedQuery, controller.signal).catch(() => []) : Promise.resolve([]),
            searchAnilist(debouncedQuery, controller.signal).catch(() => []),
          ])
          searchResults = [...tmdbSearch, ...anilistSearch]
          featured = searchResults.find(hasArtwork) ?? searchResults[0] ?? featured
        }

        const gallery = uniqueMedia([...trending, ...animeTrending, ...recommendations]).filter(hasArtwork).slice(0, 8)
        const recs = uniqueMedia([...recommendations, ...animeTrending, ...trending]).filter(hasArtwork).slice(0, 20)

        const error = (!hasTmdbCredentials && !animeTrending.length) ? 'Add TMDB credentials to load live posters, search, and details.' : null

        setState({ featured, gallery, recommendations: recs, searchResults, loading: false, error })

        // Cache the default catalog (not search results) so the next refresh is instant
        if (!debouncedQuery && featured && gallery.length) {
          window.localStorage.setItem(
            STORAGE_KEYS.catalog, 
            JSON.stringify({ featured, gallery, recommendations: recs })
          )
        }
      } catch (err) {
        if (controller.signal.aborted) return
        setState({ ...defaultHomeState, loading: false, error: err instanceof Error ? err.message : 'Unable to load catalog.' })
      }
    }

    void load()
    return () => controller.abort()
  }, [debouncedQuery])

  return state
}

export function useFeaturedDetails(item: MediaItem | null): MediaDetails | null {
  const [details, setDetails] = useState<MediaDetails | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      if (!item) { setDetails(null); return }
      try {
        let res
        if (mediaTypeFromItem(item) === 'anime') {
          res = await fetchAnimeDetails(String(item.id), controller.signal)
        } else {
          res = await fetchTitleDetails(mediaTypeFromItem(item), String(item.id), controller.signal)
        }
        setDetails(res)
      } catch {
        if (!controller.signal.aborted) setDetails(null)
      }
    }
    void load()
    return () => controller.abort()
  }, [item])

  return details
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueMedia(items: MediaItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${mediaTypeFromItem(item)}-${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function hasArtwork(item: MediaItem) {
  return Boolean(item.poster_path || item.backdrop_path)
}

export function upsertHistory(entries: WatchHistoryEntry[], next: WatchHistoryEntry) {
  // Deduplicate by mediaType and id so only the latest episode of a show appears
  const filtered = entries.filter(
    (e) => !(e.mediaType === next.mediaType && e.id === next.id)
  )
  return [next, ...filtered].slice(0, 500)
}

export function formatDuration(minutes?: number) {
  if (!minutes) return '—'
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function formatMoney(amount?: number) {
  if (!amount) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: 'compact' }).format(amount)
}

export function parsePositiveNumber(value: string | null) {
  if (!value) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : null
}
