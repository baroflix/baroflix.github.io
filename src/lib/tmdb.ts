import type { MediaDetails, MediaItem, MediaKind, SeasonDetails, CollectionDetails } from '../types'

const TMDB_BASE_URL = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/'

const API_KEY = import.meta.env.VITE_TMDB_API_KEY?.trim()
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_ACCESS_TOKEN?.trim()

export const hasTmdbCredentials = Boolean(API_KEY || ACCESS_TOKEN)

type RequestParams = Record<string, string | number | boolean | undefined>

function buildQuery(params: RequestParams = {}) {
  const search = new URLSearchParams()

  if (API_KEY) {
    search.set('api_key', API_KEY)
  }

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  })

  return search
}

async function request<T>(path: string, params: RequestParams = {}, signal?: AbortSignal) {
  if (!hasTmdbCredentials) {
    throw new Error('Add VITE_TMDB_API_KEY or VITE_TMDB_ACCESS_TOKEN to enable TMDB data.')
  }

  const url = new URL(`${TMDB_BASE_URL}${path}`)
  const query = buildQuery(params)
  query.forEach((value, key) => url.searchParams.set(key, value))

  const response = await fetch(url, {
    signal,
    headers: ACCESS_TOKEN ? { Authorization: `Bearer ${ACCESS_TOKEN}` } : undefined,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `TMDB request failed with status ${response.status}`)
  }

  return response.json() as Promise<T>
}

