import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, ArrowRight, Star, ArrowLeft, Bell, BellRing, Search, X, Plus, CheckCircle2, Circle } from 'lucide-react'
import heroFallback from './assets/hero.png'
import {
  buildEmbedUrl,
  fetchSeasonDetails,
  fetchTitleDetails,
  hasTmdbCredentials,
  imageUrl,
  normalizeMediaKind,
  pickTrailer,
  titleFromItem,
  subtitleFromItem,
  yearFromItem,
} from './lib/tmdb'
import { supabase } from './lib/supabase'
import { fetchAnimeDetails, generateAnimeSeasonDetails, type AnilistStreamingEpisode, type AnimeEpisodeMeta } from './lib/anilist'
import { fetchJikanEpisodes } from './lib/jikan'
import { fetchAnimeTmdbMeta, type AnimeTmdbMeta } from './lib/tmdb'
import type { MediaDetails, SeasonDetails } from './types'
import type { MediaKind } from './types'
import { useLocalStorageState, formatDuration, formatMoney, parsePositiveNumber, upsertHistory, THEME_PRESETS, useProgressStore, useWatchedEpisodes, writeProgressEntry, writeBulkWatched, removeBulkWatched, useReminders, useRatings, writeWatchedEntry } from './hooks'
import type { WatchHistoryEntry } from './hooks'
import { STORAGE_KEYS } from './hooks'
import { useAuth } from './context/AuthContext'
import { locales } from './locales'
import { Chip, FactBadge, CastCard, SetupNotice, EmptyPanel, MediaGrid } from './ui'
import { StarRating, AddToCollectionModal } from './components/CollectionsUi'
import { FullscreenPlayer } from './FullscreenPlayer'
import { CommentsSection } from './components/CommentsSection'

type PlaybackState = { mediaType: MediaKind; id: number; season?: number; episode?: number }

// ─── TitlePage ────────────────────────────────────────────────────────────────

