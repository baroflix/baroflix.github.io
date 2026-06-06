import { useState, useEffect, useRef, type FormEvent } from 'react'
import { User, Send, MessageSquare, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase, type Comment, type ProfileComment, type UserBadge, BADGE_CONFIG, getHighestBadge, fetchBadgesForUsers } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─────────────────────────────────────────────────────────────
// Image-embed helpers (same allow-list as the live sports chat)
// ─────────────────────────────────────────────────────────────
const ALLOWED_IMG_HOSTS = new Set([
  'c.tenor.com', 'media.tenor.com',
  'i.imgur.com',
  'cdn.discordapp.com', 'media.discordapp.net',
  'i.redd.it',
  'pbs.twimg.com',
])
const IMG_EXT_RE = /\.(gif|jpe?g|png|webp|avif)(\?[^#]*)?$/i

function isAllowedImgHost(h: string) {
  return ALLOWED_IMG_HOSTS.has(h) || /^media\d*\.giphy\.com$/.test(h)
}

function sanitizeCommentImageUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t.startsWith('https://')) return null
  try {
    const u = new URL(t)
    if (u.protocol !== 'https:') return null
    if (!isAllowedImgHost(u.hostname)) return null
    if (!IMG_EXT_RE.test(u.pathname)) return null
    return u.href
  } catch { return null }
}

/** Returns a sanitised URL when the entire content is a lone image link, else null. */
export function extractCommentImageEmbed(content: string): string | null {
  const t = content.trim()
  if (!t || t.includes(' ') || !t.startsWith('https://')) return null
  return sanitizeCommentImageUrl(t)
}

function CommentImage({ url }: { url: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [expanded, setExpanded] = useState(false)
  return (
    <div style={{ marginTop: 4, maxWidth: 480 }}>
      {state === 'loading' && <div className="skeleton" style={{ height: 90, borderRadius: 8 }} />}
      {state === 'error' && (
        <div style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.3)',
        }}>🖼 Image unavailable</div>
      )}
      <img
        src={url} alt="Shared image"
        referrerPolicy="no-referrer" loading="lazy"
        onLoad={() => setState('loaded')}
        onError={() => setState('error')}
        onClick={() => setExpanded(e => !e)}
        style={{
          display: state === 'loaded' ? 'block' : 'none',
          maxWidth: '100%',
          maxHeight: expanded ? 280 : 120,
          objectFit: expanded ? 'contain' : 'cover',
          borderRadius: 8, cursor: expanded ? 'zoom-out' : 'zoom-in',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.3)',
          transition: 'max-height 0.25s ease',
        }}
        title={expanded ? 'Click to collapse' : 'Click to expand'}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// No nested user_badges join — badges are fetched separately to avoid
// PostgREST 403 issues when user_badges RLS isn't fully propagated
const COMMENT_SELECT =
  'id, movie_id, user_id, content, created_at, profiles(username, avatar_url)'

// ─────────────────────────────────────────────────────────────
// CommentsSection
// Props: movieId — the TMDB id (as string) for the title page
// ─────────────────────────────────────────────────────────────
interface CommentsSectionProps {
  movieId: string
}

