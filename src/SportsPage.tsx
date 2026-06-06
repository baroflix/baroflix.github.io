import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'

// ─── Image-embed security helpers ────────────────────────────────────────────

// Only domains whose images are safe to embed. HTTPS required.
// Extend this list to add more trusted sources.
const ALLOWED_EXACT_HOSTS = new Set([
  'c.tenor.com',        // Tenor GIFs (direct media)
  'media.tenor.com',
  'i.imgur.com',        // Imgur direct images
  'cdn.discordapp.com', // Discord CDN
  'media.discordapp.net',
  'i.redd.it',          // Reddit image CDN
  'pbs.twimg.com',      // Twitter/X image CDN
])

const IMAGE_EXT_RE = /\.(gif|jpe?g|png|webp|avif)(\?[^#]*)?$/i

function isAllowedHost(hostname: string): boolean {
  if (ALLOWED_EXACT_HOSTS.has(hostname)) return true
  // Giphy CDN shards: media.giphy.com, media0.giphy.com … media4.giphy.com
  if (/^media\d*\.giphy\.com$/.test(hostname)) return true
  return false
}

/**
 * Returns a sanitised https URL if `raw` is an embeddable image from an
 * allowed host, otherwise null.
 */
function sanitizeImageUrl(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed.startsWith('https://')) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') return null
    if (!isAllowedHost(url.hostname)) return null
    if (!IMAGE_EXT_RE.test(url.pathname)) return null
    return url.href // reconstructed — strips any malformed characters
  } catch {
    return null
  }
}

/**
 * If the entire message is a single image URL, return the sanitised URL.
 * Mixed text + URL messages are rendered as plain text.
 */
function extractImageEmbed(content: string): string | null {
  const trimmed = content.trim()
  if (!trimmed || trimmed.includes(' ') || !trimmed.startsWith('https://')) return null
  return sanitizeImageUrl(trimmed)
}

// ─── ChatImage ────────────────────────────────────────────────────────────────

function ChatImage({ url }: { url: string }) {
  const [imgState, setImgState] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [expanded, setExpanded] = useState(false)

  return (
    <div style={{ marginTop: 4, maxWidth: '100%' }}>
      {imgState === 'loading' && (
        <div className="skeleton" style={{ height: 110, borderRadius: 8 }} />
      )}
      {imgState === 'error' && (
        <div style={{
          padding: '6px 10px', borderRadius: 8, fontSize: 10,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.3)',
        }}>
          🖼 Image unavailable
        </div>
      )}
      <img
        src={url}
        alt="Shared image"
        referrerPolicy="no-referrer"
        loading="lazy"
        onLoad={() => setImgState('loaded')}
        onError={() => setImgState('error')}
        onClick={() => setExpanded(e => !e)}
        style={{
          display: imgState === 'loaded' ? 'block' : 'none',
          maxWidth: '100%',
          width: '100%',
          maxHeight: expanded ? 360 : 150,
          objectFit: expanded ? 'contain' : 'cover',
          borderRadius: 8,
          cursor: expanded ? 'zoom-out' : 'zoom-in',
          border: '1px solid rgba(255,255,255,0.07)',
          background: 'rgba(0,0,0,0.3)',
          transition: 'max-height 0.25s ease',
        }}
        title={expanded ? 'Click to collapse' : 'Click to expand'}
      />
    </div>
  )
}
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Calendar, Play, Flame, Trophy, Activity, X, Tv, RefreshCw, MessageSquare, Send, User, Maximize2, Minimize2 } from 'lucide-react'
import { supabase } from './lib/supabase'
import { useAuth } from './context/AuthContext'
import {
  fetchSports,
  fetchMatches,
  fetchLiveMatches,
  fetchTodayMatches,
  fetchStreams,
  getBadgeUrl,
  getPosterUrl,
  getFriendlySourceName,
  type APIMatch,
  type Sport,
  type Stream
} from './lib/sportsApi'

