import { createPortal } from 'react-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useLocation } from 'react-router-dom'
import { Search, X, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useHomeCatalog, STORAGE_KEYS } from './hooks'
import { MediaGrid } from './ui'
import { mediaTypeFromItem } from './lib/tmdb'

const MAX_RECENT = 8

function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.recentSearches)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveRecentSearch(query: string) {
  const q = query.trim()
  if (q.length < 2) return
  const prev = readRecentSearches()
  const next = [q, ...prev.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, MAX_RECENT)
  window.localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next))
}

function removeRecentSearch(query: string) {
  const prev = readRecentSearches()
  const next = prev.filter(r => r !== query)
  window.localStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(next))
}

// ─── SearchOverlay (portal-mounted so it always sits above everything) ────────

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''
  const [localQuery, setLocalQuery] = useState(urlQuery)

  // Sync back from URL if it changes (e.g., navigating back)
  useEffect(() => {
    setLocalQuery(urlQuery)
  }, [urlQuery])

  // Debounce syncing local query to the URL search params (which triggers the actual search)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== urlQuery) {
        const nextParams = new URLSearchParams(searchParams)
        if (localQuery.trim()) nextParams.set('q', localQuery)
        else nextParams.delete('q')
        setSearchParams(nextParams, { replace: true })
      }
    }, 600) // 600ms delay between keypresses
    return () => clearTimeout(timer)
  }, [localQuery, urlQuery, searchParams, setSearchParams])

  const homeState = useHomeCatalog(urlQuery)
  const results = urlQuery.trim().length >= 2 ? homeState.searchResults : homeState.recommendations
  const [filter, setFilter] = useState<'all' | 'movie' | 'tv' | 'anime'>('all')
  const [isFocused, setIsFocused] = useState(false)
  const location = useLocation()
  const [recentSearches, setRecentSearches] = useState<string[]>(readRecentSearches)

  // Save to recent searches once the debounced query commits to the URL
  useEffect(() => {
    if (urlQuery.trim().length >= 2) {
      saveRecentSearch(urlQuery)
      setRecentSearches(readRecentSearches())
    }
  }, [urlQuery])

  const deleteRecent = useCallback((q: string) => {
    removeRecentSearch(q)
    setRecentSearches(readRecentSearches())
  }, [])

  // Store the initial pathname when the search overlay was opened
  const openPath = useRef(location.pathname)

  // Close the search overlay when navigating to a new route/pathname
  useEffect(() => {
    if (location.pathname !== openPath.current) {
      onClose()
    }
  }, [location.pathname, onClose])

  const filteredResults = filter === 'all' ? results : results.filter(r => mediaTypeFromItem(r) === filter)

  const overlay = (
    <AnimatePresence>
      <motion.div
        key="search-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        // Full-screen fixed, above everything (z-[200] beats nav z-50)
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: 'rgba(8,8,8,0.97)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        // Click backdrop to close
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        {/* ── Search bar ────────────────────────────────────────────────── */}
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              padding: '24px 28px',
              maxWidth: '1200px',
              margin: '0 auto',
              width: '100%',
            }}
          >
            {/* Glassmorphic input wrapper */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 20px',
                height: 54,
                background: 'rgba(255, 255, 255, 0.05)',
                border: isFocused ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 27,
                flex: 1,
                boxShadow: isFocused 
                  ? 'inset 0 1px 1px rgba(255,255,255,0.05), 0 0 20px var(--accent-dim), 0 8px 32px rgba(0,0,0,0.3)'
                  : 'inset 0 1px 1px rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.3)',
                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <Search style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0 }} />
              <input
                id="search-input"
                autoFocus
                value={localQuery}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onChange={(e) => setLocalQuery(e.target.value)}
                placeholder="Search movies, TV shows, anime..."
                className="flex-1 bg-transparent border-none outline-none text-base font-normal text-white placeholder-white/30 font-sans min-w-0 focus:ring-0 focus:outline-none"
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  fontWeight: 400,
                  color: '#fff',
                  fontFamily: 'Inter, sans-serif',
                  minWidth: 0,
                }}
              />
              {localQuery && (
                <button
                  type="button"
                  className="no-bg-hover"
                  onClick={() => setLocalQuery('')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.1)',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  <X style={{ width: 12, height: 12 }} />
                </button>
              )}
            </div>

            {/* Premium close button */}
            <button
              type="button"
              className="no-bg-hover"
              onClick={onClose}
              aria-label="Close search"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                flexShrink: 0,
                color: 'rgba(255,255,255,0.7)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
                e.currentTarget.style.color = '#fff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
              }}
            >
              <X style={{ width: 18, height: 18 }} />
            </button>
          </motion.div>

          {/* Filters */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="flex gap-2 px-7 pb-4 max-w-[1200px] mx-auto w-full justify-center"
          >
            {([
              { key: 'all',   label: 'All' },
              { key: 'movie', label: 'Movies' },
              { key: 'tv',    label: 'TV Shows' },
              { key: 'anime', label: 'Anime' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
                style={{
                  background: filter === key ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                  color: filter === key ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${filter === key ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`
                }}
              >
                {label}
              </button>
            ))}
          </motion.div>
        </div>

        {/* ── Results ────────────────────────────────────────────────────── */}
        <div 
          style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) {
              onClose()
            }
          }}
        >
          <div style={{ maxWidth: '1536px', margin: '0 auto' }}>
            {/* Recent searches row — only shown when no active query */}
            {urlQuery.trim().length < 2 && recentSearches.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Recent searches
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {recentSearches.map(q => (
                    <div
                      key={q}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '6px 12px 6px 10px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.07)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)' }}
                      onClick={() => setLocalQuery(q)}
                    >
                      <Clock style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', userSelect: 'none' }}>{q}</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteRecent(q) }}
                        aria-label={`Remove "${q}" from recent searches`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'rgba(255,255,255,0.35)',
                          padding: 0,
                          marginLeft: 2,
                          flexShrink: 0,
                        }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.8)' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)' }}
                      >
                        <X style={{ width: 10, height: 10 }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {urlQuery.trim().length >= 2 ? (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>
                {homeState.loading ? 'Searching…' : `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''} for "${urlQuery}"`}
              </p>
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>
                {filter === 'anime' ? 'Trending anime' : 'Trending right now'}
              </p>
            )}
            <MediaGrid
              items={filteredResults}
              loading={homeState.loading && results.length === 0}
              emptyLabel="No results. Try a different filter."
              columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              stagger
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}

// ─── HomeSearchToggle ─────────────────────────────────────────────────────────

export function HomeSearchToggle() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center w-10 h-10 rounded-full text-sm transition-all lg:w-64 lg:justify-start lg:gap-2 lg:px-4 lg:h-10"
        style={{
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        <Search className="w-4 h-4 shrink-0" />
        <span className="hidden lg:inline">Search…</span>
      </button>
      {open && <SearchOverlay onClose={() => setOpen(false)} />}
    </>
  )
}
