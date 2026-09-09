/**
 * Server-side data accessors. Import JSON statically so Next can bundle
 * predictions at build time — no simulation work on page load.
 */

import teamsFile from "@/data/teams.json";
import scheduleFile from "@/data/schedule.json";
import predictionsFile from "@/data/predictions.json";
import type {
  Game,
  GamePrediction,
  GameWithPrediction,
  SeasonMeta,
  Team,
  TeamStatsMeta,
  TeamsFile,
} from "./types";

const teamsData = teamsFile as TeamsFile;
const teams = teamsData.teams as Team[];
const games = scheduleFile.games as Game[];
const predictions = predictionsFile.predictions as GamePrediction[];
const meta = predictionsFile.meta as SeasonMeta;

const teamById = new Map(teams.map((t) => [t.id, t]));
const gameById = new Map(games.map((g) => [g.id, g]));
const predictionByGameId = new Map(predictions.map((p) => [p.gameId, p]));

export function getMeta(): SeasonMeta {
  return meta;
}

export function getLeagueAvgPpg(): number {
  return teamsData.leagueAvgPpg;
}

/** Provenance for blended team ratings (ESPN pipeline). */
export function getTeamStatsMeta(): TeamStatsMeta | undefined {
  return teamsData.statsMeta;
}

/** Human-readable ratings freshness for badges. */
export function getRatingsBadgeText(): string {
  const sm = teamsData.statsMeta;
  if (!sm) return "Team ratings: manual / not yet synced";
  const when = new Date(sm.statsAsOf).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (sm.statsWeek == null || sm.gamesPlayedMax <= 0) {
    return `Ratings: ${sm.priorSeason} full-season rates`;
  }
  return `Ratings as of Week ${sm.statsWeek} · ${sm.currentSeason} YTD blended · ${when}`;
}

export function getAllTeams(): Team[] {
  return [...teams].sort((a, b) => a.city.localeCompare(b.city));
}

export function getTeam(id: string): Team | undefined {
  return teamById.get(id);
}

export function getAllGames(): Game[] {
  return games;
}

export function getGame(id: string): Game | undefined {
  return gameById.get(id);
}

export function getPrediction(gameId: string): GamePrediction | undefined {
  return predictionByGameId.get(gameId);
}

/** Join schedule + teams + precomputed predictions for UI tables. */
export function getGamesWithPredictions(): GameWithPrediction[] {
  return games
    .map((game) => {
      const homeTeam = teamById.get(game.homeTeamId);
      const awayTeam = teamById.get(game.awayTeamId);
      const prediction = predictionByGameId.get(game.id);
      if (!homeTeam || !awayTeam || !prediction) return null;
      return { game, homeTeam, awayTeam, prediction };
    })
    .filter((x): x is GameWithPrediction => x !== null);
}

export function getGameWithPrediction(
  id: string
): GameWithPrediction | undefined {
  return getGamesWithPredictions().find((g) => g.game.id === id);
}

export function getGamesByWeek(week: number): GameWithPrediction[] {
  return getGamesWithPredictions().filter((g) => g.game.week === week);
}

export function getFeaturedGames(limit = 6): GameWithPrediction[] {
  const week = meta.currentWeek;
  const weekGames = getGamesByWeek(week);
  // Prefer competitive games (win prob closer to 50%) for homepage interest
  return [...weekGames]
    .sort(
      (a, b) =>
        Math.abs(a.prediction.homeWinProb - 0.5) -
        Math.abs(b.prediction.homeWinProb - 0.5)
    )
    .slice(0, limit);
}

export function searchGames(
  query: string,
  week?: number | "all"
): GameWithPrediction[] {
  const q = query.trim().toLowerCase();
  return getGamesWithPredictions().filter((g) => {
    if (week !== undefined && week !== "all" && g.game.week !== week) {
      return false;
    }
    if (!q) return true;
    const hay = [
      g.homeTeam.name,
      g.homeTeam.city,
      g.homeTeam.abbreviation,
      g.awayTeam.name,
      g.awayTeam.city,
      g.awayTeam.abbreviation,
      g.game.id,
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
