import { createPortal } from 'react-dom'
import { useEffect, useEffectEvent, useState, useRef } from 'react'
import { X, SkipForward } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { STORAGE_KEYS, writeWatchedEntry } from './hooks'

// ─── FullscreenPlayer ─────────────────────────────────────────────────────────

export function FullscreenPlayer({
  src,
  onClose,
  progressKey,
  onEpisodeChange,
  onNextEpisode,
}: {
  src: string
  onClose: () => void
  progressKey?: string
  onEpisodeChange?: (season: number, episode: number) => void
  onNextEpisode?: () => void
}) {
  const [showControls, setShowControls] = useState(true)
  const timeoutRef = useRef<number | null>(null)

  const wake = useEffectEvent(() => {
    setShowControls(true)
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000)
  })

  // Real progress tracking from embedded players that post playback updates.
  useEffect(() => {
    let lastSavedTime = 0
    let latestTimestamp = 0
    let latestDuration = 0
    let currentKey = progressKey
    const markedWatched = new Set<string>()   // avoid duplicate writes per session

    function maybeMarkWatched(key: string | undefined, percent: number) {
      if (key && percent >= 0.95 && !markedWatched.has(key)) {
        markedWatched.add(key)
        writeWatchedEntry(key)
      }
    }

    function persistProgress(key: string, timestamp: number, duration?: number) {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEYS.progress)
        const data = raw ? JSON.parse(raw) : {}
        data[key] = timestamp
        if (duration != null && duration > 0) {
          data[key + ':duration'] = duration
        }
        window.localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(data))
      } catch (e) { /* ignore */ }
    }

    function handleMessage(event: MessageEvent) {
      const raw = event.data
      if (typeof raw !== 'string' && typeof raw !== 'object') return
      try {
        const payload = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (!payload || typeof payload !== 'object') return

        // ── animeplay.cfd events ────────────────────────────────────────
        // { event: "time", time: number, duration: number, percent: number }
        if (payload.event === 'time' && typeof payload.time === 'number') {
          const ts = payload.time
          const dur = payload.duration ?? 0
          latestTimestamp = ts
          if (dur > 0) latestDuration = dur
          if (Math.abs(ts - lastSavedTime) >= 5) {
            lastSavedTime = ts
            if (currentKey) persistProgress(currentKey, ts, dur > 0 ? dur : undefined)
          }
          // Auto-mark watched at 95% — prefer explicit percent field, fall back to ratio
          const pct = typeof payload.percent === 'number'
            ? payload.percent / 100
            : dur > 0 ? ts / dur : 0
          maybeMarkWatched(currentKey, pct)
          return
        }

        // { type: "watching-log", currentTime: number, duration: number }
        if (payload.type === 'watching-log' && typeof payload.currentTime === 'number') {
          const ts = payload.currentTime
          const dur = payload.duration ?? 0
          latestTimestamp = ts
          if (dur > 0) latestDuration = dur
          if (currentKey) persistProgress(currentKey, ts, dur > 0 ? dur : undefined)
          maybeMarkWatched(currentKey, dur > 0 ? ts / dur : 0)
          return
        }

        // { event: "complete" } — episode finished, mark watched then advance
        if (payload.event === 'complete') {
          maybeMarkWatched(currentKey, 1)    // completed = 100%
          if (onEpisodeChange && currentKey) {
            const parts = currentKey.split('-')
            if (parts.length >= 4) {
              const season = Number(parts[2])
              const nextEpisode = Number(parts[3]) + 1
              const newKey = `${parts[0]}-${parts[1]}-${season}-${nextEpisode}`
              currentKey = newKey
              onEpisodeChange(season, nextEpisode)
            }
          }
          return
        }

        // ── Videasy MEDIA_DATA ─────────────────────────────────────────
        if (payload.type === 'MEDIA_DATA' && typeof payload.data === 'string') {
          const allMedia: Record<string, any> = JSON.parse(payload.data)

          const parts = currentKey?.split('-')
          if (parts && parts.length >= 2) {
            const mediaPrefix = `${parts[0]}-${parts[1]}`
            const entry = allMedia[mediaPrefix]
            if (entry) {
              if (entry.last_season_watched != null && entry.last_episode_watched != null) {
                const newKey = `${mediaPrefix}-${entry.last_season_watched}-${entry.last_episode_watched}`
                if (newKey !== currentKey) {
                  currentKey = newKey
                  if (onEpisodeChange) {
                    onEpisodeChange(Number(entry.last_season_watched), Number(entry.last_episode_watched))
                  }
                }
              }

              let ts = 0
              let dur = 0
              if (parts.length >= 4) {
                const epKey = `s${parts[2]}e${parts[3]}`
                const epProgress = entry.show_progress?.[epKey]?.progress
                if (epProgress && typeof epProgress.watched === 'number') {
                  ts = epProgress.watched
                  if (epProgress.duration) dur = epProgress.duration
                }
              }
              if (ts === 0 && entry.progress?.watched != null) {
                ts = entry.progress.watched
                if (entry.progress.duration) dur = entry.progress.duration
              }

              if (ts > 0) {
                latestTimestamp = ts
                if (dur > 0) latestDuration = dur
                if (Math.abs(ts - lastSavedTime) >= 5) {
                  lastSavedTime = ts
                  persistProgress(currentKey!, ts, dur > 0 ? dur : undefined)
                }
                maybeMarkWatched(currentKey, dur > 0 ? ts / dur : 0)
              }
            }
          }
          return
        }

        // ── Fallback: direct timestamp object ──────────────────────────
        if (typeof payload.timestamp === 'number') {
          latestTimestamp = payload.timestamp
          const nextKey = `${payload.type}-${payload.id}-${payload.season || 0}-${payload.episode || 0}`

          if (!currentKey) {
            currentKey = nextKey
          } else if (currentKey !== nextKey) {
            currentKey = nextKey
            if (onEpisodeChange && payload.season && payload.episode) {
              onEpisodeChange(payload.season, payload.episode)
            }
          }

          if (Math.abs(payload.timestamp - lastSavedTime) >= 5) {
            lastSavedTime = payload.timestamp
            persistProgress(currentKey!, payload.timestamp)
          }
          maybeMarkWatched(currentKey, latestDuration > 0 ? latestTimestamp / latestDuration : 0)
        }
      } catch {
        // Not parseable — ignore
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)

      // Ensure the absolute latest timestamp is saved before unmounting!
      if (currentKey && latestTimestamp > 0) {
        persistProgress(currentKey, latestTimestamp, latestDuration > 0 ? latestDuration : undefined)
        maybeMarkWatched(currentKey, latestDuration > 0 ? latestTimestamp / latestDuration : 0)
      }

      // Dispatch event on close so the underlying UI updates its progress bars
      if (currentKey) {
        window.dispatchEvent(new Event('progress-updated'))
      }
    }
  }, [progressKey])

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      wake()
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Prevent body scroll while player is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Auto-hide controls after inactivity
  useEffect(() => {
    window.addEventListener('mousemove', wake)
    window.addEventListener('pointermove', wake)
    window.addEventListener('pointerdown', wake)
    window.addEventListener('touchstart', wake)
    wake()
    return () => {
      window.removeEventListener('mousemove', wake)
      window.removeEventListener('pointermove', wake)
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('touchstart', wake)
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    }
  }, [])

  const player = (
    <AnimatePresence>
      <motion.div
        key="fullscreen-player"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 300,
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Cross-origin iframes swallow pointer movement, so when controls are
            hidden we temporarily place a full-screen wake layer above the player. */}
        {!showControls && (
          <div
            onMouseMove={wake}
            onPointerMove={wake}
            onPointerDown={wake}
            onTouchStart={wake}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 5,
              background: 'transparent',
            }}
          />
        )}

        {/* ── Unified controls overlay — auto-hides as one unit ─────────── */}
        <AnimatePresence>
          {showControls && (
            <motion.div
              initial={{ y: -40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                padding: '12px 20px',
                background: 'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, transparent 100%)',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 10,
                gap: 12,
                pointerEvents: 'none',
              }}
            >
              {onNextEpisode ? (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '0 14px',
                    height: 36,
                    background: 'rgba(255,255,255,0.12)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: 600,
                    flexShrink: 0,
                    fontFamily: 'Inter, sans-serif',
                    pointerEvents: 'auto',
                  }}
                >
                  <SkipForward style={{ width: 14, height: 14 }} />
                  Next Episode
                </button>
              ) : null}

              <button
                type="button"
                onClick={onClose}
                aria-label="Close player"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer',
                  color: '#fff',
                  flexShrink: 0,
                  pointerEvents: 'auto',
                }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── iframe — takes up the full screen ──────────────────────── */}
        <iframe
          title="Video player"
          src={src}
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
          }}
          allow="autoplay; fullscreen *; picture-in-picture *; encrypted-media"
          referrerPolicy="no-referrer-when-downgrade"
        />

      </motion.div>
    </AnimatePresence>
  )

  return createPortal(player, document.body)
}
