/**
 * Milestone badge auto-award logic.
 *
 * SQL migration required (run in Supabase SQL editor):
 * ─────────────────────────────────────────────────────
 * -- Allow milestone badge types in user_badges
 * -- (no schema change needed — badge_type is text)
 *
 * -- Make sure RLS INSERT policy exists for user's own rows:
 * -- ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;
 * -- CREATE POLICY "users can insert own badges" ON user_badges
 * --   FOR INSERT WITH CHECK (auth.uid() = user_id);
 * ─────────────────────────────────────────────────────
 */

import { awardBadge } from './supabase'
import type { BadgeType, UserBadge } from './supabase'

// ─── Types ────────────────────────────────────────────────────

export type MilestoneBadgeId = Extract<
  BadgeType,
  | 'hours_10' | 'hours_100' | 'hours_250' | 'hours_500'
  | 'movies_1' | 'movies_5' | 'movies_10'
  | 'shows_1' | 'shows_5' | 'shows_10'
>

interface WatchEntry {
  mediaType: string
  watchedAt?: number
}

interface MilestoneCheck {
  id: MilestoneBadgeId
  check: (ctx: MilestoneContext) => boolean
}

interface MilestoneContext {
  watchedHours: number
  movieCount: number
  uniqueShowIds: number
}

// ─── Milestone definitions ─────────────────────────────────────

const MILESTONE_CHECKS: MilestoneCheck[] = [
  { id: 'hours_10',  check: c => c.watchedHours >= 10 },
  { id: 'hours_100', check: c => c.watchedHours >= 100 },
  { id: 'hours_250', check: c => c.watchedHours >= 250 },
  { id: 'hours_500', check: c => c.watchedHours >= 500 },
  { id: 'movies_1',  check: c => c.movieCount >= 1 },
  { id: 'movies_5',  check: c => c.movieCount >= 5 },
  { id: 'movies_10', check: c => c.movieCount >= 10 },
  { id: 'shows_1',   check: c => c.uniqueShowIds >= 1 },
  { id: 'shows_5',   check: c => c.uniqueShowIds >= 5 },
  { id: 'shows_10',  check: c => c.uniqueShowIds >= 10 },
]

// ─── Calculate watch streak ────────────────────────────────────

/**
 * Calculate the current watch streak (in days) from a list of history entries.
 * A streak continues as long as the user watched on consecutive days.
 * Watching today OR yesterday counts as an active streak (so you don't lose it
 * just because you haven't watched yet today).
 */
export function calculateStreak(history: { watchedAt?: number }[]): number {
  if (!history.length) return 0

  // Collect unique calendar dates (local time YYYY-MM-DD)
  const dates = new Set<string>()
  for (const entry of history) {
    if (!entry.watchedAt) continue
    const d = new Date(entry.watchedAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    dates.add(key)
  }

  function toKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  function addDays(d: Date, n: number): Date {
    const r = new Date(d)
    r.setDate(r.getDate() + n)
    return r
  }

  const today = new Date()
  const todayKey = toKey(today)
  const yesterdayKey = toKey(addDays(today, -1))

  // Streak must start from today or yesterday
  if (!dates.has(todayKey) && !dates.has(yesterdayKey)) return 0

  let streak = 0
  let cursor = dates.has(todayKey) ? today : addDays(today, -1)

  while (dates.has(toKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }

  return streak
}

// ─── Check and award milestones ────────────────────────────────

/**
 * Check which milestones the user has earned and award any new ones.
 * Call this when the user views their own profile.
 *
 * @param userId         Supabase auth user ID
 * @param watchHistory   User's watch_history array from their profile
 * @param watchProgress  User's watch_progress map (key → seconds)
 * @param existingBadges Already awarded badge rows
 * @returns Array of newly awarded badge IDs
 */
export async function checkAndAwardMilestones(
  userId: string,
  watchHistory: WatchEntry[],
  watchProgress: Record<string, number>,
  existingBadges: UserBadge[],
): Promise<MilestoneBadgeId[]> {
  // Calculate context values
  const totalSeconds = Object.entries(watchProgress)
    .filter(([k]) => !k.includes(':duration'))
    .reduce((sum, [, v]) => sum + v, 0)
  const watchedHours = totalSeconds / 3600

  const movieCount = new Set(
    watchHistory
      .filter(e => e.mediaType === 'movie')
      .map(e => (e as any).id)
  ).size

  const uniqueShowIds = new Set(
    watchHistory
      .filter(e => e.mediaType === 'tv' || e.mediaType === 'anime')
      .map(e => (e as any).id)
  ).size

  const ctx: MilestoneContext = { watchedHours, movieCount, uniqueShowIds }

  // Log what we're working with to make debugging easier
  console.info('[milestones] context:', {
    watchedHours: watchedHours.toFixed(1),
    movieCount,
    uniqueShowIds,
    existingBadgeCount: existingBadges.length,
  })

  // Determine which milestone badge IDs the user already has
  const already = new Set(existingBadges.map(b => b.badge_type))

  const awarded: MilestoneBadgeId[] = []
  const errors: string[] = []

  for (const m of MILESTONE_CHECKS) {
    if (already.has(m.id)) continue
    if (!m.check(ctx)) continue
    try {
      await awardBadge(userId, m.id)
      awarded.push(m.id)
      console.info(`[milestones] awarded: ${m.id}`)
    } catch (err: any) {
      // Surface the real Supabase error message so it's visible in the console
      const msg = err?.message ?? String(err)
      console.error(`[milestones] failed to award ${m.id}: ${msg}`)
      errors.push(`${m.id}: ${msg}`)
    }
  }

  if (errors.length > 0) {
    // Throw with a combined message so the UI can show it
    throw new Error(errors.join(' | '))
  }

  return awarded
}
