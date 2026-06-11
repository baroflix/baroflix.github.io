import { useRef, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Search, X, SlidersHorizontal, ChevronDown, RotateCcw,
} from 'lucide-react'
import { useCollectionDetails } from './hooks'
import { SectionHeader, MediaCard, GridSkeleton, EmptyPanel, SetupNotice } from './ui'
import { hasTmdbCredentials, imageUrl, discoverCatalog } from './lib/tmdb'
import type { DiscoverMediaType, DiscoverSort, DiscoverResult } from './lib/tmdb'
import { discoverAnime, ANILIST_GENRES } from './lib/anilist'
import type { MediaItem } from './types'
import { NETWORKS } from './NetworkPage'
import { locales } from './locales'
import { useAuth } from './context/AuthContext'

// ─── Constants ────────────────────────────────────────────────────────────────

const FRANCHISES = [
  { id: 86311, title: 'Marvel Cinematic Universe' },
  { id: 10, title: 'Star Wars' },
  { id: 1241, title: 'Harry Potter' },
  { id: 119, title: 'The Lord of the Rings' },
  { id: 263, title: 'The Dark Knight Trilogy' },
  { id: 531241, title: 'Spider-Man Collection' },
  { id: 9485, title: 'Fast & Furious' },
  { id: 84, title: 'Indiana Jones' },
  { id: 295, title: 'Pirates of the Caribbean' },
  { id: 87359, title: 'Mission: Impossible' },
  { id: 645, title: 'James Bond' },
  { id: 556, title: 'The Matrix' },
]

const MOVIE_GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' }, { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' }, { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' }, { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' }, { id: 27, name: 'Horror' },
  { id: 9648, name: 'Mystery' }, { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' }, { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' }, { id: 37, name: 'Western' },
]

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' }, { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' }, { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' }, { id: 9648, name: 'Mystery' },
  { id: 10765, name: 'Sci-Fi & Fantasy' }, { id: 10768, name: 'War & Politics' },
  { id: 10764, name: 'Reality' }, { id: 37, name: 'Western' },
]

const TV_NETWORKS = [
  { value: '', label: 'All Networks' },
  { value: '213', label: 'Netflix' },
  { value: '49', label: 'HBO / Max' },
  { value: '2739', label: 'Disney+' },
  { value: '1024', label: 'Prime Video' },
  { value: '2552', label: 'Apple TV+' },
  { value: '453', label: 'Hulu' },
  { value: '3353', label: 'Peacock' },
  { value: '4330', label: 'Paramount+' },
  { value: '67', label: 'Showtime' },
  { value: '174', label: 'AMC' },
  { value: '88', label: 'FX' },
  { value: '4', label: 'BBC' },
  { value: '16', label: 'CBS' },
  { value: '6', label: 'NBC' },
  { value: '2', label: 'ABC' },
  { value: '56', label: 'Cartoon Network' },
]

const MOVIE_STUDIOS = [
  { value: '', label: 'All Studios' },
  { value: '420', label: 'Marvel Studios' },
  { value: '3', label: 'Pixar' },
  { value: '41077', label: 'A24' },
  { value: '174', label: 'Warner Bros.' },
  { value: '33', label: 'Universal' },
  { value: '34', label: 'Sony Pictures' },
  { value: '25', label: '20th Century Studios' },
  { value: '4', label: 'Paramount' },
  { value: '2', label: 'Walt Disney Pictures' },
  { value: '1632', label: 'Lionsgate' },
  { value: '521', label: 'DreamWorks' },
  { value: '923', label: 'Legendary' },
]

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_VALS = ['', ...Array.from({ length: CURRENT_YEAR - 1979 }, (_, i) => String(CURRENT_YEAR - i))]
const RATING_VALS = ['', '6', '7', '7.5', '8', '8.5', '9']

// ─── CollectionCard ───────────────────────────────────────────────────────────

function CollectionCard({ id, fallbackTitle }: { id: number; fallbackTitle: string }) {
  const { details } = useCollectionDetails(String(id))
  const title = details?.name || fallbackTitle
  const image = imageUrl(details?.backdrop_path, 'w780') || imageUrl(details?.poster_path, 'w500')

  return (
    <Link
      to={`/collection/${id}`}
      className="group relative overflow-hidden block transition-transform hover:-translate-y-1"
      style={{ aspectRatio: '16/9', borderRadius: 20, border: '1px solid var(--border)' }}
    >
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full" style={{ background: 'var(--bg-card)' }} />
      )}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.95), transparent 70%)' }} />
      <div className="absolute bottom-5 left-5 right-5">
        <h3 className="text-lg font-medium text-white truncate" style={{ fontFamily: 'DM Serif Display, serif' }}>
          {title}
        </h3>
      </div>
    </Link>
  )
}

