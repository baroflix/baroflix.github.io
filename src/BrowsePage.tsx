import { useCollectionDetails } from './hooks'
import { SectionHeader, MediaCard, GridSkeleton, EmptyPanel, SetupNotice } from './ui'
import { hasTmdbCredentials, imageUrl, discoverCatalog } from './lib/tmdb'
import type { DiscoverMediaType, DiscoverSort, DiscoverResult } from './lib/tmdb'
import type { MediaItem } from './types'
import { Link } from 'react-router-dom'
import { NETWORKS } from './NetworkPage'
import { ChevronLeft, ChevronRight, Search, X, SlidersHorizontal } from 'lucide-react'
import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Data ─────────────────────────────────────────────────────────────────────

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
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 27, name: 'Horror' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
]

const TV_GENRES = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 9648, name: 'Mystery' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10768, name: 'War & Politics' },
  { id: 10764, name: 'Reality' },
  { id: 37, name: 'Western' },
]

const SORT_OPTIONS: { value: DiscoverSort; label: string }[] = [
  { value: 'popularity.desc', label: 'Popular' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
]

const TYPE_OPTIONS: { value: DiscoverMediaType; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
  { value: 'anime', label: 'Anime' },
]

// ─── CollectionCard ───────────────────────────────────────────────────────────

function CollectionCard({ id, fallbackTitle }: { id: number; fallbackTitle: string }) {
  const { details } = useCollectionDetails(String(id))
  const title = details?.name || fallbackTitle
  const image = imageUrl(details?.backdrop_path, 'w780') || imageUrl(details?.poster_path, 'w500')

  return (
    <Link
      to={`/collection/${id}`}
      className="group relative overflow-hidden block transition-transform hover:-translate-y-1"
      style={{ aspectRatio: '16/9', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
      )}
      <div className="absolute inset-0 transition-opacity" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.95), transparent 70%)' }} />
      <div className="absolute bottom-5 left-5 right-5">
        <h3 className="text-lg font-medium text-white truncate" style={{ fontFamily: 'DM Serif Display, serif' }}>
          {title}
        </h3>
      </div>
    </Link>
  )
}

// ─── Pill button ──────────────────────────────────────────────────────────────

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 cursor-pointer"
      style={
        active
          ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px var(--accent-glow)' }
          : {
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.09)',
            }
      }
    >
      {children}
    </button>
  )
}

// ─── Discover Hook ────────────────────────────────────────────────────────────

