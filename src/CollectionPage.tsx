import { useParams, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { imageUrl, hasTmdbCredentials } from './lib/tmdb'
import { useCollectionDetails } from './hooks'
import { SetupNotice, MediaGrid } from './ui'

export function CollectionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { details, loading, error } = useCollectionDetails(id)

  if (!hasTmdbCredentials) return <div className="px-4 sm:px-6 pt-20 sm:pt-24 max-w-3xl mx-auto"><SetupNotice /></div>
  if (!id) return <Navigate replace to="/" />

  const backdropSrc = imageUrl(details?.backdrop_path, 'w1280') || ''
  const parts = details?.parts?.slice().sort((a, b) => {
    const dateA = a.release_date ? new Date(a.release_date).getTime() : 0
    const dateB = b.release_date ? new Date(b.release_date).getTime() : 0
    return dateA - dateB
  }) ?? []

  return (
    <>
      {loading ? (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pt-20 sm:pt-24 h-screen animate-pulse text-white/50">
          Loading collection...
        </div>
      ) : error ? (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 pt-20 sm:pt-24">
          <SetupNotice compact message={error} />
        </div>
      ) : details ? (
        <div>
          {/* ── Hero ──────────────────────────────────────────────────────────── */}
          <section className="relative overflow-hidden" style={{ minHeight: '65svh' }}>
            <div className="absolute inset-0 overflow-hidden">
              <img
                src={backdropSrc}
                alt=""
                className="w-full h-full object-cover animate-ken-burns"
                style={{ opacity: 0.45 }}
              />
            </div>
            <div
              className="absolute inset-0"
              style={{
                background: `
                  linear-gradient(to top, rgba(8,8,8,1) 0%, rgba(8,8,8,0.55) 40%, rgba(8,8,8,0.1) 100%),
                  linear-gradient(to right, rgba(8,8,8,0.85) 0%, rgba(8,8,8,0.0) 60%)
                `,
              }}
            />

            <div className="relative z-10 mx-auto flex h-[65svh] max-w-screen-2xl w-full flex-col justify-between px-4 sm:px-6 pt-20 sm:pt-24 pb-12">
              {/* Back button sits at top of hero content */}
              <div>
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:opacity-90 cursor-pointer"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.85)',
                    backdropFilter: 'blur(12px)'
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              </div>

              {/* Title block at bottom of hero */}
              <div className="max-w-3xl space-y-5">
                <h1
                  className="text-5xl sm:text-6xl font-normal text-white"
                  style={{ textShadow: '0 4px 32px rgba(0,0,0,0.6)', letterSpacing: '-0.02em' }}
                >
                  {details.name}
                </h1>
                <p className="text-base sm:text-lg max-w-xl leading-relaxed text-white/75">
                  {details.overview}
                </p>
                <div className="text-sm font-semibold text-white/50 uppercase tracking-widest">
                  {parts.length} Movies
                </div>
              </div>
            </div>
          </section>

          {/* ── Content ───────────────────────────────────────────────────────── */}
          <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 py-12">
            <MediaGrid
              items={parts}
              loading={false}
              emptyLabel="No parts found in this collection."
              columnsClassName="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            />
          </div>
        </div>
      ) : null}
    </>
  )
}