export function CommentsSection({ movieId }: CommentsSectionProps) {
  const { session, profile } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  // Badges fetched separately (flat query avoids nested-join 403)
  const [badgesMap, setBadgesMap] = useState<Record<string, UserBadge[]>>({})
  const fetchedUserIds = useRef(new Set<string>())

  // ── Fetch initial comments ──────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('comments')
        .select(COMMENT_SELECT)
        .eq('movie_id', movieId)
        .order('created_at', { ascending: true })

      if (!cancelled) {
        setComments((data as unknown as Comment[]) ?? [])
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [movieId])

  // ── Fetch badges for comment authors (incremental, no duplicates) ──
  useEffect(() => {
    const newIds = comments
      .map(c => c.user_id)
      .filter(id => !fetchedUserIds.current.has(id))
    if (!newIds.length) return
    newIds.forEach(id => fetchedUserIds.current.add(id))
    fetchBadgesForUsers(newIds).then(map => {
      setBadgesMap(prev => ({ ...prev, ...map }))
    })
  }, [comments]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time subscription ──────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`comments:movie_id=eq.${movieId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `movie_id=eq.${movieId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('comments')
            .select(COMMENT_SELECT)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            setComments((prev) => {
              if (prev.some((c) => c.id === data.id)) return prev
              return [...prev, data as unknown as Comment]
            })
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `movie_id=eq.${movieId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [movieId])

  const commentsLoaded = useRef(false)

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    if (!commentsLoaded.current) {
      if (comments.length > 0 || !loading) {
        commentsLoaded.current = true
      }
      return
    }
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, loading])

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || !content.trim()) return
    setSubmitting(true)
    setSubmitError(null)

    const { data, error } = await supabase
      .from('comments')
      .insert({
        movie_id: movieId,
        user_id: session.user.id,
        content: content.trim(),
      })
      .select(COMMENT_SELECT)
      .single()

    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
    } else {
      setContent('')
      if (data) {
        setComments((prev) => {
          if (prev.some((c) => c.id === data.id)) return prev
          return [...prev, data as unknown as Comment]
        })
      }
    }
  }

  // ── Delete own comment ──────────────────────────────────────
  async function handleDelete(commentId: string) {
    await supabase.from('comments').delete().eq('id', commentId)
    setComments((prev) => prev.filter((c) => c.id !== commentId))
  }

  // ─────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────
  return (
    <section
      style={{
        marginTop: '3rem',
        padding: '1.5rem',
        borderRadius: 20,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <MessageSquare size={16} style={{ color: 'var(--accent, #8b5cf6)' }} />
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>
          Comments
        </h2>
        {!loading && (
          <span style={{
            marginLeft: 4, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 99,
          }}>
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      {loading ? (
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem', padding: '1rem 0' }}>
          Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem' }}>
          No comments yet. Be the first!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
          {comments.map((comment) => {
            const author = comment.profiles
            const isOwn = session?.user.id === comment.user_id
            const displayName = author?.username || 'Anonymous'
            // Use separately-fetched badges map instead of nested join data
            const badges = badgesMap[comment.user_id] ?? []
            const highestBadge = getHighestBadge(badges)
            const badgeCfg = highestBadge ? BADGE_CONFIG[highestBadge] : null

            return (
              <div
                key={comment.id}
                style={{
                  display: 'flex',
                  gap: '0.75rem',
                  alignItems: 'flex-start',
                  padding: '0.875rem',
                  borderRadius: 12,
                  background: isOwn ? 'rgba(var(--accent-rgb, 139,92,246),0.07)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isOwn ? 'rgba(var(--accent-rgb,139,92,246),0.2)' : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                {/* Avatar (links to profile if username exists) */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {author?.avatar_url ? (
                    <img src={author.avatar_url} alt={displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  )}
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    {/* Username — links to public profile if available */}
                    {author?.username ? (
                      <Link
                        to={`/user/${author.username}`}
                        style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', textDecoration: 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}
                      >
                        {displayName}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>
                        {displayName}
                      </span>
                    )}

                    {/* Highest badge pill */}
                    {badgeCfg && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 999,
                        background: badgeCfg.bg, border: `1px solid ${badgeCfg.border}`,
                        color: badgeCfg.color, fontSize: 10, fontWeight: 600, lineHeight: 1.5,
                      }}>
                        <span style={{ fontSize: 11 }}>{badgeCfg.emoji}</span>
                        {badgeCfg.label}
                      </span>
                    )}

                    <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.3)' }}>
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  {extractCommentImageEmbed(comment.content) ? (
                    <CommentImage url={extractCommentImageEmbed(comment.content)!} />
                  ) : (
                    <p style={{
                      margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)',
                      lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {comment.content}
                    </p>
                  )}
                </div>

                {/* Delete own comment */}
                {isOwn && (
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => handleDelete(comment.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.2)', padding: 4, borderRadius: 6,
                      flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f87171')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)')}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
          <div ref={listEndRef} />
        </div>
      )}

      {/* New comment form (only for signed-in users) */}
      {session ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {submitError && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#fca5a5' }}>{submitError}</p>
          )}
          {/* Image preview */}
          {extractCommentImageEmbed(content) && (
            <img
              src={extractCommentImageEmbed(content)!}
              alt="Preview"
              referrerPolicy="no-referrer"
              style={{
                maxHeight: 80, maxWidth: 240, objectFit: 'cover',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          )}
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            {/* Mini avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="You"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <User size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
              )}
            </div>

            <textarea
              id={`comment-input-${movieId}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Add a comment… or paste an image/GIF link"
              rows={1}
              maxLength={2000}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit(e as unknown as FormEvent)
                }
              }}
              style={{
                flex: 1, padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: 'white', fontSize: '0.875rem',
                resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />

            <button
              id={`comment-submit-${movieId}`}
              type="submit"
              disabled={submitting || !content.trim()}
              style={{
                padding: '0.625rem 1rem', borderRadius: 10, border: 'none',
                background: 'var(--accent, #8b5cf6)', color: 'white', fontWeight: 600,
                fontSize: '0.85rem', cursor: submitting || !content.trim() ? 'not-allowed' : 'pointer',
                opacity: submitting || !content.trim() ? 0.45 : 1,
                display: 'flex', alignItems: 'center', gap: '0.375rem',
                transition: 'opacity 0.2s', flexShrink: 0,
              }}
            >
              <Send size={14} />
              Post
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>
            ⌘↵ to submit
          </p>
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}>
          Sign in to leave a comment.
        </p>
      )}
    </section>
  )
}

