import type { MediaDetails, MediaItem } from '../types'

const ANILIST_API = 'https://graphql.anilist.co'

const TRENDING_QUERY = `
query {
  Page(page: 1, perPage: 20) {
    media(sort: TRENDING_DESC, type: ANIME, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage
      description
      averageScore
      format
      episodes
      seasonYear
      startDate { year month day }
      genres
    }
  }
}
`

const SEARCH_QUERY = `
query($search: String) {
  Page(page: 1, perPage: 20) {
    media(search: $search, type: ANIME, isAdult: false, sort: POPULARITY_DESC) {
      id
      title { romaji english native }
      coverImage { extraLarge large medium }
      bannerImage
      description
      averageScore
      format
      episodes
      seasonYear
      startDate { year month day }
      genres
    }
  }
}
`

const DETAILS_QUERY = `
query($id: Int) {
  Media(id: $id, type: ANIME) {
    id
    title { romaji english native }
    coverImage { extraLarge large medium }
    bannerImage
    description
    averageScore
    format
    episodes
    seasonYear
    startDate { year month day }
    genres
    characters(role: MAIN, perPage: 12) {
      edges {
        node { id name { full } image { large } }
        role
      }
    }
    trailer { id site }
    streamingEpisodes {
      title
      thumbnail
      url
      site
    }
  }
}
`

async function requestGraphql(query: string, variables: any = {}, signal?: AbortSignal) {
  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Anilist API error: ${response.status} ${text}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(`Anilist GraphQL error: ${json.errors[0].message}`)
  }

  return json.data
}

function mapToMediaItem(media: any): MediaItem {
  const title = media.title.english || media.title.romaji || media.title.native || 'Untitled'
  const vote_average = media.averageScore ? media.averageScore / 10 : undefined
  const release_date = media.startDate?.year ? `${media.startDate.year}-${String(media.startDate.month || 1).padStart(2, '0')}-${String(media.startDate.day || 1).padStart(2, '0')}` : undefined

  return {
    id: media.id,
    media_type: 'anime',
    title,
    overview: media.description?.replace(/<[^>]*>?/gm, ''), // Strip HTML tags
    poster_path: media.coverImage?.extraLarge || media.coverImage?.large, // Full URL
    backdrop_path: media.bannerImage || media.coverImage?.extraLarge, // Full URL
    release_date,
    vote_average,
  }
}

export async function fetchTrendingAnime(signal?: AbortSignal): Promise<MediaItem[]> {
  const data = await requestGraphql(TRENDING_QUERY, {}, signal)
  return data.Page.media.map(mapToMediaItem)
}

export async function searchAnime(query: string, signal?: AbortSignal): Promise<MediaItem[]> {
  const data = await requestGraphql(SEARCH_QUERY, { search: query }, signal)
  return data.Page.media.map(mapToMediaItem)
}

export interface AnilistStreamingEpisode {
  title: string
  thumbnail: string
  url: string
  site: string
}

const animeDetailsCache = new Map<string, Promise<MediaDetails & { streamingEpisodes?: AnilistStreamingEpisode[] }>>()

export async function fetchAnimeDetails(id: string, signal?: AbortSignal): Promise<MediaDetails & { streamingEpisodes?: AnilistStreamingEpisode[] }> {
  if (animeDetailsCache.has(id)) return animeDetailsCache.get(id)!

  const promise = (async () => {
    const data = await requestGraphql(DETAILS_QUERY, { id: parseInt(id, 10) }, signal)
    const media = data.Media
    const item = mapToMediaItem(media)
    const episodesCount = media.episodes || media.streamingEpisodes?.length || 1
    const streamingEpisodes: AnilistStreamingEpisode[] = media.streamingEpisodes ?? []

    const seasonSummary = {
      id: media.id,
      season_number: 1,
      name: 'Season 1',
      episode_count: episodesCount,
    }

    const cast = media.characters?.edges?.map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.name.full,
      character: edge.role,
      profile_path: edge.node.image?.large,
    })) || []

    const videos: any[] = []
    if (media.trailer && media.trailer.site === 'youtube') {
      videos.push({
        id: media.trailer.id,
        key: media.trailer.id,
        name: 'Trailer',
        site: 'YouTube',
        type: 'Trailer'
      })
    }

    return {
      ...item,
      number_of_seasons: 1,
      number_of_episodes: episodesCount,
      genres: media.genres?.map((g: string, i: number) => ({ id: i, name: g })) || [],
      seasons: [seasonSummary],
      credits: { cast },
      videos: { results: videos },
      streamingEpisodes,
    }
  })()

  animeDetailsCache.set(id, promise)
  promise.catch(() => animeDetailsCache.delete(id))

  return promise
}


export function generateAnimeSeasonDetails(
  id: string,
  episodesCount: number,
  streamingEps?: AnilistStreamingEpisode[]
) {
  // Use the larger of declared episodes vs known streaming episodes
  const total = Math.max(episodesCount, streamingEps?.length ?? 0)

  const episodes = Array.from({ length: total }, (_, i) => {
    const epNum = i + 1
    const streamEp = streamingEps?.[i]
    return {
      id: i + 1,
      episode_number: epNum,
      // Use real episode title if available, otherwise "Episode N"
      name: streamEp?.title?.trim() ? streamEp.title.trim() : `Episode ${epNum}`,
      overview: '',
      runtime: 24,
      // thumbnail is a full URL — imageUrl() handles full URLs as-is
      still_path: streamEp?.thumbnail || null,
    }
  })

  return {
    id: parseInt(id, 10),
    name: 'Season 1',
    overview: '',
    episodes,
  }
}
