/**
 * Pull team scoring rates from ESPN standings and write src/data/teams.json.
 *
 * - Prior season (default: currentSeason - 1) = full-season baseline
 * - Current season YTD blended in as games accumulate
 * - Blend: weight = min(1, GP / 8) toward current year
 *
 * Usage:
 *   npm run fetch-stats
 *   npm run fetch-stats -- --season 2026
 *   npm run fetch-stats -- --prior 2025 --season 2026
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import {
  FULL_WEIGHT_GAMES,
  blendRate,
  blendWeight,
  round1,
  round2,
} from "../src/lib/stats-blend";
import type { Team, TeamStatsMeta, TeamsFile } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const TEAMS_PATH = join(ROOT, "src", "data", "teams.json");

/** ESPN standings abbreviations → our team ids */
const ESPN_ABBR_TO_ID: Record<string, string> = {
  ARI: "ari",
  ATL: "atl",
  BAL: "bal",
  BUF: "buf",
  CAR: "car",
  CHI: "chi",
  CIN: "cin",
  CLE: "cle",
  DAL: "dal",
  DEN: "den",
  DET: "det",
  GB: "gb",
  HOU: "hou",
  IND: "ind",
  JAX: "jax",
  KC: "kc",
  LAC: "lac",
  LAR: "lar",
  LV: "lv",
  MIA: "mia",
  MIN: "min",
  NE: "ne",
  NO: "no",
  NYG: "nyg",
  NYJ: "nyj",
  PHI: "phi",
  PIT: "pit",
  SEA: "sea",
  SF: "sf",
  TB: "tb",
  TEN: "ten",
  WSH: "was",
  WAS: "was",
};

interface TeamSeasonRates {
  pointsFor: number;
  pointsAgainst: number;
  gamesPlayed: number;
  offensePpg: number;
  defensePapg: number;
}

interface EspnStandingStat {
  name: string;
  value?: number;
  displayValue?: string;
}

interface EspnStandingEntry {
  team: { abbreviation: string; displayName?: string };
  stats: EspnStandingStat[];
}

function parseArgs(argv: string[]) {
  let season = 2026;
  let prior: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--season" && argv[i + 1]) {
      season = Number(argv[++i]);
    } else if (argv[i] === "--prior" && argv[i + 1]) {
      prior = Number(argv[++i]);
    }
  }
  return { season, priorSeason: prior ?? season - 1 };
}

function statValue(stats: EspnStandingStat[], name: string): number {
  const s = stats.find((x) => x.name === name);
  if (!s) return 0;
  if (typeof s.value === "number" && !Number.isNaN(s.value)) return s.value;
  const n = Number(s.displayValue);
  return Number.isNaN(n) ? 0 : n;
}