// ─────────────────────────────────────────────────────────────
// ProfileCommentsSection
// Comments on a user's public profile page.
// profileOwnerId: the user_id of the person whose profile is being viewed
//   — they can delete any comment left on their page.
//
// SQL migration (run once in Supabase SQL editor):
// ─────────────────────────────────────────────────────────────
// CREATE TABLE public.profile_comments (
//   id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
//   profile_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
//   content     text NOT NULL CHECK (char_length(content) <= 2000),
//   created_at  timestamptz NOT NULL DEFAULT now()
// );
// ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "profile_comments readable by all"
//   ON public.profile_comments FOR SELECT USING (true);
// CREATE POLICY "users can post profile comments"
//   ON public.profile_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
// CREATE POLICY "author or profile owner can delete"
//   ON public.profile_comments FOR DELETE
//   USING (auth.uid() = user_id OR auth.uid() = profile_id);
// GRANT SELECT, INSERT, DELETE ON public.profile_comments TO authenticated;
// GRANT SELECT ON public.profile_comments TO anon;
// ─────────────────────────────────────────────────────────────

const PROFILE_COMMENT_SELECT =
  'id, profile_id, user_id, content, created_at, profiles(username, avatar_url)'

interface ProfileCommentsSectionProps {
  profileId: string        // uuid of the profile being viewed
  profileOwnerId: string   // same value — kept explicit for clarity in the component
}

