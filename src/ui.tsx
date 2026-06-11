import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, ArrowRight, Play, X, ChevronLeft, ChevronRight } from 'lucide-react'
import heroFallback from './assets/hero.png'
import { imageUrl, mediaTypeFromItem, titleFromItem, yearFromItem } from './lib/tmdb'
import { useProgressStore } from './hooks'
import type { MediaItem, CastMember } from './types'

// ─── Media Card ───────────────────────────────────────────────────────────────

export function MediaCard({ item }: { item: MediaItem }) {
  const kind = mediaTypeFromItem(item)
  const link = `/title/${kind}/${item.id}`
  const image = imageUrl(item.poster_path, 'w500') || imageUrl(item.backdrop_path, 'w500') || heroFallback

  return (
    <motion.article
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-full"
    >
      <Link
        to={link}
        className="group block overflow-hidden h-full"
        style={{ borderRadius: 16, border: '1px solid var(--border)' }}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] bg-white/5 overflow-hidden">
          <img
            src={image}
            alt={titleFromItem(item)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Bottom gradient */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.96) 0%, rgba(8,8,8,0.0) 50%)' }}
          />
          {/* Type badge — always on dark image, keep dark bg + white text */}
          <div
            className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{
              background: 'rgba(8,8,8,0.7)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 999,
              color: 'rgba(255,255,255,0.7)',
            }}
          >
            {kind}
          </div>
          {/* Score — always on dark image */}
          {item.vote_average ? (
            <div
              className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold"
              style={{
                background: 'rgba(8,8,8,0.75)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 999,
                color: '#fff',
              }}
            >
              <Star className="w-2.5 h-2.5" style={{ color: '#f59e0b', fill: '#f59e0b' }} />
              <span>{item.vote_average.toFixed(1)}</span>
            </div>
          ) : null}
          {/* Hover overlay */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center"
            style={{ background: 'var(--accent-dim)' }}
          >
            <div
              className="flex items-center justify-center w-12 h-12 rounded-full"
              style={{
                background: 'var(--accent)',
                boxShadow: '0 0 32px var(--accent-glow)',
              }}
            >
              <Play className="w-5 h-5 text-white fill-white" />
            </div>
          </div>
        </div>
        {/* Info below poster — adapts to theme */}
        <div className="px-3 py-3" style={{ background: 'var(--bg-card)' }}>
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{titleFromItem(item)}</div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {yearFromItem(item) ?? 'Now Streaming'}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}

// ─── Media Grid ───────────────────────────────────────────────────────────────

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
} as const
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const

export function MediaGrid({
  items,
  loading,
  emptyLabel,
  columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  stagger = false,
}: {
  items: MediaItem[]
  loading: boolean
  emptyLabel: string
  columnsClassName?: string
  stagger?: boolean
}) {
  if (loading) return <GridSkeleton columnsClassName={columnsClassName} />
  if (!items.length) return <EmptyPanel label="Nothing here yet" description={emptyLabel} />

  return (
    <motion.div
      className={`grid gap-3 ${columnsClassName}`}
      variants={stagger ? gridVariants : undefined}
      initial={stagger ? 'hidden' : undefined}
      animate={stagger ? 'show' : undefined}
    >
      {items.map((item) => (
        <motion.div
          key={`${item.media_type ?? mediaTypeFromItem(item)}-${item.id}`}
          variants={stagger ? itemVariants : undefined}
        >
          <MediaCard item={item} />
        </motion.div>
      ))}
    </motion.div>
  )
}

// ─── Content Rail (horizontal scroll-snap) ───────────────────────────────────