export function SportsPage() {
  const { session } = useAuth()
  
  // API Data
  const [sports, setSports] = useState<Sport[]>([])
  const [matches, setMatches] = useState<APIMatch[]>([])

  // Sports chat states
  const [chatMessages, setChatMessages] = useState<{
    id: string
    match_id: string
    user_id: string
    content: string
    created_at: string
    profiles?: {
      username: string | null
      avatar_url: string | null
    } | null
  }[]>([])
  const [chatContent, setChatContent] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  
  // UI states
  const [loadingSports, setLoadingSports] = useState(true)
  const [loadingMatches, setLoadingMatches] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSport, setSelectedSport] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'live' | 'today' | 'popular'>('live')
  const [sortBy, setSortBy] = useState<'time-asc' | 'time-desc' | 'popular-first'>('time-asc')
  
  // Active Stream/Player state
  const [theatreMode, setTheatreMode] = useState(false)
  const [activeMatch, setActiveMatch] = useState<APIMatch | null>(null)
  const [selectedSource, setSelectedSource] = useState<{ source: string; id: string } | null>(null)
  const [streams, setStreams] = useState<Stream[]>([])
  const [loadingStreams, setLoadingStreams] = useState(false)
  const [activeStream, setActiveStream] = useState<Stream | null>(null)

  // Fetch recent chat messages and subscribe to supabase realtime
  useEffect(() => {
    if (!activeMatch) {
      setChatMessages([])
      return
    }

    let cancelled = false

    // Fetch last 50 messages
    supabase
      .from('sports_chat_messages')
      .select('id, match_id, user_id, content, created_at, profiles(username, avatar_url)')
      .eq('match_id', activeMatch.id)
      .order('created_at', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (!cancelled && data) {
          setChatMessages(data as any)
        }
      })

    // Replace colons to avoid breaking Supabase channel parsing
    const safeChannelName = `sports_chat_${activeMatch.id.replace(/:/g, '_')}`

    // Subscribe to INSERT events
    const channel = supabase
      .channel(safeChannelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sports_chat_messages',
          // No filter parameter here to prevent parsing failures on complex IDs (e.g. IDs containing colons)
        },
        async (payload) => {
          // Filter in-memory instead
          if (payload.new.match_id !== activeMatch.id) return

          // Fetch complete profile details for the new message
          const { data } = await supabase
            .from('sports_chat_messages')
            .select('id, match_id, user_id, content, created_at, profiles(username, avatar_url)')
            .eq('id', payload.new.id)
            .single()

          if (!cancelled && data) {
            setChatMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev
              return [...prev, data as any]
            })
          }
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [activeMatch])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages.length])

  // Update image preview when the input looks like an image URL
  useEffect(() => {
    setImagePreview(extractImageEmbed(chatContent))
  }, [chatContent])

  async function handleSendChatMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !chatContent.trim() || !activeMatch) return
    const msg = chatContent.trim()
    setChatContent('')
    setSendingMessage(true)
    setChatError(null)

    const { data, error } = await supabase
      .from('sports_chat_messages')
      .insert({
        match_id: activeMatch.id,
        user_id: session.user.id,
        content: msg,
      })
      .select('id, match_id, user_id, content, created_at, profiles(username, avatar_url)')
      .single()

    setSendingMessage(false)
    if (error) {
      console.error('Failed to send message:', error)
      setChatError(error.message)
    } else if (data) {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev
        return [...prev, data as any]
      })
    }
  }

  // Fetch initial sports categories
  useEffect(() => {
    fetchSports()
      .then((data) => {
        setSports(data)
      })
      .catch((err) => {
        console.error('Failed to load sports:', err)
      })
      .finally(() => setLoadingSports(false))
  }, [])

  // Fetch matches based on status filter & selected sport
  const loadMatches = () => {
    setLoadingMatches(true)
    setError(null)

    let promise: Promise<APIMatch[]>
    
    if (statusFilter === 'live') {
      promise = fetchLiveMatches()
    } else if (statusFilter === 'today') {
      promise = fetchTodayMatches()
    } else {
      // 'all' or 'popular'
      promise = fetchMatches(selectedSport, statusFilter === 'popular')
    }

    promise
      .then((data) => {
        // If we fetched the generic live/today endpoint, filter by sport locally if needed
        if ((statusFilter === 'live' || statusFilter === 'today') && selectedSport !== 'all') {
          setMatches(data.filter(m => m.category === selectedSport))
        } else {
          setMatches(data)
        }
      })
      .catch((err) => {
        console.error('Failed to load matches:', err)
        setError('Could not retrieve match data. Please try again.')
      })
      .finally(() => setLoadingMatches(false))
  }

  useEffect(() => {
    loadMatches()
  }, [selectedSport, statusFilter])

  // Process, filter, search, and sort matches locally
  const processedMatches = useMemo(() => {
    // 1. Search Query filtering
    let result = matches.filter((m) => {
      const titleMatch = m.title.toLowerCase().includes(searchQuery.toLowerCase())
      const homeMatch = m.teams?.home?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
      const awayMatch = m.teams?.away?.name.toLowerCase().includes(searchQuery.toLowerCase()) ?? false
      return titleMatch || homeMatch || awayMatch
    })

    // 2. Sorting
    result.sort((a, b) => {
      if (sortBy === 'time-asc') return a.date - b.date
      if (sortBy === 'time-desc') return b.date - a.date
      if (sortBy === 'popular-first') {
        if (a.popular && !b.popular) return -1
        if (!a.popular && b.popular) return 1
        return a.date - b.date // fallback to date
      }
      return 0
    })

    return result
  }, [matches, searchQuery, sortBy])

  // Fetch streams when active match or source changes
  useEffect(() => {
    if (!activeMatch || !selectedSource) {
      setStreams([])
      setActiveStream(null)
      return
    }

    setLoadingStreams(true)
    fetchStreams(selectedSource.source, selectedSource.id)
      .then((data) => {
        setStreams(data)
        if (data.length > 0) {
          // Default to the first stream, preferably in HD or English
          const defaultStream = data.find(s => s.language.toLowerCase() === 'english' && s.hd) 
            || data.find(s => s.hd)
            || data[0]
          setActiveStream(defaultStream)
        } else {
          setActiveStream(null)
        }
      })
      .catch((err) => {
        console.error('Failed to load streams:', err)
      })
      .finally(() => setLoadingStreams(false))
  }, [activeMatch, selectedSource])

  // Format Unix timestamp into a readable date/time
  const formatMatchTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    
    const isToday = date.toDateString() === now.toDateString()
    
    const timeOptions: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
    const timeStr = date.toLocaleTimeString(undefined, timeOptions)
    
    if (isToday) {
      return `Today at ${timeStr}`
    }
    
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`
  }

  // Handle match card click to open streams
  const handleOpenMatch = (match: APIMatch) => {
    setActiveMatch(match)
    if (match.sources && match.sources.length > 0) {
      setSelectedSource(match.sources[0])
    }
  }

  // Sync theatre mode → body class so the navbar can hide itself
  useEffect(() => {
    if (theatreMode) document.body.classList.add('theatre-mode')
    else document.body.classList.remove('theatre-mode')
    return () => document.body.classList.remove('theatre-mode')
  }, [theatreMode])

  const handleClosePlayer = () => {
    setActiveMatch(null)
    setSelectedSource(null)
    setStreams([])
    setActiveStream(null)
    setTheatreMode(false)
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-16 pt-20 sm:pt-24 relative min-h-screen">
      {/* Background glow effects */}
      <div 
        className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none -z-10"
        style={{ background: 'var(--accent-dim)', opacity: 0.15 }}
      />
        {/* Title / Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3">
              <Activity className="w-6 h-6 animate-pulse" style={{ color: 'var(--accent)' }} />
              <h1 className="text-3xl font-bold text-white tracking-tight">Live Sports</h1>
            </div>
            <p className="text-sm mt-1.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Watch football, basketball, combat sports and more live stream events on Baroflix
            </p>
          </div>

          {/* Refresh action */}
          <button
            onClick={loadMatches}
            className="flex items-center gap-2 self-start px-3 py-1.5 text-xs font-semibold rounded-full transition-colors border"
            style={{
              background: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.7)'
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingMatches ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Toolbar: Status Filter, Search, Sort */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-6 p-4 rounded-2xl"
             style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          
          {/* Status Tabs */}
          <div className="flex gap-1 p-1 rounded-xl overflow-x-auto" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', scrollbarWidth: 'none' }}>
            {(['live', 'today', 'popular', 'all'] as const).map((status) => (
              <button
                key={status}
                onClick={() => {
                  setStatusFilter(status)
                  // Reset category filter if checking live/today, since those endpoints fetch globally
                  if (status === 'live' || status === 'today') {
                    setSelectedSport('all')
                  }
                }}
                className={`shrink-0 px-3 sm:px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap`}
                style={{
                  background: statusFilter === status ? 'var(--accent)' : 'transparent',
                  color: statusFilter === status ? '#fff' : 'rgba(255,255,255,0.55)',
                  boxShadow: statusFilter === status ? '0 4px 12px var(--accent-glow)' : 'none'
                }}
              >
                {status === 'live' && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping shrink-0" />}
                {status === 'popular' && <Flame className="w-3.5 h-3.5" />}
                {status}
              </button>
            ))}
          </div>

          {/* Right Controls */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search teams or league..."
                className="w-full pl-10 pr-4 py-2 text-sm text-white outline-none rounded-xl transition-all"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Sort Select */}
            <div className="relative w-full sm:w-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full sm:w-auto pl-3 pr-8 py-2 text-xs font-semibold text-white/70 outline-none rounded-xl appearance-none cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <option value="time-asc">Sort: Earliest First</option>
                <option value="time-desc">Sort: Latest First</option>
                <option value="popular-first">Sort: Popular First</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-white/40">
                <svg className="fill-current h-4 w-4" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Sports Categories Chips Row (Horizontal Scroll) */}
        {!loadingSports && sports.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
            <button
              onClick={() => setSelectedSport('all')}
              className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border`}
              style={{
                background: selectedSport === 'all' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                borderColor: selectedSport === 'all' ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                color: selectedSport === 'all' ? '#fff' : 'rgba(255,255,255,0.6)'
              }}
            >
              All Categories
            </button>
            {sports.map((sport) => (
              <button
                key={sport.id}
                onClick={() => {
                  setSelectedSport(sport.id)
                  // Switch out of live/today if they want custom category browser
                  if (statusFilter === 'live' || statusFilter === 'today') {
                    setStatusFilter('all')
                  }
                }}
                className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all border`}
                style={{
                  background: selectedSport === sport.id ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)',
                  borderColor: selectedSport === sport.id ? 'var(--accent)' : 'rgba(255,255,255,0.07)',
                  color: selectedSport === sport.id ? '#fff' : 'rgba(255,255,255,0.6)'
                }}
              >
                {sport.name}
              </button>
            ))}
          </div>
        )}

        {/* Loading Indicator */}
        {loadingMatches && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div 
                key={i} 
                className="h-48 rounded-2xl animate-pulse" 
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              />
            ))}
          </div>
        )}

        {/* Error State */}
        {!loadingMatches && error && (
          <div className="p-8 text-center rounded-2xl border border-red-500/20 bg-red-500/5">
            <p className="text-red-400 font-medium">{error}</p>
            <button 
              onClick={loadMatches} 
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loadingMatches && !error && processedMatches.length === 0 && (
          <div className="py-20 px-6 text-center rounded-2xl border border-dashed border-white/10">
            <Trophy className="w-10 h-10 mx-auto opacity-20 mb-4" />
            <div className="text-lg font-semibold text-white/50">No sports events found</div>
            <p className="mt-2 text-sm text-white/30 max-w-sm mx-auto">
              There are currently no matches available matching the "{statusFilter}" status filter or selected sport.
            </p>
          </div>
        )}

        {/* Matches Grid */}
        {!loadingMatches && !error && processedMatches.length > 0 && (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {processedMatches.map((match) => {
              const isLive = statusFilter === 'live' || (match.date <= Date.now() && match.date + 7200000 > Date.now())
              const hasTeams = match.teams && (match.teams.home || match.teams.away)

              return (
                <motion.article
                  layout
                  key={match.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  onClick={() => handleOpenMatch(match)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleOpenMatch(match) }}
                  className="p-5 flex flex-col justify-between cursor-pointer rounded-2xl relative overflow-hidden group transition-all outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                  {/* Glowing hover accent border */}
                  <div 
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                    style={{ border: '1px solid var(--accent)', borderRadius: 16 }}
                  />

                  <div>
                    {/* Header: Category & Tags */}
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <span 
                        className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}
                      >
                        {match.category}
                      </span>
                      
                      <div className="flex items-center gap-1.5">
                        {match.popular && (
                          <span 
                            className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#fbbf24' }}
                          >
                            <Flame className="w-2.5 h-2.5 fill-current" />
                            Popular
                          </span>
                        )}
                        {isLive && (
                          <span 
                            className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                            Live
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Content: Match Title & Badges */}
                    {hasTeams ? (
                      <div className="flex items-center justify-between gap-4 py-2">
                        {/* Home Team */}
                        <div className="flex flex-col items-center flex-1 text-center">
                          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 p-2 border border-white/5 mb-2">
                            {match.teams?.home?.badge ? (
                              <img 
                                src={getBadgeUrl(match.teams.home.badge)} 
                                alt={match.teams.home.name} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <Trophy className="w-5 h-5 text-white/20" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-white/90 line-clamp-2 min-h-[32px]">{match.teams?.home?.name}</span>
                        </div>

                        {/* VS Label */}
                        <div className="flex flex-col items-center">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--accent)' }}>
                            VS
                          </span>
                        </div>

                        {/* Away Team */}
                        <div className="flex flex-col items-center flex-1 text-center">
                          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-white/5 p-2 border border-white/5 mb-2">
                            {match.teams?.away?.badge ? (
                              <img 
                                src={getBadgeUrl(match.teams.away.badge)} 
                                alt={match.teams.away.name} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                }}
                              />
                            ) : (
                              <Trophy className="w-5 h-5 text-white/20" />
                            )}
                          </div>
                          <span className="text-xs font-semibold text-white/90 line-clamp-2 min-h-[32px]">{match.teams?.away?.name}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="py-4">
                        <h3 className="text-sm font-semibold text-white/90 mb-1 line-clamp-2">{match.title}</h3>
                        {match.poster && (
                          <div className="mt-3 aspect-video w-full rounded-xl overflow-hidden bg-white/5 border border-white/5">
                            <img 
                              src={getPosterUrl(match.poster)} 
                              alt={match.title} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Footer: Date and Watch Button */}
                  <div className="flex items-center justify-between gap-4 mt-6 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatMatchTime(match.date)}</span>
                    </div>

                    <div 
                      className="flex items-center justify-center w-8 h-8 rounded-full transition-transform group-hover:scale-110"
                      style={{ background: 'var(--accent)' }}
                    >
                      <Play className="w-3.5 h-3.5 text-white fill-white translate-x-0.5" />
                    </div>
                  </div>
                </motion.article>
              )
            })}
          </motion.div>
        )}

      {/* Immersive Overlay Video Player Modal */}
      <AnimatePresence>
        {activeMatch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${theatreMode ? 'p-2' : 'items-start sm:items-center p-3 sm:p-6 overflow-y-auto'}`}
            style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)' }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`w-full rounded-3xl overflow-hidden relative transition-all duration-300 ${theatreMode ? 'max-w-[98vw]' : 'max-w-6xl'}`}
              style={{
                background: 'rgba(20,20,20,0.96)',
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 20px 80px rgba(0,0,0,0.8)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className={`flex transition-all duration-300 ${theatreMode ? 'flex-row' : 'flex-col lg:flex-row lg:h-[680px]'}`}
                style={theatreMode ? { height: 'calc(100vh - 16px)' } : undefined}
              >
                {/* Left Column: Player & Channels */}
                <div className={`flex-1 min-w-0 flex flex-col ${theatreMode ? 'h-full overflow-hidden' : 'justify-between lg:h-full lg:overflow-y-auto'}`}>
                  {/* Modal Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/2">
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-widest" style={{ color: 'var(--accent)' }}>
                        {activeMatch.category}
                      </span>
                      <h2 className="text-base font-bold text-white truncate mt-0.5 pr-4">{activeMatch.title}</h2>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      {/* Theatre mode toggle — desktop only */}
                      <button
                        onClick={() => setTheatreMode(m => !m)}
                        className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200"
                        style={{
                          background: theatreMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${theatreMode ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}`,
                          color: theatreMode ? '#fff' : 'rgba(255,255,255,0.55)',
                          boxShadow: theatreMode ? '0 0 12px rgba(255,255,255,0.06)' : 'none',
                        }}
                        title={theatreMode ? 'Exit Theatre Mode' : 'Theatre Mode'}
                      >
                        {theatreMode
                          ? <Minimize2 className="w-3.5 h-3.5" />
                          : <Maximize2 className="w-3.5 h-3.5" />}
                        <span>{theatreMode ? 'Exit' : 'Theatre'}</span>
                      </button>

                      {/* Mobile close */}
                      <button
                        onClick={handleClosePlayer}
                        className="flex lg:hidden items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white transition-colors"
                        style={{ background: 'rgba(255,255,255,0.05)' }}
                        aria-label="Close player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Stream Video Iframe Area */}
                  <div className={`relative bg-black flex items-center justify-center ${theatreMode ? 'flex-1 min-h-0' : 'aspect-video'}`}>
                    {loadingStreams ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-full border-4 border-t-white border-white/10 animate-spin" style={{ borderTopColor: 'var(--accent)' }} />
                        <span className="text-xs text-white/50">Fetching live streams...</span>
                      </div>
                    ) : activeStream ? (
                      <iframe
                        title={`${activeMatch.title} Live Stream`}
                        src={activeStream.embedUrl}
                        className="w-full h-full block border-0"
                        allow="autoplay; fullscreen; picture-in-picture"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 p-6 text-center">
                        <Tv className="w-10 h-10 opacity-20 mb-2" />
                        <span className="text-sm font-semibold text-white/60">No stream channels available</span>
                        <span className="text-xs text-white/30 max-w-xs">This source doesn't have any streams configured or the match hasn't started yet.</span>
                      </div>
                    )}
                  </div>

                  {/* Source & Stream Selector Panel */}
                  <div className={`bg-white/2 shrink-0 ${theatreMode ? 'px-4 py-2.5 overflow-y-auto max-h-28' : 'p-6'}`}>
                    {/* Source Selection Tabs */}
                    {activeMatch.sources && activeMatch.sources.length > 0 && (
                      <div className="mb-4">
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Sources</div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                          {activeMatch.sources.map((src) => {
                            const isSelected = selectedSource?.source === src.source && selectedSource?.id === src.id
                            return (
                              <button
                                key={`${src.source}-${src.id}`}
                                onClick={() => setSelectedSource(src)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wide transition-all border"
                                style={{
                                  background: isSelected ? 'rgba(255,255,255,0.08)' : 'transparent',
                                  borderColor: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                                  color: isSelected ? '#fff' : 'rgba(255,255,255,0.5)'
                                }}
                              >
                                {getFriendlySourceName(src.source)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Individual Stream Links (Languages/Quality) */}
                    {!loadingStreams && streams.length > 0 && (
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-2">Select Feed</div>
                        <div className="flex flex-wrap gap-2">
                          {streams.map((stream) => {
                            const isActive = activeStream?.id === stream.id
                            return (
                              <button
                                key={stream.id}
                                onClick={() => setActiveStream(stream)}
                                className="px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border"
                                style={{
                                  background: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                                  borderColor: isActive ? 'transparent' : 'rgba(255,255,255,0.06)',
                                  color: isActive ? '#fff' : 'rgba(255,255,255,0.8)',
                                  boxShadow: isActive ? '0 4px 12px var(--accent-glow)' : 'none'
                                }}
                              >
                                <Tv className="w-3.5 h-3.5" />
                                <span>Feed #{stream.streamNo} · {stream.language}</span>
                                {stream.hd && (
                                  <span 
                                    className="text-[8px] font-extrabold uppercase px-1 rounded" 
                                    style={{ background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)' }}
                                  >
                                    HD
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Chat Panel */}
                <div className={`shrink-0 border-white/10 flex flex-col bg-white/1 overflow-hidden ${theatreMode ? 'w-72 xl:w-80 h-full border-l' : 'w-full lg:w-80 lg:h-full border-t lg:border-t-0 lg:border-l min-h-[220px] sm:min-h-[300px] lg:min-h-0'}`}>
                  {/* Chat Header */}
                  <div className="px-4 py-3.5 border-b border-white/5 bg-white/2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 border border-red-500/30 text-red-400 animate-pulse flex items-center gap-1 shrink-0">
                        <span className="w-1 h-1 rounded-full bg-red-500" />
                        Live
                      </span>
                      <MessageSquare className="w-4 h-4 text-white/40" />
                      <span className="text-xs font-semibold text-white">Live Chat</span>
                    </div>
                  </div>

                  {/* Messages list */}
                  <div className={`flex-1 overflow-y-auto p-4 space-y-3 ${theatreMode ? '' : 'max-h-[180px] sm:max-h-[280px] lg:max-h-none'}`}>
                    {chatError && (
                      <div className="p-2 mb-2 text-[10px] bg-red-500/15 border border-red-500/30 text-red-400 rounded-lg text-center font-sans">
                        Error: {chatError}
                      </div>
                    )}
                    {chatMessages.length === 0 ? (
                      <div className="text-center text-xs text-white/30 py-16">
                        No messages yet. Say hello!
                      </div>
                    ) : (
                      chatMessages.map((msg) => {
                        const isOwn = msg.user_id === session?.user.id
                        const displayName = msg.profiles?.username || 'Anonymous'
                        const avatar = msg.profiles?.avatar_url
                        return (
                          <div key={msg.id} className={`flex gap-2 items-start text-left p-1.5 rounded-xl transition-all ${isOwn ? 'bg-white/5 border border-white/5' : ''}`}>
                            {msg.profiles?.username ? (
                              <Link to={`/user/${msg.profiles.username}`} className="no-bg-hover shrink-0">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center hover:ring-1 hover:ring-white/20 transition-all">
                                  {avatar ? (
                                    <img src={avatar} alt={displayName} className="w-full h-full object-cover" />
                                  ) : (
                                    <User className="w-3 h-3 text-white/30" />
                                  )}
                                </div>
                              </Link>
                            ) : (
                              <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 border border-white/10 shrink-0 flex items-center justify-center">
                                <User className="w-3 h-3 text-white/30" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline gap-1.5">
                                {msg.profiles?.username ? (
                                  <Link
                                    to={`/user/${msg.profiles.username}`}
                                    className={`no-bg-hover text-[11px] font-semibold truncate hover:underline ${isOwn ? 'text-[var(--accent)] font-bold' : 'text-white/80'}`}
                                  >
                                    {displayName}
                                  </Link>
                                ) : (
                                  <span className="text-[11px] font-semibold truncate text-white/50">{displayName}</span>
                                )}
                                <span className="text-[8px] text-white/30 shrink-0">
                                  {new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              {extractImageEmbed(msg.content) ? (
                                <ChatImage url={extractImageEmbed(msg.content)!} />
                              ) : (
                                <p className="text-[11px] text-white/70 leading-relaxed mt-0.5 break-words whitespace-pre-wrap">
                                  {msg.content}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Image preview (shown when input contains an image URL) */}
                  {imagePreview && (
                    <div className="px-3 pt-2.5 pb-1 border-t border-white/5" style={{ background: 'rgba(255,255,255,0.02)' }}>
                      <p className="text-[9px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        Image preview
                      </p>
                      <img
                        src={imagePreview}
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        style={{
                          maxHeight: 72,
                          maxWidth: 128,
                          borderRadius: 6,
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.1)',
                          display: 'block',
                        }}
                      />
                    </div>
                  )}

                  {/* Input Form */}
                  <form onSubmit={handleSendChatMessage} className="p-3 border-t border-white/5 flex gap-2 items-center">
                    <input
                      type="text"
                      value={chatContent}
                      onChange={(e) => setChatContent(e.target.value)}
                      placeholder={session ? "Send a message or paste an image URL…" : "Sign in to chat"}
                      disabled={!session || sendingMessage}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/20 transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!chatContent.trim() || sendingMessage || !session}
                      className="w-8 h-8 rounded-xl flex items-center justify-center transition-opacity shrink-0 bg-[var(--accent)] text-white disabled:opacity-40"
                      aria-label="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </form>
                </div>
              </div>

              {/* Desktop Close button */}
              <button
                onClick={handleClosePlayer}
                className="hidden lg:flex items-center justify-center w-8 h-8 rounded-full text-white/50 hover:text-white transition-colors absolute top-4 right-4 z-50"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                aria-label="Close player"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