export function ProfileCommentsSection({ profileId, profileOwnerId }: ProfileCommentsSectionProps) {
  const { session, profile } = useAuth()
  const [comments, setComments] = useState<ProfileComment[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  const [badgesMap, setBadgesMap] = useState<Record<string, UserBadge[]>>({})
  const fetchedUserIds = useRef(new Set<string>())

  // ── Load comments ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    supabase
      .from('profile_comments')
      .select(PROFILE_COMMENT_SELECT)
      .eq('profile_id', profileId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled) {
          setComments((data as unknown as ProfileComment[]) ?? [])
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [profileId])

  // ── Load badges for authors ─────────────────────────────────
  useEffect(() => {
    const newIds = comments.map(c => c.user_id).filter(id => !fetchedUserIds.current.has(id))
    if (!newIds.length) return
    newIds.forEach(id => fetchedUserIds.current.add(id))
    fetchBadgesForUsers(newIds).then(map => setBadgesMap(prev => ({ ...prev, ...map })))
  }, [comments]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Realtime ────────────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`profile_comments:${profileId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'profile_comments',
        filter: `profile_id=eq.${profileId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('profile_comments')
          .select(PROFILE_COMMENT_SELECT)
          .eq('id', payload.new.id)
          .single()
        if (data) {
          setComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data as unknown as ProfileComment])
        }
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'profile_comments',
        filter: `profile_id=eq.${profileId}`,
      }, (payload) => {
        setComments(prev => prev.filter(c => c.id !== payload.old.id))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profileId])

  // Auto-scroll on new comments (skip initial load)
  const initialised = useRef(false)
  useEffect(() => {
    if (!initialised.current) { if (!loading) initialised.current = true; return }
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length, loading])

  // ── Submit ──────────────────────────────────────────────────
  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!session || !content.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    const { data, error } = await supabase
      .from('profile_comments')
      .insert({ profile_id: profileId, user_id: session.user.id, content: content.trim() })
      .select(PROFILE_COMMENT_SELECT)
      .single()
    setSubmitting(false)
    if (error) {
      setSubmitError(error.message)
    } else {
      setContent('')
      if (data) setComments(prev => prev.some(c => c.id === data.id) ? prev : [...prev, data as unknown as ProfileComment])
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  async function handleDelete(commentId: string) {
    await supabase.from('profile_comments').delete().eq('id', commentId)
    setComments(prev => prev.filter(c => c.id !== commentId))
  }

  const isOwner = session?.user?.id === profileOwnerId

  // ── Render ──────────────────────────────────────────────────
  return (
    <section style={{
      padding: '1.5rem', borderRadius: 20,
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      marginBottom: 24,
    }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <MessageSquare size={16} style={{ color: 'var(--accent)' }} />
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'white' }}>Comments</h2>
        {!loading && (
          <span style={{
            marginLeft: 4, fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.06)', padding: '1px 8px', borderRadius: 99,
          }}>
            {comments.length}
          </span>
        )}
      </div>

      {/* Comment list */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: '1.5rem' }}>
          {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
      ) : comments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem 0', color: 'rgba(255,255,255,0.25)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
          No comments yet. Be the first!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', marginBottom: '1.5rem' }}>
          {comments.map(comment => {
            const author = comment.profiles
            const isOwn = session?.user?.id === comment.user_id
            const canDelete = isOwn || isOwner
            const displayName = author?.username || 'Anonymous'
            const badges = badgesMap[comment.user_id] ?? []
            const highestBadge = getHighestBadge(badges)
            const badgeCfg = highestBadge ? BADGE_CONFIG[highestBadge] : null

            return (
              <div key={comment.id} style={{
                display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                padding: '0.875rem', borderRadius: 12,
                background: isOwn ? 'rgba(var(--accent-rgb,139,92,246),0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isOwn ? 'rgba(var(--accent-rgb,139,92,246),0.2)' : 'rgba(255,255,255,0.05)'}`,
              }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
                  overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {author?.avatar_url
                    ? <img src={author.avatar_url} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <User size={16} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  }
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' as const }}>
                    {author?.username ? (
                      <Link to={`/user/${author.username}`}
                        style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white', textDecoration: 'none' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--accent)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'white' }}>
                        {displayName}
                      </Link>
                    ) : (
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'white' }}>{displayName}</span>
                    )}
                    {badgeCfg && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        padding: '1px 6px', borderRadius: 999,
                        background: badgeCfg.bg, border: `1px solid ${badgeCfg.border}`,
                        color: badgeCfg.color, fontSize: 10, fontWeight: 600, lineHeight: 1.5,
                      }}>
                        <span style={{ fontSize: 11 }}>{badgeCfg.emoji}</span>{badgeCfg.label}
                      </span>
                    )}
                    {isOwner && !isOwn && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }}>
                        visitor
                      </span>
                    )}
                    <span style={{ fontSize: '0.73rem', color: 'rgba(255,255,255,0.3)' }}>
                      {timeAgo(comment.created_at)}
                    </span>
                  </div>
                  {extractCommentImageEmbed(comment.content) ? (
                    <CommentImage url={extractCommentImageEmbed(comment.content)!} />
                  ) : (
                    <p style={{
                      margin: 0, fontSize: '0.875rem', color: 'rgba(255,255,255,0.8)',
                      lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    }}>
                      {comment.content}
                    </p>
                  )}
                </div>

                {/* Delete */}
                {canDelete && (
                  <button type="button" aria-label="Delete comment"
                    onClick={() => handleDelete(comment.id)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.2)', padding: 4, borderRadius: 6,
                      flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#f87171' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.2)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            )
          })}
          <div ref={listEndRef} />
        </div>
      )}

      {/* Input */}
      {session ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {submitError && <p style={{ margin: 0, fontSize: '0.8rem', color: '#fca5a5' }}>{submitError}</p>}
          {/* Image preview */}
          {extractCommentImageEmbed(content) && (
            <img
              src={extractCommentImageEmbed(content)!}
              alt="Preview"
              referrerPolicy="no-referrer"
              style={{
                maxHeight: 80, maxWidth: 240, objectFit: 'cover',
                borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              }}
            />
          )}
          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="You" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <User size={15} style={{ color: 'rgba(255,255,255,0.3)' }} />
              }
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Leave a comment… or paste an image/GIF link"
              rows={1}
              maxLength={2000}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleSubmit(e as unknown as FormEvent)
                }
              }}
              style={{
                flex: 1, padding: '0.625rem 0.875rem',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, color: 'white', fontSize: '0.875rem',
                resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
              }}
            />
            <button type="submit" disabled={submitting || !content.trim()} style={{
              padding: '0.625rem 1rem', borderRadius: 10, border: 'none',
              background: 'var(--accent)', color: 'white', fontWeight: 600,
              fontSize: '0.85rem', cursor: submitting || !content.trim() ? 'not-allowed' : 'pointer',
              opacity: submitting || !content.trim() ? 0.45 : 1,
              display: 'flex', alignItems: 'center', gap: '0.375rem',
              transition: 'opacity 0.2s', flexShrink: 0,
            }}>
              <Send size={14} />
              Post
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)' }}>⌘↵ to submit</p>
        </form>
      ) : (
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.3)' }}>
          Sign in to leave a comment.
        </p>
      )}
    </section>
  )
}
