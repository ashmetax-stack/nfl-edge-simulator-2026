/**
 * Fetch the official 2026 NFL regular-season schedule from ESPN
 * and write src/data/schedule.json.
 *
 * Usage:  npm run fetch-schedule
 *
 * Then recompute lines:  npm run precompute
 */

import { writeFileSync } from "fs";
import { join } from "path";
import type { Game, ScheduleFile } from "../src/lib/types";

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "src", "data", "schedule.json");

/** ESPN abbreviations → our team ids in teams.json */
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

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { abbreviation: string };
}

interface EspnGame {
  id?: string | number;
  uid?: string;
  date: string;
  name?: string;
  week?: { number: number };
  competitions: Array<{
    date?: string;
    broadcast?: string;
    broadcasts?: Array<{ names?: string[] }>;
    venue?: {
      fullName?: string;
      address?: { city?: string; state?: string };
    };
    competitors: EspnCompetitor[];
  }>;
}

function formatKickoffEt(isoUtc: string): string {
  const dt = new Date(isoUtc);
  // Format in America/New_York without external deps
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(dt);
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayPeriod = parts.find((p) => p.type === "dayPeriod")?.value ?? "";
  return `${hour}:${minute} ${dayPeriod} ET`;
}

function dateInEt(isoUtc: string): string {
  const dt = new Date(isoUtc);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt); // YYYY-MM-DD
  return parts;
}

async function fetchWeek(week: number): Promise<EspnGame[]> {
  const url = `https://cdn.espn.com/core/nfl/schedule?xhr=1&year=2026&seasontype=2&week=${week}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "NFLEdgeSimulator/1.0" },
  });
  if (!res.ok) throw new Error(`Week ${week}: HTTP ${res.status}`);
  const data = (await res.json()) as {
    content?: { schedule?: Record<string, { games?: EspnGame[] }> };
  };
  const schedule = data.content?.schedule ?? {};
  const games: EspnGame[] = [];
  for (const day of Object.values(schedule)) {
    for (const g of day.games ?? []) games.push(g);
  }
  return games;
}

async function main() {
  const games: Game[] = [];

  for (let week = 1; week <= 18; week++) {
    process.stdout.write(`Fetching week ${week}… `);
    const espnGames = await fetchWeek(week);
    for (const g of espnGames) {
      const comp = g.competitions[0];
      if (!comp) continue;
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;

      const homeId = ESPN_ABBR_TO_ID[home.team.abbreviation];
      const awayId = ESPN_ABBR_TO_ID[away.team.abbreviation];
      if (!homeId || !awayId) {
        throw new Error(
          `Unknown team abbr: ${away.team.abbreviation} @ ${home.team.abbreviation}`
        );
      }

      const utc = comp.date ?? g.date;
      const venue = comp.venue;
      let venueLabel = venue?.fullName;
      if (venue?.address?.city && venue?.address?.state) {
        venueLabel = `${venue.fullName}, ${venue.address.city}, ${venue.address.state}`;
      }

      let broadcast = comp.broadcast ?? "";
      if (!broadcast && comp.broadcasts?.[0]?.names?.[0]) {
        broadcast = comp.broadcasts[0].names[0];
      }

      const espnId = String(g.id ?? g.uid?.split(":").pop() ?? "");

      games.push({
        id: espnId ? `espn-${espnId}` : `2026-w${String(week).padStart(2, "0")}-${awayId}-${homeId}`,
        week,
        date: dateInEt(utc),
        kickoff: formatKickoffEt(utc),
        awayTeamId: awayId,
        homeTeamId: homeId,
        venue: venueLabel,
      });
    }
    console.log(`${espnGames.length} games`);
    await new Promise((r) => setTimeout(r, 200));
  }

  games.sort(
    (a, b) =>
      a.week - b.week ||
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id)
  );

  if (games.length !== 272) {
    console.warn(`Expected 272 games, got ${games.length}`);
  }

  const out: ScheduleFile = {
    season: 2026,
    note: "Official 2026 NFL regular-season schedule sourced from ESPN (cdn.espn.com). Kickoffs shown in Eastern time.",
    games,
  };

  writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${games.length} games → src/data/schedule.json`);

  // Sanity: Week 1 opener
  const w1 = games.filter((g) => g.week === 1);
  const opener = w1[0];
  if (opener) {
    console.log(
      `Week 1 first game: ${opener.date} ${opener.kickoff} ${opener.awayTeamId} @ ${opener.homeTeamId}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
