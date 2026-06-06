import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, User, Globe, Clock, Film, Tv, Sword } from 'lucide-react'
import { fetchPublicProfile, BADGE_CONFIG, getHighestBadge } from './lib/supabase'
import type { ProfileWithBadges, BadgeType, PinnedItem } from './lib/supabase'
import { THEME_PRESETS } from './hooks'
import { useAuth } from './context/AuthContext'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const POSTER_BASE = 'https://image.tmdb.org/t/p/w185'

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ''
  return code
    .toUpperCase()
    .replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h < 24) return `${h}h ${m}m`
  const d = Math.floor(h / 24)
  const rh = h % 24
  return `${d}d ${rh}h`
}

function computeStats(profile: ProfileWithBadges) {
  const progress = profile.watch_progress ?? {}
  const totalSeconds = Object.entries(progress)
    .filter(([k]) => !k.includes(':duration'))
    .reduce((sum, [, v]) => sum + v, 0)
  const totalMinutes = Math.round(totalSeconds / 60)

  const history: any[] = profile.watch_history ?? []
  const movies = history.filter(h => h.mediaType === 'movie').length
  const shows = history.filter(h => h.mediaType === 'tv').length
  const anime = history.filter(h => h.mediaType === 'anime').length

  return { totalMinutes, movies, shows, anime }
}

// ─── Badge pill ───────────────────────────────────────────────────────────────

function BadgePill({ type, size = 'sm' }: { type: BadgeType; size?: 'sm' | 'lg' }) {
  const cfg = BADGE_CONFIG[type]
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'lg' ? 6 : 4,
        padding: size === 'lg' ? '5px 12px' : '2px 8px',
        borderRadius: 999,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.color,
        fontSize: size === 'lg' ? 13 : 11,
        fontWeight: 600,
        whiteSpace: 'nowrap' as const,
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontSize: size === 'lg' ? 15 : 12 }}>{cfg.emoji}</span>
      {cfg.label}
    </span>
  )
}

// ─── Poster card ──────────────────────────────────────────────────────────────