// ─── FilterDropdown ───────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const selected = options.find(o => o.value === value) ?? options[0]

  return (
    <div ref={ref} className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
        {label}
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors"
          style={{
            background: open ? 'var(--bg-card-hover)' : 'var(--bg-card)',
            border: `1px solid ${open ? 'var(--border-hover)' : 'var(--border)'}`,
            color: value ? 'var(--text-primary)' : 'var(--text-tertiary)',
          }}
        >
          <span className="truncate text-left">{selected.label}</span>
          <ChevronDown
            className="shrink-0 transition-transform duration-200"
            style={{ width: 13, height: 13, color: 'var(--text-secondary)', transform: open ? 'rotate(180deg)' : 'none' }}
          />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scaleY: 0.94 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={{ opacity: 0, y: -4, scaleY: 0.94, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{
                transformOrigin: 'top',
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                zIndex: 200,
                maxHeight: 220,
                overflowY: 'auto',
                borderRadius: 12,
                background: 'var(--surface-dropdown)',
                border: '1px solid var(--border)',
                backdropFilter: 'blur(24px)',
                boxShadow: 'var(--shadow-dropdown)',
                scrollbarWidth: 'none',
              }}
            >
              {options.map(opt => {
                const isActive = opt.value === value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => { onChange(opt.value); setOpen(false) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-white/5"
                    style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', background: isActive ? 'var(--bg-card)' : 'transparent' }}
                  >
                    <span
                      className="shrink-0 rounded-full"
                      style={{
                        width: 6, height: 6,
                        background: isActive ? 'var(--accent)' : 'var(--border)',
                        boxShadow: isActive ? '0 0 6px var(--accent-glow)' : 'none',
                      }}
                    />
                    {opt.label}
                  </button>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Filter Panel Content (shared between desktop sidebar and mobile panel) ───

function FilterPanelContent({
  type, onTypeChange,
  sortBy, onSortChange,
  genre, onGenreChange,
  networkId, onNetworkChange,
  year, onYearChange,
  minRating, onMinRatingChange,
  hasActiveFilters, onClearAll,
  t,
}: {
  type: DiscoverMediaType
  onTypeChange: (t: DiscoverMediaType) => void
  sortBy: DiscoverSort
  onSortChange: (s: DiscoverSort) => void
  genre: string
  onGenreChange: (g: string) => void
  networkId: string
  onNetworkChange: (n: string) => void
  year: string
  onYearChange: (y: string) => void
  minRating: string
  onMinRatingChange: (r: string) => void
  hasActiveFilters: boolean
  onClearAll: () => void
  t: typeof locales.en.browse
}) {
  const TYPE_OPTS: { value: DiscoverMediaType; label: string }[] = [
    { value: 'all', label: t.types.all },
    { value: 'movie', label: t.types.movies },
    { value: 'tv', label: t.types.tv },
    { value: 'anime', label: t.types.anime },
  ]

  const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
    { value: 'popularity.desc', label: t.sortOptions.popular },
    { value: 'vote_average.desc', label: t.sortOptions.topRated },
    { value: 'newest', label: t.sortOptions.newest },
    { value: 'oldest', label: t.sortOptions.oldest },
  ]

  const YEAR_OPTIONS = [
    { value: '', label: t.anyYear },
    ...YEAR_VALS.slice(1).map(y => ({ value: y, label: y })),
  ]

  const RATING_OPTIONS = RATING_VALS.map(v => ({
    value: v,
    label: v === '' ? t.anyRating : `${v} +`,
  }))

  const genreOptions =
    type === 'movie'
      ? [{ value: '', label: t.allGenres }, ...MOVIE_GENRES.map(g => ({ value: String(g.id), label: g.name }))]
      : type === 'tv'
      ? [{ value: '', label: t.allGenres }, ...TV_GENRES.map(g => ({ value: String(g.id), label: g.name }))]
      : type === 'anime'
      ? [{ value: '', label: t.allGenres }, ...ANILIST_GENRES.map(g => ({ value: g, label: g }))]
      : []

  const networkOptions = type === 'tv'
    ? TV_NETWORKS.map(n => n.value === '' ? { ...n, label: t.allNetworks } : n)
    : type === 'movie'
    ? MOVIE_STUDIOS.map(n => n.value === '' ? { ...n, label: t.allStudios } : n)
    : null
  const networkLabel = type === 'movie' ? t.studio : t.network

  return (
    <div className="space-y-5">
      {/* Type */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-tertiary)' }}>
          {t.types.all}
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TYPE_OPTS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTypeChange(opt.value)}
              className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={
                type === opt.value
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 12px var(--accent-glow)' }
                  : { background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <FilterDropdown label={t.sortBy} value={sortBy} onChange={v => onSortChange(v as DiscoverSort)} options={SORT_OPTIONS} />

      {/* Genre */}
      {genreOptions.length > 0 && (
        <FilterDropdown label={t.genre} value={genre} onChange={onGenreChange} options={genreOptions} />
      )}

      {/* Network / Studio */}
      {networkOptions && (
        <FilterDropdown label={networkLabel} value={networkId} onChange={onNetworkChange} options={networkOptions} />
      )}

      {/* Year */}
      <FilterDropdown label={t.releaseYear} value={year} onChange={onYearChange} options={YEAR_OPTIONS} />

      {/* Min Rating */}
      <FilterDropdown label={t.minRating} value={minRating} onChange={onMinRatingChange} options={RATING_OPTIONS} />

      {/* Clear all */}
      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClearAll}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <RotateCcw style={{ width: 11, height: 11 }} />
          {t.clearFilters}
        </button>
      )}
    </div>
  )
}

// ─── useDiscover hook ─────────────────────────────────────────────────────────

function useDiscover() {
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [type, setTypeState] = useState<DiscoverMediaType>('all')
  const [sortBy, setSortByState] = useState<DiscoverSort>('popularity.desc')
  const [genre, setGenreState] = useState('')
  const [networkId, setNetworkIdState] = useState('')
  const [year, setYearState] = useState('')
  const [minRating, setMinRatingState] = useState('')

  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MediaItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const fetchIdRef = useRef(0)

  // Debounce raw query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 450)
    return () => clearTimeout(t)
  }, [rawQuery])

  // Primary fetch: replaces items on every filter change (always page 1)
  useEffect(() => {
    const id = ++fetchIdRef.current
    const ctrl = new AbortController()
    setLoading(true)
    setItems([])
    setPage(1)
    setTotalPages(1)
    setTotalResults(0)

    const genreIdNum = genre && !isNaN(Number(genre)) ? Number(genre) : undefined
    const yearNum = year ? Number(year) : undefined
    const ratingNum = minRating ? Number(minRating) : undefined
    const networkNum = networkId ? Number(networkId) : undefined

    const run = type === 'anime'
      ? discoverAnime(
          {
            search: debouncedQuery || undefined,
            genre: genre && isNaN(Number(genre)) ? genre : undefined, // AniList uses string genre
            sortBy,
            year: yearNum,
            minRating: ratingNum,
            page: 1,
          },
          ctrl.signal
        )
      : discoverCatalog(
          {
            type,
            query: debouncedQuery || undefined,
            genreId: genreIdNum,
            sortBy,
            page: 1,
            networkId: networkNum,
            year: yearNum,
            minRating: ratingNum,
          },
          ctrl.signal
        )

    run
      .then((result: DiscoverResult | { results: MediaItem[]; totalPages: number; totalResults: number }) => {
        if (fetchIdRef.current !== id) return
        setItems(result.results)
        setTotalPages(result.totalPages)
        setTotalResults(result.totalResults)
      })
      .catch((err: unknown) => { if ((err as Error)?.name !== 'AbortError') console.error(err) })
      .finally(() => { if (fetchIdRef.current === id) setLoading(false) })

    return () => ctrl.abort()
  }, [debouncedQuery, type, sortBy, genre, networkId, year, minRating])

  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    const id = ++fetchIdRef.current
    setLoadingMore(true)

    const genreIdNum = genre && !isNaN(Number(genre)) ? Number(genre) : undefined
    const yearNum = year ? Number(year) : undefined
    const ratingNum = minRating ? Number(minRating) : undefined
    const networkNum = networkId ? Number(networkId) : undefined

    try {
      const result = type === 'anime'
        ? await discoverAnime({ search: debouncedQuery || undefined, genre: genre && isNaN(Number(genre)) ? genre : undefined, sortBy, year: yearNum, minRating: ratingNum, page: nextPage })
        : await discoverCatalog({ type, query: debouncedQuery || undefined, genreId: genreIdNum, sortBy, page: nextPage, networkId: networkNum, year: yearNum, minRating: ratingNum })

      if (fetchIdRef.current !== id) return
      setItems(prev => {
        const seen = new Set(prev.map(x => `${x.media_type}-${x.id}`))
        return [...prev, ...result.results.filter(x => !seen.has(`${x.media_type}-${x.id}`))]
      })
      setPage(nextPage)
      setTotalPages(result.totalPages)
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.error(err)
    } finally {
      if (fetchIdRef.current === id) setLoadingMore(false)
    }
  }, [type, debouncedQuery, sortBy, genre, networkId, year, minRating, page])

  function setType(t: DiscoverMediaType) {
    setTypeState(t)
    setGenreState('')
    setNetworkIdState('')
  }

  function clearAll() {
    setSortByState('popularity.desc')
    setGenreState('')
    setNetworkIdState('')
    setYearState('')
    setMinRatingState('')
  }

  const hasActiveFilters = !!genre || !!networkId || !!year || !!minRating || sortBy !== 'popularity.desc'

  return {
    rawQuery, setRawQuery,
    debouncedQuery,
    type, setType,
    sortBy, setSortBy: setSortByState,
    genre, setGenre: setGenreState,
    networkId, setNetworkId: setNetworkIdState,
    year, setYear: setYearState,
    minRating, setMinRating: setMinRatingState,
    items, loading, loadingMore,
    totalPages, totalResults, page,
    loadMore, clearAll, hasActiveFilters,
  }
}

