import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Clock, Film, Tv, Star, Flame, Sparkles, Trophy, Play, X, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { useWatchHistory, useProgressStore } from './hooks'
import { fetchTitleDetails } from './lib/tmdb'
import type { MediaDetails } from './types'

export function StatsPage() {
  const history = useWatchHistory()
  const progress = useProgressStore()

  const [topDetails, setTopDetails] = useState<MediaDetails[]>([])
  const [loading, setLoading] = useState(true)

  // Wrapped slider states
  const [showWrapped, setShowWrapped] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const totalSlides = 6

  // Handle slide controls
  const handleNextSlide = () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(prev => prev + 1)
    } else {
      setShowWrapped(false)
    }
  }

  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(prev => prev - 1)
    }
  }

  // Keyboard navigation for slides
  useEffect(() => {
    if (!showWrapped) return
    const handleKeys = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Space') {
        e.preventDefault()
        handleNextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevSlide()
      } else if (e.key === 'Escape') {
        setShowWrapped(false)
      }
    }
    window.addEventListener('keydown', handleKeys)
    return () => window.removeEventListener('keydown', handleKeys)
  }, [showWrapped, currentSlide])

  const totalSecondsWatched = Object.values(progress).reduce((a, b) => a + b, 0)
  const totalHoursWatched = Math.floor(totalSecondsWatched / 3600)

  useEffect(() => {
    const controller = new AbortController()
    
    async function loadStats() {
      // Pick top 20 most recently watched unique items to analyze
      const recent = history.slice(0, 20)
      if (!recent.length) {
        setLoading(false)
        return
      }

      try {
        const details = await Promise.all(
          recent.map(item => 
            fetchTitleDetails(item.mediaType, String(item.id), controller.signal).catch(() => null)
          )
        )
        if (!controller.signal.aborted) {
          setTopDetails(details.filter(Boolean) as MediaDetails[])
          setLoading(false)
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadStats()
    return () => controller.abort()
  }, [history])

  // Calculate Genres
  const genreCounts: Record<string, number> = {}
  topDetails.forEach(d => {
    d.genres?.forEach(g => {
      genreCounts[g.name] = (genreCounts[g.name] || 0) + 1
    })
  })
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // Calculate Actors
  const actorCounts: Record<string, { count: number; profilePath?: string | null }> = {}
  topDetails.forEach(d => {
    d.credits?.cast?.slice(0, 8).forEach(actor => {
      if (!actorCounts[actor.name]) {
        actorCounts[actor.name] = { count: 0, profilePath: actor.profile_path }
      }
      actorCounts[actor.name].count += 1
    })
  })
  const topActors = Object.entries(actorCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)

  // Calculate TV vs Movies
  const movieCount = history.filter(h => h.mediaType === 'movie').length
  const tvCount = history.filter(h => h.mediaType === 'tv').length

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-20 sm:pt-24 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-12"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-purple-500 mb-4" style={{ fontFamily: 'DM Serif Display, serif' }}>
              Your Baroflix Wrapped
            </h1>
            <p className="text-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
              A deep dive into your streaming habits.
            </p>
          </div>
          <button
            onClick={() => {
              setCurrentSlide(0)
              setShowWrapped(true)
            }}
            className="flex items-center gap-2 self-start px-5 py-3 text-sm font-bold rounded-full transition-all bg-gradient-to-r from-[var(--accent)] to-purple-500 text-white shadow-lg hover:shadow-[0_0_24px_rgba(139,92,246,0.3)] active:scale-95 shrink-0"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            Watch My Slides
          </button>
        </div>
      </motion.div>

      {/* Main Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-12">
        {/* Total Time */}
        <StatCard delay={0.1} color="from-blue-500 to-cyan-400" icon={<Clock className="w-8 h-8 opacity-50" />}>
          <div className="text-5xl font-bold mb-2">{totalHoursWatched}</div>
          <div className="text-lg font-medium opacity-80">Hours Watched</div>
        </StatCard>

        {/* Movies vs TV */}
        <StatCard delay={0.2} color="from-pink-500 to-rose-400" icon={<Flame className="w-8 h-8 opacity-50" />}>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-4xl font-bold mb-1">{movieCount}</div>
              <div className="text-sm font-medium opacity-80 flex items-center gap-1"><Film className="w-4 h-4"/> Movies</div>
            </div>
            <div className="w-px h-12 bg-white/20 mx-4" />
            <div>
              <div className="text-4xl font-bold mb-1">{tvCount}</div>
              <div className="text-sm font-medium opacity-80 flex items-center gap-1"><Tv className="w-4 h-4"/> TV Shows</div>
            </div>
          </div>
        </StatCard>

        {/* Top Genres */}
        <StatCard delay={0.3} color="from-amber-500 to-orange-400" icon={<Star className="w-8 h-8 opacity-50" />}>
          <div className="text-lg font-medium opacity-80 mb-3">Top Genres</div>
          {loading ? (
            <div className="animate-pulse h-16 bg-white/10 rounded" />
          ) : topGenres.length > 0 ? (
            <div className="space-y-2">
              {topGenres.map(([genre, _], i) => (
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

      {/* Top Actors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="text-2xl font-bold text-white mb-6">Most Watched Actors</h2>
        {loading ? (
          <div className="animate-pulse h-32 bg-white/5 rounded-2xl" />
        ) : topActors.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {topActors.map(([name, { profilePath, count }]) => (
              <div key={name} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-white/10">
                  {profilePath ? (
                    <img src={`https://image.tmdb.org/t/p/w185${profilePath}`} alt={name} className="w-full h-full object-cover" />
                  ) : null}
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

      {/* Wrapped Slide Deck Modal */}
      <AnimatePresence>
        {showWrapped && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(20,20,20,1) 0%, rgba(8,8,8,1) 100%)'
            }}
          >
            {/* Ambient glow backgrounds */}
            <div className="absolute top-1/4 left-1/4 w-[350px] h-[350px] rounded-full blur-[150px] pointer-events-none opacity-20 bg-[var(--accent)]" />
            <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full blur-[150px] pointer-events-none opacity-10 bg-purple-500" />

            {/* Top Instagram-story style progress indicators */}
            <div className="absolute top-6 left-6 right-6 flex gap-1.5 z-50">
              {Array.from({ length: totalSlides }).map((_, idx) => (
                <div key={idx} className="flex-1 h-1 rounded-full bg-white/20 overflow-hidden">
                  <motion.div
                    className="h-full bg-[var(--accent)]"
                    initial={{ width: '0%' }}
                    animate={{
                      width: idx < currentSlide ? '100%' : idx === currentSlide ? '100%' : '0%'
                    }}
                    transition={{
                      duration: idx === currentSlide ? 0.3 : 0
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Close Button */}
            <button
              onClick={() => setShowWrapped(false)}
              className="absolute top-10 right-6 text-white/50 hover:text-white transition-colors z-50 p-2"
              aria-label="Close Wrapped"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Slide Window */}
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
                      <h1 className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-[var(--accent)] to-purple-500 tracking-tight leading-none mb-4" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.04em' }}>
                        BAROFLIX WRAPPED
                      </h1>
                      <p className="text-base text-white/60 max-w-sm mb-10">
                        Ready to discover your year in streaming? Let's take a look at your personal stats.
                      </p>
                      <button
                        onClick={handleNextSlide}
                        className="px-8 py-3.5 rounded-full text-xs font-bold bg-white text-black hover:scale-105 active:scale-95 transition-all font-sans flex items-center gap-2 shadow-xl"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Start the Show
                      </button>
                    </>
                  )}

                  {currentSlide === 1 && (
                    <>
                      <Clock className="w-14 h-14 text-blue-400 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">TIME SPENT</h2>
                      <div className="text-6xl md:text-7xl font-black text-white leading-none my-4 tracking-tight" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.02em' }}>
                        {totalHoursWatched} HOURS
                      </div>
                      <p className="text-sm text-white/60 max-w-md">
                        That is equivalent to <span className="text-white font-bold">{Math.round(totalHoursWatched / 24)} full days</span> of non-stop watching on Baroflix. Talk about dedication!
                      </p>
                    </>
                  )}

                  {currentSlide === 2 && (
                    <>
                      <Flame className="w-14 h-14 text-pink-500 mb-6" />
                      <h2 className="text-lg font-bold text-white/50 tracking-wider mb-2">FORMAT CLASH</h2>
                      <h3 className="text-2xl font-extrabold text-white mt-1 mb-6">What did you stream most?</h3>
                      
                      {/* Split visual */}
                      <div className="w-full max-w-md space-y-6">
                        <div className="flex justify-between items-baseline text-[10px] font-bold uppercase tracking-wider text-white/40">
                          <span className="text-pink-400">Movies ({movieCount})</span>
                          <span className="text-rose-400">TV Shows ({tvCount})</span>
                        </div>
                        <div className="h-5 w-full rounded-full bg-white/5 overflow-hidden flex p-0.5 border border-white/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(movieCount / (movieCount + tvCount || 1)) * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-l-full"
                          />
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(tvCount / (movieCount + tvCount || 1)) * 100}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-r-full flex-1"
                          />
                        </div>
                        <p className="text-xs text-white/50 leading-relaxed mt-4">
                          {movieCount > tvCount 
                            ? "You're a cinephile at heart, preferring standalone stories."
                            : tvCount > movieCount 
                              ? "You're a binge-watcher, loving the long-form stories."
                              : "You have a perfect balance of cinematic epics and episodic series!"}
                        </p>
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
                          {/* Visual bar chart */}
                          <div className="flex items-end justify-center gap-6 h-48 mt-6">
                            {topGenres.map(([genre, count], idx) => {
                              const maxCount = topGenres[0][1]
                              const percentage = (count / maxCount) * 100
                              return (
                                <div key={genre} className="flex flex-col items-center flex-1 max-w-[100px]">
                                  <div className="flex-1 w-full flex items-end justify-center">
                                    <motion.div
                                      initial={{ height: 0 }}
                                      animate={{ height: `${percentage}%` }}
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
                                {profilePath ? (
                                  <img src={`https://image.tmdb.org/t/p/w185${profilePath}`} alt={name} className="w-full h-full object-cover" />
                                ) : (
                                  <User className="w-5 h-5 text-white/30" />
                                )}
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
                          {/* Metric 1 */}
                          <div className="flex items-center gap-3">
                            <Clock className="w-5 h-5 text-blue-400" />
                            <div>
                              <div className="text-base font-bold text-white leading-none">{totalHoursWatched} Hours</div>
                              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Total Time</div>
                            </div>
                          </div>

                          {/* Metric 2 */}
                          <div className="flex items-center gap-3">
                            <Film className="w-5 h-5 text-pink-400" />
                            <div>
                              <div className="text-base font-bold text-white leading-none">{movieCount} Movies / {tvCount} TV</div>
                              <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Preferred Format</div>
                            </div>
                          </div>

                          {/* Metric 3 */}
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

                          {/* Metric 4 */}
                          {topActors.length > 0 && (
                            <div className="flex items-center gap-3">
                              <Trophy className="w-5 h-5 text-purple-400" />
                              <div>
                                <div className="text-xs font-bold text-white leading-none truncate max-w-[200px]">
                                  {topActors[0][0]}
                                </div>
                                <div className="text-[10px] text-white/40 uppercase font-bold tracking-wider mt-0.5">Most Watched Star</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-4 mt-8">
                        <button
                          onClick={() => setCurrentSlide(0)}
                          className="px-6 py-2.5 rounded-full text-xs font-bold border border-white/20 text-white hover:bg-white/5 transition-colors font-sans"
                        >
                          Replay
                        </button>
                        <button
                          onClick={() => setShowWrapped(false)}
                          className="px-6 py-2.5 rounded-full text-xs font-bold bg-[var(--accent)] text-white hover:opacity-90 transition-opacity font-sans"
                        >
                          Done
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation Arrows */}
            {currentSlide > 0 && (
              <button
                onClick={handlePrevSlide}
                className="absolute left-6 w-12 h-12 rounded-full border border-white/10 hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors bg-white/2"
                aria-label="Previous Slide"
              >
                <ChevronLeft className="w-6 h-6 -translate-x-0.5" />
              </button>
            )}

            <button
              onClick={handleNextSlide}
              className="absolute right-6 w-12 h-12 rounded-full border border-white/10 hover:border-white/20 flex items-center justify-center text-white/50 hover:text-white transition-colors bg-white/2"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-6 h-6 translate-x-0.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function StatCard({ children, delay, color, icon }: { children: React.ReactNode; delay: number; color: string; icon: React.ReactNode }) {
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
