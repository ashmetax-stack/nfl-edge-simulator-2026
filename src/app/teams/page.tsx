import type { Metadata } from "next";
import { TeamStatsTable } from "@/components/teams/team-stats-table";
import { RatingsBadge } from "@/components/teams/ratings-badge";
import { getAllTeams, getLeagueAvgPpg, getTeamStatsMeta } from "@/lib/data";

export const metadata: Metadata = {
  title: "Team stats & ratings",
  description:
    "Offensive and defensive averages used by the NFL Edge Simulator Monte Carlo model.",
};

export default function TeamsPage() {
  const teams = getAllTeams();
  const leagueAvg = getLeagueAvgPpg();
  const statsMeta = getTeamStatsMeta();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team stats</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            All 32 clubs with the offensive (PPG) and defensive (PAPG) rates fed
            into the Poisson model. Sorted by net rating. Values are pulled from
            ESPN and blended prior-season → current YTD as games accumulate.
          </p>
        </div>
        <RatingsBadge meta={statsMeta} variant="callout" />
      </div>
      <TeamStatsTable teams={teams} leagueAvgPpg={leagueAvg} />
    </div>
  );
}
