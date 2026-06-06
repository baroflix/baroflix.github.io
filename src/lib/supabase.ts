import { createClient } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// Environment variables (set in .env)
// ─────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your .env file.'
  )
}

// ─────────────────────────────────────────────────────────────
// Supabase client (singleton)
// ─────────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─────────────────────────────────────────────────────────────
// Badge system
// ─────────────────────────────────────────────────────────────

export type BadgeType = 'owner' | 'developer' | 'beta_tester'

export const BADGE_CONFIG: Record<BadgeType, {
  label: string
  color: string
  bg: string
  border: string
  emoji: string
  priority: number
}> = {
  owner: {
    label: 'Owner',
    color: '#FFD700',
    bg: 'rgba(255,215,0,0.15)',
    border: 'rgba(255,215,0,0.4)',
    emoji: '👑',
    priority: 3,
  },
  developer: {
    label: 'Developer',
    color: '#60A5FA',
    bg: 'rgba(96,165,250,0.15)',
    border: 'rgba(96,165,250,0.4)',
    emoji: '⚙️',
    priority: 2,
  },
  beta_tester: {
    label: 'Beta Tester',
    color: '#C084FC',
    bg: 'rgba(192,132,252,0.15)',
    border: 'rgba(192,132,252,0.4)',
    emoji: '🧪',
    priority: 1,
  },
}

/** Returns the highest-priority badge from a list of badge objects */
export function getHighestBadge(badges: { badge_type: string }[]): BadgeType | null {
  if (!badges?.length) return null
  const valid = badges
    .map(b => b.badge_type as BadgeType)
    .filter(t => t in BADGE_CONFIG)
  if (!valid.length) return null
  return valid.sort((a, b) => BADGE_CONFIG[b].priority - BADGE_CONFIG[a].priority)[0]
}

// ─────────────────────────────────────────────────────────────
// TypeScript domain types
// ─────────────────────────────────────────────────────────────

/** An item a user has pinned to their public profile */
export interface PinnedItem {
  mediaType: 'movie' | 'tv' | 'anime'
  id: number
  title: string
  posterPath: string | null
}

/** Row in public.user_badges */
export interface UserBadge {
  id: string
  user_id: string
  badge_type: BadgeType
  awarded_at: string
}

/** Row in public.profiles */
export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
  theme: string | null
  language: string | null
  watch_history: any[] | null
  watch_progress: Record<string, number> | null
  watchlist: any[] | null
  ratings: Record<string, number> | null
  custom_lists: any[] | null
  visit_count: number | null
  updated_at: string | null
  // Public profile fields
  full_name: string | null
  country: string | null
  banner_url: string | null
  bio: string | null
  is_public: boolean | null
  pinned_items: PinnedItem[] | null
  created_at: string | null
}

/** Profile row with badges joined */
export type ProfileWithBadges = Profile & {
  user_badges: UserBadge[]
}

/** Row in public.comments (with joined profile data — badges fetched separately) */
export interface Comment {
  id: string
  movie_id: string
  user_id: string
  content: string
  created_at: string
  profiles: {
    username: string | null
    avatar_url: string | null
  } | null
}

/** Row in public.allowed_emails */
export interface AllowedEmail {
  email: string
}

// ─────────────────────────────────────────────────────────────
// Follow system
// ─────────────────────────────────────────────────────────────

/** Row in public.follows */
export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

/** Returns { followers, following } counts for a user */
export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followerRes, followingRes] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
  ])
  return { followers: followerRes.count ?? 0, following: followingRes.count ?? 0 }
}

/** Check if followerId is following followingId */
export async function checkIsFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle()
  return !!data
}

/** Follow a user (followerId follows followingId) */
export async function followUser(followerId: string, followingId: string): Promise<void> {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })
}

/** Unfollow a user */
export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await supabase.from('follows').delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
}

const FOLLOW_PROFILE_FIELDS =
  'id, username, avatar_url, full_name, country, is_public'

// ─────────────────────────────────────────────────────────────
// Internal badge helper — always a flat, separate query
// (avoids PostgREST nested-join 403 issues with user_badges RLS)
// ─────────────────────────────────────────────────────────────
async function fetchBadgesForIds(userIds: string[]): Promise<Record<string, UserBadge[]>> {
  if (!userIds.length) return {}
  const { data } = await supabase
    .from('user_badges')
    .select('id, user_id, badge_type, awarded_at')
    .in('user_id', userIds)
  const map: Record<string, UserBadge[]> = {}
  for (const b of (data ?? []) as UserBadge[]) {
    if (!map[b.user_id]) map[b.user_id] = []
    map[b.user_id].push(b)
  }
  return map
}

/** Fetch badges for a single user (used by CommentsSection) */
export async function fetchBadgesForUsers(userIds: string[]): Promise<Record<string, UserBadge[]>> {
  return fetchBadgesForIds(userIds)
}

/** Returns list of profiles that follow userId */
export async function getFollowersList(userId: string): Promise<ProfileWithBadges[]> {
  const { data: rows } = await supabase
    .from('follows').select('follower_id').eq('following_id', userId)
  if (!rows?.length) return []
  const ids = rows.map((r: any) => r.follower_id)
  const { data: profiles } = await supabase
    .from('profiles').select(FOLLOW_PROFILE_FIELDS).in('id', ids)
  if (!profiles?.length) return []
  const badgesMap = await fetchBadgesForIds(ids)
  return profiles.map((p: any) => ({ ...p, user_badges: badgesMap[p.id] ?? [] })) as ProfileWithBadges[]
}

/** Returns list of profiles that userId is following */
export async function getFollowingList(userId: string): Promise<ProfileWithBadges[]> {
  const { data: rows } = await supabase
    .from('follows').select('following_id').eq('follower_id', userId)
  if (!rows?.length) return []
  const ids = rows.map((r: any) => r.following_id)
  const { data: profiles } = await supabase
    .from('profiles').select(FOLLOW_PROFILE_FIELDS).in('id', ids)
  if (!profiles?.length) return []
  const badgesMap = await fetchBadgesForIds(ids)
  return profiles.map((p: any) => ({ ...p, user_badges: badgesMap[p.id] ?? [] })) as ProfileWithBadges[]
}

// ─────────────────────────────────────────────────────────────
// Profile query helpers
// ─────────────────────────────────────────────────────────────

/** Search public profiles by username (case-insensitive, up to 12 results) */
export async function searchProfiles(query: string): Promise<ProfileWithBadges[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url, full_name, country, is_public, theme')
    .ilike('username', `%${query}%`)
    .not('username', 'is', null)
    .limit(12)
  const profiles = ((data ?? []) as any[]).filter(p => p.is_public !== false)
  if (!profiles.length) return []
  const badgesMap = await fetchBadgesForIds(profiles.map((p: any) => p.id))
  return profiles.map((p: any) => ({ ...p, user_badges: badgesMap[p.id] ?? [] })) as ProfileWithBadges[]
}

/** Fetch a full profile by username (for the public profile page) */
export async function fetchPublicProfile(username: string): Promise<ProfileWithBadges | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .maybeSingle()
  if (!profile) return null
  const badgesMap = await fetchBadgesForIds([profile.id])
  return { ...profile, user_badges: badgesMap[profile.id] ?? [] } as ProfileWithBadges
}
