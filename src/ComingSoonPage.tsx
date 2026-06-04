import { useEffect, useState } from 'react'
import { Bell, BellRing, Calendar } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReminders } from './hooks'
import { fetchUpcoming, imageUrl, titleFromItem, subtitleFromItem, hasTmdbCredentials } from './lib/tmdb'
import type { MediaItem, MediaKind } from './types'
import { SetupNotice } from './ui'

export function ComingSoonPage() {
  const [reminders, setReminders] = useReminders()
  const [upcoming, setUpcoming] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<'upcoming' | 'reminders'>('upcoming')

  useEffect(() => {
    if (!hasTmdbCredentials) return
    const controller = new AbortController()
    setLoading(true)

    fetchUpcoming(controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          // Filter out released and sort closest to release first (ascending)
          const unreleased = res.filter(item => {
            const dateStr = subtitleFromItem(item)
            return dateStr && new Date(dateStr).getTime() > Date.now()
          })
          const sorted = unreleased.sort((a, b) => {
            const dateA = new Date(subtitleFromItem(a)!).getTime()
            const dateB = new Date(subtitleFromItem(b)!).getTime()
            return dateA - dateB
          })
          setUpcoming(sorted)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load upcoming titles.')
          setLoading(false)
        }
      })

    return () => controller.abort()
  }, [])

  function toggleReminder(item: MediaItem) {
    const exists = reminders.some(r => r.id === item.id && r.mediaType === item.media_type)
    if (exists) {
      setReminders(reminders.filter(r => !(r.id === item.id && r.mediaType === item.media_type)))
    } else {
      setReminders([
        ...reminders,
        {
          id: item.id,
          mediaType: (item.media_type as MediaKind) || 'movie',
          title: titleFromItem(item),
          posterPath: item.poster_path,
          releaseDate: subtitleFromItem(item),
          addedAt: Date.now()
        }
      ])
    }
  }

  if (!hasTmdbCredentials) return <div className="px-6 pt-24 max-w-3xl mx-auto"><SetupNotice /></div>

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-24 min-h-screen">
      {/* Header — title and tabs stack on mobile */}
      <div className="mb-8 space-y-4">
        <h1 className="text-3xl sm:text-5xl font-bold text-white" style={{ fontFamily: 'DM Serif Display, serif' }}>
          Coming Soon
        </h1>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10 w-fit max-w-full overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <button
            onClick={() => setTab('upcoming')}
            className={`shrink-0 px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors whitespace-nowrap ${tab === 'upcoming' ? 'bg-white text-black' : 'text-white/60 hover:text-white'}`}
          >
            New &amp; Upcoming
          </button>
          <button
            onClick={() => setTab('reminders')}
            className={`shrink-0 px-4 sm:px-5 py-2 rounded-full text-sm font-semibold transition-colors flex items-center gap-2 whitespace-nowrap ${tab === 'reminders' ? 'bg-[var(--accent)] text-white shadow-[0_0_16px_var(--accent-glow)]' : 'text-white/60 hover:text-white'}`}
          >
            <Bell className="w-4 h-4 shrink-0" /> Reminders ({reminders.length})
          </button>
        </div>
      </div>

      {error && <SetupNotice compact message={error} />}

      {tab === 'reminders' && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {reminders.length === 0 && (
            <div className="col-span-full py-12 text-center text-white/50 bg-white/5 rounded-2xl border border-white/10">
              <Bell className="w-8 h-8 mx-auto mb-4 opacity-50" />
              <p>You haven't set any reminders yet.</p>
              <p className="text-sm mt-1">Check the "New & Upcoming" tab to find things you're excited about.</p>
            </div>
          )}
          {reminders.map(r => (
            <motion.div key={`${r.mediaType}-${r.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4 bg-white/5 rounded-2xl p-4 border border-white/10 relative overflow-hidden group">
              <div className="w-24 shrink-0 rounded-lg overflow-hidden bg-white/10 shadow-lg relative aspect-[2/3]">
                {r.posterPath ? (
                  <img src={imageUrl(r.posterPath, 'w342')} alt={r.title} className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <h3 className="font-semibold text-lg text-white mb-1 truncate">{r.title}</h3>
                <div className="text-sm text-[var(--accent)] font-medium flex items-center gap-1.5 mb-4">
                  <Calendar className="w-3.5 h-3.5" />
                  {r.releaseDate ? new Date(r.releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                </div>
                <button
                  onClick={() => setReminders(reminders.filter(x => !(x.id === r.id && x.mediaType === r.mediaType)))}
                  className="self-start text-xs font-semibold px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors flex items-center gap-1.5"
                >
                  <XIcon /> Remove
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="space-y-12">
          {loading && <div className="animate-pulse h-[400px] bg-white/5 rounded-3xl" />}
          
          {upcoming.map((item, i) => {
            const dateStr = subtitleFromItem(item)
            const date = dateStr ? new Date(dateStr) : null
            const isOut = date ? date.getTime() < Date.now() : false
            const isReminded = reminders.some(r => r.id === item.id && r.mediaType === item.media_type)

            return (
              <motion.div
                key={`${item.media_type}-${item.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.1, 1) }}
                className="group relative flex flex-col sm:flex-row gap-5 sm:gap-8 bg-white/5 rounded-3xl p-4 sm:p-6 border border-white/10 transition-all hover:bg-white/10"
              >
                {/* Poster */}
                <div className="w-full sm:w-44 md:w-56 shrink-0 rounded-2xl overflow-hidden bg-white/10 shadow-[0_16px_32px_rgba(0,0,0,0.5)] aspect-[2/3]">
                  {item.poster_path ? (
                    <img src={imageUrl(item.poster_path, 'w500')} alt={titleFromItem(item)} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                  ) : null}
                </div>

                {/* Info */}
                <div className="flex flex-col flex-1 py-2">
                  <div className="mb-4">
                    {date && (
                      <div className="inline-flex flex-col mb-4">
                        <span className="text-4xl font-bold tracking-tight text-white mb-1">
                          {date.getDate()}
                        </span>
                        <span className="text-sm font-bold tracking-widest uppercase text-white/50">
                          {date.toLocaleString('default', { month: 'short' })}
                        </span>
                      </div>
                    )}
                    
                    <h2 className="text-3xl font-bold text-white mb-2">{titleFromItem(item)}</h2>
                    <p className="text-white/60 leading-relaxed max-w-3xl line-clamp-4">
                      {item.overview || 'No synopsis available.'}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-3 pt-4">
                    <button
                      onClick={() => toggleReminder(item)}
                      className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all"
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
                      {isReminded ? 'Reminder Set' : 'Remind Me'}
                    </button>
                    {isOut && (
                      <span className="inline-flex items-center px-4 py-3 text-sm font-semibold text-[var(--accent)] bg-[var(--accent-dim)] rounded-full">
                        Available Now
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function XIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
    </svg>
  )
}