// ─── BrowsePage ───────────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
} as const
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const

export function BrowsePage() {
  const franchisesRef = useRef<HTMLDivElement>(null)
  const d = useDiscover()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const { settings } = useAuth()
  const lang = settings.language ?? 'en'
  const t = locales[lang]

  function scrollFranchises(dir: 'left' | 'right') {
    franchisesRef.current?.scrollBy({
      left: dir === 'left' ? -franchisesRef.current.clientWidth * 0.75 : franchisesRef.current.clientWidth * 0.75,
      behavior: 'smooth',
    })
  }

  if (!hasTmdbCredentials) {
    return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  }

  const filterProps = {
    type: d.type, onTypeChange: d.setType,
    sortBy: d.sortBy, onSortChange: d.setSortBy,
    genre: d.genre, onGenreChange: d.setGenre,
    networkId: d.networkId, onNetworkChange: d.setNetworkId,
    year: d.year, onYearChange: d.setYear,
    minRating: d.minRating, onMinRatingChange: d.setMinRating,
    hasActiveFilters: d.hasActiveFilters, onClearAll: d.clearAll,
    t: t.browse,
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-20 sm:pt-24 animate-fade-up">

      {/* Page Header */}
      <div className="space-y-2 mb-12">
        <h1 className="text-3xl sm:text-4xl font-normal text-white" style={{ fontFamily: 'DM Serif Display, serif' }}>
          {t.nav.browse}
        </h1>
        <p className="text-sm text-white/50 max-w-2xl leading-relaxed">
          {lang === 'pl'
            ? 'Filmy, seriale, klasyki i huby studyjne we wszystkich gatunkach i franczyzach.'
            : 'Explore movies, TV shows, timeless classics, and studio hubs across all your favorite genres and franchises.'}
        </p>
      </div>

      {/* ── Studio Hubs ─────────────────────────────────────────────────── */}
      <section className="mb-12">
        <SectionHeader
          title={lang === 'pl' ? 'Huby Studyjne' : 'Studio Hubs'}
          subtitle={lang === 'pl' ? 'Przeglądaj według sieci i wytwórni filmowej' : 'Explore by network and production company'}
        />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.values(NETWORKS).map(network => (
            <Link
              key={network.id}
              to={`/network/${network.id}`}
              className="group relative flex items-center justify-center rounded-2xl aspect-video transition-all hover:scale-[1.02] hover:border-white/20 border border-white/5 overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${network.color}25, ${network.color}03)`, backdropFilter: 'blur(8px)' }}
            >
              {network.logo_path ? (
                <img src={imageUrl(network.logo_path, 'w342')} alt={network.name}
                  className="max-w-[80%] max-h-[60%] object-contain opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  style={{ filter: network.filter }} />
              ) : (
                <span className="text-sm font-bold tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity text-white">{network.name}</span>
              )}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity pointer-events-none" style={{ backgroundColor: network.color }} />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Franchises & Collections ────────────────────────────────────── */}
      <section className="mb-16">
        <SectionHeader
          title={lang === 'pl' ? 'Franczyzy i Kolekcje' : 'Franchises & Collections'}
          subtitle={lang === 'pl' ? 'Epickie maratony filmowe i kolekcje seriali' : 'Epic movie marathons and series collections'}
        />
        <div className="relative group/rail">
          <button type="button" onClick={() => scrollFranchises('left')} tabIndex={-1} aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>
          <div ref={franchisesRef} className="flex gap-4 overflow-x-auto pb-4 rail">
            {FRANCHISES.map(f => (
              <div key={f.id} className="w-[260px] sm:w-[300px] shrink-0">
                <CollectionCard id={f.id} fallbackTitle={f.title} />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => scrollFranchises('right')} tabIndex={-1} aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer' }}>
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </section>

      {/* ── Discover (sidebar + content) ────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-2 mb-6">
          <SlidersHorizontal className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h2 className="text-xl font-semibold text-white">{t.browse.discover}</h2>
          {d.hasActiveFilters && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: 'var(--accent)', color: '#fff' }}>
              {t.browse.filtered}
            </span>
          )}
        </div>

        <div className="flex gap-6 xl:gap-8 items-start">

          {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
          <aside
            className="hidden lg:block shrink-0 w-52 xl:w-56 sticky self-start"
            style={{ top: '6rem' }}
          >
            <div className="rounded-2xl p-4 space-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <FilterPanelContent {...filterProps} />
            </div>
          </aside>

          {/* ── Content area ────────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Search bar */}
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: 14, height: 14, color: 'var(--text-tertiary)' }} />
              <input
                value={d.rawQuery}
                onChange={e => d.setRawQuery(e.target.value)}
                placeholder={t.search.placeholder}
                className="w-full pl-10 pr-9 py-2.5 rounded-xl text-sm outline-none transition-colors"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--border-hover)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <AnimatePresence>
                {d.rawQuery && (
                  <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 0.12 }}
                    type="button" onClick={() => d.setRawQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full" style={{ background: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                    <X style={{ width: 11, height: 11 }} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile filter toggle */}
            <div className="lg:hidden mb-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(o => !o)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{
                    background: mobileFiltersOpen ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                    border: `1px solid ${mobileFiltersOpen ? 'var(--border-hover)' : 'var(--border)'}`,
                    color: 'var(--text-secondary)',
                  }}
                >
                  <SlidersHorizontal style={{ width: 13, height: 13 }} />
                  {t.browse.filters}
                  {d.hasActiveFilters && (
                    <span className="w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center" style={{ background: 'var(--accent)', color: '#fff' }}>
                      ✓
                    </span>
                  )}
                  <ChevronDown style={{ width: 13, height: 13, transform: mobileFiltersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {!d.loading && d.totalResults > 0 && (
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {d.totalResults.toLocaleString()} {t.browse.results}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {mobileFiltersOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      <FilterPanelContent {...filterProps} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop results count */}
            <AnimatePresence>
              {!d.loading && d.totalResults > 0 && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="hidden lg:block text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
                  {d.totalResults.toLocaleString()} {t.browse.results}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Grid */}
            {d.loading ? (
              <GridSkeleton columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4" />
            ) : d.items.length === 0 ? (
              <EmptyPanel label={t.browse.noResults} description={t.browse.noResultsHint} />
            ) : (
              <>
                <motion.div
                  key={`${d.type}-${d.genre}-${d.networkId}-${d.year}-${d.minRating}-${d.sortBy}-${d.debouncedQuery}`}
                  className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                  variants={gridVariants}
                  initial="hidden"
                  animate="show"
                >
                  {d.items.map(item => (
                    <motion.div key={`${item.media_type ?? 'x'}-${item.id}`} variants={itemVariants}>
                      <MediaCard item={item} />
                    </motion.div>
                  ))}
                </motion.div>

                {d.page < d.totalPages && (
                  <div className="flex justify-center mt-10">
                    <button
                      type="button"
                      onClick={d.loadMore}
                      disabled={d.loadingMore}
                      className="flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-medium transition-all disabled:opacity-50 cursor-pointer"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    >
                      {d.loadingMore ? (
                        <>
                          <svg className="animate-spin" style={{ width: 14, height: 14 }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                          </svg>
                          {t.common.loading}
                        </>
                      ) : t.browse.loadMore}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
