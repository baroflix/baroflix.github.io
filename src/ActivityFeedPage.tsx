import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Film, Tv, Sword, Clock, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './context/AuthContext'
import { supabase } from './lib/supabase'
import type { ProfileWithBadges } from './lib/supabase'
import type { WatchHistoryEntry } from './hooks'

// ─── Constants ────────────────────────────────────────────────

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

function posterUrl(entry: WatchHistoryEntry): string | null {
  if (!entry.posterPath) return null
  return entry.posterPath.startsWith('http') ? entry.posterPath : `${POSTER_BASE}${entry.posterPath}`
}

// ─── Time formatting ──────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Activity item ────────────────────────────────────────────

function ActivityItem({ entry, username, avatarUrl }: {
  entry: WatchHistoryEntry
  username?: string | null
  avatarUrl?: string | null
}) {
  const imgSrc = posterUrl(entry)
  const [imgFailed, setImgFailed] = useState(false)

  const subtitleParts: string[] = []
  if (entry.mediaType === 'movie') subtitleParts.push('Movie')
  else if (entry.season && entry.episode) subtitleParts.push(`S${entry.season} E${entry.episode}`)
  else if (entry.season) subtitleParts.push(`Season ${entry.season}`)
  else if (entry.mediaType === 'anime') subtitleParts.push('Anime')
  else subtitleParts.push('TV Show')

  const TypeIcon = entry.mediaType === 'movie' ? Film
    : entry.mediaType === 'anime' ? Sword : Tv

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-4 px-5 py-4 rounded-2xl transition-colors"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Avatar */}
      {username !== undefined && (
        <Link to={`/user/${username}`} className="no-bg-hover shrink-0">
          <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={username ?? ''} className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {username?.[0]?.toUpperCase() ?? '?'}
              </span>
            )}
          </div>
        </Link>
      )}

      {/* Poster */}
      <Link
        to={`/title/${entry.mediaType}/${entry.id}`}
        className="no-bg-hover shrink-0"
        style={{ display: 'block', width: 44, borderRadius: 8, overflow: 'hidden' }}
      >
        <div style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.06)', borderRadius: 8, overflow: 'hidden' }}>
          {imgSrc && !imgFailed ? (
            <img src={imgSrc} alt={entry.title}
              onError={() => setImgFailed(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TypeIcon size={14} style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {username !== undefined && (
          <p className="text-xs font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
            <Link to={`/user/${username}`} className="no-bg-hover hover:text-white transition-colors">
              @{username}
            </Link>
            {' '}watched
          </p>
        )}
        <Link to={`/title/${entry.mediaType}/${entry.id}`} className="no-bg-hover block">
          <p className="text-sm font-semibold text-white leading-snug truncate hover:text-white/80 transition-colors">
            {entry.title}
          </p>
        </Link>
        <div className="flex items-center gap-2 mt-1" style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>
          <TypeIcon size={11} />
          <span>{subtitleParts.join(' · ')}</span>
          <span>·</span>
          <span>{timeAgo(entry.watchedAt)}</span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Empty state ──────────────────────────────────────────────

function EmptyState({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
      <div style={{ fontSize: 40 }}>{icon}</div>
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, maxWidth: 280, lineHeight: 1.6 }}>{body}</p>
    </div>
  )
}

// ─── Tab button ───────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold px-4 py-1.5 rounded-full transition-all"
      style={{
        background: active ? 'var(--accent-dim)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.1)'}`,
        color: active ? 'var(--accent)' : 'rgba(255,255,255,0.55)',
      }}
    >
      {children}
    </button>
  )
}

// ─── ActivityFeedPage ─────────────────────────────────────────

export function ActivityFeedPage() {
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const [tab, setTab] = useState<'yours' | 'following'>('yours')
  const [followingActivity, setFollowingActivity] = useState<{
    entry: WatchHistoryEntry
    username: string | null
    avatarUrl: string | null
  }[]>([])
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const fetchedRef = useRef(false)

  // Own history from profile
  const ownHistory: WatchHistoryEntry[] = [...(profile?.watch_history ?? [])]
    .sort((a: any, b: any) => (b.watchedAt || 0) - (a.watchedAt || 0))

  // Load following activity on tab switch
  useEffect(() => {
    if (tab !== 'following' || followingLoaded || fetchedRef.current) return
    fetchedRef.current = true
    loadFollowingActivity()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFollowingActivity() {
    if (!session?.user?.id) return
    setFollowingLoading(true)
    try {
      // Get list of followed user IDs
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', session.user.id)
      if (!followRows?.length) { setFollowingLoaded(true); setFollowingLoading(false); return }

      const ids = followRows.map((r: any) => r.following_id)

      // Fetch their profiles (watch_history + username + avatar)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, watch_history')
        .in('id', ids)

      const items: { entry: WatchHistoryEntry; username: string | null; avatarUrl: string | null }[] = []
      for (const p of (profiles ?? []) as ProfileWithBadges[]) {
        const hist: WatchHistoryEntry[] = (p as any).watch_history ?? []
        for (const entry of hist) {
          items.push({ entry, username: p.username, avatarUrl: p.avatar_url })
        }
      }

      // Sort by watchedAt descending
      items.sort((a, b) => (b.entry.watchedAt || 0) - (a.entry.watchedAt || 0))
      setFollowingActivity(items.slice(0, 60))
      setFollowingLoaded(true)
    } catch (err) {
      console.error('[ActivityFeed] failed to load following activity:', err)
    }
    setFollowingLoading(false)
  }

  return (
    <div className="min-h-screen" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <div className="max-w-2xl mx-auto px-4">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="no-bg-hover flex items-center justify-center w-9 h-9 rounded-full transition-colors"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Activity Feed</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              What you and the people you follow have been watching
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <TabBtn active={tab === 'yours'} onClick={() => setTab('yours')}>
            <span className="flex items-center gap-1.5"><Clock size={13} /> Your Activity</span>
          </TabBtn>
          <TabBtn active={tab === 'following'} onClick={() => setTab('following')}>
            <span className="flex items-center gap-1.5"><Users size={13} /> Following</span>
          </TabBtn>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {tab === 'yours' ? (
            <motion.div key="yours" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {ownHistory.length === 0 ? (
                <EmptyState
                  icon="🎬"
                  title="Nothing watched yet"
                  body="Start watching movies, shows, or anime and your activity will appear here."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {ownHistory.map((entry, i) => (
                    <ActivityItem key={`${entry.mediaType}-${entry.id}-${i}`} entry={entry} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="following" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {followingLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton rounded-2xl" style={{ height: 80 }} />
                  ))}
                </div>
              ) : followingActivity.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No activity from people you follow"
                  body="Follow other users to see what they're watching in your feed."
                />
              ) : (
                <div className="flex flex-col gap-3">
                  {followingActivity.map((item, i) => (
                    <ActivityItem
                      key={`${item.username}-${item.entry.mediaType}-${item.entry.id}-${i}`}
                      entry={item.entry}
                      username={item.username}
                      avatarUrl={item.avatarUrl}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
