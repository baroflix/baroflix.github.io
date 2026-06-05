import { useEffect, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fetchPersonDetails, imageUrl, hasTmdbCredentials } from './lib/tmdb'
import type { PersonDetails } from './types'
import { SetupNotice, FactBadge } from './ui'

export function CastPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [details, setDetails] = useState<PersonDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    
    fetchPersonDetails(id, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          setDetails(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load person details.')
          setLoading(false)
        }
      })
      
    return () => controller.abort()
  }, [id])

  if (!hasTmdbCredentials) return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  if (!id) return <Navigate replace to="/" />

  const credits = details?.combined_credits?.cast ?? []
  
  const timelineMap = new Map<number | 'Upcoming', typeof credits>()
  credits.forEach(credit => {
    const dateStr = credit.release_date || credit.first_air_date
    const year = dateStr ? new Date(dateStr).getFullYear() : 'Upcoming'
    if (!timelineMap.has(year)) {
      timelineMap.set(year, [])
    }
    timelineMap.get(year)!.push(credit)
  })

  const sortedYears = Array.from(timelineMap.keys()).sort((a, b) => {
    if (a === 'Upcoming') return -1
    if (b === 'Upcoming') return 1
    return b - a
  })

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-16 pt-20 sm:pt-24">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.85)',
          }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse text-white/50">Loading profile...</div>
      ) : error ? (
        <SetupNotice compact message={error} />
      ) : details ? (
        <div className="grid gap-12 lg:grid-cols-[300px_1fr] xl:grid-cols-[350px_1fr]">
          {/* Sidebar */}
          <div>
            <div className="rounded-2xl overflow-hidden mb-6" style={{ background: 'rgba(255,255,255,0.05)', aspectRatio: '2/3' }}>
              {details.profile_path ? (
                <img
                  src={imageUrl(details.profile_path, 'w500')}
                  alt={details.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl font-bold" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {details.name.charAt(0)}
                </div>
              )}
            </div>
            
            <h2 className="text-xl font-semibold text-white mb-4">Personal Info</h2>
            <div className="grid gap-2">
              <FactBadge label="Known For" value={details.known_for_department ?? '—'} />
              <FactBadge label="Born" value={details.birthday ?? '—'} />
              {details.deathday && <FactBadge label="Died" value={details.deathday} />}
              <FactBadge label="Place of Birth" value={details.place_of_birth ?? '—'} />
            </div>
          </div>

          {/* Main Content */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6" style={{ fontFamily: 'DM Serif Display, serif' }}>
              {details.name}
            </h1>
            
            {details.biography && (
              <div className="mb-12">
                <h2 className="text-lg font-semibold text-white mb-3">Biography</h2>
                <div className="text-sm leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto pr-4" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  {details.biography}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Filmography Timeline</h2>
              <div className="relative border-l-2 border-white/10 ml-4 pl-8 space-y-12">
                {sortedYears.map(year => (
                  <div key={year} className="relative">
                    {/* Timeline dot */}
                    <div className="absolute -left-[41px] top-2 w-4 h-4 rounded-full bg-[var(--accent)] border-4 border-[#080808]" />
                    
                    <h3 className="text-xl font-bold text-white mb-6 sticky top-24 z-10 py-2" style={{ fontFamily: 'DM Serif Display, serif', background: 'rgba(8,8,8,0.9)', backdropFilter: 'blur(8px)' }}>
                      {year}
                    </h3>
                    
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {timelineMap.get(year)!.map((credit: any) => (
                        <Link
                          key={`${credit.media_type}-${credit.id}-${credit.character}`}
                          to={`/title/${credit.media_type}/${credit.id}`}
                          className="group flex gap-4 bg-white/5 rounded-2xl p-4 border border-white/10 transition-colors hover:bg-white/10"
                        >
                          <div className="w-16 shrink-0 rounded-lg overflow-hidden bg-white/10 aspect-[2/3]">
                            {credit.poster_path ? (
                              <img src={imageUrl(credit.poster_path, 'w342')} alt={credit.title || credit.name} className="w-full h-full object-cover" />
                            ) : null}
                          </div>
                          <div className="flex flex-col justify-center min-w-0">
                            <div className="font-semibold text-white truncate text-sm">{credit.title || credit.name}</div>
                            {credit.character && (
                              <div className="text-xs text-[var(--accent)] truncate mt-1">as {credit.character}</div>
                            )}
                            <div className="text-xs text-white/40 mt-1 uppercase tracking-widest">{credit.media_type}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
