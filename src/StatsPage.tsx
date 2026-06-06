import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Film, Tv, Star, Flame, Sparkles, Trophy, Play,
  X, ChevronLeft, ChevronRight, User, CheckCircle2,
  ArrowUpDown, AlignLeft, Percent, Timer, Clapperboard,
} from 'lucide-react'
import { useWatchHistory, useProgressStore, useWatchedEpisodes } from './hooks'
import { fetchTitleDetails, imageUrl } from './lib/tmdb'
import { fetchAnimeDetails } from './lib/anilist'
import type { MediaDetails } from './types'

// ─── helpers ─────────────────────────────────────────────────────────────────

function minutesFromSeconds(s: number) { return Math.floor(s / 60) }

function fmtMinutes(m: number): string {
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rem = m % 60
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`
}

type SortKey = 'name' | 'completion' | 'time'

// ─── StatsPage ────────────────────────────────────────────────────────────────

export function StatsPage() {
  const history = useWatchHistory()
  const progress = useProgressStore()
  const [watchedEpisodes] = useWatchedEpisodes()

  const [detailsMap, setDetailsMap] = useState<Record<string, MediaDetails>>({})
  const [loadingDetails, setLoadingDetails] = useState(true)

  // Wrapped slider
  const [showWrapped, setShowWrapped] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 6

  const handleNextSlide = () => {
    if (currentSlide < totalSlides - 1) setCurrentSlide(p => p + 1)
    else setShowWrapped(false)
  }
  const handlePrevSlide = () => { if (currentSlide > 0) setCurrentSlide(p => p - 1) }

  useEffect(() => {
    if (!showWrapped) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') { e.preventDefault(); handleNextSlide() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); handlePrevSlide() }
      else if (e.key === 'Escape') setShowWrapped(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showWrapped, currentSlide])

  // ── unique titles from history ─────────────────────────────────────────────
  const uniqueTitles = useMemo(() => {
    const seen = new Set<string>()
    return history.filter(h => {
      const key = `${h.mediaType}-${h.id}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [history])

  // ── load details for all unique titles ────────────────────────────────────
  useEffect(() => {
    if (!uniqueTitles.length) { setLoadingDetails(false); return }
    const controller = new AbortController()
    setLoadingDetails(true)

    async function load() {
      const batch = uniqueTitles.slice(0, 50)
      const settled = await Promise.allSettled(
        batch.map(item => {
          const fetcher = item.mediaType === 'anime'
            ? fetchAnimeDetails(String(item.id), controller.signal)
            : fetchTitleDetails(item.mediaType, String(item.id), controller.signal)
          return fetcher.then(d => ({ key: `${item.mediaType}-${item.id}`, d }))
        })
      )
      if (controller.signal.aborted) return
      const map: Record<string, MediaDetails> = {}
      for (const r of settled) {
        if (r.status === 'fulfilled') map[r.value.key] = r.value.d
      }
      setDetailsMap(map)
      setLoadingDetails(false)
    }
    void load()
    return () => controller.abort()
  }, [uniqueTitles.map(u => `${u.mediaType}-${u.id}`).join(',')])

  // ── global totals ──────────────────────────────────────────────────────────
  const totalSeconds = Object.values(progress).reduce((a, b) => a + b, 0)
  const totalMinutes = minutesFromSeconds(totalSeconds)

  const movieCount  = history.filter(h => h.mediaType === 'movie').length
  const tvCount     = history.filter(h => h.mediaType === 'tv').length
  const animeCount  = history.filter(h => h.mediaType === 'anime').length

  // ── genres / actors from loaded details ───────────────────────────────────
  const allDetails = Object.values(detailsMap)

  const genreCounts: Record<string, number> = {}
  allDetails.forEach(d => d.genres?.forEach(g => {
    genreCounts[g.name] = (genreCounts[g.name] || 0) + 1
  }))
  const topGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)

  const actorCounts: Record<string, { count: number; profilePath?: string | null }> = {}
  allDetails.forEach(d => {
    d.credits?.cast?.slice(0, 8).forEach(actor => {
      if (!actorCounts[actor.name]) actorCounts[actor.name] = { count: 0, profilePath: actor.profile_path }
      actorCounts[actor.name].count += 1
    })
  })
  const topActors = Object.entries(actorCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 5)

  // ── per-title stats ────────────────────────────────────────────────────────
  const [sortKey, setSortKey] = useState<SortKey>('time')

  const titleRows = useMemo(() => {
    return uniqueTitles.map(entry => {
      const prefix = `${entry.mediaType}-${entry.id}-`

      // total seconds for this title
      const secs = Object.entries(progress)
        .filter(([k]) => k.startsWith(prefix))
        .reduce((sum, [, v]) => sum + v, 0)

      // episodes watched = union of manually marked + >5 min progress
      const byProgress = new Set(
        Object.entries(progress)
          .filter(([k, v]) => k.startsWith(prefix) && v >= 300)
          .map(([k]) => k)
      )
      const byManual = Array.from(watchedEpisodes).filter(k => k.startsWith(prefix))
      const allWatchedKeys = new Set([...byProgress, ...byManual])
      const episodesWatched = allWatchedKeys.size

      // total episodes from loaded details
      const details = detailsMap[`${entry.mediaType}-${entry.id}`]
      const totalEp = details?.number_of_episodes ?? null

      // completion %
      let completion: number | null = null
      if (entry.mediaType === 'movie') {
        // movie: use progress ratio against runtime (or treat as 100 if >5min)
        const runtime = (details as any)?.runtime ?? 90
        completion = Math.min(100, Math.round((secs / (runtime * 60)) * 100))
      } else if (totalEp) {
        completion = Math.min(100, Math.round((episodesWatched / totalEp) * 100))
      }

      return {
        ...entry,
        secs,
        minutes: minutesFromSeconds(secs),
        episodesWatched,
        totalEp,
        completion,
        details,
      }
    })
  }, [uniqueTitles, progress, watchedEpisodes, detailsMap])

  const sortedRows = useMemo(() => {
    return [...titleRows].sort((a, b) => {
      if (sortKey === 'name') return a.title.localeCompare(b.title)
      if (sortKey === 'completion') return (b.completion ?? -1) - (a.completion ?? -1)
      return b.secs - a.secs   // time
    })
  }, [titleRows, sortKey])

  // ── UI ─────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-20 sm:pt-24 min-h-screen">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-purple-500 mb-4"
              style={{ fontFamily: 'DM Serif Display, serif' }}>
              Your Baroflix Wrapped
            </h1>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
              A deep dive into your streaming habits.
            </p>
          </div>
          <button
            onClick={() => { setCurrentSlide(0); setShowWrapped(true) }}
            className="flex items-center gap-2 self-start px-5 py-3 text-sm font-bold rounded-full transition-all bg-gradient-to-r from-[var(--accent)] to-purple-500 text-white shadow-lg hover:shadow-[0_0_24px_rgba(139,92,246,0.3)] active:scale-95 shrink-0"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            Watch My Slides
          </button>
        </div>
      </motion.div>

      {/* ── Top stat cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {/* Total Time */}
        <StatCard delay={0.1} color="from-blue-500 to-cyan-400" icon={<Clock className="w-8 h-8 opacity-50" />}>
          <div className="text-5xl font-bold mb-2">{totalMinutes.toLocaleString()}</div>
          <div className="text-lg font-medium opacity-80">Minutes Watched</div>
          <div className="text-sm opacity-60 mt-1">≈ {fmtMinutes(totalMinutes)} total</div>
        </StatCard>

        {/* Movies / TV / Anime */}
        <StatCard delay={0.2} color="from-pink-500 to-rose-400" icon={<Flame className="w-8 h-8 opacity-50" />}>
          <div className="flex justify-between items-end gap-2">
            <div>
              <div className="text-3xl font-bold mb-1">{movieCount}</div>
              <div className="text-xs font-medium opacity-80 flex items-center gap-1"><Film className="w-3 h-3"/> Movies</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-3xl font-bold mb-1">{tvCount}</div>
              <div className="text-xs font-medium opacity-80 flex items-center gap-1"><Tv className="w-3 h-3"/> TV Shows</div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-3xl font-bold mb-1">{animeCount}</div>
              <div className="text-xs font-medium opacity-80 flex items-center gap-1"><Clapperboard className="w-3 h-3"/> Anime</div>
            </div>
          </div>
        </StatCard>

        {/* Top Genres */}
        <StatCard delay={0.3} color="from-amber-500 to-orange-400" icon={<Star className="w-8 h-8 opacity-50" />}>
          <div className="text-lg font-medium opacity-80 mb-3">Top Genres</div>
          {loadingDetails ? (
            <div className="animate-pulse h-16 bg-white/10 rounded" />
          ) : topGenres.length > 0 ? (
            <div className="space-y-2">
              {topGenres.map(([genre], i) => (
                <div key={genre} className="flex items-center justify-between bg-black/20 rounded-lg px-3 py-1.5">
                  <span className="font-semibold text-white truncate max-w-[150px]">{i + 1}. {genre}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm opacity-60">Not enough data yet.</div>
          )}
        </StatCard>
      </div>

      {/* ── Watched Titles list ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mb-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-white">
            Watched Titles
            <span className="ml-3 text-base font-normal" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {uniqueTitles.length} title{uniqueTitles.length !== 1 ? 's' : ''}
            </span>
          </h2>

          {/* Sort controls */}
          <div className="flex items-center gap-2 shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
            {([
              { key: 'time',       label: 'Time',       icon: <Timer className="w-3 h-3" /> },
              { key: 'name',       label: 'Name',       icon: <AlignLeft className="w-3 h-3" /> },
              { key: 'completion', label: 'Completion', icon: <Percent className="w-3 h-3" /> },
            ] as const).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: sortKey === key ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                  color: sortKey === key ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${sortKey === key ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
                }}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {sortedRows.length === 0 ? (
          <div className="py-16 text-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-white/40">Start watching something to see your stats here!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedRows.map((row, idx) => {
              const linkTo = `/title/${row.mediaType}/${row.id}`
              const posterSrc = row.posterPath
                ? (row.posterPath.startsWith('http') ? row.posterPath : imageUrl(row.posterPath, 'w342'))
                : null
              const isEpisodic = row.mediaType === 'tv' || row.mediaType === 'anime'
              const pct = row.completion ?? 0
              const badgeColor = row.mediaType === 'movie' ? '#3b82f6' : row.mediaType === 'anime' ? '#ec4899' : '#10b981'

              return (
                <motion.div
                  key={`${row.mediaType}-${row.id}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                >
                  <Link
                    to={linkTo}
                    className="flex items-center gap-4 rounded-2xl px-4 py-3 transition-all group"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold w-6 shrink-0 text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {idx + 1}
                    </span>

                    {/* Poster */}
                    <div className="shrink-0 overflow-hidden rounded-lg" style={{ width: 36, height: 54, background: 'rgba(255,255,255,0.08)' }}>
                      {posterSrc
                        ? <img src={posterSrc} alt={row.title} className="w-full h-full object-cover" loading="lazy" />
                        : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-white/20" /></div>
                      }
                    </div>

                    {/* Title + type */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-white truncate">{row.title}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ background: `${badgeColor}22`, color: badgeColor, border: `1px solid ${badgeColor}44` }}>
                          {row.mediaType === 'movie' ? 'Movie' : row.mediaType === 'anime' ? 'Anime' : 'TV'}
                        </span>
                      </div>

                      {/* Completion bar */}
                      {isEpisodic && row.totalEp ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden" style={{ maxWidth: 160 }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct === 100 ? '#10b981' : 'var(--accent)' }}
                            />
                          </div>
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {row.episodesWatched}/{row.totalEp} ep
                          </span>
                          {pct === 100 && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                        </div>
                      ) : row.mediaType === 'movie' && row.completion !== null ? (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden" style={{ maxWidth: 160 }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: pct >= 90 ? '#10b981' : 'var(--accent)' }}
                            />
                          </div>
                          {pct >= 90
                            ? <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Watched</span>
                            : <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{pct}%</span>
                          }
                        </div>
                      ) : loadingDetails ? (
                        <div className="h-1 w-24 rounded-full bg-white/10 animate-pulse mt-1" />
                      ) : null}
                    </div>

                    {/* Time */}
                    {row.minutes > 0 && (
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold text-white">{fmtMinutes(row.minutes)}</div>
                        <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>watched</div>
                      </div>
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* ── Top Actors ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <h2 className="text-2xl font-bold text-white mb-6">Most Watched Actors</h2>
        {loadingDetails ? (
          <div className="animate-pulse h-32 bg-white/5 rounded-2xl" />
        ) : topActors.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {topActors.map(([name, { profilePath, count }]) => (
              <div key={name} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white/10">
                  {profilePath && <img src={`https://image.tmdb.org/t/p/w185${profilePath}`} alt={name} className="w-full h-full object-cover" />}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-white text-sm truncate">{name}</div>
                  <div className="text-xs text-white/50">{count} appearances</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-white/50">Keep watching to discover your favorite actors!</div>
        )}
      </motion.div>

      {/* ── Wrapped Slide Deck ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showWrapped && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{ background: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,1) 0%, rgba(8,8,8,1) 100%)' }}
          >
            <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full blur-[150px] pointer-events-none opacity-20 bg-[var(--accent)]" />
            <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[150px] pointer-events-none opacity-10 bg-purple-500" />

            {/* Progress bars */}
            <div className="absolute top-6 left-6 right-6 flex gap-1.5 z-50">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <div key={idx} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--accent)]"
                    initial={{ width: '0%' }}
                    animate={{ width: idx <= currentSlide ? '100%' : '0%' }}
                    transition={{ duration: idx === currentSlide ? 0.3 : 0 }}
                  />
                </div>
              ))}
            </div>

            <button onClick={() => setShowWrapped(false)}
              className="absolute top-10 right-6 text-white/50 hover:text-white transition-colors z-50 p-2">
              <X className="w-6 h-6" />
            </button>

            <div className="w-full max-w-2xl h-[550px] relative overflow-hidden flex flex-col justify-center items-center px-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlide}
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.95 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="w-full flex flex-col items-center text-center"
                >
                  {currentSlide === 0 && (
                    <>
                      <Sparkles className="w-14 h-14 text-yellow-400 mb-6 animate-pulse" />
                      <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-[var(--accent)] to-purple-500 tracking-tight leading-none mb-4"
                        style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>
                        BAROFLIX WRAPPED
                      </h1>
                      <p className="text-base text-white/60 max-w-sm mb-10">
                        Ready to discover your year in streaming? Let's take a look.
                      </p>
                      <button onClick={handleNextSlide}
                        className="px-8 py-3.5 rounded-full text-xs font-bold bg-white text-black hover:scale-105 active:scale-95 transition-all font-sans flex items-center gap-2 shadow-xl">
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start the Show
                      </button>
                    </>
                  )}

                  {currentSlide === 1 && (
                    <>
                      <Clock className="w-14 h-14 text-blue-400 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">TIME SPENT</h2>
                      <div className="text-6xl md:text-7xl font-black text-white leading-none my-4 tracking-tight"
                        style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>
                        {totalMinutes.toLocaleString()} MIN
                      </div>
                      <p className="text-sm text-white/60 max-w-md">
                        That's <span className="text-white font-bold">{fmtMinutes(totalMinutes)}</span> of non-stop Baroflix.{' '}
                        {totalMinutes >= 60 ? `Equivalent to ${Math.round(totalMinutes / 60)} movies!` : 'Just warming up!'}
                      </p>
                    </>
                  )}

                  {currentSlide === 2 && (
                    <>
                      <Flame className="w-14 h-14 text-pink-500 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">FORMAT CLASH</h2>
                      <h3 className="text-2xl font-extrabold text-white mt-1 mb-6">What did you stream most?</h3>
                      <div className="w-full max-w-md space-y-6">
                        <div className="flex justify-between items-baseline text-[10px] font-bold uppercase tracking-wider text-white/40">
                          <span className="text-pink-400">Movies ({movieCount})</span>
                          <span className="text-rose-400">TV ({tvCount})</span>
                          <span className="text-fuchsia-400">Anime ({animeCount})</span>
                        </div>
                        {[
                          { label: 'Movies', count: movieCount, color: 'from-pink-500 to-rose-400' },
                          { label: 'TV Shows', count: tvCount, color: 'from-purple-500 to-indigo-400' },
                          { label: 'Anime', count: animeCount, color: 'from-fuchsia-500 to-pink-400' },
                        ].map(({ label, count, color }) => {
                          const total = movieCount + tvCount + animeCount || 1
                          return (
                            <div key={label}>
                              <div className="flex justify-between text-[11px] text-white/50 mb-1">
                                <span>{label}</span><span>{count}</span>
                              </div>
                              <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden border border-white/10">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / total) * 100}%` }}
                                  transition={{ duration: 1, ease: 'easeOut' }}
                                  className={`h-full bg-gradient-to-r ${color} rounded-full`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}

                  {currentSlide === 3 && (
                    <>
                      <Star className="w-14 h-14 text-amber-400 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">TOP GENRES</h2>
                      <h3 className="text-2xl font-extrabold text-white mt-1 mb-6">Your Favorite Vibes</h3>
                      {topGenres.length > 0 ? (
                        <div className="w-full max-w-md">
                          <div className="flex items-end justify-center gap-6 h-48 mt-6">
                            {topGenres.map(([genre, count], idx) => {
                              const maxCount = topGenres[0][1]
                              const pct = (count / maxCount) * 100
                              return (
                                <div key={genre} className="flex flex-col items-center flex-1 max-w-[100px]">
                                  <div className="flex-1 w-full flex items-end justify-center">
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${pct}%` }}
                                      transition={{ delay: 0.1 + idx * 0.1, duration: 0.8, ease: 'easeOut' }}
                                      className="w-full rounded-t-2xl bg-gradient-to-t from-[var(--accent)] to-purple-500 shadow-lg"
                                    />
                                  </div>
                                  <span className="text-[11px] font-semibold text-white truncate w-full mt-2 text-center">{genre}</span>
                                  <span className="text-[10px] text-white/40 mt-0.5">{count} titles</span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-white/40">Watch more titles to see your favorite genres.</div>
                      )}
                    </>
                  )}

                  {currentSlide === 4 && (
                    <>
                      <Trophy className="w-14 h-14 text-purple-400 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">STAR CAST</h2>
                      <h3 className="text-2xl font-extrabold text-white mt-1 mb-6">Your Most Watched Stars</h3>
                      {topActors.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-4 w-full">
                          {topActors.map(([name, { profilePath, count }], idx) => (
                            <motion.div
                              key={name}
                              initial={{ opacity: 0, y: 30, scale: 0.9 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ delay: 0.08 * idx, type: 'spring', stiffness: 100 }}
                              className="flex flex-col items-center p-3 rounded-2xl bg-white/5 border border-white/10"
                            >
                              <div className="w-14 h-14 rounded-full overflow-hidden mb-2 bg-white/10 border-2 border-[var(--accent)]/30 shrink-0">
                                {profilePath
                                  ? <img src={`https://image.tmdb.org/t/p/w185${profilePath}`} alt={name} className="w-full h-full object-cover" />
                                  : <User className="w-5 h-5 text-white/30" />
                                }
                              </div>
                              <span className="text-[11px] font-bold text-white truncate w-full text-center">{name}</span>
                              <span className="text-[9px] text-white/40 mt-1">{count} appearances</span>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-white/40">Keep watching to discover your favorite actors!</div>
                      )}
                    </>
                  )}

                  {currentSlide === 5 && (
                    <>
                      <div className="p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl max-w-sm w-full relative overflow-hidden text-left font-sans">
                        <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20 bg-[var(--accent)]" />
                        <h2 className="text-2xl font-black text-white tracking-wider uppercase mb-5" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                          MY BAROFLIX WRAPPED
                        </h2>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-blue-400" />
                            <div>
                              <div className="text-base font-bold text-white leading-none">{totalMinutes.toLocaleString()} minutes</div>
                              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Total Time</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Film className="w-5 h-5 text-pink-400" />
                            <div>
                              <div className="text-base font-bold text-white leading-none">{movieCount} Movies / {tvCount} TV / {animeCount} Anime</div>
                              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Preferred Format</div>
                            </div>
                          </div>
                          {topGenres.length > 0 && (
                            <div className="flex items-center gap-3">
                              <Star className="w-5 h-5 text-amber-400" />
                              <div>
                                <div className="text-xs font-bold text-white leading-none truncate max-w-[200px]">
                                  {topGenres.map(([g]) => g).join(', ')}
                                </div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Top Genres</div>
                              </div>
                            </div>
                          )}
                          {topActors.length > 0 && (
                            <div className="flex items-center gap-3">
                              <Trophy className="w-5 h-5 text-purple-400" />
                              <div>
                                <div className="text-xs font-bold text-white leading-none truncate max-w-[200px]">{topActors[0][0]}</div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Most Watched Star</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 mt-8">
                        <button onClick={() => setCurrentSlide(0)}
                          className="px-6 py-2.5 rounded-full text-xs font-bold border border-white/20 text-white hover:bg-white/5 transition-colors font-sans">
                          Replay
                        </button>
                        <button onClick={() => setShowWrapped(false)}
                          className="px-6 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-sans">
                          Done
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {currentSlide > 0 && (
              <button onClick={handlePrevSlide}
                className="absolute left-6 w-12 h-12 rounded-full border border-white/10 hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                <ChevronLeft className="w-6 h-6 -translate-x-0.5" />
              </button>
            )}
            <button onClick={handleNextSlide}
              className="absolute right-6 w-12 h-12 rounded-full border border-white/10 hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors">
              <ChevronRight className="w-6 h-6 translate-x-0.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ children, delay, color, icon }: {
  children: React.ReactNode; delay: number; color: string; icon: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, type: 'spring' }}
      className={`relative overflow-hidden rounded-3xl p-8 text-white bg-gradient-to-br ${color} shadow-2xl`}
      style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}
    >
      <div className="relative z-10">{children}</div>
      <div className="absolute -bottom-2 -right-2 z-0 pointer-events-none" style={{ transform: 'rotate(-15deg) scale(1.5)' }}>
        {icon}
      </div>
    </motion.div>
  )
}
