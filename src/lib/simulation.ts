/**
 * Monte Carlo + Poisson scoring model for NFL game predictions.
 *
 * Model summary:
 * 1. Convert each team's offense PPG and opponent defense PAPG into expected
 *    points (Poisson λ) for home and away, with a small home-field boost.
 * 2. Draw homeScore ~ Poisson(λ_home) and awayScore ~ Poisson(λ_away)
 *    many times (default 10,000).
 * 3. Aggregate mean scores, total, spread (home perspective), and win probs.
 *
 * Pre-compute once via `npm run precompute` — pages only read JSON.
 */

import type { GamePrediction, SampleOutcome, Team } from "./types";

export const DEFAULT_SIMULATIONS = 10_000;
/** Points added to home λ for home-field advantage (league-average style). */
export const HOME_FIELD_ADVANTAGE = 2.4;

/**
 * Sample a Poisson random variable using Knuth's algorithm for moderate λ,
 * which is fine for NFL scoring rates (~15–35 points).
 */
export function samplePoisson(lambda: number, rng: () => number = Math.random): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= rng();
  } while (p > L);
  return k - 1;
}

/**
 * Expected points for a side:
 *   λ = (ownOffense * oppDefense / leagueAvg) * multipliers + HFA(if home)
 *
 * offensePpg high + opponent defensePapg high ⇒ more points scored.
 */
export function expectedPoints(
  offense: Team,
  defense: Team,
  leagueAvgPpg: number,
  isHome: boolean,
  homeFieldAdvantage = HOME_FIELD_ADVANTAGE
): number {
  const offMult = offense.offenseMultiplier ?? 1;
  const defMult = defense.defenseMultiplier ?? 1;

  // Defense multiplier > 1 means we treat defense as weaker (allows more points).
  const raw =
    ((offense.offensePpg * offMult) * (defense.defensePapg * defMult)) /
    Math.max(leagueAvgPpg, 1);

  const withHfa = isHome ? raw + homeFieldAdvantage : raw;
  // Clamp to a sensible NFL range so extreme overrides don't break the model.
  return Math.min(Math.max(withHfa, 6), 48);
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Build a short betting-style interpretation from home win probability.
 * Spread is home-perspective (negative = home favorite).
 */
export function interpretFavorite(
  homeWinProb: number,
  predictedSpread: number,
  homeAbbr: string,
  awayAbbr: string
): string {
  const homeFav = predictedSpread < 0;
  const favAbbr = homeFav ? homeAbbr : awayAbbr;
  const dogAbbr = homeFav ? awayAbbr : homeAbbr;
  const mag = Math.abs(predictedSpread);
  const winPct = Math.round((homeFav ? homeWinProb : 1 - homeWinProb) * 100);

  let strength: string;
  if (mag < 1.5) strength = "a slight favorite";
  else if (mag < 3.5) strength = "a mild favorite";
  else if (mag < 6.5) strength = "a moderate favorite";
  else if (mag < 10) strength = "a solid favorite";
  else strength = "a heavy favorite";

  const side = homeFav ? "Home" : "Away";
  return `${side} team ${favAbbr} is ${strength} (${winPct}% win probability, ${mag.toFixed(1)}-point edge over ${dogAbbr}).`;
}

export interface SimulateOptions {
  simulations?: number;
  homeFieldAdvantage?: number;
  leagueAvgPpg: number;
  /** How many distinct sample scorelines to keep for the detail page */
  sampleTopN?: number;
  /** Optional seeded RNG for reproducibility in tests */
  rng?: () => number;
}

/**
 * Run Monte Carlo simulation for one matchup and return a full prediction object.
 */
export function simulateGame(
  gameId: string,
  home: Team,
  away: Team,
  options: SimulateOptions
): GamePrediction {
  const sims = options.simulations ?? DEFAULT_SIMULATIONS;
  const hfa = options.homeFieldAdvantage ?? HOME_FIELD_ADVANTAGE;
  const sampleTopN = options.sampleTopN ?? 8;
  const rng = options.rng ?? Math.random;

  const lambdaHome = expectedPoints(home, away, options.leagueAvgPpg, true, hfa);
  const lambdaAway = expectedPoints(away, home, options.leagueAvgPpg, false, hfa);

  let homeWins = 0;
  let awayWins = 0;
  let ties = 0;
  let sumHome = 0;
  let sumAway = 0;
  const margins: number[] = [];
  const outcomeCounts = new Map<string, number>();

  for (let i = 0; i < sims; i++) {
    const hs = samplePoisson(lambdaHome, rng);
    const as = samplePoisson(lambdaAway, rng);
    sumHome += hs;
    sumAway += as;
    // Home margin of victory (positive = home wins by that many)
    margins.push(hs - as);

    if (hs > as) homeWins += 1;
    else if (as > hs) awayWins += 1;
    else ties += 1;

    const key = `${hs}-${as}`;
    outcomeCounts.set(key, (outcomeCounts.get(key) ?? 0) + 1);
  }

  const predictedHomeScore = sumHome / sims;
  const predictedAwayScore = sumAway / sims;
  const predictedTotal = predictedHomeScore + predictedAwayScore;

  // Betting spread convention: home perspective, negative = home favorite.
  // We use negative median home margin so "spread = -3.5" means home -3.5.
  const sortedMargins = [...margins].sort((a, b) => a - b);
  const medianHomeMargin = median(sortedMargins);
  const predictedSpread = -medianHomeMargin;

  // Split ties 50/50 for "win probability" display (common sportsbook style).
  const homeWinProb = (homeWins + ties * 0.5) / sims;
  const awayWinProb = (awayWins + ties * 0.5) / sims;
  const tieProb = ties / sims;

  const sampleOutcomes: SampleOutcome[] = [...outcomeCounts.entries()]
    .map(([key, count]) => {
      const [h, a] = key.split("-").map(Number) as [number, number];
      return {
        homeScore: h,
        awayScore: a,
        count,
        pct: (count / sims) * 100,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, sampleTopN);

  const interpretation = interpretFavorite(
    homeWinProb,
    predictedSpread,
    home.abbreviation,
    away.abbreviation
  );

  return {
    gameId,
    predictedHomeScore: round1(predictedHomeScore),
    predictedAwayScore: round1(predictedAwayScore),
    predictedSpread: round1(predictedSpread),
    predictedTotal: round1(predictedTotal),
    homeWinProb: round4(homeWinProb),
    awayWinProb: round4(awayWinProb),
    tieProb: round4(tieProb),
    lambdaHome: round2(lambdaHome),
    lambdaAway: round2(lambdaAway),
    simulations: sims,
    sampleOutcomes,
    interpretation,
    generatedAt: new Date().toISOString(),
  };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