function PosterCard({ item }: { item: PinnedItem | any }) {
  const posterUrl = item.posterPath ? `${POSTER_BASE}${item.posterPath}` : null
  return (
    <Link
      to={`/title/${item.mediaType}/${item.id}`}
      className="no-bg-hover"
      style={{ display: 'block', borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio: '2/3',
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Film size={24} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
        )}
        {/* hover overlay with title */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)',
            opacity: 0,
            transition: 'opacity 0.2s',
            display: 'flex',
            alignItems: 'flex-end',
            padding: 8,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0' }}
        >
          <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
            {item.title}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── PublicProfilePage ────────────────────────────────────────────────────────

export function PublicProfilePage() {
  const { username } = useParams<{ username: string }>()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [profile, setProfile] = useState<ProfileWithBadges | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!username) { setNotFound(true); setLoading(false); return }

    fetchPublicProfile(username).then(data => {
      if (!data) setNotFound(true)
      else setProfile(data)
      setLoading(false)
    })
  }, [username])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center pt-20">
        <div style={{ textAlign: 'center' }}>
          <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px' }} />
          <div className="skeleton" style={{ width: 160, height: 18, borderRadius: 8, margin: '0 auto 8px' }} />
          <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 8, margin: '0 auto' }} />
        </div>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 px-4 gap-4 text-center">
        <div style={{ fontSize: 40 }}>👤</div>
        <h1 className="text-xl font-semibold text-white">Profile not found</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
          The user <strong>@{username}</strong> doesn't exist or hasn't set up their profile yet.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    )
  }

  // Private profile (show basic info if it's the viewer's own profile)
  const isOwnProfile = session?.user?.id === profile.id
  if (profile.is_public === false && !isOwnProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center pt-20 px-4 gap-4 text-center">
        <div style={{ fontSize: 40 }}>🔒</div>
        <h1 className="text-xl font-semibold text-white">@{profile.username}</h1>
        <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
          This profile is private.
        </p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
        >
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    )
  }

  const badges = profile.user_badges ?? []
  const highestBadge = getHighestBadge(badges)
  const stats = computeStats(profile)
  const pinnedItems: PinnedItem[] = profile.pinned_items ?? []
  const recentHistory = [...(profile.watch_history ?? [])]
    .sort((a: any, b: any) => (b.watchedAt || 0) - (a.watchedAt || 0))
    .slice(0, 5)

  const themeId = (profile.theme ?? 'scarlet') as keyof typeof THEME_PRESETS
  const theme = THEME_PRESETS[themeId] ?? THEME_PRESETS.scarlet

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null

  return (
    <div className="min-h-screen" style={{ paddingBottom: 80 }}>

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 220,
          overflow: 'hidden',
          background: profile.banner_url
            ? undefined
            : `linear-gradient(135deg, ${theme.glow.replace(/[\d.]+\)$/, '0.4)')}, ${theme.glow.replace(/[\d.]+\)$/, '0.05)')})`,
        }}
      >
        {profile.banner_url && (
          <img
            src={profile.banner_url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        )}
        {/* gradient overlay for readability */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(8,8,8,0.1) 0%, rgba(8,8,8,0.7) 100%)',
        }} />

        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="no-bg-hover"
          style={{
            position: 'absolute', top: 60, left: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.8)', cursor: 'pointer', zIndex: 2,
          }}
        >
          <ArrowLeft size={15} />
        </button>

        {/* Own profile edit link */}
        {isOwnProfile && (
          <Link
            to="/profile"
            className="no-bg-hover"
            style={{
              position: 'absolute', top: 60, right: 16,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 20,
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600,
              textDecoration: 'none', zIndex: 2,
            }}
          >
            Edit profile
          </Link>
        )}
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4">

        {/* ── Avatar + identity row ─────────────────────────────────────────── */}
        <div style={{ marginTop: -44, marginBottom: 24, display: 'flex', alignItems: 'flex-end', gap: 16 }}>
          {/* Avatar */}
          <div
            style={{
              width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.08)',
              border: '3px solid var(--bg, #080808)',
              overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 0 2px ${theme.glow.replace(/[\d.]+\)$/, '0.5)')}`,
            }}
          >
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username ?? ''}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={36} style={{ color: 'rgba(255,255,255,0.3)' }} />
            )}
          </div>

          {/* Name block */}
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
                @{profile.username}
              </h1>
              {highestBadge && <BadgePill type={highestBadge} />}
            </div>
            {profile.full_name && (
              <p style={{ margin: '2px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
                {profile.full_name}
              </p>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
              {profile.country && (
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Globe size={12} style={{ opacity: 0.6 }} />
                  {countryFlag(profile.country)} {profile.country}
                </span>
              )}
              {memberSince && (
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} style={{ opacity: 0.6 }} />
                  Joined {memberSince}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Stats bar ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            padding: '16px', borderRadius: 16,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
            marginBottom: 20,
          }}
        >
          {[
            { icon: <Film size={14} />, value: stats.movies, label: 'Movies' },
            { icon: <Tv size={14} />, value: stats.shows, label: 'Shows' },
            { icon: <Sword size={14} />, value: stats.anime, label: 'Anime' },
            { icon: <Clock size={14} />, value: formatMinutes(stats.totalMinutes), label: 'Watched' },
          ].map(({ icon, value, label }) => (
            <div key={label} style={{ textAlign: 'center', padding: '8px 4px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4, color: theme.accent, opacity: 0.8 }}>
                {icon}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        {profile.bio && (
          <section
            style={{
              padding: 20, borderRadius: 16,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              marginBottom: 20,
            }}
          >
            <h2 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Inter, sans-serif' }}>
              About
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65, whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif' }}>
              {profile.bio}
            </p>
          </section>
        )}

        {/* ── Theme ─────────────────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 12,
            background: theme.glow.replace(/[\d.]+\)$/, '0.08)'),
            border: `1px solid ${theme.glow.replace(/[\d.]+\)$/, '0.2)')}`,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 16, height: 16, borderRadius: '50%',
              background: theme.accent,
              boxShadow: `0 0 8px ${theme.glow}`,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter, sans-serif' }}>
            Using the{' '}
            <span style={{ color: theme.accent, fontWeight: 600 }}>{theme.label}</span>
            {' '}theme
          </span>
        </div>

        {/* ── Pinned Favorites ──────────────────────────────────────────────── */}
        {pinnedItems.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Inter, sans-serif' }}>
              Pinned Favorites
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {pinnedItems.map(item => (
                <PosterCard key={`${item.mediaType}-${item.id}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* ── Currently Watching ───────────────────────────────────────────── */}
        {recentHistory.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Inter, sans-serif' }}>
              Recently Watched
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {recentHistory.map((item: any, i: number) => (
                <PosterCard key={`${item.mediaType}-${item.id}-${i}`} item={item} />
              ))}
            </div>
          </section>
        )}

        {/* ── Badges section ───────────────────────────────────────────────── */}
        {badges.length > 0 && (
          <section style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: 'Inter, sans-serif' }}>
              Badges
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[...badges]
                .sort((a, b) => BADGE_CONFIG[b.badge_type].priority - BADGE_CONFIG[a.badge_type].priority)
                .map(badge => {
                  const cfg = BADGE_CONFIG[badge.badge_type]
                  return (
                    <div
                      key={badge.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '12px 16px', borderRadius: 12,
                        background: cfg.bg, border: `1px solid ${cfg.border}`,
                      }}
                    >
                      <span style={{ fontSize: 22 }}>{cfg.emoji}</span>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif' }}>
                          Awarded {new Date(badge.awarded_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
