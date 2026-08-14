"use client";

/**
 * Team strength table with local overrides (localStorage).
 * Overrides are for power-user exploration only — they do not rewrite
 * precomputed predictions. Edit teams.json + `npm run precompute` for site-wide updates.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Team } from "@/lib/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RotateCcw, Search } from "lucide-react";

const STORAGE_KEY = "nfl-edge-2026-team-overrides";

type OverrideMap = Record<
  string,
  { offensePpg?: number; defensePapg?: number }
>;

interface TeamStatsTableProps {
  teams: Team[];
  leagueAvgPpg: number;
}

export function TeamStatsTable({ teams, leagueAvgPpg }: TeamStatsTableProps) {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [query, setQuery] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOverrides(JSON.parse(raw) as OverrideMap);
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: OverrideMap) => {
    setOverrides(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private mode etc. */
    }
  }, []);

  const updateField = (teamId: string, field: "offensePpg" | "defensePapg", value: string) => {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    const base = teams.find((t) => t.id === teamId);
    if (!base) return;

    const next = { ...overrides };
    const current = { ...(next[teamId] ?? {}) };
    const baseline = base[field];
    if (Math.abs(n - baseline) < 0.05) {
      delete current[field];
    } else {
      current[field] = Math.round(n * 10) / 10;
    }
    if (Object.keys(current).length === 0) delete next[teamId];
    else next[teamId] = current;
    persist(next);
  };

  const resetAll = () => persist({});

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return teams
      .filter((t) => {
        if (!q) return true;
        return (
          t.name.toLowerCase().includes(q) ||
          t.city.toLowerCase().includes(q) ||
          t.abbreviation.toLowerCase().includes(q)
        );
      })
      .map((t) => {
        const o = overrides[t.id] ?? {};
        return {
          team: t,
          offensePpg: o.offensePpg ?? t.offensePpg,
          defensePapg: o.defensePapg ?? t.defensePapg,
          modified: Boolean(o.offensePpg !== undefined || o.defensePapg !== undefined),
          /** Simple net rating: offense vs league − defense vs league */
          net:
            (o.offensePpg ?? t.offensePpg) -
            leagueAvgPpg -
            ((o.defensePapg ?? t.defensePapg) - leagueAvgPpg),
        };
      })
      .sort((a, b) => b.net - a.net);
  }, [teams, overrides, query, leagueAvgPpg]);

  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5 max-w-sm w-full">
          <Label htmlFor="team-filter">Filter teams</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="team-filter"
              className="pl-9"
              placeholder="Search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overrideCount > 0 && (
            <Badge variant="secondary">{overrideCount} local override(s)</Badge>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetAll}
            disabled={!hydrated || overrideCount === 0}
          >
            <RotateCcw className="size-3.5" />
            Reset overrides
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Team</TableHead>
              <TableHead>Conf</TableHead>
              <TableHead className="text-right">Model off</TableHead>
              <TableHead className="text-right">Model def</TableHead>
              <TableHead className="text-right hidden lg:table-cell">
                Prior / YTD off
              </TableHead>
              <TableHead className="text-right hidden lg:table-cell">
                GP
              </TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ team, offensePpg, defensePapg, modified, net }) => (
              <TableRow key={team.id} className={modified ? "bg-amber-500/5" : undefined}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded text-[10px] font-bold text-white"
                      style={{ backgroundColor: team.primaryColor }}
                    >
                      {team.abbreviation}
                    </span>
                    <div>
                      <p className="font-medium leading-tight">
                        {team.city} {team.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {team.abbreviation}
                        {team.blendWeight != null && team.blendWeight > 0
                          ? ` · ${(team.blendWeight * 100).toFixed(0)}% YTD`
                          : ""}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {team.conference} {team.division}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.1"
                    min={10}
                    max={40}
                    className="ml-auto h-8 w-20 text-right tabular-nums"
                    value={offensePpg}
                    onChange={(e) =>
                      updateField(team.id, "offensePpg", e.target.value)
                    }
                    aria-label={`${team.abbreviation} offense PPG`}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.1"
                    min={10}
                    max={40}
                    className="ml-auto h-8 w-20 text-right tabular-nums"
                    value={defensePapg}
                    onChange={(e) =>
                      updateField(team.id, "defensePapg", e.target.value)
                    }
                    aria-label={`${team.abbreviation} defense PAPG`}
                  />
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums text-muted-foreground hidden lg:table-cell">
                  {team.priorOffensePpg != null
                    ? `${team.priorOffensePpg.toFixed(1)}`
                    : "—"}
                  {" / "}
                  {team.currentOffensePpg != null
                    ? team.currentOffensePpg.toFixed(1)
                    : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground hidden lg:table-cell">
                  {team.gamesPlayed ?? 0}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {net > 0 ? "+" : ""}
                  {net.toFixed(1)}
                </TableCell>
                <TableCell>
                  {modified && (
                    <Badge variant="outline" className="text-[10px]">
                      edited
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground space-y-2">
        <p>
          <strong className="text-foreground">Local overrides</strong> live only in
          this browser (localStorage). They do not change precomputed game lines.
        </p>
        <p>
          <strong className="text-foreground">Weekly pipeline</strong> (recommended):
{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            npm run update-week
          </code>{" "}
          pulls ESPN standings, blends prior + YTD, and recomputes predictions.
          Add{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">--schedule</code>{" "}
          to also refresh the ESPN slate.
        </p>
        <p>
          Manual path:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            npm run fetch-stats
          </code>{" "}
          then{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            npm run precompute
          </code>
          .
        </p>
        <p>League average PPG used in the model: {leagueAvgPpg.toFixed(1)}</p>
      </div>
    </div>
  );
}
