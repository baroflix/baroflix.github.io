// Jikan v4 — unofficial MyAnimeList REST API
// Rate limits: 3 req/sec, 60 req/min
// Docs: https://docs.api.jikan.moe

const BASE = 'https://api.jikan.moe/v4'

export interface JikanEpisode {
  /** Equal to episode number */
  mal_id: number
  title: string | null
  title_japanese: string | null
  aired: string | null
  filler: boolean
  recap: boolean
}

// In-memory cache keyed by MAL ID
const episodeCache = new Map<number, Promise<JikanEpisode[]>>()

/**
 * Fetch the full episode list for an anime from Jikan.
 * Handles pagination automatically (up to 10 pages = 1 000 episodes).
 */
export async function fetchJikanEpisodes(
  malId: number,
  signal?: AbortSignal
): Promise<JikanEpisode[]> {
  if (episodeCache.has(malId)) return episodeCache.get(malId)!

  const promise = (async (): Promise<JikanEpisode[]> => {
    const all: JikanEpisode[] = []
    let page = 1

    while (page <= 10) {
      const res = await fetch(`${BASE}/anime/${malId}/episodes?page=${page}`, { signal })
      if (!res.ok) break

      const json = await res.json()
      all.push(...(json.data ?? []))

      if (!json.pagination?.has_next_page) break

      page++
      // Respect Jikan rate limit — 350 ms between pages
      await new Promise<void>(r => setTimeout(r, 350))
    }

    return all
  })()

  episodeCache.set(malId, promise)
  promise.catch(() => episodeCache.delete(malId))
  return promise
}
