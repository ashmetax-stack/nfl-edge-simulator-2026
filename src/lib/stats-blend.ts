/**
 * Season-to-date blend for team scoring rates.
 *
 * Early-season raw PPG/PAPG is noisy. We shrink current-year averages
 * toward the prior season until enough games have been played.
 *
 *   weight = min(1, gamesPlayed / FULL_WEIGHT_GAMES)
 *   blended = weight * current + (1 - weight) * prior
 */

/** Games needed before current-season rates get 100% weight. */
export const FULL_WEIGHT_GAMES = 8;

export function blendWeight(gamesPlayed: number): number {
  if (gamesPlayed <= 0) return 0;
  return Math.min(1, gamesPlayed / FULL_WEIGHT_GAMES);
}

export function blendRate(
  prior: number,
  current: number | null | undefined,
  gamesPlayed: number
): number {
  const w = blendWeight(gamesPlayed);
  if (w === 0 || current == null || Number.isNaN(current)) {
    return round1(prior);
  }
  return round1(w * current + (1 - w) * prior);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
