import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, Copy, Check, LogOut, Radio, Play } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

interface Participant {
  user_id: string
  username: string
  avatar_url: string
  is_host: boolean
  presence_ref?: string
}

interface WatchPartyPanelProps {
  movieId: string
  mediaType: string
  title: string
  currentSeason?: number
  currentEpisode?: number
  onStartPlayback: (season?: number, episode?: number) => void
  activeRoomId: string | null
  setActiveRoomId: (id: string | null) => void
  channel: any
  setChannel: (channel: any) => void
}

export function WatchPartyPanel({
  movieId,
  mediaType,
  title,
  currentSeason,
  currentEpisode,
  onStartPlayback,
  activeRoomId,
  setActiveRoomId,
  channel,
  setChannel,
}: WatchPartyPanelProps) {
  const { session, profile } = useAuth()
  const [inputRoomId, setInputRoomId] = useState('')
  const [copied, setCopied] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])

  // Setup presence syncing when room changes
  useEffect(() => {
    if (!activeRoomId || !session) {
      setParticipants([])
      return
    }

    // Subscribe to presence & broadcast channel
    const chan = supabase.channel(`watch_party:${activeRoomId}`)

    chan
      .on('presence', { event: 'sync' }, () => {
        const state = chan.presenceState()
        const parsed: Participant[] = []
        Object.keys(state).forEach((key) => {
          const presences = state[key] as any
          presences.forEach((p: any) => {
            parsed.push({
              user_id: p.user_id,
              username: p.username,
              avatar_url: p.avatar_url,
              is_host: p.is_host,
              presence_ref: p.presence_ref,
            })
          });
        })
        setParticipants(parsed)
      })
      .on('broadcast', { event: 'change_media' }, (payload: any) => {
        const { mediaType: pType, id: pId, season: pSeason, episode: pEpisode } = payload.payload
        // Start playback if it matches this title or triggers it
        if (String(pId) === String(movieId) && pType === mediaType) {
          onStartPlayback(pSeason, pEpisode)
        }
      })

    // Subscribe to channel
    chan.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return

      const isHost = activeRoomId.includes(session.user.id.substring(0, 5))
      const myPresence = {
        user_id: session.user.id,
        username: profile?.username || session.user.email?.split('@')[0] || 'User',
        avatar_url: profile?.avatar_url || '',
        is_host: isHost,
      }

      await chan.track(myPresence)
    })

    setChannel(chan)

    return () => {
      chan.untrack()
      supabase.removeChannel(chan)
      setChannel(null)
    }
  }, [activeRoomId, session, profile])

  const handleCreateRoom = () => {
    if (!session) return
    const code = `WP-${profile?.username || session.user.email?.split('@')[0] || 'Room'}-${session.user.id.substring(0, 5)}`
    setActiveRoomId(code)
  }

  const handleJoinRoom = () => {
    const code = inputRoomId.trim().toUpperCase()
    if (code) {
      setActiveRoomId(code)
    }
  }

  const handleLeaveRoom = () => {
    setActiveRoomId(null)
  }

  const handleCopyCode = () => {
    if (!activeRoomId) return
    navigator.clipboard.writeText(activeRoomId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Check if current user is host of this party
  const isHost = session && activeRoomId?.includes(session.user.id.substring(0, 5))

  const handleSyncPlay = () => {
    if (!isHost || !channel) return
    // Broadcast change media signal
    channel.send({
      type: 'broadcast',
      event: 'change_media',
      payload: {
        mediaType,
        id: Number(movieId),
        season: currentSeason,
        episode: currentEpisode,
      },
    })
    // Also trigger own playback
    onStartPlayback(currentSeason, currentEpisode)
  }

  return (
    <div
      className="p-5 rounded-2xl border"
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" style={{ color: 'var(--accent)' }} />
        <h3 className="text-sm font-semibold text-white">Watch Party: {title}</h3>
      </div>

      {!activeRoomId ? (
        <div className="space-y-4">
          <p className="text-xs text-white/50 leading-relaxed">
            Watch together with friends! Create a room code or enter an existing code to synchronize playback and chat in real-time.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputRoomId}
              onChange={(e) => setInputRoomId(e.target.value)}
              placeholder="Enter Room Code (e.g. WP-XXXX)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-white/20 uppercase transition-colors"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!inputRoomId.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-black hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              Join
            </button>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-white/30 uppercase font-bold tracking-wider">or</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <button
            onClick={handleCreateRoom}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white border border-[var(--accent)] bg-[var(--accent)]/10 hover:bg-[var(--accent)]/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse" />
            Create Party Room
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Room details */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
            <div>
              <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Room Code</div>
              <div className="text-xs font-mono font-bold text-white select-all mt-0.5">{activeRoomId}</div>
            </div>
            <button
              onClick={handleCopyCode}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-white/5 text-white/60 hover:text-white"
            >
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Action button for host */}
          {isHost ? (
            <button
              onClick={handleSyncPlay}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Start Synced Stream
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 text-center text-xs text-white/60">
              Waiting for the host to start the sync stream...
            </div>
          )}

          {/* Members list */}
          <div>
            <div className="text-[10px] text-white/40 font-bold uppercase tracking-wider mb-2">Members ({participants.length})</div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {participants.map((member) => (
                <div key={member.user_id} className="flex items-center justify-between gap-3 text-left">
                  <Link
                    to={`/user/${member.username}`}
                    className="no-bg-hover flex items-center gap-2 min-w-0 flex-1"
                  >
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center shrink-0 hover:ring-1 hover:ring-white/20 transition-all">
                      {member.avatar_url ? (
                        <img src={member.avatar_url} alt={member.username} className="w-full h-full object-cover" />
                      ) : (
                        <Users className="w-3 h-3 text-white/40" />
                      )}
                    </div>
                    <span className="text-xs text-white/80 font-medium truncate hover:text-white transition-colors">{member.username}</span>
                  </Link>
                  {member.is_host && (
                    <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30 shrink-0">
                      Host
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Leave Button */}
          <button
            onClick={handleLeaveRoom}
            className="w-full py-2 rounded-xl text-xs font-semibold border border-red-500/20 text-red-400 bg-red-500/5 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Leave Party
          </button>
        </div>
      )}
    </div>
  )
}
