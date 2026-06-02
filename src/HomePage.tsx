import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Play, ArrowRight, Settings as SettingsIcon, Star, ChevronLeft, ChevronRight, User, Menu, X } from 'lucide-react'
import heroFallback from './assets/hero.png'
import { imageUrl, mediaTypeFromItem, titleFromItem, yearFromItem, hasTmdbCredentials, pickTrailer, buildVideasyUrl } from './lib/tmdb'
import { useHomeCatalog, useFeaturedDetails, useLocalStorageState, STORAGE_KEYS, THEME_PRESETS, upsertHistory, useCustomLists, useRatings } from './hooks'
import { useAuth } from './context/AuthContext'
import type { WatchHistoryEntry } from './hooks'
import type { MediaKind } from './types'
import { FullscreenPlayer } from './FullscreenPlayer'
import {
  ContentRail,
  ContinueWatchingRail,
  SectionHeader,
  Chip,
  SetupNotice,
  MediaGrid,
} from './ui'
import { HomeSearchToggle } from './SearchOverlay'
import { locales } from './locales'

// ─── HomePage ────────────────────────────────────────────────────────────────

export function HomePage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const homeState = useHomeCatalog(query)
  const [history, setHistory] = useLocalStorageState<WatchHistoryEntry[]>(STORAGE_KEYS.history, [])
  const { settings } = useAuth()
  const [lists] = useCustomLists()
  const [ratingsRaw] = useRatings()
  const [playback, setPlayback] = useState<{ mediaType: MediaKind; id: number; season?: number; episode?: number } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const dragState = useRef<{ x: number } | null>(null)
  
  const collectionsRailRef = useRef<HTMLDivElement>(null)
  const scrollCollections = (dir: 'left' | 'right') => {
    if (!collectionsRailRef.current) return
    const scrollAmount = collectionsRailRef.current.clientWidth * 0.75
    collectionsRailRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }

  const watchedItems = Object.values(ratingsRaw || {})
    .filter((r: any) => typeof r === 'object' && r.rating)
    .map((r: any) => ({
      mediaType: r.mediaType,
      id: r.id,
      title: r.title,
      posterPath: r.posterPath,
      backdropPath: r.backdropPath,
      addedAt: r.addedAt,
      rating: r.rating
    }))
    .sort((a, b) => b.rating - a.rating)

  const watchedList = {
    id: 'watched',
    name: 'Watched & Rated',
    coverImage: null,
    items: watchedItems as any
  }

  const allLists = [watchedList, ...lists]

  const gallery = homeState.gallery.length ? homeState.gallery : homeState.recommendations
  const heroItems = gallery.length ? gallery : homeState.featured ? [homeState.featured] : []
  const activeHero = heroItems[activeIndex % heroItems.length] ?? homeState.featured
  const activeDetails = useFeaturedDetails(activeHero)
  const lang = settings.language || 'en'
  const t = locales[lang].home
  const navT = locales[lang].nav

  const heroBackdrop =
    imageUrl(activeHero?.backdrop_path, 'w1280') ||
    imageUrl(activeHero?.poster_path, 'w780') ||
    heroFallback

  const heroLogo = activeDetails?.images?.logos
    ?.slice()
    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
    .find((l) => l.file_path)?.file_path
    ? imageUrl(
        activeDetails.images!.logos!
          .slice()
          .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
          .find((l) => l.file_path)!.file_path!,
        'w500'
      )
    : null

  const featuredLink = activeHero
    ? `/title/${mediaTypeFromItem(activeHero)}/${activeHero.id}`
    : '/'

  const trailer = pickTrailer(activeDetails?.videos)
  const heroCount = heroItems.length

  useEffect(() => {
    queueMicrotask(() => setActiveIndex(0))
  }, [query])

  useEffect(() => {
    if (heroCount <= 1) {
      return
    }

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % heroCount)
    }, 6500)

    return () => window.clearInterval(timer)
  }, [heroCount])

  function goToHero(nextIndex: number) {
    if (!heroCount) {
      return
    }

    setActiveIndex(((nextIndex % heroCount) + heroCount) % heroCount)
  }

  function goPrevHero() {
    goToHero(activeIndex - 1)
  }

  function goNextHero() {
    goToHero(activeIndex + 1)
  }

  function handleHeroPointerDown(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null
    if (target?.closest('a,button,input,textarea,select')) {
      return
    }

    dragState.current = { x: event.clientX }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handleHeroPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const start = dragState.current
    dragState.current = null
    if (!start) {
      return
    }

    const delta = event.clientX - start.x
    if (delta > 60) {
      goPrevHero()
    } else if (delta < -60) {
      goNextHero()
    }
  }

  function handlePlayClick(e: React.MouseEvent) {
    e.preventDefault()
    if (!activeHero) return
    const type = mediaTypeFromItem(activeHero)
    const isEpisodic = type === 'tv' || type === 'anime'
    const season = isEpisodic ? 1 : undefined
    const episode = isEpisodic ? 1 : undefined
    
    setPlayback({ mediaType: type, id: activeHero.id, season, episode })
    
    setHistory((current) => upsertHistory(current, {
      mediaType: type,
      id: activeHero.id,
      title: titleFromItem(activeHero),
      posterPath: activeHero.poster_path,
      backdropPath: activeHero.backdrop_path,
      season,
      episode,
      watchedAt: Date.now(),
    }))
  }

  const playerUrl = playback 
    ? buildVideasyUrl(playback.mediaType, playback.id, playback.season, playback.episode, { color: THEME_PRESETS[settings.theme].accent })
    : null

  const progressKey = playback ? `${playback.mediaType}-${playback.id}-${playback.season || 0}-${playback.episode || 0}` : undefined

  return (
    <div>
      {/* Fullscreen player — portal-mounted */}
      {playback && playerUrl && (
        <FullscreenPlayer
          src={playerUrl}
          onClose={() => setPlayback(null)}
          progressKey={progressKey}
          onEpisodeChange={(season, episode) => {
            setPlayback(p => p ? { ...p, season, episode } : p)
          }}
        />
      )}
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: '75svh' }}
      >
        {/* Ken Burns backdrop */}
        <div className="absolute inset-0 overflow-hidden">
          <img
            key={activeHero?.id}
            src={heroBackdrop}
            alt=""
            className="w-full h-full object-cover animate-ken-burns"
            style={{ opacity: 0.45 }}
          />
        </div>

        {/* Gradient scrim */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(to top, rgba(8,8,8,1) 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.1) 100%),
              linear-gradient(to right, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.0) 60%)
            `,
          }}
        />

        {/* Nav row */}
        <div className="relative z-10 mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-6">
          <div className="flex items-center gap-8">
            <img
                src="/1x/Asset 1.webp"
                alt="Baroflix"
                className="block h-10 w-auto"
            />
            <nav className="hidden lg:flex items-center gap-6">
              <Link to="/" className="text-sm font-semibold text-white hover:text-white transition-colors">
                {navT.home}
              </Link>
              <Link to="/browse" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                {navT.browse}
              </Link>
              <Link to="/sports" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                {navT.sports}
              </Link>
              <Link to="/collections" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                {navT.collections}
              </Link>
              <Link to="/coming-soon" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                {navT.comingSoon}
              </Link>
              <Link to="/stats" className="text-sm font-semibold text-white/70 hover:text-white transition-colors">
                {navT.stats}
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {!(/electron/i.test(navigator.userAgent)) && (
              <Link
                to="/download"
                className="hidden lg:flex items-center justify-center px-4 h-10 rounded-full text-sm font-bold text-white transition-all hover:brightness-110 mr-2"
                style={{
                  background: 'var(--accent)',
                  boxShadow: '0 0 20px var(--accent-dim)',
                }}
              >
                {navT.downloadApp}
              </Link>
            )}
            {/* Search — always visible */}
            <HomeSearchToggle />
            {/* Settings + Profile — desktop only */}
            <div className="hidden lg:flex items-center gap-2">
              <Link
                to="/settings"
                className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                }}
                aria-label="Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </Link>
              <Link
                to="/profile"
                className="flex items-center justify-center w-10 h-10 rounded-full transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)',
                }}
                aria-label="Profile"
              >
                <User className="w-4 h-4" />
              </Link>
            </div>
            {/* Hamburger — mobile only */}
            <button
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-white/70 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={() => setMobileMenuOpen(o => !o)}
              aria-label="Menu"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        <div className="fixed inset-0 z-40 lg:hidden pointer-events-none" aria-hidden={!mobileMenuOpen}>
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 transition-opacity duration-300"
            style={{ opacity: mobileMenuOpen ? 1 : 0, pointerEvents: mobileMenuOpen ? 'auto' : 'none' }}
            onClick={() => setMobileMenuOpen(false)}
          />
          {/* Panel */}
          <nav
            className="absolute top-0 right-0 h-full w-72 flex flex-col pt-24 pb-8 px-6 gap-1 transition-transform duration-300"
            style={{
              transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(100%)',
              pointerEvents: mobileMenuOpen ? 'auto' : 'none',
              background: 'rgba(10,10,10,0.97)',
              backdropFilter: 'blur(20px)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {[
              { to: '/', label: navT.home },
              { to: '/browse', label: navT.browse },
              { to: '/sports', label: navT.sports },
              { to: '/collections', label: navT.collections },
              { to: '/coming-soon', label: navT.comingSoon },
              { to: '/stats', label: navT.stats },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
              >
                {label}
              </Link>
            ))}

            {/* Divider */}
            <div className="my-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

            {/* Settings */}
            <Link
              to="/settings"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
              Settings
            </Link>

            {/* Profile */}
            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 text-base font-semibold text-white/70 hover:text-white transition-colors px-3 py-3 rounded-xl hover:bg-white/5"
            >
              <User className="w-4 h-4 shrink-0" />
              Profile
            </Link>

            {!(/electron/i.test(navigator.userAgent)) && (
              <Link
                to="/download"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4 flex items-center justify-center px-4 h-11 rounded-full text-sm font-bold text-white transition-all hover:brightness-110"
                style={{ background: 'var(--accent)', boxShadow: '0 0 20px var(--accent-dim)' }}
              >
                {navT.downloadApp}
              </Link>
            )}
          </nav>
        </div>

        {/* Hero content */}
        <div
          className="relative z-10 mx-auto flex h-[75svh] max-w-screen-2xl w-full flex-col justify-end px-6 pb-12 sm:pb-14"
          onPointerDown={handleHeroPointerDown}
          onPointerUp={handleHeroPointerUp}
          onPointerCancel={() => { dragState.current = null }}
          onPointerLeave={() => { dragState.current = null }}
          style={{ touchAction: 'pan-y' }}
        >
          <motion.div
            key={activeHero?.id ?? 'default'}
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div className="max-w-3xl space-y-5">
              {/* Title / Logo */}
              {heroLogo ? (
                <img
                  src={heroLogo}
                  alt={activeHero ? titleFromItem(activeHero) : 'Baroflix'}
                  className="max-h-28 w-auto object-contain drop-shadow-2xl sm:max-h-36"
                />
              ) : (
                <h1
                  className="text-5xl sm:text-6xl lg:text-7xl font-normal text-white"
                  style={{ fontFamily: 'DM Serif Display, serif', textShadow: '0 4px 32px rgba(0,0,0,0.6)', letterSpacing: '-0.02em' }}
                >
                  {activeHero ? titleFromItem(activeHero) : 'Baroflix'}
                </h1>
              )}

              {/* Overview */}
              <p
                className="text-base sm:text-lg max-w-xl leading-relaxed line-clamp-3"
                style={{ color: 'rgba(255,255,255,0.75)' }}
              >
                {activeHero?.overview ?? 'Discover trending movies and TV shows from around the world.'}
              </p>

              {/* Meta chips */}
              <div className="flex flex-wrap gap-2 items-center">
                {activeHero?.vote_average ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                    style={{ borderRadius: 999, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
                  >
                    <Star className="w-3 h-3 fill-current" />
                    {activeHero.vote_average.toFixed(1)}
                  </span>
                ) : null}
                {activeHero && <Chip>{mediaTypeFromItem(activeHero) === 'tv' ? 'TV Series' : 'Movie'}</Chip>}
                {activeHero && yearFromItem(activeHero) && <Chip>{String(yearFromItem(activeHero))}</Chip>}
                {activeDetails?.genres?.slice(0, 2).map((g) => <Chip key={g.id}>{g.name}</Chip>)}
              </div>

              {/* CTAs */}
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handlePlayClick}
                  id="hero-play-btn"
                  className="primary-btn inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:text-white"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 32px var(--accent-glow)' }}
                >
                  <Play className="w-4 h-4 fill-white" />
                  {t.play}
                </button>
                <Link
                  to={featuredLink}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  {t.moreInfo}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                  >
                    {t.trailer}
                  </a>
                )}
              </div>
            </div>

            {heroCount > 1 ? (
              <div className="mt-10 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={goPrevHero}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-xl transition hover:bg-white/12 hover:text-white"
                  aria-label="Previous hero item"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="flex flex-1 items-center justify-center gap-2 px-2" aria-label="Hero gallery position">
                  {heroItems.slice(0, 8).map((item, index) => (
                    <button
                      key={`dot-${item.id}`}
                      type="button"
                      onClick={() => goToHero(index)}
                      className="h-2.5 rounded-full transition-all"
                      style={{
                        width: index === activeIndex ? 28 : 10,
                        background: index === activeIndex ? 'var(--accent)' : 'rgba(255,255,255,0.28)',
                        boxShadow: index === activeIndex ? '0 0 18px var(--accent-glow)' : undefined,
                      }}
                      aria-label={`Go to hero item ${index + 1}`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  onClick={goNextHero}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/80 backdrop-blur-xl transition hover:bg-white/12 hover:text-white"
                  aria-label="Next hero item"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            ) : null}
          </motion.div>
        </div>
      </section>

      {/* ── Catalog Sections ───────────────────────────────────────────────── */}
      <div className="px-6 py-12 space-y-14 max-w-screen-2xl mx-auto">
        {!hasTmdbCredentials && (
          <SetupNotice />
        )}

        {/* Continue Watching */}
        {history.length > 0 && (
          <section>
            <SectionHeader number="01" title={t.continueWatching} subtitle={t.continueWatchingSub} />
            <ContinueWatchingRail history={history} onRemove={(i) => setHistory(prev => prev.filter((_, idx) => idx !== i))} />
          </section>
        )}

        {/* My Collections */}
        {allLists.length > 0 && (
          <section>
            <SectionHeader number={history.length > 0 ? "02" : "01"} title="My Collections" subtitle="Your custom curated lists." />
            <div className="relative group/rail">
              {/* Left arrow */}
              <button
                type="button"
                onClick={() => scrollCollections('left')}
                tabIndex={-1}
                aria-label="Scroll left"
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
                style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
              >
                <ChevronLeft className="w-4 h-4 text-white" />
              </button>

              <div ref={collectionsRailRef} className="rail">
                {allLists.map((list) => (
                <Link
                  key={list.id}
                  to="/collections"
                  className="group shrink-0 overflow-hidden transition-transform hover:-translate-y-1 block relative"
                  style={{
                    width: 220,
                    aspectRatio: '2/3',
                    borderRadius: 14,
                    border: '1px solid rgba(255,255,255,0.07)',
                    background: 'rgba(255,255,255,0.04)',
                  }}
                >
                  {list.coverImage ? (
                    <img src={list.coverImage} className="w-full h-full object-cover" />
                  ) : list.items[0]?.posterPath ? (
                    <img src={imageUrl(list.items[0].posterPath, 'w342')} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 backdrop-blur-2xl p-4 text-center border border-white/10">
                       <span className="text-4xl font-black text-white/20 mb-2">{list.name.charAt(0).toUpperCase()}</span>
                       <span className="text-xs font-semibold text-white/40 uppercase tracking-widest break-words w-full line-clamp-2">{list.name}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="font-bold text-white text-lg leading-tight truncate drop-shadow-md">{list.name}</h3>
                    <p className="text-xs text-white/60 font-medium drop-shadow-sm mt-0.5">{list.items.length} items</p>
                  </div>
                </Link>
              ))}
              </div>
              
              {/* Right arrow */}
              <button
                type="button"
                onClick={() => scrollCollections('right')}
                tabIndex={-1}
                aria-label="Scroll right"
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
                style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
              >
                <ChevronRight className="w-4 h-4 text-white" />
              </button>
            </div>
          </section>
        )}

        {/* Trending */}
        <section>
          <SectionHeader number={(history.length > 0 && allLists.length > 0) ? "03" : (history.length > 0 || allLists.length > 0) ? "02" : "01"} title={t.trending} subtitle={t.trendingSub} />
          <ContentRail items={homeState.recommendations} loading={homeState.loading && !homeState.recommendations.length} />
        </section>

        {/* Browse All */}
        <section>
          <SectionHeader number={(history.length > 0 && allLists.length > 0) ? "04" : (history.length > 0 || allLists.length > 0) ? "03" : "02"} title={t.browseAll} subtitle={t.browseAllSub} />
          <MediaGrid
            items={homeState.recommendations.slice(0, 20)}
            loading={homeState.loading && !homeState.recommendations.length}
            emptyLabel="Connect TMDB to unlock the full catalog."
            columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          />
        </section>
      </div>

      {/* Footer */}
      <footer className="px-6 py-10 border-t text-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
          Powered by{' '}
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" className="underline hover:text-white/50 transition-colors">
            TMDB
          </a>
          {' '}· Baroflix © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  )
}
