"use client";

/**
 * Game-level What-if simulator.
 * Runs the same Poisson Monte Carlo model in the browser with temporary
 * rating overrides. Supports shareable scenario URLs.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { GamePrediction, Team } from "@/lib/types";
import {
  HOME_FIELD_ADVANTAGE,
  simulateGame,
} from "@/lib/simulation";
import {
  formatSpread,
  formatTotal,
  formatWinProb,
  spreadColorClass,
} from "@/lib/format";
import {
  WHAT_IF_PRESETS,
  clampHfa,
  clampRate,
  matchPresetId,
  type WhatIfPreset,
  type WhatIfPresetId,
  type WhatIfScenarioInputs,
} from "@/lib/what-if-presets";
import {
  buildWhatIfQuery,
  buildWhatIfShareUrl,
  parseWhatIfSearchParams,
  searchParamsHaveWhatIf,
} from "@/lib/what-if-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, Copy, Dices, Link2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const SIM_OPTIONS = [
  { value: "2000", label: "2,000 (fast)" },
  { value: "5000", label: "5,000 (default)" },
  { value: "10000", label: "10,000 (precise)" },
] as const;

type ScenarioInputs = WhatIfScenarioInputs;

interface WhatIfPanelProps {
  gameId: string;
  homeTeam: Team;
  awayTeam: Team;
  baseline: GamePrediction;
  leagueAvgPpg: number;
}

function baselineInputs(home: Team, away: Team): ScenarioInputs {
  return {
    homeOffense: home.offensePpg,
    homeDefense: home.defensePapg,
    awayOffense: away.offensePpg,
    awayDefense: away.defensePapg,
    hfa: HOME_FIELD_ADVANTAGE,
    simulations: 5000,
  };
}

function isExtreme(inputs: ScenarioInputs): boolean {
  return (
    inputs.homeOffense >= 35 ||
    inputs.awayOffense >= 35 ||
    inputs.homeDefense >= 35 ||
    inputs.awayDefense >= 35 ||
    inputs.homeOffense <= 12 ||
    inputs.awayOffense <= 12
  );
}

function inputsDirty(a: ScenarioInputs, b: ScenarioInputs): boolean {
  return (
    a.homeOffense !== b.homeOffense ||
    a.homeDefense !== b.homeDefense ||
    a.awayOffense !== b.awayOffense ||
    a.awayDefense !== b.awayDefense ||
    a.hfa !== b.hfa ||
    a.simulations !== b.simulations
  );
}

function deltaClass(delta: number, invert = false): string {
  const positive = invert ? delta < 0 : delta > 0;
  const negative = invert ? delta > 0 : delta < 0;
  if (Math.abs(delta) < 0.05) return "text-muted-foreground";
  if (positive) return "text-emerald-600 dark:text-emerald-400";
  if (negative) return "text-rose-600 dark:text-rose-400";
  return "text-muted-foreground";
}

function formatDelta(n: number, digits = 1, suffix = ""): string {
  if (Math.abs(n) < 0.05) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}${suffix}`;
}

function normalizeInputs(draft: ScenarioInputs): ScenarioInputs {
  return {
    homeOffense: clampRate(draft.homeOffense),
    homeDefense: clampRate(draft.homeDefense),
    awayOffense: clampRate(draft.awayOffense),
    awayDefense: clampRate(draft.awayDefense),
    hfa: clampHfa(draft.hfa),
    simulations: draft.simulations,
  };
}

export function WhatIfPanel({
  gameId,
  homeTeam,
  awayTeam,
  baseline,
  leagueAvgPpg,
}: WhatIfPanelProps) {
  const defaults = useMemo(
    () => baselineInputs(homeTeam, awayTeam),
    [homeTeam, awayTeam]
  );

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [draft, setDraft] = useState<ScenarioInputs>(defaults);
  const [result, setResult] = useState<GamePrediction | null>(null);
  const [ranWith, setRanWith] = useState<ScenarioInputs | null>(null);
  const [activePresetId, setActivePresetId] = useState<WhatIfPresetId | null>(
    "baseline"
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  );

  const hydratedRef = useRef(false);
  const autoRanRef = useRef(false);

  const dirty = inputsDirty(draft, defaults);
  const resultStale =
    result != null && ranWith != null && inputsDirty(draft, ranWith);

  const matchedPresetId = useMemo(
    () => matchPresetId(draft, defaults),
    [draft, defaults]
  );
  const highlightedPreset = activePresetId ?? matchedPresetId;

  const runSimulationWith = useCallback(
    (raw: ScenarioInputs, opts?: { syncUrl?: boolean }) => {
      setError(null);
      const inputs = normalizeInputs(raw);
      setDraft(inputs);
      setActivePresetId(matchPresetId(inputs, defaults));

      startTransition(() => {
        try {
          const home: Team = {
            ...homeTeam,
            offensePpg: inputs.homeOffense,
            defensePapg: inputs.homeDefense,
          };
          const away: Team = {
            ...awayTeam,
            offensePpg: inputs.awayOffense,
            defensePapg: inputs.awayDefense,
          };

          const prediction = simulateGame(gameId, home, away, {
            simulations: inputs.simulations,
            homeFieldAdvantage: inputs.hfa,
            leagueAvgPpg,
            sampleTopN: 8,
          });

          setResult(prediction);
          setRanWith(inputs);

          if (opts?.syncUrl !== false) {
            const q = buildWhatIfQuery(inputs, defaults, { autoRun: true });
            const qs = q.toString();
            router.replace(qs ? `${pathname}?${qs}` : pathname, {
              scroll: false,
            });
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : "Simulation failed");
          setResult(null);
          setRanWith(null);
        }
      });
    },
    [
      awayTeam,
      defaults,
      gameId,
      homeTeam,
      leagueAvgPpg,
      pathname,
      router,
    ]
  );

  // Hydrate from shareable URL once per mount / when search string first appears
  useEffect(() => {
    if (hydratedRef.current) return;
    if (!searchParamsHaveWhatIf(searchParams)) {
      hydratedRef.current = true;
      return;
    }

    const parsed = parseWhatIfSearchParams(searchParams, defaults);
    if (!parsed.hasScenario) {
      hydratedRef.current = true;
      return;
    }

    hydratedRef.current = true;
    setDraft(parsed.inputs);
    setActivePresetId(parsed.presetId);

    if (parsed.autoRun && !autoRanRef.current) {
      autoRanRef.current = true;
      // Defer so state settles; avoid double-sync loop on first paint
      queueMicrotask(() => {
        runSimulationWith(parsed.inputs, { syncUrl: true });
      });
    }
  }, [defaults, runSimulationWith, searchParams]);

  function updateField<K extends keyof ScenarioInputs>(
    key: K,
    raw: string
  ) {
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    setActivePresetId(null);
    setDraft((d) => ({ ...d, [key]: n }));
  }

  function resetToBaseline() {
    applyPreset(WHAT_IF_PRESETS.find((p) => p.id === "baseline")!);
    setResult(null);
    setRanWith(null);
    setError(null);
    router.replace(pathname, { scroll: false });
  }

  /**
   * Presets fill inputs from the published board + deltas.
   * They do not auto-run — user still presses Run simulation.
   */
  function applyPreset(preset: WhatIfPreset) {
    const next = preset.apply(defaults, draft.simulations);
    setDraft(next);
    setActivePresetId(preset.id);
    setError(null);
    if (result) {
      setResult(null);
      setRanWith(null);
    }
  }

  function runSimulation() {
    runSimulationWith(draft, { syncUrl: true });
  }

  async function copyShareLink() {
    const source = ranWith && !resultStale ? ranWith : normalizeInputs(draft);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const url = buildWhatIfShareUrl(origin, pathname, source, defaults, {
      autoRun: true,
    });

    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      // Keep address bar in sync with the shared scenario
      const q = buildWhatIfQuery(source, defaults, { autoRun: true });
      const qs = q.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      window.setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2500);
    }
  }

  return (
    <Card
      id="what-if"
      className="mt-6 scroll-mt-20 border-2 border-black ring-0 dark:border-white"
    >
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Dices className="size-5 text-emerald-600 dark:text-emerald-400" />
              What-if simulator
            </CardTitle>
            <CardDescription className="mt-1.5 max-w-xl">
              Override team rates for this matchup only, then run Monte Carlo.
              Share a link to reopen the same scenario. Does not change the
              published board.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-normal">
            Scenario only
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Presets */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Presets</p>
              <p className="text-xs text-muted-foreground">
                Each option shows what it changes. Click one to fill inputs,
                then press <strong>Run simulation</strong>.
              </p>
            </div>
            {!highlightedPreset && dirty && (
              <Badge variant="outline" className="font-normal">
                Custom
              </Badge>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {WHAT_IF_PRESETS.map((preset) => {
              const active = highlightedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isPending}
                  aria-pressed={active}
                  onClick={() => applyPreset(preset)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    "disabled:pointer-events-none disabled:opacity-50",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-muted/60"
                  )}
                >
                  <span className="block text-sm font-medium leading-tight">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inputs */}
        <div className="grid gap-4 sm:grid-cols-2">
          <TeamRateFields
            label={`${awayTeam.abbreviation} (away)`}
            color={awayTeam.primaryColor}
            offense={draft.awayOffense}
            defense={draft.awayDefense}
            baselineOff={defaults.awayOffense}
            baselineDef={defaults.awayDefense}
            onOffense={(v) => updateField("awayOffense", v)}
            onDefense={(v) => updateField("awayDefense", v)}
          />
          <TeamRateFields
            label={`${homeTeam.abbreviation} (home)`}
            color={homeTeam.primaryColor}
            offense={draft.homeOffense}
            defense={draft.homeDefense}
            baselineOff={defaults.homeOffense}
            baselineDef={defaults.homeDefense}
            onOffense={(v) => updateField("homeOffense", v)}
            onDefense={(v) => updateField("homeDefense", v)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="hfa">Home-field advantage (pts)</Label>
            <Input
              id="hfa"
              type="number"
              step="0.1"
              min={-2}
              max={10}
              className="tabular-nums"
              value={draft.hfa}
              onChange={(e) => updateField("hfa", e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Baseline board uses {HOME_FIELD_ADVANTAGE.toFixed(1)}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sim-count">Simulations</Label>
            <Select
              value={String(draft.simulations)}
              onValueChange={(v) => {
                if (v != null) {
                  setDraft((d) => ({ ...d, simulations: Number(v) }));
                }
              }}
            >
              <SelectTrigger id="sim-count" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIM_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {isExtreme(draft) && (
          <p className="text-xs text-amber-700 dark:text-amber-400 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            Extreme rates — the model may be unreliable outside normal NFL
            scoring ranges.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={runSimulation}
            disabled={isPending}
            className="gap-1.5"
          >
            <Dices className="size-4" />
            {isPending ? "Running…" : "Run simulation"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={copyShareLink}
            disabled={isPending}
            className="gap-1.5"
          >
            {copyState === "copied" ? (
              <Check className="size-3.5" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            {copyState === "copied"
              ? "Link copied"
              : copyState === "error"
                ? "Copy failed"
                : "Copy link"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={resetToBaseline}
            disabled={isPending || (!dirty && !result)}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            Reset to baseline
          </Button>
          {resultStale && (
            <span className="text-xs text-amber-700 dark:text-amber-400">
              Inputs changed — run again to refresh results
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Copy className="size-3 mt-0.5 shrink-0" />
          <span>
            <strong className="text-foreground font-medium">Copy link</strong>{" "}
            encodes this scenario (preset when possible, otherwise exact rates)
            with <code className="rounded bg-muted px-1">run=1</code> so
            recipients open and auto-simulate. Example:{" "}
            <code className="rounded bg-muted px-1 text-[10px]">
              ?preset=neutral-site&amp;run=1
            </code>
          </span>
        </p>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* Comparison */}
        {result && ranWith && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold">Baseline vs what-if</h3>
              {resultStale && (
                <Badge variant="secondary" className="text-[10px]">
                  Stale
                </Badge>
              )}
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead>Metric</TableHead>
                    <TableHead className="text-right">Baseline</TableHead>
                    <TableHead className="text-right">What-if</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">
                      Predicted score
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {homeTeam.abbreviation}{" "}
                      {Math.round(baseline.predictedHomeScore)} –{" "}
                      {awayTeam.abbreviation}{" "}
                      {Math.round(baseline.predictedAwayScore)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {homeTeam.abbreviation}{" "}
                      {Math.round(result.predictedHomeScore)} –{" "}
                      {awayTeam.abbreviation}{" "}
                      {Math.round(result.predictedAwayScore)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                      {formatDelta(
                        result.predictedHomeScore - baseline.predictedHomeScore
                      )}{" "}
                      /{" "}
                      {formatDelta(
                        result.predictedAwayScore - baseline.predictedAwayScore
                      )}
                    </TableCell>
                  </TableRow>
                  <CompareRow
                    label="Spread (home)"
                    baseline={formatSpread(
                      baseline.predictedSpread,
                      homeTeam.abbreviation
                    )}
                    whatIf={formatSpread(
                      result.predictedSpread,
                      homeTeam.abbreviation
                    )}
                    delta={result.predictedSpread - baseline.predictedSpread}
                    baselineClass={spreadColorClass(baseline.predictedSpread)}
                    whatIfClass={spreadColorClass(result.predictedSpread)}
                    deltaHint="pts on home line"
                  />
                  <CompareRow
                    label="Total"
                    baseline={formatTotal(baseline.predictedTotal)}
                    whatIf={formatTotal(result.predictedTotal)}
                    delta={result.predictedTotal - baseline.predictedTotal}
                  />
                  <CompareRow
                    label={`${homeTeam.abbreviation} win %`}
                    baseline={formatWinProb(baseline.homeWinProb)}
                    whatIf={formatWinProb(result.homeWinProb)}
                    delta={(result.homeWinProb - baseline.homeWinProb) * 100}
                    deltaDigits={1}
                    deltaSuffix=" pts"
                  />
                  <CompareRow
                    label={`${awayTeam.abbreviation} win %`}
                    baseline={formatWinProb(baseline.awayWinProb)}
                    whatIf={formatWinProb(result.awayWinProb)}
                    delta={(result.awayWinProb - baseline.awayWinProb) * 100}
                    deltaDigits={1}
                    deltaSuffix=" pts"
                  />
                  <TableRow>
                    <TableCell className="font-medium">Poisson λ</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                      {homeTeam.abbreviation} {baseline.lambdaHome.toFixed(1)} ·{" "}
                      {awayTeam.abbreviation} {baseline.lambdaAway.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs font-medium">
                      {homeTeam.abbreviation} {result.lambdaHome.toFixed(1)} ·{" "}
                      {awayTeam.abbreviation} {result.lambdaAway.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      —
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
              <p className="text-sm font-medium">{result.interpretation}</p>
              <p className="text-xs text-muted-foreground">
                What-if used {result.simulations.toLocaleString()} sims · HFA{" "}
                {ranWith.hfa.toFixed(1)} · league avg {leagueAvgPpg.toFixed(1)}{" "}
                PPG. Published board still uses the baseline line above.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-semibold mb-2">
                What-if sample scorelines
              </h3>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead>#</TableHead>
                      <TableHead>
                        {awayTeam.abbreviation} – {homeTeam.abbreviation}
                      </TableHead>
                      <TableHead className="text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.sampleOutcomes.map((o, i) => (
                      <TableRow key={`${o.awayScore}-${o.homeScore}-w${i}`}>
                        <TableCell className="text-muted-foreground">
                          {i + 1}
                        </TableCell>
                        <TableCell className="font-medium tabular-nums">
                          {o.awayScore} – {o.homeScore}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {o.pct.toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        )}

        {!result && (
          <p className="text-xs text-muted-foreground">
            Adjust the inputs, then press <strong>Run simulation</strong> to
            compare against the published baseline line.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function TeamRateFields({
  label,
  color,
  offense,
  defense,
  baselineOff,
  baselineDef,
  onOffense,
  onDefense,
}: {
  label: string;
  color: string;
  offense: number;
  defense: number;
  baselineOff: number;
  baselineDef: number;
  onOffense: (v: string) => void;
  onDefense: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span
          className="size-2.5 rounded-full"
          style={{ backgroundColor: color }}
        />
        <p className="text-sm font-semibold">{label}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Offense PPG</Label>
          <Input
            type="number"
            step="0.1"
            min={8}
            max={45}
            className="tabular-nums"
            value={offense}
            onChange={(e) => onOffense(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            Board {baselineOff.toFixed(1)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Defense PAPG</Label>
          <Input
            type="number"
            step="0.1"
            min={8}
            max={45}
            className="tabular-nums"
            value={defense}
            onChange={(e) => onDefense(e.target.value)}
          />
          <p className="text-[10px] text-muted-foreground">
            Board {baselineDef.toFixed(1)}
          </p>
        </div>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  baseline,
  whatIf,
  delta,
  baselineClass,
  whatIfClass,
  deltaDigits = 1,
  deltaSuffix = "",
  deltaHint,
}: {
  label: string;
  baseline: string;
  whatIf: string;
  delta: number;
  baselineClass?: string;
  whatIfClass?: string;
  deltaDigits?: number;
  deltaSuffix?: string;
  deltaHint?: string;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{label}</TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums text-muted-foreground",
          baselineClass
        )}
      >
        {baseline}
      </TableCell>
      <TableCell
        className={cn("text-right tabular-nums font-medium", whatIfClass)}
      >
        {whatIf}
      </TableCell>
      <TableCell
        className={cn(
          "text-right tabular-nums text-sm font-medium",
          deltaClass(delta)
        )}
        title={deltaHint}
      >
        {formatDelta(delta, deltaDigits, deltaSuffix)}
      </TableCell>
    </TableRow>
  );
}