async function fetchStandingsRates(
  season: number
): Promise<Map<string, TeamSeasonRates>> {
  const url = `https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=${season}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "NFLEdgeSimulator/1.0 (stats-pipeline)" },
  });
  if (!res.ok) {
    throw new Error(`ESPN standings ${season}: HTTP ${res.status}`);
  }

  const data = (await res.json()) as {
    children?: Array<{ standings?: { entries?: EspnStandingEntry[] } }>;
    standings?: { entries?: EspnStandingEntry[] };
  };

  const entries: EspnStandingEntry[] = [];
  if (data.children?.length) {
    for (const child of data.children) {
      for (const e of child.standings?.entries ?? []) entries.push(e);
    }
  } else if (data.standings?.entries) {
    entries.push(...data.standings.entries);
  }

  const map = new Map<string, TeamSeasonRates>();
  for (const entry of entries) {
    const abbr = entry.team.abbreviation;
    const id = ESPN_ABBR_TO_ID[abbr];
    if (!id) {
      console.warn(`  Skipping unknown ESPN abbr: ${abbr}`);
      continue;
    }

    const pointsFor = statValue(entry.stats, "pointsFor");
    const pointsAgainst = statValue(entry.stats, "pointsAgainst");
    const wins = statValue(entry.stats, "wins");
    const losses = statValue(entry.stats, "losses");
    const ties = statValue(entry.stats, "ties");
    let gamesPlayed = wins + losses + ties;

    // Prefer explicit gamesPlayed when present and sensible
    const gpStat = statValue(entry.stats, "gamesPlayed");
    if (gpStat > 0) gamesPlayed = gpStat;

    // Guard: if no games, rates are undefined
    const offensePpg =
      gamesPlayed > 0 ? pointsFor / gamesPlayed : Number.NaN;
    const defensePapg =
      gamesPlayed > 0 ? pointsAgainst / gamesPlayed : Number.NaN;

    map.set(id, {
      pointsFor,
      pointsAgainst,
      gamesPlayed,
      offensePpg,
      defensePapg,
    });
  }

  return map;
}

/**
 * Infer "stats week" from max games played (approx; byes make this imperfect).
 * Preseason / no games → null.
 */
function inferStatsWeek(maxGamesPlayed: number): number | null {
  if (maxGamesPlayed <= 0) return null;
  // With one bye, GP ≈ weeks completed for most teams late season.
  // Cap at 18 for display.
  return Math.min(18, maxGamesPlayed);
}

async function main() {
  const { season, priorSeason } = parseArgs(process.argv.slice(2));
  console.log(
    `Fetching ESPN standings: prior=${priorSeason}, current=${season}…`
  );

  const existing: TeamsFile = JSON.parse(readFileSync(TEAMS_PATH, "utf-8"));
  const priorRates = await fetchStandingsRates(priorSeason);
  const currentRates = await fetchStandingsRates(season);

  if (priorRates.size < 32) {
    throw new Error(
      `Prior season ${priorSeason} only returned ${priorRates.size} teams (need 32)`
    );
  }

  const maxGp = Math.max(
    0,
    ...[...currentRates.values()].map((r) => r.gamesPlayed)
  );
  /**
   * Hall of Fame / exhibition games sometimes appear on ESPN standings
   * before the regular season (e.g. only CAR/ARI with 1 GP). Require at
   * least half the league to have played before blending any YTD rates.
   */
  const teamsWithGames = [...currentRates.values()].filter(
    (r) => r.gamesPlayed > 0
  ).length;
  const seasonUnderway = teamsWithGames >= 16;

  // League-wide blend weight for metadata (mean of team weights)
  let weightSum = 0;

  const updatedTeams: Team[] = existing.teams.map((team) => {
    const prior = priorRates.get(team.id);
    if (!prior || prior.gamesPlayed <= 0 || Number.isNaN(prior.offensePpg)) {
      throw new Error(
        `Missing prior-season rates for ${team.id} (${team.abbreviation})`
      );
    }

    const current = currentRates.get(team.id);
    const gp = seasonUnderway ? (current?.gamesPlayed ?? 0) : 0;
    const useCurrent =
      seasonUnderway &&
      gp > 0 &&
      !!current &&
      !Number.isNaN(current.offensePpg);

    const w = useCurrent ? blendWeight(gp) : 0;
    weightSum += w;

    const offensePpg = blendRate(
      prior.offensePpg,
      useCurrent ? current!.offensePpg : null,
      useCurrent ? gp : 0
    );
    const defensePapg = blendRate(
      prior.defensePapg,
      useCurrent ? current!.defensePapg : null,
      useCurrent ? gp : 0
    );

    return {
      ...team,
      offensePpg,
      defensePapg,
      priorOffensePpg: round1(prior.offensePpg),
      priorDefensePapg: round1(prior.defensePapg),
      currentOffensePpg: useCurrent ? round1(current!.offensePpg) : null,
      currentDefensePapg: useCurrent ? round1(current!.defensePapg) : null,
      gamesPlayed: gp,
      blendWeight: round2(w),
    };
  });

  const leagueAvgPpg = round1(
    updatedTeams.reduce((s, t) => s + t.offensePpg, 0) / updatedTeams.length
  );
  const meanWeight = round2(weightSum / updatedTeams.length);
  const statsWeek = seasonUnderway ? inferStatsWeek(maxGp) : null;
  const gamesPlayedMax = seasonUnderway ? maxGp : 0;

  const statsMeta: TeamStatsMeta = {
    source: "espn",
    priorSeason,
    currentSeason: season,
    statsAsOf: new Date().toISOString(),
    statsWeek,
    gamesPlayedMax,
    blendGamesFullWeight: FULL_WEIGHT_GAMES,
    blendWeightCurrentMean: meanWeight,
    leagueAvgPpg,
    note: !seasonUnderway
      ? `Preseason / regular season not underway (${teamsWithGames} teams with games on ESPN) — using ${priorSeason} full-season rates only.`
      : `Blended ${priorSeason} prior + ${season} YTD (full weight at ${FULL_WEIGHT_GAMES} GP).`,
  };

  const out: TeamsFile = {
    season,
    note:
      "Auto-updated by npm run fetch-stats (ESPN standings). Model uses offensePpg / defensePapg (blended). Re-run precompute after changes.",
    leagueAvgPpg,
    statsMeta,
    teams: updatedTeams,
  };

  writeFileSync(TEAMS_PATH, JSON.stringify(out, null, 2) + "\n");

  console.log(`Wrote ${updatedTeams.length} teams → src/data/teams.json`);
  console.log(`  leagueAvgPpg: ${leagueAvgPpg}`);
  console.log(
    `  season underway: ${seasonUnderway} (${teamsWithGames}/32 teams with games on ESPN)`
  );
  console.log(
    `  max GP used for blend (${season}): ${gamesPlayedMax}` +
      (!seasonUnderway && maxGp > 0
        ? ` (ignored raw ESPN max GP=${maxGp} — likely HOF/exhibition)`
        : "")
  );
  console.log(
    `  mean blend weight toward current: ${meanWeight} (0 = all prior)`
  );
  console.log(`  statsWeek: ${statsWeek ?? "preseason"}`);
  console.log(`  ${statsMeta.note}`);

  // Top / bottom net for a quick sanity check
  const ranked = [...updatedTeams]
    .map((t) => ({
      abbr: t.abbreviation,
      net: round1(t.offensePpg - t.defensePapg),
      off: t.offensePpg,
      def: t.defensePapg,
    }))
    .sort((a, b) => b.net - a.net);
  console.log("  Top 5 net (off − def):");
  for (const r of ranked.slice(0, 5)) {
    console.log(`    ${r.abbr}: ${r.net} (off ${r.off} / def ${r.def})`);
  }
  console.log("  Bottom 5 net:");
  for (const r of ranked.slice(-5).reverse()) {
    console.log(`    ${r.abbr}: ${r.net} (off ${r.off} / def ${r.def})`);
  }
  console.log("\nNext: npm run precompute   (or npm run update-week)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
