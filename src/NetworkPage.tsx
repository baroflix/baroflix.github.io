import { useEffect, useState } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { fetchByNetwork, hasTmdbCredentials, imageUrl } from './lib/tmdb'
import type { MediaItem } from './types'
import { SetupNotice, MediaGrid } from './ui'

export const NETWORKS = {
  'netflix': { id: 213, name: 'Netflix', color: '#E50914', type: 'tv' as const, logo_path: '/wwemzKWzjKYJFfCeiB57q3r4Bcm.png', filter: 'brightness(0) invert(1)' },
  'hbo': { id: 49, name: 'HBO', color: '#000000', type: 'tv' as const, logo_path: '/tuomPhY2UtuPTqqFnKMVHvSb724.png', filter: 'brightness(0) invert(1)' },
  'disney': { id: 2, name: 'Disney', color: '#113CCF', type: 'tv' as const, logo_path: '/wdrCwmRnLFJhEoH8GSfymY85KHT.png', filter: 'brightness(0) invert(1)' },
  'marvel': { id: 420, name: 'Marvel Studios', color: '#FFFFFF', type: 'movie' as const, logo_path: '/hUzeosd33nzE5MCNsZxCGEKTXaQ.png', filter: 'none' },
  'pixar': { id: 3, name: 'Pixar', color: '#000000', type: 'movie' as const, logo_path: '/1TjvGVDMYsj6JBxOAkUHpPEwLf7.png', filter: 'brightness(0) invert(1)' },
  'a24': { id: 41077, name: 'A24', color: '#000000', type: 'movie' as const, logo_path: '/1ZXsGaFPgrgS6ZZGS37AqD5uU12.png', filter: 'brightness(0) invert(1)' },
}

export function NetworkPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const networkKey = Object.keys(NETWORKS).find(k => String(NETWORKS[k as keyof typeof NETWORKS].id) === id)
  const network = networkKey ? NETWORKS[networkKey as keyof typeof NETWORKS] : null

  useEffect(() => {
    if (!network || !hasTmdbCredentials) return
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    
    fetchByNetwork(network.id, network.type, controller.signal)
      .then(res => {
        if (!controller.signal.aborted) {
          setItems(res)
          setLoading(false)
        }
      })
      .catch(err => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load network content.')
          setLoading(false)
        }
      })
      
    return () => controller.abort()
  }, [network])

  if (!hasTmdbCredentials) return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  if (!network) return <Navigate replace to="/" />

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-16 pt-20 sm:pt-24 min-h-screen">
      <div className="mb-12 flex flex-col items-start gap-8 border-b pb-8" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.85)' }}
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="flex items-center gap-6">
          <div
            className="flex items-center justify-center rounded-2xl w-24 h-24 sm:w-32 sm:h-32 shadow-[0_0_40px_rgba(255,255,255,0.1)] p-4"
            style={{ background: network.color }}
          >
            {network.logo_path ? (
              <img src={imageUrl(network.logo_path, 'w342')} alt={network.name} className="max-w-full max-h-full object-contain" style={{ filter: network.filter }} />
            ) : (
              <span className="text-3xl sm:text-4xl font-black tracking-tighter" style={{ color: network.color === '#FFFFFF' ? 'black' : 'white' }}>
                {network.name.slice(0,1)}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-4xl sm:text-6xl font-bold text-white mb-2" style={{  }}>
              {network.name} Hub
            </h1>
            <p className="text-white/50 text-lg">
              Explore the entire {network.name} catalog.
            </p>
          </div>
        </div>
      </div>

      {error ? (
        <SetupNotice compact message={error} />
      ) : (
        <MediaGrid
          items={items}
          loading={loading}
          emptyLabel={`No content found for ${network.name}.`}
          columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
        />
      )}
    </div>
  )
}