export function TitlePage() {
  const params = useParams()
  const navigate = useNavigate()
  const mediaType = normalizeMediaKind(params.mediaType)
  const id = params.id ?? ''
  const [searchParams, setSearchParams] = useSearchParams()

  const [playback, setPlayback] = useState<PlaybackState | null>(null)
  const [details, setDetails] = useState<MediaDetails | null>(null)
  const [seasonDetails, setSeasonDetails] = useState<SeasonDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useLocalStorageState<WatchHistoryEntry[]>(STORAGE_KEYS.history, [])
  const { settings, session } = useAuth()
  const t = locales[settings.language ?? 'en'].titlePage
  const tc = locales[settings.language ?? 'en'].common

  // Ref so cleanup effect always has the latest userId without stale closure
  const sessionIdRef = useRef<string | undefined>(undefined)
  useEffect(() => { sessionIdRef.current = session?.user?.id }, [session?.user?.id])

  // Clear now_watching when leaving this title page
  useEffect(() => {
    return () => {
      const uid = sessionIdRef.current
      if (uid) supabase.from('profiles').update({ now_watching: null }).eq('id', uid).then()
    }
  }, [])
  const progressStore = useProgressStore()
  const [watchedEpisodes, toggleWatchedEpisode] = useWatchedEpisodes()
  const [reminders, setReminders] = useReminders()
  const [ratings, setRatings] = useRatings()
  
  const ratingKey = `${mediaType}-${id}`
  const userRatingObj = ratings[ratingKey]
  const userRating = typeof userRatingObj === 'number' ? userRatingObj : (userRatingObj?.rating || 0)
  const [showCollectionModal, setShowCollectionModal] = useState(false)
  const [animeLang, setAnimeLang] = useState<'sub' | 'dub'>('sub')
  const [animeStreamingEps, setAnimeStreamingEps] = useState<AnilistStreamingEpisode[]>([])
  const [jikanEpisodes, setJikanEpisodes] = useState<{ mal_id: number; title: string | null }[]>([])
  const [animeTmdbMeta, setAnimeTmdbMeta] = useState<AnimeTmdbMeta>({ logos: [], episodeOverviews: new Map(), episodeStills: new Map() })
  const [posterOpen, setPosterOpen] = useState(false)

  const historyEntry = useMemo(() => history.find(h => h.mediaType === mediaType && h.id === Number(id)), [history, mediaType, id])

  // Load title details
  useEffect(() => {
    if (!mediaType || !id) return
    const controller = new AbortController()
    queueMicrotask(() => {
      setLoading(true); setError(null); setDetails(null)
      setSeasonDetails(null); setPlayback(null)
      setAnimeStreamingEps([]); setJikanEpisodes([])
      setAnimeTmdbMeta({ logos: [], episodeOverviews: new Map(), episodeStills: new Map() })
    })

    const fetcher = mediaType === 'anime'
      ? fetchAnimeDetails(id, controller.signal)
      : fetchTitleDetails(mediaType, id, controller.signal)

    fetcher
      .then((res) => {
        if (!controller.signal.aborted) {
          setDetails(res)
          setLoading(false)
          if (mediaType === 'anime') {
            // AniList streaming episodes (thumbnails)
            if ((res as any)._streamingEpisodes) {
              setAnimeStreamingEps((res as any)._streamingEpisodes)
            }
            // Jikan episode list (titles) — needs MAL ID
            const malId = (res as any).idMal
            if (malId) {
              fetchJikanEpisodes(malId, controller.signal)
                .then(eps => { if (!controller.signal.aborted) setJikanEpisodes(eps) })
                .catch(() => {/* graceful degradation */})
            }
            // TMDB meta (logo + episode synopses)
            const animeTitle = res.title ?? res.name ?? ''
            const animeYear = res.release_date ? new Date(res.release_date).getFullYear() : null
            if (animeTitle) {
              fetchAnimeTmdbMeta(animeTitle, animeYear, controller.signal)
                .then(meta => { if (!controller.signal.aborted) setAnimeTmdbMeta(meta) })
                .catch(() => {/* graceful degradation */})
            }
          }
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load title.')
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [id, mediaType])

  const seasons = useMemo(() => details?.seasons?.filter((s) => s.season_number > 0) ?? [], [details])
  const selectedSeasonParam = parsePositiveNumber(searchParams.get('season'))
  const isEpisodic = mediaType === 'tv' || mediaType === 'anime'
  const selectedSeason = isEpisodic ? selectedSeasonParam ?? historyEntry?.season ?? seasons[0]?.season_number ?? 1 : undefined
  const selectedEpisodeParam = parsePositiveNumber(searchParams.get('episode'))

  // Load season details
  useEffect(() => {
    if (!isEpisodic || !details || seasons.length === 0) return
    const controller = new AbortController()

    if (mediaType === 'anime') {
      // Merge all enrichment sources into a single AnimeEpisodeMeta[] array
      const total = Math.max(
        details.number_of_episodes ?? 0,
        jikanEpisodes.length,
        animeStreamingEps.length
      )
      const merged: AnimeEpisodeMeta[] = Array.from({ length: total }, (_, i) => {
        const epNum = i + 1
        const jikan = jikanEpisodes.find(j => j.mal_id === epNum)
        const streaming = animeStreamingEps[i]            // positional — used for thumbnail only
        const synopsis = animeTmdbMeta.episodeOverviews.get(epNum) ?? null
        // Thumbnail priority: AniList streamingEpisodes → TMDB season still
        const thumbnail =
          streaming?.thumbnail ||
          animeTmdbMeta.episodeStills.get(epNum) ||
          null
        return {
          episode_number: epNum,
          title: jikan?.title || null,                    // Jikan is authoritative for titles
          thumbnail,
          synopsis,
        }
      })
      setSeasonDetails(generateAnimeSeasonDetails(id, total || 1, merged))
      return
    }

    fetchSeasonDetails(id, selectedSeason ?? seasons[0].season_number, controller.signal)
      .then((res) => setSeasonDetails(res))
      .catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Failed to load season.') })
    return () => controller.abort()
  }, [details, id, mediaType, seasons, selectedSeason, isEpisodic, animeStreamingEps, jikanEpisodes, animeTmdbMeta])

  // Auto-play when ?autoplay=1 is present (from continue-watching play button).
  // We immediately strip the param after firing so that season/detail re-loads
  // don't re-trigger playback (which would erroneously set now_watching again).
  const autoplayParam = searchParams.get('autoplay')
  useEffect(() => {
    if (!autoplayParam || !mediaType) return
    if (isEpisodic && !seasonDetails) return
    if (!details) return
    handlePlay(selectedSeason, activeEpisode)
    // One-shot: strip ?autoplay so changing seasons won't re-trigger this effect
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.delete('autoplay')
      return next
    }, { replace: true })
  }, [autoplayParam, mediaType, isEpisodic, seasonDetails, details])

  if (!hasTmdbCredentials && mediaType !== 'anime') return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  if (!mediaType) return <Navigate replace to="/" />

  const title = details ? titleFromItem(details) : 'Loading…'
  const backdropSrc = imageUrl(details?.backdrop_path, 'w1280') || heroFallback
  const posterSrc = imageUrl(details?.poster_path, 'w780') || heroFallback
  const posterOriginalSrc = imageUrl(details?.poster_path, 'original') || posterSrc
  const trailer = pickTrailer(details?.videos)
  const cast = (details?.credits?.cast ?? []).slice(0, 12)
  const activeSeason = selectedSeason ?? 1
  const defaultEpisode = (historyEntry && historyEntry.season === activeSeason && selectedSeasonParam == null) ? historyEntry.episode : undefined
  const activeEpisode = selectedEpisodeParam ?? defaultEpisode ?? seasonDetails?.episodes[0]?.episode_number ?? 1
  const playerUrl = playback
    ? buildEmbedUrl(settings.embedProvider ?? 'videasy', playback.mediaType, playback.id, playback.season, playback.episode, {
      color: THEME_PRESETS[settings.theme].accent,
      language: animeLang,
    })
    : null

  const progressKey = playback ? `${playback.mediaType}-${playback.id}-${playback.season || 0}-${playback.episode || 0}` : undefined

  // For anime, prefer TMDB logos fetched via title search.
  // For movies/TV, use the logos embedded in TMDB's MediaDetails response.
  const logoUrl = (() => {
    const logoList =
      mediaType === 'anime'
        ? animeTmdbMeta.logos
        : (details?.images?.logos ?? [])

    const best = logoList
      .slice()
      .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
      .find(l => l.file_path)

    return best ? imageUrl(best.file_path, 'w500') : null
  })()

  function handlePlay(season?: number, episode?: number) {
    if (!mediaType) return
    const next: PlaybackState = { mediaType, id: Number(id), season, episode }
    setPlayback(next)
    setHistory((current) =>
      upsertHistory(current, {
        mediaType,
        id: Number(id),
        title,
        posterPath: details?.poster_path,
        backdropPath: details?.backdrop_path,
        season,
        episode,
        watchedAt: Date.now(),
      })
    )
    // Update now_watching status on profile
    const uid = sessionIdRef.current
    if (uid) {
      supabase.from('profiles').update({
        now_watching: {
          mediaType,
          id: Number(id),
          title,
          posterPath: details?.poster_path ?? null,
          season,
          episode,
          startedAt: Date.now(),
        },
      }).eq('id', uid).then()
    }
  }

  const isReminded = details ? reminders.some(r => r.id === details.id && r.mediaType === mediaType) : false
  const isUnreleased = details && subtitleFromItem(details) ? new Date(subtitleFromItem(details)).getTime() > Date.now() : false

  function toggleReminder() {
    if (!details || !mediaType) return
    if (isReminded) {
      setReminders(reminders.filter(r => !(r.id === details.id && r.mediaType === mediaType)))
    } else {
      setReminders([
        ...reminders,
        {
          id: details.id,
          mediaType: mediaType,
          title: titleFromItem(details),
          posterPath: details.poster_path,
          releaseDate: subtitleFromItem(details),
          addedAt: Date.now()
        }
      ])
    }
  }

  useEffect(() => {
    if (details) {
      if (isEpisodic) {
        const sStr = String(activeSeason).padStart(2, '0');
        const eStr = String(activeEpisode).padStart(2, '0');
        const activeEpisodeDetails = seasonDetails?.episodes?.find((ep) => ep.episode_number === activeEpisode);
        if (activeEpisodeDetails && activeEpisodeDetails.name) {
          document.title = `${title}, S${sStr}E${eStr}: ${activeEpisodeDetails.name} | baroflix`;
        } else {
          document.title = `${title}, S${sStr}E${eStr} | baroflix`;
        }
      } else {
        document.title = `${title} | baroflix`;
      }
    } else {
      document.title = 'baroflix';
    }
  }, [details, isEpisodic, title, activeSeason, activeEpisode, seasonDetails]);

  useEffect(() => {
    return () => {
      document.title = 'baroflix';
    };
  }, []);

  // Close poster lightbox on Escape
  useEffect(() => {
    if (!posterOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setPosterOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [posterOpen]);

  return (
    <>
      {/* Fullscreen player — portal-mounted, covers entire viewport */}
      {playback && playerUrl && (
        <FullscreenPlayer
          src={playerUrl}
          onClose={() => setPlayback(null)}
          progressKey={progressKey}
          onEpisodeChange={(season, episode) => {
            setPlayback(p => p ? { ...p, season, episode } : p)
            const next = new URLSearchParams(searchParams)
            next.set('season', String(season))
            next.set('episode', String(episode))
            setSearchParams(next, { replace: true })
          }}
          onNextEpisode={isEpisodic && playback ? () => {
            const curSeason = playback.season ?? 1
            const curEpisode = playback.episode ?? 1
            const nextEp = curEpisode + 1
            // Mark current episode as watched
            writeWatchedEntry(`${mediaType}-${id}-${curSeason}-${curEpisode}`)
            // Advance playback + URL
            setPlayback(p => p ? { ...p, season: curSeason, episode: nextEp } : p)
            setHistory(current => upsertHistory(current, {
              mediaType: mediaType!,
              id: Number(id),
              title,
              posterPath: details?.poster_path,
              backdropPath: details?.backdrop_path,
              season: curSeason,
              episode: nextEp,
              watchedAt: Date.now(),
            }))
            const next = new URLSearchParams(searchParams)
            next.set('season', String(curSeason))
            next.set('episode', String(nextEp))
            setSearchParams(next, { replace: true })
          } : undefined}
        />
      )}

      {showCollectionModal && details && (
        <AddToCollectionModal item={details} onClose={() => setShowCollectionModal(false)} />
      )}

      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-16 pt-20 sm:pt-24">

        {/* ── Back button above hero card ──────────────────────────────── */}
        <div className="mb-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.85)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            {tc.back}
          </button>
        </div>

        {/* ── Single hero card ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 overflow-hidden"
          style={{
            borderRadius: 24,
            border: '1px solid rgba(255,255,255,0.09)',
            background: 'rgba(255,255,255,0.03)',
            position: 'relative',
          }}
        >
          {/* Backdrop fills the card */}
          <div className="absolute inset-0">
            <img
              src={backdropSrc}
              alt=""
              className="w-full h-full object-cover"
              style={{ opacity: 0.35 }}
            />
            {/* Dark gradient — strong on left, fades right; strong at bottom */}
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(to right, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.6) 55%, rgba(8,8,8,0.1) 100%),
                  linear-gradient(to top, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.0) 40%)
                `,
              }}
            />
          </div>

          {/* Content row: text left, poster right */}
          <div
            className="relative z-10 flex gap-4 sm:gap-8 p-4 sm:p-8 lg:p-12"
            style={{ minHeight: 340 }}
          >
            {/* ── Left: info ───────────────────────────────────────────── */}
            <div className="flex flex-col justify-end flex-1 min-w-0 space-y-5">
              {/* Logo or title */}
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={title}
                  className="max-h-12 sm:max-h-20 w-auto object-contain drop-shadow-2xl"
                  style={{ maxWidth: 300, alignSelf: 'flex-start' }}
                />
              ) : (
                <h1
                  className="text-4xl sm:text-5xl lg:text-6xl font-normal text-white"
                  style={{
                    fontFamily: 'DM Serif Display, serif',
                    letterSpacing: '-0.02em',
                    textShadow: '0 4px 32px rgba(0,0,0,0.7)',
                  }}
                >
                  {loading ? tc.loading : title}
                </h1>
              )}

              {/* Meta chips */}
              <div className="flex flex-wrap items-center gap-2">
                <StarRating 
                  value={userRating} 
                  onChange={(v) => {
                    setRatings({ 
                      ...ratings, 
                      [ratingKey]: {
                        rating: v,
                        id: details?.id || Number(id),
                        mediaType,
                        title: details ? titleFromItem(details) : '',
                        posterPath: details?.poster_path,
                        backdropPath: details?.backdrop_path,
                        addedAt: Date.now()
                      } 
                    })
                  }} 
                />
                
                {details?.vote_average ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ml-2 border-l border-white/10 pl-4"
                    style={{ background: 'rgba(245,158,11,0.05)', color: '#fbbf24' }}
                    title="TMDB Score"
                  >
                    <Star className="w-3 h-3 fill-current" />
                    {details.vote_average.toFixed(1)}
                  </span>
                ) : null}
                {yearFromItem(details ?? { id: 0 }) && (
                  <Chip>{String(yearFromItem(details ?? { id: 0 }))}</Chip>
                )}
                {isEpisodic && details?.number_of_seasons && (
                  <Chip>{details.number_of_seasons} {t.facts.seasons}</Chip>
                )}
                {mediaType === 'movie' && details?.runtime && (
                  <Chip>{formatDuration(details.runtime)}</Chip>
                )}
                {details?.genres?.slice(0, 3).map((g) => <Chip key={g.id}>{g.name}</Chip>)}
              </div>

              {/* Overview */}
              <p
                className="max-w-xl text-sm sm:text-base leading-relaxed line-clamp-3"
                style={{ color: 'rgba(255,255,255,0.65)' }}
              >
                {details?.overview ?? (loading ? '' : t.noOverview)}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => handlePlay(
                    isEpisodic ? activeSeason : undefined,
                    isEpisodic ? activeEpisode : undefined
                  )}
                  className="primary-btn inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 hover:text-white"
                  style={{ background: 'var(--accent)', boxShadow: '0 0 32px var(--accent-glow)' }}
                >
                  <Play className="w-4 h-4 fill-white" />
                  {mediaType === 'anime'
                    ? `${t.play} E${activeEpisode}`
                    : isEpisodic
                      ? `${t.play} S${activeSeason}E${activeEpisode}`
                      : t.play}
                </button>

                {/* Mark as watched — movies only */}
                {mediaType === 'movie' && (() => {
                  const isWatched = history.some(h => h.mediaType === 'movie' && h.id === Number(id))
                  const movieProgressKey = `movie-${id}-0-0`
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isWatched) {
                          setHistory(history.filter(h => !(h.mediaType === 'movie' && h.id === Number(id))))
                          writeProgressEntry(movieProgressKey, 0)
                        } else {
                          setHistory(upsertHistory(history, {
                            mediaType: 'movie',
                            id: Number(id),
                            title,
                            posterPath: details?.poster_path,
                            backdropPath: details?.backdrop_path,
                            watchedAt: Date.now(),
                          }))
                          if (details?.runtime) {
                            writeProgressEntry(movieProgressKey, details.runtime * 60)
                          }
                        }
                      }}
                      className="inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold transition-all"
                      style={isWatched ? {
                        background: 'rgba(34,197,94,0.15)',
                        border: '1px solid rgba(34,197,94,0.4)',
                        color: '#4ade80',
                      } : {
                        background: 'rgba(255,255,255,0.1)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: 'rgba(255,255,255,0.85)',
                      }}
                    >
                      {isWatched
                        ? <><CheckCircle2 className="w-4 h-4" /> {t.watched}</>
                        : <><Circle className="w-4 h-4" /> {t.markWatched}</>}
                    </button>
                  )
                })()}

                {/* Sub / Dub toggle — anime only */}
                {mediaType === 'anime' && (
                  <div
                    className="inline-flex items-center rounded-full text-sm font-semibold overflow-hidden"
                    style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)' }}
                  >
                    <button
                      type="button"
                      onClick={() => setAnimeLang('sub')}
                      className="px-4 py-2.5 transition-colors"
                      style={{
                        background: animeLang === 'sub' ? 'rgba(255,255,255,0.18)' : 'transparent',
                        color: animeLang === 'sub' ? '#fff' : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      SUB
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnimeLang('dub')}
                      className="px-4 py-2.5 transition-colors"
                      style={{
                        background: animeLang === 'dub' ? 'rgba(255,255,255,0.18)' : 'transparent',
                        color: animeLang === 'dub' ? '#fff' : 'rgba(255,255,255,0.55)',
                      }}
                    >
                      DUB
                    </button>
                  </div>
                )}
                {details && (
                    <button
                      onClick={() => setShowCollectionModal(true)}
                      className="inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold transition-all hover:opacity-90"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
                    >
                      <Plus className="w-4 h-4" /> {t.addToCollection}
                    </button>
                )}
                {isUnreleased && details && (
                  <button
                    onClick={toggleReminder}
                    className="inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold transition-all"
                    style={isReminded ? {
                      background: 'var(--accent)',
                      color: 'white',
                      boxShadow: '0 0 24px var(--accent-glow)'
                    } : {
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: 'rgba(255,255,255,0.85)'
                    }}
                  >
                    {isReminded ? <BellRing className="w-4 h-4 fill-current" /> : <Bell className="w-4 h-4" />}
                    {isReminded ? t.reminderSet : t.remindMe}
                  </button>
                )}
                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm font-semibold"
                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}
                  >
                    {t.trailer} <ArrowRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            {/* ── Right: poster ─────────────────────────────────────────── */}
            <button
              className="hidden sm:block shrink-0 self-center overflow-hidden shadow-2xl cursor-pointer group focus:outline-none"
              style={{
                width: 180,
                aspectRatio: '2/3',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'transparent',
                padding: 0,
              }}
              onClick={() => details && setPosterOpen(true)}
              aria-label="View full poster"
            >
              <img
                src={posterSrc}
                alt={title}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </button>
          </div>
        </motion.div>

        {/* ── Content below card ─────────────────────────────────────────── */}
        <div className="mt-8 space-y-10">

          {/* Seasons & Episodes */}
          {isEpisodic && (
            <SeasonPanel
              key={activeSeason}
              details={details}
              activeSeason={activeSeason}
              activeEpisode={playback?.episode ?? activeEpisode}
              seasonDetails={seasonDetails}
              t={t}
              onSeasonChange={(n) => {
                const next = new URLSearchParams(searchParams)
                next.set('season', String(n))
                next.delete('episode')
                setSearchParams(next, { replace: true })
                setPlayback(null)
              }}
              onEpisodeChange={(n) => {
                const next = new URLSearchParams(searchParams)
                next.set('season', String(activeSeason))
                next.set('episode', String(n))
                setSearchParams(next, { replace: true })
                handlePlay(activeSeason, n)
              }}
              progressStore={progressStore}
              watchedEpisodes={watchedEpisodes}
              onToggleWatched={toggleWatchedEpisode}
              onAddToHistory={() => {
                if (!mediaType) return
                setHistory(current => upsertHistory(current, {
                  mediaType,
                  id: Number(id),
                  title,
                  posterPath: details?.poster_path,
                  backdropPath: details?.backdrop_path,
                  watchedAt: Date.now(),
                }))
              }}
              mediaType={mediaType}
              id={id}
            />
          )}

          {/* Cast + Details */}
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">{t.cast}</h2>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {cast.map((m) => <CastCard key={m.id} member={m} />)}
                {!cast.length && !loading && (
                  <EmptyPanel label={t.noCast} description={t.noCastSub} />
                )}
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white mb-4">{t.details}</h2>
              <div className="grid grid-cols-2 gap-2">
                <FactBadge label={t.facts.released} value={details?.release_date ?? details?.first_air_date ?? '—'} />
                <FactBadge label={t.facts.language} value={details?.original_language?.toUpperCase() ?? '—'} />
                <FactBadge label={t.facts.score} value={details?.vote_average ? `${details.vote_average.toFixed(1)} / 10` : '—'} />
                <FactBadge label={t.facts.status} value={details?.status ?? '—'} />
                {isEpisodic && details?.number_of_seasons ? (
                  <FactBadge label={t.facts.seasons} value={`${details.number_of_seasons}`} />
                ) : null}
                {mediaType === 'movie' && details?.runtime ? (
                  <FactBadge label={t.facts.runtime} value={formatDuration(details.runtime)} />
                ) : null}
                {details?.budget ? <FactBadge label={t.facts.budget} value={formatMoney(details.budget)} /> : null}
                {details?.revenue ? <FactBadge label={t.facts.revenue} value={formatMoney(details.revenue)} /> : null}
              </div>
            </div>
          </div>

          {/* More Like This */}
          {details?.recommendations?.results && details.recommendations.results.length > 0 && (
            <div className="pt-8">
              <h2 className="text-lg font-semibold text-white mb-6">{t.moreLikeThis}</h2>
              <MediaGrid
                items={details.recommendations.results.slice(0, 12)}
                loading={false}
                emptyLabel=""
                columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
              />
            </div>
          )}

          {error && <SetupNotice compact message={error} />}

          {/* Comments */}
          {id && <CommentsSection movieId={id} />}
        </div>
      </div>

      {/* ── Poster lightbox ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {posterOpen && (
          <motion.div
            key="poster-lightbox"
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPosterOpen(false)}
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
          >
            {/* Close button */}
            <button
              className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
              onClick={() => setPosterOpen(false)}
              aria-label="Close poster"
            >
              <X size={28} />
            </button>

            <motion.img
              src={posterOriginalSrc}
              alt={title}
              className="max-h-[90dvh] w-auto object-contain shadow-2xl"
              style={{ borderRadius: 16, maxWidth: '90vw' }}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.88, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}


// ─── SeasonPanel ─────────────────────────────────────────────────────────────

function SeasonPanel({
  details, activeSeason, activeEpisode, seasonDetails, onSeasonChange, onEpisodeChange,
  progressStore, watchedEpisodes, onToggleWatched, onAddToHistory, mediaType, id, t
}: {
  details: MediaDetails | null
  activeSeason: number
  activeEpisode: number
  seasonDetails: SeasonDetails | null
  onSeasonChange: (n: number) => void
  onEpisodeChange: (n: number) => void
  progressStore: Record<string, number>
  watchedEpisodes: Set<string>
  onToggleWatched: (key: string) => void
  onAddToHistory: () => void
  mediaType: string
  id: string
  t: typeof locales.en.titlePage
}) {
  const seasons = details?.seasons?.filter((s) => s.season_number > 0) ?? []
  const [episodeQuery, setEpisodeQuery] = useState('')

  const filteredEpisodes = useMemo(() => {
    const episodes = seasonDetails?.episodes ?? []
    if (!episodeQuery.trim()) return episodes
    const q = episodeQuery.toLowerCase()
    return episodes.filter(ep => 
      ep.name.toLowerCase().includes(q) || 
      (ep.overview && ep.overview.toLowerCase().includes(q))
    )
  }, [seasonDetails?.episodes, episodeQuery])

  const allEpisodes = seasonDetails?.episodes ?? []
  const seasonEpKeys = allEpisodes.map(ep => `${mediaType}-${id}-${activeSeason}-${ep.episode_number}`)
  const allSeasonWatched = seasonEpKeys.length > 0 && seasonEpKeys.every(k => watchedEpisodes.has(k))

  const defaultRuntime = mediaType === 'anime' ? 24 : 45

  // All season summaries — used for mark-whole-show
  const allSeasons = mediaType === 'anime'
    ? [{ season_number: 1, episode_count: allEpisodes.length || (details?.number_of_episodes ?? 0) }]
    : (seasons.map(s => ({ season_number: s.season_number, episode_count: s.episode_count })))

  // Build a runtime lookup for episodes we've already loaded (current season)
  const runtimeByKey: Record<string, number> = {}
  allEpisodes.forEach(ep => {
    runtimeByKey[`${mediaType}-${id}-${activeSeason}-${ep.episode_number}`] = (ep.runtime || defaultRuntime) * 60
  })

  // Count all keys that would belong to this show
  const allShowKeys = allSeasons.flatMap(s =>
    Array.from({ length: s.episode_count }, (_, i) => `${mediaType}-${id}-${s.season_number}-${i + 1}`)
  )
  const allShowWatched = allShowKeys.length > 0 && allShowKeys.every(k => watchedEpisodes.has(k))

  function markSeasonWatched() {
    allEpisodes.forEach((ep, i) => {
      writeProgressEntry(seasonEpKeys[i], (ep.runtime || defaultRuntime) * 60)
    })
    writeBulkWatched(seasonEpKeys)
    onAddToHistory()
  }
  function unmarkSeasonWatched() {
    removeBulkWatched(seasonEpKeys)
  }

  function markShowWatched() {
    allShowKeys.forEach(k => {
      writeProgressEntry(k, runtimeByKey[k] ?? defaultRuntime * 60)
    })
    writeBulkWatched(allShowKeys)
    onAddToHistory()
  }
  function unmarkShowWatched() {
    removeBulkWatched(allShowKeys)
  }

  return (
    <div>
      {/* Header row: "Episodes" label + season + show watched buttons */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h2 className="text-lg font-semibold text-white">{t.episodes}</h2>
        {allEpisodes.length > 0 && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {/* Mark whole show */}
            <button
              type="button"
              onClick={allShowWatched ? unmarkShowWatched : markShowWatched}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: allShowWatched ? 'rgba(var(--accent-rgb,139,92,246),0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${allShowWatched ? 'var(--accent)' : 'rgba(255,255,255,0.10)'}`,
                color: allShowWatched ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
              }}
            >
              {allShowWatched
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> {t.showWatched}</>
                : <><Circle className="w-3.5 h-3.5" /> {t.markShowWatched}</>
              }
            </button>

            {/* Mark current season */}
            <button
              type="button"
              onClick={allSeasonWatched ? unmarkSeasonWatched : markSeasonWatched}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                background: allSeasonWatched ? 'rgba(var(--accent-rgb,139,92,246),0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${allSeasonWatched ? 'var(--accent)' : 'rgba(255,255,255,0.12)'}`,
                color: allSeasonWatched ? 'var(--accent)' : 'rgba(255,255,255,0.55)',
              }}
            >
              {allSeasonWatched
                ? <><CheckCircle2 className="w-3.5 h-3.5" /> {t.seasonWatched}</>
                : <><Circle className="w-3.5 h-3.5" /> {t.markSeasonWatched}</>
              }
            </button>
          </div>
        )}
      </div>

      {/* Season tabs & Search bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex gap-2 flex-wrap">
          {seasons.map((s) => (
            <button
              key={s.season_number}
              type="button"
              onClick={() => onSeasonChange(s.season_number)}
              className="px-4 py-2 text-sm rounded-full transition-all"
              style={
                s.season_number === activeSeason
                  ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 0 16px var(--accent-glow)' }
                  : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.65)' }
              }
            >
              {t.season} {s.season_number}
            </button>
          ))}
        </div>

        {/* Episode Search Bar */}
        <div className="relative shrink-0 w-full sm:w-64">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            type="text"
            placeholder={t.searchEpisode}
            value={episodeQuery}
            onChange={(e) => setEpisodeQuery(e.target.value)}
            className="w-full pl-10 pr-8 py-2 text-sm bg-white/5 border border-white/10 rounded-full outline-none text-white placeholder-white/40 transition-all focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/30"
          />
          {episodeQuery && (
            <button
              onClick={() => setEpisodeQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-white/40 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Episode list */}
      <div className="grid gap-2 sm:gap-3 lg:grid-cols-2" style={{ maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
        {filteredEpisodes.map((ep) => {
          const epKey = `${mediaType}-${id}-${activeSeason}-${ep.episode_number}`
          const isActive = ep.episode_number === activeEpisode
          const isWatched = watchedEpisodes.has(epKey)
          const watchedSeconds = progressStore[epKey] || 0
          const runtimeMinutes = ep.runtime || (mediaType === 'anime' ? 24 : 45)
          const pct = (watchedSeconds / (runtimeMinutes * 60)) * 100
          const progressPercent = Math.min(100, pct)
          const hasProgress = watchedSeconds > 0

          return (
            <div
              key={ep.id}
              className="text-left transition-all cursor-pointer p-2 sm:p-3"
              style={{
                borderRadius: 12,
                background: isWatched
                  ? 'rgba(var(--accent-rgb,139,92,246),0.08)'
                  : isActive
                    ? 'var(--accent-dim)'
                    : hasProgress
                      ? 'rgba(var(--accent-rgb, 139,92,246),0.06)'
                      : 'rgba(255,255,255,0.03)',
                border: `1px solid ${
                  isWatched
                    ? 'rgba(var(--accent-rgb,139,92,246),0.3)'
                    : isActive
                      ? 'var(--accent)'
                      : hasProgress
                        ? 'rgba(var(--accent-rgb, 139,92,246),0.2)'
                        : 'rgba(255,255,255,0.07)'
                }`,
              }}
              onClick={() => onEpisodeChange(ep.episode_number)}
            >
              <div className="flex gap-2 sm:gap-3">
                {/* Thumbnail */}
                <div
                  className="shrink-0 overflow-hidden relative"
                  style={{ width: 'clamp(60px, 17vw, 128px)', aspectRatio: '16/9', borderRadius: 7, background: 'rgba(255,255,255,0.06)' }}
                >
                  {ep.still_path ? (
                    <img src={imageUrl(ep.still_path, 'w342')} alt={ep.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                      {t.noStill}
                    </div>
                  )}

                  {/* Watched overlay on thumbnail */}
                  {isWatched && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
                      <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--accent)' }} />
                    </div>
                  )}

                  {hasProgress && !isWatched && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(4, progressPercent)}%`,
                          background: 'var(--accent)',
                          boxShadow: '0 0 6px var(--accent-glow)',
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Text content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1.5 mb-0.5">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-widest shrink-0" style={{ color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.35)' }}>
                      E{ep.episode_number}
                    </span>

                    {/* Right-side meta: checkmark · progress · runtime */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                      {/* Mark-as-watched toggle — always visible, left of progress */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleWatched(epKey)
                          if (!isWatched) {
                            writeProgressEntry(epKey, (ep.runtime || defaultRuntime) * 60)
                            onAddToHistory()
                          }
                        }}
                        title={isWatched ? t.markUnwatched : t.markWatched}
                        className="flex items-center justify-center transition-colors hover:opacity-80"
                        style={{ color: isWatched ? 'var(--accent)' : 'rgba(255,255,255,0.25)', minHeight: 0 }}
                      >
                        {isWatched
                          ? <CheckCircle2 className="w-3.5 h-3.5" />
                          : <Circle className="w-3.5 h-3.5" />
                        }
                      </button>

                      {isWatched && (
                        <span className="hidden sm:inline text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>{t.watched}</span>
                      )}
                      {!isWatched && hasProgress && (
                        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)' }}>
                          {Math.round(progressPercent)}%
                        </span>
                      )}
                      {ep.runtime && <span className="text-[9px] sm:text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{ep.runtime}m</span>}
                    </div>
                  </div>

                  <div className="text-xs sm:text-sm font-semibold text-white mb-0.5 truncate" style={{ opacity: isWatched ? 0.6 : 1 }}>{ep.name}</div>
                  <div className="ep-synopsis-wrap hidden sm:block overflow-hidden" style={{ maxHeight: 'calc(2 * 1.625em)', fontSize: '0.75rem' }}>
                    <p className="ep-synopsis-text leading-relaxed m-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
                      {ep.overview || t.noSynopsis}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {filteredEpisodes.length === 0 && (seasonDetails?.episodes ?? []).length > 0 && (
          <div className="col-span-full py-12 text-center">
            <p className="text-white/40 text-sm">{t.noEpisodesFound} "{episodeQuery}"</p>
          </div>
        )}
        {!seasonDetails?.episodes?.length && (
          <EmptyPanel label={t.episodesLoading} description={t.episodesLoadingSub} />
        )}
      </div>
    </div>
  )
}
