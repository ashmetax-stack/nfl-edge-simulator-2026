import type { Metadata } from "next";
import { ScheduleTable } from "@/components/games/schedule-table";
import { getGamesWithPredictions, getMeta } from "@/lib/data";

export const metadata: Metadata = {
  title: "Full season schedule",
  description:
    "All 2026 NFL regular-season games with predicted spreads, totals, and win probabilities.",
};

export default function SchedulePage() {
  const games = getGamesWithPredictions();
  const meta = getMeta();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">2026 schedule</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          All {meta.totalGames} regular-season games from the ESPN 2026 slate,
          with pre-computed Monte Carlo lines. Filter by week or search for a
          team. Spreads are home-team perspective (negative = home favorite).
        </p>
      </div>
      <ScheduleTable games={games} defaultWeek="all" />
    </div>
  );
}
