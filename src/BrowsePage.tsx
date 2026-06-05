import { useBrowseData, useCollectionDetails } from './hooks'
import { SectionHeader, ContentRail, SetupNotice } from './ui'
import { hasTmdbCredentials, imageUrl } from './lib/tmdb'
import { Link } from 'react-router-dom'
import { NETWORKS } from './NetworkPage'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'

const FRANCHISES = [
  { id: 86311, title: 'Marvel Cinematic Universe' },
  { id: 10, title: 'Star Wars' },
  { id: 1241, title: 'Harry Potter' },
  { id: 119, title: 'The Lord of the Rings' },
  { id: 263, title: 'The Dark Knight Trilogy' },
  { id: 531241, title: 'Spider-Man Collection' },
  { id: 9485, title: 'Fast & Furious' },
  { id: 84, title: 'Indiana Jones' },
  { id: 295, title: 'Pirates of the Caribbean' },
  { id: 87359, title: 'Mission: Impossible' },
  { id: 645, title: 'James Bond' },
  { id: 556, title: 'The Matrix' },
]

function CollectionCard({ id, fallbackTitle }: { id: number; fallbackTitle: string }) {
  const { details } = useCollectionDetails(String(id))
  
  const title = details?.name || fallbackTitle
  const image = imageUrl(details?.backdrop_path, 'w780') || imageUrl(details?.poster_path, 'w500')
  
  return (
    <Link 
      to={`/collection/${id}`}
      className="group relative overflow-hidden block transition-transform hover:-translate-y-1"
      style={{ aspectRatio: '16/9', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {image ? (
        <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <div className="w-full h-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
      )}
      <div className="absolute inset-0 transition-opacity group-hover:opacity-100" style={{ background: 'linear-gradient(to top, rgba(8,8,8,0.95), transparent 70%)' }} />
      <div className="absolute bottom-5 left-5 right-5">
        <h3 className="text-lg font-medium text-white truncate" style={{ fontFamily: 'DM Serif Display, serif' }}>
          {title}
        </h3>
      </div>
    </Link>
  )
}

export function BrowsePage() {
  const { movies, tv, classics, action, comedy, scifi, animation, loading } = useBrowseData()
  const franchisesRef = useRef<HTMLDivElement>(null)

  function scrollFranchises(dir: 'left' | 'right') {
    if (!franchisesRef.current) return
    const scrollAmount = franchisesRef.current.clientWidth * 0.75
    franchisesRef.current.scrollBy({ left: dir === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }

  if (!hasTmdbCredentials) {
    return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  }

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pb-20 pt-20 sm:pt-24 space-y-12 animate-fade-up">
      
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-normal text-white" style={{ fontFamily: 'DM Serif Display, serif' }}>
          Browse Catalog
        </h1>
        <p className="text-sm text-white/50 max-w-2xl leading-relaxed">
          Explore movies, TV shows, timeless classics, and studio hubs across all your favorite genres and franchises.
        </p>
      </div>

      {/* ── Studio Hubs ─────────────────────────────────────────────────── */}
      <section className="pt-2">
        <SectionHeader title="Studio Hubs" subtitle="Explore by network and production company" />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {Object.values(NETWORKS).map(network => (
            <Link
              key={network.id}
              to={`/network/${network.id}`}
              className="group relative flex items-center justify-center rounded-2xl aspect-video transition-all hover:scale-[1.02] hover:border-white/20 border border-white/5 p-4 bg-white/2 shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden"
              style={{ 
                background: `linear-gradient(135deg, ${network.color}25, ${network.color}03)`,
                backdropFilter: 'blur(8px)',
              }}
            >
              {network.logo_path ? (
                <img 
                  src={imageUrl(network.logo_path, 'w342')} 
                  alt={network.name} 
                  className="max-w-[80%] max-h-[60%] object-contain opacity-70 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300" 
                  style={{ filter: network.filter }} 
                />
              ) : (
                <span 
                  className="text-sm sm:text-base font-bold tracking-tighter opacity-70 group-hover:opacity-100 transition-opacity text-white" 
                >
                  {network.name}
                </span>
              )}
              {/* Hover highlight background */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-300 pointer-events-none"
                style={{ backgroundColor: network.color }}
              />
            </Link>
          ))}
        </div>
      </section>

      {/* ── Franchises & Collections ────────────────────────────────────── */}
      <section>
        <SectionHeader title="Franchises & Collections" subtitle="Epic movie marathons and series collections" />
        <div className="relative group/rail">
          {/* Left scroll arrow */}
          <button
            type="button"
            onClick={() => scrollFranchises('left')}
            tabIndex={-1}
            aria-label="Scroll left"
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          >
            <ChevronLeft className="w-4 h-4 text-white" />
          </button>

          <div ref={franchisesRef} className="flex gap-4 overflow-x-auto pb-4 rail">
            {FRANCHISES.map(f => (
              <div key={f.id} className="w-[260px] sm:w-[300px] shrink-0">
                <CollectionCard id={f.id} fallbackTitle={f.title} />
              </div>
            ))}
          </div>

          {/* Right scroll arrow */}
          <button
            type="button"
            onClick={() => scrollFranchises('right')}
            tabIndex={-1}
            aria-label="Scroll right"
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 flex items-center justify-center w-9 h-9 rounded-full opacity-0 group-hover/rail:opacity-100 transition-opacity no-bg-hover"
            style={{ background: 'rgba(8,8,8,0.9)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer' }}
          >
            <ChevronRight className="w-4 h-4 text-white" />
          </button>
        </div>
      </section>

      {/* ── Must Watch TV ──────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Must-Watch TV Shows" subtitle="Highest rated of all time" />
        <ContentRail items={tv} loading={loading} />
      </section>

      {/* ── Must Watch Movies ───────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Must-Watch Movies" subtitle="Highest rated of all time" />
        <ContentRail items={movies} loading={loading} />
      </section>

      {/* ── Action & Adventure ───────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Action & Adventure" subtitle="High-octane blockbusters and thrilling journeys" />
        <ContentRail items={action} loading={loading} />
      </section>

      {/* ── Comedy Hits ─────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Comedy Hits" subtitle="Laughter is the best medicine" />
        <ContentRail items={comedy} loading={loading} />
      </section>

      {/* ── Sci-Fi & Fantasy ────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Sci-Fi & Fantasy" subtitle="Out of this world imagination" />
        <ContentRail items={scifi} loading={loading} />
      </section>

      {/* ── Animation & Anime ───────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Animation & Anime" subtitle="Curated hand-drawn and digital masterpieces" />
        <ContentRail items={animation} loading={loading} />
      </section>

      {/* ── Classics ────────────────────────────────────────────────────── */}
      <section>
        <SectionHeader title="Timeless Classics" subtitle="Released before 1995" />
        <ContentRail items={classics} loading={loading} />
      </section>

    </div>
  )
}
