import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Film, Tv, Sword, Clock, Users, Bell, UserPlus, MessageSquare } from 'lucide-react'
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
        style={{ display: 'block', width: 44,  overflow: 'hidden' }}
      >
        <div style={{ aspectRatio: '2/3', background: 'rgba(255,255,255,0.06)',  overflow: 'hidden' }}>
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

// ─── Notification types ───────────────────────────────────────

type NotifItem =
  | { kind: 'follow'; username: string | null; avatar_url: string | null; created_at: string; isNew: boolean }
  | { kind: 'comment'; username: string | null; avatar_url: string | null; content: string; created_at: string; isNew: boolean }

function NotificationItem({ item }: { item: NotifItem }) {
  const AVATAR_SIZE = 36
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        background: item.isNew ? 'rgba(var(--accent-rgb,139,92,246),0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${item.isNew ? 'rgba(var(--accent-rgb,139,92,246),0.18)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {/* Avatar */}
      <Link
        to={item.username ? `/user/${item.username}` : '#'}
        className="no-bg-hover shrink-0"
        style={{ position: 'relative' }}
      >
        <div style={{
          width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
          overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.avatar_url
            ? <img src={item.avatar_url} alt={item.username ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }}>👤</span>
          }
        </div>
        {/* Kind icon badge */}
        <span style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: item.kind === 'follow' ? 'var(--accent)' : '#3b82f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid var(--bg, #080808)',
        }}>
          {item.kind === 'follow'
            ? <UserPlus size={8} style={{ color: '#fff' }} />
            : <MessageSquare size={8} style={{ color: '#fff' }} />
          }
        </span>
      </Link>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {item.kind === 'follow' ? (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
            <Link to={`/user/${item.username}`} className="no-bg-hover" style={{ fontWeight: 600, color: '#fff' }}>
              @{item.username ?? 'Someone'}
            </Link>
            {' '}started following you
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
            <Link to={`/user/${item.username}`} className="no-bg-hover" style={{ fontWeight: 600, color: '#fff' }}>
              @{item.username ?? 'Someone'}
            </Link>
            {' '}commented on your profile:{' '}
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>
              "{(item as any).content?.slice(0, 60)}{(item as any).content?.length > 60 ? '…' : ''}"
            </span>
          </p>
        )}
        <p style={{ margin: '2px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          {timeAgo(new Date(item.created_at).getTime())}
        </p>
      </div>

      {/* Unread dot */}
      {item.isNew && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent)', boxShadow: '0 0 5px var(--accent-glow)',
        }} />
      )}
    </motion.div>
  )
}

// ─── ActivityFeedPage ─────────────────────────────────────────

export function ActivityFeedPage() {
  const navigate = useNavigate()
  const { profile, session } = useAuth()
  const [tab, setTab] = useState<'yours' | 'following' | 'notifications'>('yours')
  const [followingActivity, setFollowingActivity] = useState<{
    entry: WatchHistoryEntry
    username: string | null
    avatarUrl: string | null
  }[]>([])
  const [followingLoading, setFollowingLoading] = useState(false)
  const [followingLoaded, setFollowingLoaded] = useState(false)
  const fetchedRef = useRef(false)

  // ── Notifications tab ─────────────────────────────────────────
  const [notifications, setNotifications] = useState<NotifItem[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifLoaded, setNotifLoaded] = useState(false)
  const notifFetchedRef = useRef(false)

  // Unread count from localStorage (to highlight new items)
  const [lastSeen, setLastSeen] = useState<string | null>(() => {
    const uid = session?.user?.id
    return uid ? localStorage.getItem(`baroflix_notif_seen_${uid}`) : null
  })

  useEffect(() => {
    const uid = session?.user?.id
    setLastSeen(uid ? localStorage.getItem(`baroflix_notif_seen_${uid}`) : null)
  }, [session?.user?.id])

  // When Shell clears the badge, refresh our lastSeen so items stop being "new"
  useEffect(() => {
    const handler = () => {
      const uid = session?.user?.id
      if (uid) setLastSeen(localStorage.getItem(`baroflix_notif_seen_${uid}`))
    }
    window.addEventListener('baroflix:notif-cleared', handler)
    return () => window.removeEventListener('baroflix:notif-cleared', handler)
  }, [session?.user?.id])

  // Own history from profile
  const ownHistory: WatchHistoryEntry[] = [...(profile?.watch_history ?? [])]
    .sort((a: any, b: any) => (b.watchedAt || 0) - (a.watchedAt || 0))

  // Load following activity on tab switch
  useEffect(() => {
    if (tab !== 'following' || followingLoaded || fetchedRef.current) return
    fetchedRef.current = true
    loadFollowingActivity()
  }, [tab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load notifications on tab switch
  useEffect(() => {
    if (tab !== 'notifications' || notifLoaded || notifFetchedRef.current) return
    notifFetchedRef.current = true
    loadNotifications()
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

  async function loadNotifications() {
    const userId = session?.user?.id
    if (!userId) return
    setNotifLoading(true)
    try {
      // Recent follows received
      const { data: followRows } = await supabase
        .from('follows')
        .select('follower_id, created_at')
        .eq('following_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)

      // Recent profile comments received
      const { data: commentRows } = await supabase
        .from('profile_comments')
        .select('user_id, content, created_at')
        .eq('profile_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)

      // Fetch profiles for followers and commenters in one batch
      const allIds = [
        ...new Set([
          ...(followRows ?? []).map((r: any) => r.follower_id),
          ...(commentRows ?? []).map((r: any) => r.user_id),
        ])
      ]
      const profileMap: Record<string, { username: string | null; avatar_url: string | null }> = {}
      if (allIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', allIds)
        for (const p of profiles ?? []) profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url }
      }

      const items: NotifItem[] = []

      for (const r of (followRows ?? [])) {
        const p = profileMap[r.follower_id] ?? { username: null, avatar_url: null }
        items.push({ kind: 'follow', ...p, created_at: r.created_at, isNew: lastSeen ? r.created_at > lastSeen : false })
      }
      for (const r of (commentRows ?? [])) {
        const p = profileMap[r.user_id] ?? { username: null, avatar_url: null }
        items.push({ kind: 'comment', ...p, content: r.content, created_at: r.created_at, isNew: lastSeen ? r.created_at > lastSeen : false })
      }

      items.sort((a, b) => b.created_at.localeCompare(a.created_at))
      setNotifications(items)
    } catch (err) {
      console.error('[ActivityFeed] failed to load notifications:', err)
    }
    setNotifLoaded(true)
    setNotifLoading(false)
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
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <TabBtn active={tab === 'yours'} onClick={() => setTab('yours')}>
            <span className="flex items-center gap-1.5"><Clock size={13} /> Your Activity</span>
          </TabBtn>
          <TabBtn active={tab === 'following'} onClick={() => setTab('following')}>
            <span className="flex items-center gap-1.5"><Users size={13} /> Following</span>
          </TabBtn>
          <TabBtn active={tab === 'notifications'} onClick={() => setTab('notifications')}>
            <span className="flex items-center gap-1.5">
              <Bell size={13} /> Notifications
            </span>
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
          ) : tab === 'following' ? (
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
          ) : (
            <motion.div key="notifications" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {notifLoading ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton rounded-2xl" style={{ height: 64 }} />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <EmptyState
                  icon="🔔"
                  title="No notifications yet"
                  body="You'll see new followers and profile comments here."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {notifications.map((item, i) => (
                    <NotificationItem key={`${item.kind}-${item.created_at}-${i}`} item={item} />
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
