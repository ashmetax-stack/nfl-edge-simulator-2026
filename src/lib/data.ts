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

/**
 * Sort key from YYYY-MM-DD + "8:20 PM ET" so lists follow the slate,
 * not JSON insertion or model closeness.
 */
export function gameKickoffSortKey(game: Game): string {
  const match = game.kickoff.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let hours = 0;
  let minutes = 0;
  if (match) {
    hours = Number(match[1]);
    minutes = Number(match[2]);
    const mer = match[3]!.toUpperCase();
    if (mer === "PM" && hours !== 12) hours += 12;
    if (mer === "AM" && hours === 12) hours = 0;
  }
  return `${game.date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Join schedule + teams + predictions, sorted by kickoff. */
export function getGamesWithPredictions(): GameWithPrediction[] {
  return games
    .map((game) => {
      const homeTeam = teamById.get(game.homeTeamId);
      const awayTeam = teamById.get(game.awayTeamId);
      const prediction = predictionByGameId.get(game.id);
      if (!homeTeam || !awayTeam || !prediction) return null;
      return { game, homeTeam, awayTeam, prediction };
    })
    .filter((x): x is GameWithPrediction => x !== null)
    .sort(
      (a, b) =>
        gameKickoffSortKey(a.game).localeCompare(gameKickoffSortKey(b.game)) ||
        a.game.id.localeCompare(b.game.id)
    );
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
  // Earliest kickoff first so the next game on the slate leads the homepage.
  return getGamesByWeek(week).slice(0, limit);
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