function uniqueMedia(items: MediaItem[]) {
  const seen = new Set<string>()

  return items.filter((item) => {
    // Rely on mediaTypeFromItem to infer the type if it's missing (e.g. from top_rated endpoints)
    const type = mediaTypeFromItem(item)
    if (!type) {
      return false
    }

    const key = `${type}-${item.id}`
    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export function normalizeMediaKind(mediaType?: string): MediaKind | null {
  if (mediaType === 'movie' || mediaType === 'tv' || mediaType === 'anime') {
    return mediaType
  }

  return null
}

export function mediaTypeFromItem(item: MediaItem): MediaKind {
  return normalizeMediaKind(item.media_type) ?? (item.name ? 'tv' : 'movie')
}

export function titleFromItem(item: MediaItem) {
  return item.title ?? item.name ?? 'Untitled'
}

export function subtitleFromItem(item: MediaItem) {
  return item.release_date ?? item.first_air_date ?? ''
}

export function yearFromItem(item: MediaItem) {
  const date = subtitleFromItem(item)
  return date ? new Date(date).getFullYear() : null
}

export function imageUrl(path: string | null | undefined, size: 'w342' | 'w500' | 'w780' | 'w1280' = 'w780') {
  if (!path) {
    return ''
  }

  if (path.startsWith('http')) {
    return path
  }

  return `${TMDB_IMAGE_BASE}${size}${path}`
}

export async function fetchTrendingTitles(signal?: AbortSignal) {
  const data = await request<{ results: MediaItem[] }>('/trending/all/week', { language: 'en-US' }, signal)
  return uniqueMedia(data.results)
}

export async function fetchRecommendations(signal?: AbortSignal) {
  const [movies, tv] = await Promise.all([
    request<{ results: MediaItem[] }>('/discover/movie', { sort_by: 'popularity.desc', include_adult: false, language: 'en-US', page: 1 }, signal),
    request<{ results: MediaItem[] }>('/discover/tv', { sort_by: 'popularity.desc', include_adult: false, language: 'en-US', page: 1 }, signal),
  ])

  return uniqueMedia([
    ...movies.results.map((item) => ({ ...item, media_type: 'movie' as const })),
    ...tv.results.map((item) => ({ ...item, media_type: 'tv' as const })),
  ])
}

export async function searchTitles(query: string, signal?: AbortSignal) {
  const data = await request<{ results: MediaItem[] }>('/search/multi', { query, include_adult: false, language: 'en-US', page: 1 }, signal)
  return uniqueMedia(data.results)
}

const titleDetailsCache = new Map<string, Promise<MediaDetails>>()

export async function fetchTitleDetails(mediaType: MediaKind, id: string, signal?: AbortSignal) {
  const cacheKey = `${mediaType}-${id}`
  if (titleDetailsCache.has(cacheKey)) return titleDetailsCache.get(cacheKey)!

  const promise = request<MediaDetails>(`/${mediaType}/${id}`, { language: 'en-US', append_to_response: 'credits,videos,images,external_ids,recommendations', include_image_language: 'en,null' }, signal)
  titleDetailsCache.set(cacheKey, promise)
  
  promise.catch(() => titleDetailsCache.delete(cacheKey))
  return promise
}

export async function fetchPersonDetails(id: string, signal?: AbortSignal) {
  return request<any>(`/person/${id}`, { language: 'en-US', append_to_response: 'combined_credits' }, signal)
}

const seasonDetailsCache = new Map<string, Promise<SeasonDetails>>()

export async function fetchSeasonDetails(id: string, seasonNumber: number, signal?: AbortSignal) {
  const cacheKey = `${id}-${seasonNumber}`
  if (seasonDetailsCache.has(cacheKey)) return seasonDetailsCache.get(cacheKey)!

  const promise = request<SeasonDetails>(`/tv/${id}/season/${seasonNumber}`, { language: 'en-US' }, signal)
  seasonDetailsCache.set(cacheKey, promise)

  promise.catch(() => seasonDetailsCache.delete(cacheKey))
  return promise
}

const collectionCache = new Map<string, Promise<CollectionDetails>>()

export async function fetchCollection(id: string, signal?: AbortSignal) {
  if (collectionCache.has(id)) return collectionCache.get(id)!

  const promise = request<CollectionDetails>(`/collection/${id}`, { language: 'en-US' }, signal)
  collectionCache.set(id, promise)

  promise.catch(() => collectionCache.delete(id))
  return promise
}

export async function fetchTopRatedMovies(signal?: AbortSignal) {
  const data = await request<{ results: MediaItem[] }>('/movie/top_rated', { language: 'en-US', page: 1 }, signal)
  return uniqueMedia(data.results)
}

export async function fetchTopRatedTv(signal?: AbortSignal) {
  const data = await request<{ results: MediaItem[] }>('/tv/top_rated', { language: 'en-US', page: 1 }, signal)
  return uniqueMedia(data.results)
}

export async function fetchClassics(signal?: AbortSignal) {
  const data = await request<{ results: MediaItem[] }>('/discover/movie', {
    language: 'en-US',
    page: 1,
    'primary_release_date.lte': '1995-01-01',
    sort_by: 'vote_count.desc',
    include_adult: false,
  }, signal)
  return uniqueMedia(data.results)
}

export async function fetchUpcoming(signal?: AbortSignal) {
  const [movies, tv] = await Promise.all([
    request<{ results: MediaItem[] }>('/movie/upcoming', { language: 'en-US', page: 1 }, signal),
    request<{ results: MediaItem[] }>('/tv/on_the_air', { language: 'en-US', page: 1 }, signal),
  ])

  return uniqueMedia([
    ...movies.results.map((item) => ({ ...item, media_type: 'movie' as const })),
    ...tv.results.map((item) => ({ ...item, media_type: 'tv' as const })),
  ])
}

export async function fetchByNetwork(networkId: number, type: 'movie' | 'tv', signal?: AbortSignal) {
  const endpoint = type === 'tv' ? '/discover/tv' : '/discover/movie'
  const key = type === 'tv' ? 'with_networks' : 'with_companies'
  const data = await request<{ results: MediaItem[] }>(endpoint, {
    language: 'en-US',
    page: 1,
    sort_by: 'popularity.desc',
    [key]: networkId,
  }, signal)
  
  return uniqueMedia(data.results.map(item => ({ ...item, media_type: type })))
}

export async function fetchByGenre(genreId: number, type: 'movie' | 'tv', signal?: AbortSignal) {
  const endpoint = type === 'tv' ? '/discover/tv' : '/discover/movie'
  const data = await request<{ results: MediaItem[] }>(endpoint, {
    language: 'en-US',
    page: 1,
    with_genres: genreId,
    sort_by: 'popularity.desc',
    include_adult: false,
  }, signal)
  
  return uniqueMedia(data.results.map(item => ({ ...item, media_type: type })))
}

export function buildVideasyUrl(
  mediaType: MediaKind,
  id: number,
  season?: number,
  episode?: number,
  options?: {
    color?: string
    autoplay?: boolean
    /** Sub or dub — only applies to anime (animeplay.cfd). Defaults to 'sub'. */
    language?: 'sub' | 'dub'
  }
) {
  const isTv = mediaType === 'tv'
  const isAnime = mediaType === 'anime'

  // ── Anime uses animeplay.cfd with AniList IDs ───────────────────────────────
  if (isAnime) {
    const lang = options?.language ?? 'sub'
    const ep = episode ?? 1
    return `https://animeplay.cfd/stream/ani/${id}/${ep}/${lang}`
  }

  // ── Movies / TV use Videasy ─────────────────────────────────────────────────
  const base = isTv
    ? `https://player.videasy.net/tv/${id}/${season ?? 1}/${episode ?? 1}`
    : `https://player.videasy.net/movie/${id}`

  const params = new URLSearchParams()

  if (options?.color) {
    params.set('color', options.color.replace('#', ''))
  }

  if (isTv) {
    params.set('nextEpisode', 'true')
    params.set('episodeSelector', 'true')
    params.set('autoplayNextEpisode', 'true')
  }

  params.set('overlay', 'true')

  return `${base}?${params.toString()}`
}

export function pickTrailer(videos?: { results: Array<{ site: string; type: string; official?: boolean; key: string }> }) {
  return videos?.results.find((video) => video.site === 'YouTube' && /trailer|teaser/i.test(video.type)) ?? videos?.results.find((video) => video.site === 'YouTube') ?? null
}

// ─── Anime TMDB enrichment ────────────────────────────────────────────────────

export interface AnimeTmdbMeta {
  /** Transparent logo file_path strings from TMDB images */
  logos: Array<{ file_path: string; vote_average: number }>
  /** episode_number → overview from TMDB season 1 */
  episodeOverviews: Map<number, string>
  /** episode_number → full still image URL from TMDB season 1 */
  episodeStills: Map<number, string>
}

const animeTmdbMetaCache = new Map<string, Promise<AnimeTmdbMeta>>()

/**
 * Search TMDB for an anime TV show by title, then fetch its logo images and
 * season-1 episode overviews. Results are cached in-memory per (title, year) pair.
 *
 * Returns empty data gracefully if TMDB credentials are absent or no match is found.
 */
export async function fetchAnimeTmdbMeta(
  title: string,
  year?: number | null,
  signal?: AbortSignal
): Promise<AnimeTmdbMeta> {
  const empty: AnimeTmdbMeta = { logos: [], episodeOverviews: new Map(), episodeStills: new Map() }
  if (!hasTmdbCredentials) return empty

  const cacheKey = `${title}|${year ?? ''}`
  if (animeTmdbMetaCache.has(cacheKey)) return animeTmdbMetaCache.get(cacheKey)!

  const promise = (async (): Promise<AnimeTmdbMeta> => {
    // 1. Search for the show
    const params: RequestParams = { query: title, language: 'en-US', page: 1 }
    if (year) params.first_air_date_year = year

    const searchData = await request<{ results: Array<{ id: number }> }>(
      '/search/tv',
      params,
      signal
    ).catch(() => null)

    const tmdbId = searchData?.results?.[0]?.id
    if (!tmdbId) return empty

    // 2. Fetch images + season 1 in parallel
    const [imagesData, season1Data] = await Promise.all([
      request<{ logos?: Array<{ file_path: string; vote_average: number }> }>(
        `/tv/${tmdbId}/images`,
        { include_image_language: 'en,null' },
        signal
      ).catch(() => null),
      request<{ episodes?: Array<{ episode_number: number; overview: string; still_path: string | null }> }>(
        `/tv/${tmdbId}/season/1`,
        {},
        signal
      ).catch(() => null),
    ])

    const logos = (imagesData?.logos ?? []).filter(l => l.file_path)

    const episodeOverviews = new Map<number, string>()
    const episodeStills = new Map<number, string>()
    for (const ep of season1Data?.episodes ?? []) {
      if (ep.episode_number && ep.overview) {
        episodeOverviews.set(ep.episode_number, ep.overview)
      }
      if (ep.episode_number && ep.still_path) {
        episodeStills.set(ep.episode_number, imageUrl(ep.still_path, 'w342'))
      }
    }

    return { logos, episodeOverviews, episodeStills }
  })()

  animeTmdbMetaCache.set(cacheKey, promise)
  promise.catch(() => animeTmdbMetaCache.delete(cacheKey))
  return promise
}