/**
 * Pre-compute Monte Carlo predictions for every game in schedule.json.
 *
 * Usage:
 *   npm run fetch-schedule   # optional: refresh slate from ESPN
 *   npm run precompute
 *
 * Reads:  src/data/teams.json, src/data/schedule.json
 * Writes: src/data/predictions.json
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_SIMULATIONS,
  HOME_FIELD_ADVANTAGE,
  simulateGame,
} from "../src/lib/simulation";
import type {
  GamePrediction,
  PredictionsFile,
  ScheduleFile,
  TeamsFile,
} from "../src/lib/types";

const ROOT = join(__dirname, "..");
const DATA = join(ROOT, "src", "data");

/** Deterministic PRNG (mulberry32) so re-runs with same inputs stay stable. */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function main() {
  console.log("Loading teams + ESPN schedule…");
  const teamsFile: TeamsFile = JSON.parse(
    readFileSync(join(DATA, "teams.json"), "utf-8")
  );
  const scheduleFile: ScheduleFile = JSON.parse(
    readFileSync(join(DATA, "schedule.json"), "utf-8")
  );

  const teamById = new Map(teamsFile.teams.map((t) => [t.id, t]));
  const leagueAvg = teamsFile.leagueAvgPpg;
  const games = scheduleFile.games;

  console.log(`  ${teamsFile.teams.length} teams, ${games.length} games`);
  console.log(
    `Running ${DEFAULT_SIMULATIONS.toLocaleString()} Monte Carlo sims per game…`
  );

  const predictions: GamePrediction[] = [];
  const t0 = Date.now();

  for (let i = 0; i < games.length; i++) {
    const g = games[i]!;
    const home = teamById.get(g.homeTeamId);
    const away = teamById.get(g.awayTeamId);
    if (!home || !away) {
      throw new Error(
        `Missing team for game ${g.id} (${g.awayTeamId} @ ${g.homeTeamId})`
      );
    }

    let seed = 0;
    for (let c = 0; c < g.id.length; c++) {
      seed = (seed * 31 + g.id.charCodeAt(c)) >>> 0;
    }
    const rng = mulberry32(seed ^ 0x2026);

    predictions.push(
      simulateGame(g.id, home, away, {
        simulations: DEFAULT_SIMULATIONS,
        homeFieldAdvantage: HOME_FIELD_ADVANTAGE,
        leagueAvgPpg: leagueAvg,
        sampleTopN: 10,
        rng,
      })
    );

    if ((i + 1) % 32 === 0 || i === games.length - 1) {
      console.log(`  … ${i + 1}/${games.length}`);
    }
  }

  const out: PredictionsFile = {
    meta: {
      season: 2026,
      label: "NFL Edge Simulator 2026",
      currentWeek: 1,
      totalGames: games.length,
      simulationsPerGame: DEFAULT_SIMULATIONS,
      homeFieldAdvantage: HOME_FIELD_ADVANTAGE,
      leagueAvgPpg: leagueAvg,
      generatedAt: new Date().toISOString(),
      disclaimer:
        "For entertainment and educational purposes only. Not gambling advice.",
    },
    predictions,
  };

  writeFileSync(join(DATA, "predictions.json"), JSON.stringify(out, null, 2));
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`Wrote src/data/predictions.json in ${secs}s`);
  console.log("Done. Restart or refresh `npm run dev` if it is already running.");
}

main();
