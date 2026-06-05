export type MediaKind = 'movie' | 'tv' | 'anime'

export interface MediaItem {
  id: number
  media_type?: MediaKind | 'person'
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
  original_language?: string
}

export interface CastMember {
  id: number
  name: string
  character?: string
  profile_path?: string | null
}

export interface VideoItem {
  id: string
  key: string
  name: string
  site: string
  type: string
  official?: boolean
}

export interface SeasonEpisode {
  id: number
  episode_number: number
  name: string
  overview: string
  still_path?: string | null
  runtime?: number
  vote_average?: number
}

export interface SeasonSummary {
  id: number
  season_number: number
  name: string
  air_date?: string
  episode_count: number
  overview?: string
  poster_path?: string | null
}

export interface MediaDetails extends MediaItem {
  /** MyAnimeList ID — present on anime fetched from AniList */
  idMal?: number | null
  images?: {
    logos?: Array<{
      file_path?: string | null
      vote_average?: number
    }>
  }
  external_ids?: {
    imdb_id?: string | null
  }
  status?: string
  runtime?: number
  budget?: number
  revenue?: number
  number_of_seasons?: number
  number_of_episodes?: number
  last_air_date?: string
  genres?: Array<{ id: number; name: string }>
  seasons?: SeasonSummary[]
  credits?: { cast: CastMember[] }
  videos?: { results: VideoItem[] }
  recommendations?: { results: MediaItem[] }
}

export interface SeasonDetails {
  id: number
  name: string
  overview: string
  air_date?: string
  episodes: SeasonEpisode[]
}

export interface PersonDetails {
  id: number
  name: string
  biography: string
  profile_path?: string | null
  known_for_department?: string
  place_of_birth?: string | null
  birthday?: string | null
  deathday?: string | null
  combined_credits?: {
    cast: MediaItem[]
  }
}

export interface CollectionDetails {
  id: number
  name: string
  overview: string
  poster_path?: string | null
  backdrop_path?: string | null
  parts: MediaItem[]
}