/**
 * Matchup-specific What-if hints from published ratings.
 * Points at the biggest uncertainties (injuries, 3-game noise, venue)
 * rather than a generic "try lockdown D" for every game.
 */

import type { Team } from "./types";
import type { WhatIfPresetId } from "./what-if-presets";

const NEUTRAL_VENUE =
  /london|wembley|tottenham|munich|berlin|frankfurt|mexico|azteca|melbourne|sao paulo|maracan|dublin|international/i;

const OFFENSE_DROP = 4;
const DEFENSE_LUCK = 4;
const HOT_OFFENSE = 4;

export interface WhatIfSuggestion {
  id: string;
  /** Preset to apply, or null for an informational warning. */
  presetId: WhatIfPresetId | null;
  headline: string;
  reason: string;
  score: number;
}

function ytdOff(t: Team): number | null {
  return t.currentOffensePpg ?? null;
}
function ytdDef(t: Team): number | null {
  return t.currentDefensePapg ?? null;
}

export function getWhatIfSuggestions(opts: {
  home: Team;
  away: Team;
  leagueAvgPpg: number;
  venue?: string;
  limit?: number;
}): WhatIfSuggestion[] {
  const { home, away, leagueAvgPpg, venue, limit = 2 } = opts;
  const scored: WhatIfSuggestion[] = [];

  const push = (s: WhatIfSuggestion) => scored.push(s);

  if (home.ratingNote) {
    push({
      id: "home-board-note",
      presetId: null,
      headline: `Published board already adjusts ${home.abbreviation}`,
      reason: `${home.ratingNote} Skip Home injury unless you want an extra cut on top of that.`,
      score: 100,
    });
  }
  if (away.ratingNote) {
    push({
      id: "away-board-note",
      presetId: null,
      headline: `Published board already adjusts ${away.abbreviation}`,
      reason: `${away.ratingNote} Skip Away injury unless you want an extra cut on top of that.`,
      score: 100,
    });
  }

  const homeOffNow = ytdOff(home);
  const awayOffNow = ytdOff(away);
  if (
    !home.ratingNote &&
    home.priorOffensePpg != null &&
    homeOffNow != null &&
    (home.gamesPlayed ?? 0) >= 2 &&
    home.priorOffensePpg - homeOffNow >= OFFENSE_DROP
  ) {
    push({
      id: "home-injury",
      presetId: "home-injury",
      headline: `Consider Home injury`,
      reason: `${home.abbreviation} is scoring ${homeOffNow.toFixed(1)} PPG this year vs ${home.priorOffensePpg.toFixed(1)} last season. The blend still leans on 2025. Home injury tests a bigger drop.`,
      score: 85,
    });
  }
  if (
    !away.ratingNote &&
    away.priorOffensePpg != null &&
    awayOffNow != null &&
    (away.gamesPlayed ?? 0) >= 2 &&
    away.priorOffensePpg - awayOffNow >= OFFENSE_DROP
  ) {
    push({
      id: "away-injury",
      presetId: "away-injury",
      headline: `Consider Away injury`,
      reason: `${away.abbreviation} is scoring ${awayOffNow.toFixed(1)} PPG this year vs ${away.priorOffensePpg.toFixed(1)} last season. Away injury tests a bigger drop.`,
      score: 85,
    });
  }

  const homeDefNow = ytdDef(home);
  const awayDefNow = ytdDef(away);
  if (
    home.priorDefensePapg != null &&
    homeDefNow != null &&
    (home.gamesPlayed ?? 0) >= 2 &&
    home.priorDefensePapg - homeDefNow >= DEFENSE_LUCK
  ) {
    push({
      id: "home-d-noise",
      presetId: null,
      headline: `Skip Home lockdown D for ${home.abbreviation}`,
      reason: `${home.abbreviation} has allowed ${homeDefNow.toFixed(1)} PPG in ${home.gamesPlayed} games vs ${home.priorDefensePapg.toFixed(1)} last year. Lockdown D would make that unit even stronger. If you think 2026 is noise, open Adjust rates and raise Home PAPG toward ${home.priorDefensePapg.toFixed(1)}.`,
      score: 90,
    });
  } else if (
    home.priorDefensePapg != null &&
    homeDefNow != null &&
    homeDefNow - home.priorDefensePapg >= DEFENSE_LUCK
  ) {
    push({
      id: "home-lockdown-rebound",
      presetId: "home-lockdown",
      headline: `Consider Home lockdown D`,
      reason: `${home.abbreviation} has allowed ${homeDefNow.toFixed(1)} PPG vs ${home.priorDefensePapg.toFixed(1)} last year. Lockdown D asks what if the unit tightens.`,
      score: 75,
    });
  }

  if (
    away.priorDefensePapg != null &&
    awayDefNow != null &&
    (away.gamesPlayed ?? 0) >= 2 &&
    away.priorDefensePapg - awayDefNow >= DEFENSE_LUCK
  ) {
    push({
      id: "away-d-noise",
      presetId: null,
      headline: `Skip Away lockdown D for ${away.abbreviation}`,
      reason: `${away.abbreviation} has allowed ${awayDefNow.toFixed(1)} PPG in ${away.gamesPlayed} games vs ${away.priorDefensePapg.toFixed(1)} last year. If that's a small sample, don't make Away D even stronger.`,
      score: 88,
    });
  }

  if (
    away.offensePpg >= leagueAvgPpg + HOT_OFFENSE &&
    home.defensePapg >= leagueAvgPpg - 1
  ) {
    push({
      id: "contain-away",
      presetId: "home-lockdown",
      headline: `Consider Home lockdown D`,
      reason: `${away.abbreviation} scores ${away.offensePpg.toFixed(1)} PPG (league ${leagueAvgPpg.toFixed(1)}). Home lockdown D asks whether ${home.abbreviation} can hold them down.`,
      score: 70,
    });
  }
  if (
    home.offensePpg >= leagueAvgPpg + HOT_OFFENSE &&
    away.defensePapg >= leagueAvgPpg - 1
  ) {
    push({
      id: "contain-home",
      presetId: "away-lockdown",
      headline: `Consider Away lockdown D`,
      reason: `${home.abbreviation} scores ${home.offensePpg.toFixed(1)} PPG. Away lockdown D asks whether ${away.abbreviation} can contain that offense.`,
      score: 70,
    });
  }

  if (
    home.offensePpg >= leagueAvgPpg + 2 &&
    away.offensePpg >= leagueAvgPpg + 2
  ) {
    push({
      id: "shootout",
      presetId: "shootout",
      headline: `Consider Shootout`,
      reason: `Both offenses sit above the league (${home.abbreviation} ${home.offensePpg.toFixed(1)}, ${away.abbreviation} ${away.offensePpg.toFixed(1)}).`,
      score: 60,
    });
  } else if (
    home.offensePpg <= leagueAvgPpg - 2 &&
    away.offensePpg <= leagueAvgPpg - 2
  ) {
    push({
      id: "grind",
      presetId: "defensive-struggle",
      headline: `Consider Defensive struggle`,
      reason: `Both offenses sit below the league (${home.abbreviation} ${home.offensePpg.toFixed(1)}, ${away.abbreviation} ${away.offensePpg.toFixed(1)}).`,
      score: 60,
    });
  }

  if (venue && NEUTRAL_VENUE.test(venue)) {
    push({
      id: "neutral",
      presetId: "neutral-site",
      headline: `Consider Neutral site`,
      reason: `This is listed at ${venue}. Neutral site sets home-field advantage to 0.`,
      score: 80,
    });
  }

  scored.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  const seen = new Set<string>();
  const unique: WhatIfSuggestion[] = [];
  for (const s of scored) {
    const key = s.presetId ?? s.id;
    if (seen.has(key) && s.presetId) continue;
    seen.add(key);
    unique.push(s);
    if (unique.length >= limit) break;
  }
  return unique;
}
