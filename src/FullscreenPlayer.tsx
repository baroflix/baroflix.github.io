import { createPortal } from 'react-dom'
import { useEffect, useState, useRef } from 'react'
import { X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { STORAGE_KEYS } from './hooks'

// ─── FullscreenPlayer ─────────────────────────────────────────────────────────

export function FullscreenPlayer({
  src,
  onClose,
  progressKey,
  onEpisodeChange,
}: {
  src: string
  onClose: () => void
  progressKey?: string
  onEpisodeChange?: (season: number, episode: number) => void
}) {
  const [showControls, setShowControls] = useState(true)
  const timeoutRef = useRef<number | null>(null)

  // Real progress tracking from videasy player
  useEffect(() => {
    let lastSavedTime = 0
    let latestTimestamp = 0
    let latestDuration = 0
    let currentKey = progressKey

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
      if (typeof event.data !== 'string') return
      try {
        const payload = JSON.parse(event.data)
        console.log('[FullscreenPlayer] postMessage:', payload)

        // ── MEDIA_DATA: videasy sends bulk progress for all titles ──────
        if (payload?.type === 'MEDIA_DATA' && typeof payload.data === 'string') {
          const allMedia: Record<string, any> = JSON.parse(payload.data)

          // Derive the show-level key from our currentKey, e.g. "tv-85552" from "tv-85552-1-2"
          const parts = currentKey?.split('-')
          if (parts && parts.length >= 2) {
            const mediaPrefix = `${parts[0]}-${parts[1]}`  // e.g. "tv-85552"
            const entry = allMedia[mediaPrefix]
            if (entry) {
              // --- Detect auto-advance (binge mode) ---
              if (entry.last_season_watched != null && entry.last_episode_watched != null) {
                const newKey = `${mediaPrefix}-${entry.last_season_watched}-${entry.last_episode_watched}`
                if (newKey !== currentKey) {
                  currentKey = newKey
                  if (onEpisodeChange) {
                    onEpisodeChange(Number(entry.last_season_watched), Number(entry.last_episode_watched))
                  }
                }
              }

              // --- Extract timestamp & duration ---
              let ts = 0
              let dur = 0
              if (parts.length >= 4) {
                const season = parts[2]
                const episode = parts[3]
                const epKey = `s${season}e${episode}`
                const epProgress = entry.show_progress?.[epKey]?.progress
                if (epProgress && typeof epProgress.watched === 'number') {
                  ts = epProgress.watched
                  if (epProgress.duration) dur = epProgress.duration
                }
              }
              // Fallback to top-level progress
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
              }
            }
          }
          return
        }

        // ── PLAYER_EVENT: unknown structure, log for analysis ──────────
        if (payload?.type === 'PLAYER_EVENT') {
          console.log('[FullscreenPlayer] PLAYER_EVENT data:', JSON.stringify(payload.data, null, 2))
        }

        // ── Fallback: direct timestamp object ──────────────────────────
        if (payload && typeof payload.timestamp === 'number') {
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
        }
      } catch (err) {
        // Not a JSON string from the player
      }
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)

      // Ensure the absolute latest timestamp is saved before unmounting!
      if (currentKey && latestTimestamp > 0) {
        persistProgress(currentKey, latestTimestamp, latestDuration > 0 ? latestDuration : undefined)
      }

      // Dispatch event on close so the underlying UI updates its progress bars
      if (currentKey) {
        window.dispatchEvent(new Event('progress-updated'))
      }
    }
  }, [progressKey])

  const wake = () => {
    setShowControls(true)
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current)
    timeoutRef.current = window.setTimeout(() => setShowControls(false), 5000)
  }

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
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
    wake()
    return () => {
      window.removeEventListener('mousemove', wake)
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
        {/* ── Top bar ──────────────────────────────────────────────────── */}
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
              }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Close player"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invisible hit area to wake controls when mouse moves anywhere */}
        <div
          onMouseMove={wake}
          onClick={wake}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 5,
            pointerEvents: showControls ? 'none' : 'auto'
          }}
        />

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
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </motion.div>
    </AnimatePresence>
  )

  return createPortal(player, document.body)
}