export function ContentRail({ items, loading }: { items: MediaItem[]; loading: boolean }) {
  const railRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    if (!railRef.current) return
    const scrollAmount = railRef.current.clientWidth * 0.75
    railRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="skeleton shrink-0 rounded-2xl"
            style={{ width: 160, aspectRatio: '2/3' }}
          />
        ))}
      </div>
    )
  }

  if (!items.length) return <EmptyPanel label="Nothing yet" description="Check back soon." />

  return (
    <div className="relative group/rail">
      {/* Left arrow — dark pill works against both light and dark content */}
      <button
        type="button"
        onClick={() => scroll('left')}
        tabIndex={-1}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
        style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>

      <div ref={railRef} className="rail">
        {items.map((item) => (
          <div
            key={`${item.media_type ?? mediaTypeFromItem(item)}-${item.id}`}
            style={{ width: 160 }}
          >
            <MediaCard item={item} />
          </div>
        ))}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scroll('right')}
        tabIndex={-1}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
        style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      >
        <ChevronRight className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}

// ─── Continue Watching Rail ───────────────────────────────────────────────────

export function ContinueWatchingRail({ history, onRemove }: {
  history: Array<{
    mediaType: string; id: number; title: string; posterPath?: string | null;
    backdropPath?: string | null; season?: number; episode?: number; watchedAt: number;
  }>
  onRemove: (index: number) => void
}) {
  const progressStore = useProgressStore()

  const railRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    if (!railRef.current) return
    const scrollAmount = railRef.current.clientWidth * 0.75
    railRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }

  if (!history.length) {
    return <EmptyPanel label="Nothing watched yet" description="Press play on any title and it will appear here." />
  }

  return (
    <div className="relative group/rail">
      {/* Left arrow */}
      <button
        type="button"
        onClick={() => scroll('left')}
        tabIndex={-1}
        aria-label="Scroll left"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
        style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      >
        <ChevronLeft className="w-4 h-4 text-white" />
      </button>

      <div ref={railRef} className="rail">
        {history.map((item, index) => {
        const progressKey = `${item.mediaType}-${item.id}-${item.season || 0}-${item.episode || 0}`
        const watchedSeconds = progressStore[progressKey] || 0
        const storedDuration = progressStore[progressKey + ':duration']
        const runtimeSeconds = storedDuration || (item.mediaType === 'anime' ? 24 : 45) * 60
        const progressPercent = Math.min(100, (watchedSeconds / runtimeSeconds) * 100)

        return (
          <Link
          key={`${item.mediaType}-${item.id}-${item.watchedAt}`}
          to={`/title/${item.mediaType}/${item.id}`}
          className="group shrink-0 overflow-hidden transition-transform hover:-translate-y-1 relative"
          style={{
            width: 220,
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}
        >
          <div className="relative" style={{ aspectRatio: '16/9' }}>
            <img
              src={imageUrl(item.backdropPath, 'w500') || imageUrl(item.posterPath, 'w500') || heroFallback}
              alt={item.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.9), transparent 60%)' }} />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(index) }}
              className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-all hover:scale-110 z-20"
              style={{
                width: 20,
                height: 20,
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
              }}
              aria-label="Remove from continue watching"
            >
              <X className="w-2.5 h-2.5" />
            </button>
            {/* Progress bar */}
            {progressPercent > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="h-full" style={{ width: `${progressPercent}%`, background: 'var(--accent)' }} />
              </div>
            )}
          </div>
          <div className="px-3 py-2.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                {item.mediaType.toUpperCase()}
                {item.season ? ` · S${item.season}` : ''}
                {item.episode ? ` E${item.episode}` : ''}
              </div>
            </div>
            <Link
              to={`/title/${item.mediaType}/${item.id}${item.season && item.episode ? `?season=${item.season}&episode=${item.episode}&autoplay=1` : '?autoplay=1'}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center justify-center rounded-full shrink-0 transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
              style={{
                width: 28,
                height: 28,
                background: 'var(--accent)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
              aria-label="Continue watching"
            >
              <Play className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </Link>
      )})}
      </div>

      {/* Right arrow */}
      <button
        type="button"
        onClick={() => scroll('right')}
        tabIndex={-1}
        aria-label="Scroll right"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity"
        style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}
      >
        <ChevronRight className="w-4 h-4 text-white" />
      </button>
    </div>
  )
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ number, title, subtitle }: { number?: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-end gap-4 mb-5">
      {number && (
        <span className="text-4xl font-bold tabular-nums" style={{ color: 'var(--text-ghost)', fontFamily: 'DM Serif Display, serif' }}>
          {number}
        </span>
      )}
      <div>
        {subtitle && <div className="text-[11px] uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>{subtitle}</div>}
        <h2 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      </div>
    </div>
  )
}

// ─── Chip ─────────────────────────────────────────────────────────────────────

export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block px-3 py-1 text-xs font-medium"
      style={{
        borderRadius: 999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      {children}
    </span>
  )
}

// ─── Empty Panel ─────────────────────────────────────────────────────────────

export function EmptyPanel({ label, description }: { label: string; description: string }) {
  return (
    <div
      className="py-10 px-6 text-center"
      style={{ borderRadius: 16, border: '1px dashed var(--border)' }}
    >
      <div className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </div>
  )
}

// ─── Setup Notice ─────────────────────────────────────────────────────────────

export function SetupNotice({ compact = false, message }: { compact?: boolean; message?: string }) {
  return (
    <div
      className={`${compact ? 'p-4' : 'p-6'} rounded-2xl`}
      style={{ background: 'rgba(229,9,20,0.08)', border: '1px solid rgba(229,9,20,0.2)' }}
    >
      <div className="text-sm font-semibold mb-1" style={{ color: 'var(--accent)' }}>TMDB Setup Required</div>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {message ?? 'Add VITE_TMDB_API_KEY or VITE_TMDB_ACCESS_TOKEN in a .env file, then reload to unlock live posters, cast, seasons, and search.'}
      </p>
    </div>
  )
}

// ─── Fact Badge ───────────────────────────────────────────────────────────────

export function FactBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-4 py-3"
      style={{ borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

// ─── Cast Card ────────────────────────────────────────────────────────────────

export function CastCard({ member }: { member: CastMember }) {
  return (
    <Link
      to={`/person/${member.id}`}
      className="flex items-center gap-3 p-3 transition-colors"
      style={{ borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)' }}
    >
      <div
        className="shrink-0 overflow-hidden"
        style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-card-hover)' }}
      >
        {member.profile_path ? (
          <img
            src={imageUrl(member.profile_path, 'w342')}
            alt={member.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'var(--text-secondary)' }}>
            {member.name[0]}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{member.name}</div>
        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{member.character ?? 'Cast'}</div>
      </div>
    </Link>
  )
}

// ─── Grid Skeleton ────────────────────────────────────────────────────────────

export function GridSkeleton({ columnsClassName = 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' }: { columnsClassName?: string }) {
  return (
    <div className={`grid gap-3 ${columnsClassName}`}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ aspectRatio: '2/3' }} />
          <div style={{ padding: 12, background: 'var(--bg-card)' }}>
            <div className="skeleton h-3 rounded-full mb-2" style={{ width: '60%' }} />
            <div className="skeleton h-2.5 rounded-full" style={{ width: '40%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Select Field ─────────────────────────────────────────────────────────────

export function SelectField({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: string[]
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 outline-none transition-colors"
        style={{
          borderRadius: 12,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
        }}
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  )
}

// ─── Player Frame ─────────────────────────────────────────────────────────────

export function PlayerFrame({ src, title }: { src: string; title: string }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        borderRadius: 20,
        border: '1px solid var(--border)',
        boxShadow: '0 0 80px var(--accent-glow), 0 32px 80px rgba(0,0,0,0.7)',
      }}
    >
      <div
        className="flex items-center gap-3 px-5 py-3 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-card)' }}
      >
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ background: '#ff5f57' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#ffbd2e' }} />
          <div className="w-3 h-3 rounded-full" style={{ background: '#28ca41' }} />
        </div>
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{title}</span>
      </div>
      <div style={{ background: '#000' }}>
        <iframe
          title={`${title} player`}
          src={src}
          className="aspect-video w-full block"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  )
}

// ─── Back Button ─────────────────────────────────────────────────────────────

export function BackButton() {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      onClick={() => navigate(-1)}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer"
      style={{
        borderRadius: 999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
      }}
    >
      <ArrowRight className="w-3.5 h-3.5 rotate-180" />
      Back
    </button>
  )
}
