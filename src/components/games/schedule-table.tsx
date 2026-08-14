"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GameWithPrediction } from "@/lib/types";
import { ScheduleFilters } from "./schedule-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatShortDate,
  formatSpread,
  formatWinProb,
  spreadColorClass,
} from "@/lib/format";
import { GameCard } from "./game-card";

interface ScheduleTableProps {
  games: GameWithPrediction[];
  defaultWeek?: string;
}

export function ScheduleTable({ games, defaultWeek = "all" }: ScheduleTableProps) {
  const [week, setWeek] = useState(defaultWeek);
  const [teamQuery, setTeamQuery] = useState("");

  const filtered = useMemo(() => {
    const q = teamQuery.trim().toLowerCase();
    return games.filter((g) => {
      if (week !== "all" && g.game.week !== Number(week)) return false;
      if (!q) return true;
      const hay = [
        g.homeTeam.name,
        g.homeTeam.city,
        g.homeTeam.abbreviation,
        g.awayTeam.name,
        g.awayTeam.city,
        g.awayTeam.abbreviation,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [games, week, teamQuery]);

  return (
    <div className="space-y-4">
      <ScheduleFilters
        week={week}
        teamQuery={teamQuery}
        onWeekChange={setWeek}
        onTeamQueryChange={setTeamQuery}
        resultCount={filtered.length}
      />

      {/* Mobile: cards */}
      <div className="grid gap-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-muted-foreground">
            No games match your filters.
          </p>
        ) : (
          filtered.map((item) => <GameCard key={item.game.id} item={item} />)
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="w-16">Week</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Away</TableHead>
              <TableHead>Home</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Spread</TableHead>
              <TableHead className="text-right">Home win</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No games match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(({ game, homeTeam, awayTeam, prediction }) => (
                <TableRow key={game.id} className="hover:bg-muted/30">
                  <TableCell className="font-medium">{game.week}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatShortDate(game.date)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/games/${game.id}`}
                      className="font-medium hover:underline"
                    >
                      <span
                        className="mr-1.5 inline-block size-2 rounded-full"
                        style={{ backgroundColor: awayTeam.primaryColor }}
                      />
                      {awayTeam.city} {awayTeam.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/games/${game.id}`}
                      className="font-medium hover:underline"
                    >
                      <span
                        className="mr-1.5 inline-block size-2 rounded-full"
                        style={{ backgroundColor: homeTeam.primaryColor }}
                      />
                      {homeTeam.city} {homeTeam.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {prediction.predictedTotal.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${spreadColorClass(prediction.predictedSpread)}`}
                  >
                    {formatSpread(prediction.predictedSpread, homeTeam.abbreviation)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatWinProb(prediction.homeWinProb)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
          Green spreads
        </span>{" "}
        = home favorite ·{" "}
        <span className="text-rose-600 dark:text-rose-400 font-medium">
          Red spreads
        </span>{" "}
        = away favorite. Click a game for full detail.
      </p>
    </div>
  );
}