function useDiscover() {
  const [rawQuery, setRawQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [type, setType] = useState<DiscoverMediaType>('all')
  const [genreId, setGenreId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<DiscoverSort>('popularity.desc')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<MediaItem[]>([])
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const fetchIdRef = useRef(0)

  // Debounce raw query → debouncedQuery
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(rawQuery), 450)
    return () => clearTimeout(t)
  }, [rawQuery])

  // Primary fetch: runs on filter changes (always page 1, replaces items)
  useEffect(() => {
    const id = ++fetchIdRef.current
    const ctrl = new AbortController()

    setLoading(true)
    setItems([])
    setPage(1)
    setTotalPages(1)
    setTotalResults(0)

    discoverCatalog(
      { type, query: debouncedQuery || undefined, genreId, sortBy, page: 1 },
      ctrl.signal
    )
      .then((result: DiscoverResult) => {
        if (fetchIdRef.current !== id) return
        setItems(result.results)
        setTotalPages(result.totalPages)
        setTotalResults(result.totalResults)
      })
      .catch((err: unknown) => {
        if ((err as Error)?.name !== 'AbortError') console.error(err)
      })
      .finally(() => {
        if (fetchIdRef.current === id) setLoading(false)
      })

    return () => ctrl.abort()
  }, [debouncedQuery, type, genreId, sortBy])

  // Load more (appends to items)
  const loadMore = useCallback(async () => {
    const nextPage = page + 1
    const id = ++fetchIdRef.current
    setLoadingMore(true)

    try {
      const result = await discoverCatalog({ type, query: debouncedQuery || undefined, genreId, sortBy, page: nextPage })
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
  }, [type, debouncedQuery, genreId, sortBy, page])

  function changeType(newType: DiscoverMediaType) {
    setType(newType)
    setGenreId(undefined) // clear genre when type changes
  }

  return {
    rawQuery, setRawQuery,
    debouncedQuery,
    type, setType: changeType,
    genreId, setGenreId,
    sortBy, setSortBy,
    items, loading, loadingMore,
    totalPages, totalResults, page,
    loadMore,
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
  const discover = useDiscover()

  function scrollFranchises(dir: 'left' | 'right') {
    if (!franchisesRef.current) return
    franchisesRef.current.scrollBy({
      left: dir === 'left' ? -franchisesRef.current.clientWidth * 0.75 : franchisesRef.current.clientWidth * 0.75,
      behavior: 'smooth',
    })
  }

  if (!hasTmdbCredentials) {
    return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  }

  const genres = discover.type === 'movie' ? MOVIE_GENRES : discover.type === 'tv' ? TV_GENRES : []
  const showGenres = genres.length > 0

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-20 sm:pt-24 space-y-12 animate-fade-up">

      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-normal text-white" style={{ fontFamily: 'DM Serif Display, serif' }}>
          Browse Catalog
        </h1>
        <p className="text-sm text-white/50 max-w-2xl leading-relaxed">
          Explore movies, TV shows, timeless classics, and studio hubs across all your favorite genres and franchises.
        </p>
      </div>

      {/* ── Studio Hubs ─────────────────────────────────────────────────── */}
      <section className="pt-2">
        <SectionHeader title="Studio Hubs" subtitle="Explore by network and production company" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.values(NETWORKS).map(network => (
            <Link
              key={network.id}
              to={`/network/${network.id}`}
              className="group relative flex items-center justify-center rounded-2xl aspect-video transition-all hover:scale-[1.02] hover:border-white/20 border border-white/5 p-4 bg-white/2 shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${network.color}25, ${network.color}03)`,
                backdropFilter: 'blur(8px)',
              }}
            >
              {network.logo_path ? (
                <img
                  src={imageUrl(network.logo_path, 'w342')}
                  alt={network.name}
                  className="max-w-[80%] max-h-[60%] object-contain opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  style={{ filter: network.filter }}
                />
              ) : (
                <span className="text-sm sm:text-base font-bold tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity text-white">
                  {network.name}
                </span>
              )}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-300 pointer-events-none"
                style={{ backgroundColor: network.color }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Franchises & Collections ────────────────────────────────────── */}
      <section>
        <SectionHeader title="Franchises & Collections" subtitle="Epic movie marathons and series collections" />
        <div className="relative group/rail">
          <button
            type="button"
            onClick={() => scrollFranchises('left')}
            tabIndex={-1}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>

          <div ref={franchisesRef} className="flex gap-4 overflow-x-auto pb-4 rail">
            {FRANCHISES.map(f => (
              <div key={f.id} className="w-[260px] sm:w-[300px] shrink-0">
                <CollectionCard id={f.id} fallbackTitle={f.title} />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollFranchises('right')}
            tabIndex={-1}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </section>

      {/* ── Discover ────────────────────────────────────────────────────── */}
      <section>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <SlidersHorizontal className="w-5 h-5 text-white/40" />
          <div>
            <h2 className="text-xl font-semibold text-white">Discover</h2>
            <p className="text-xs text-white/40 mt-0.5">Search and filter the full catalog</p>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.3)' }}
          />
          <input
            value={discover.rawQuery}
            onChange={e => discover.setRawQuery(e.target.value)}
            placeholder="Search movies, shows, anime..."
            className="w-full pl-11 pr-10 py-3 rounded-2xl text-sm text-white placeholder:text-white/25 outline-none transition-colors"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
          />
          <AnimatePresence>
            {discover.rawQuery && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15 }}
                type="button"
                onClick={() => discover.setRawQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors"
                style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)' }}
              >
                <X style={{ width: 12, height: 12 }} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Controls row: type + sort */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          {/* Type pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 shrink-0" style={{ scrollbarWidth: 'none' }}>
            {TYPE_OPTIONS.map(opt => (
              <Pill
                key={opt.value}
                active={discover.type === opt.value}
                onClick={() => discover.setType(opt.value)}
              >
                {opt.label}
              </Pill>
            ))}
          </div>

          {/* Divider */}
          <div className="hidden sm:block w-px h-5 self-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.1)' }} />

          {/* Sort pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 sm:ml-auto" style={{ scrollbarWidth: 'none' }}>
            {SORT_OPTIONS.map(opt => (
              <Pill
                key={opt.value}
                active={discover.sortBy === opt.value}
                onClick={() => discover.setSortBy(opt.value)}
              >
                {opt.label}
              </Pill>
            ))}
          </div>
        </div>

        {/* Genre chips */}
        <AnimatePresence>
          {showGenres && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto pb-3 mb-2" style={{ scrollbarWidth: 'none' }}>
                <Pill
                  active={discover.genreId === undefined}
                  onClick={() => discover.setGenreId(undefined)}
                >
                  All Genres
                </Pill>
                {genres.map(g => (
                  <Pill
                    key={g.id}
                    active={discover.genreId === g.id}
                    onClick={() => discover.setGenreId(discover.genreId === g.id ? undefined : g.id)}
                  >
                    {g.name}
                  </Pill>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results count */}
        <AnimatePresence>
          {!discover.loading && discover.totalResults > 0 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs mb-4"
              style={{ color: 'rgba(255,255,255,0.25)' }}
            >
              {discover.totalResults.toLocaleString()} results
            </motion.p>
          )}
        </AnimatePresence>

        {/* Grid */}
        {discover.loading ? (
          <GridSkeleton columnsClassName="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" />
        ) : discover.items.length === 0 ? (
          <EmptyPanel label="No results found" description="Try a different search term or adjust your filters." />
        ) : (
          <>
            <motion.div
              key={`${discover.type}-${discover.genreId}-${discover.sortBy}-${discover.debouncedQuery}`}
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
              variants={gridVariants}
              initial="hidden"
              animate="show"
            >
              {discover.items.map(item => (
                <motion.div
                  key={`${item.media_type ?? 'unknown'}-${item.id}`}
                  variants={itemVariants}
                >
                  <MediaCard item={item} />
                </motion.div>
              ))}
            </motion.div>

            {/* Load more */}
            {discover.page < discover.totalPages && (
              <div className="flex justify-center mt-10">
                <button
                  type="button"
                  onClick={discover.loadMore}
                  disabled={discover.loadingMore}
                  className="flex items-center gap-2 px-8 py-2.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.65)',
                  }}
                >
                  {discover.loadingMore ? (
                    <>
                      <svg
                        className="animate-spin"
                        style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.5)' }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
                      </svg>
                      Loading...
                    </>
                  ) : (
                    'Load More'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
