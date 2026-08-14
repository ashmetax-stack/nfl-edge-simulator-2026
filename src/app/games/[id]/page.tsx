import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getAllGames, getGameWithPrediction, getLeagueAvgPpg } from "@/lib/data";
import {
  formatGameDate,
  formatSpread,
  formatTotal,
  formatWinProb,
  spreadColorClass,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
import { WhatIfPanel } from "@/components/games/what-if-panel";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  return getAllGames().map((g) => ({ id: g.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const item = getGameWithPrediction(id);
  if (!item) return { title: "Game not found" };
  return {
    title: `${item.awayTeam.abbreviation} @ ${item.homeTeam.abbreviation} · Week ${item.game.week}`,
    description: item.prediction.interpretation,
  };
}

export default async function GameDetailPage({ params }: PageProps) {
  const { id } = await params;
  const item = getGameWithPrediction(id);
  if (!item) notFound();

  const { game, homeTeam, awayTeam, prediction: p } = item;
  const homeScore = Math.round(p.predictedHomeScore);
  const awayScore = Math.round(p.predictedAwayScore);
  const leagueAvgPpg = getLeagueAvgPpg();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/schedule"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 -ml-2 gap-1"
        )}
      >
        <ArrowLeft className="size-4" />
        Back to schedule
      </Link>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">Week {game.week}</Badge>
        <span>{formatGameDate(game.date)}</span>
        <span>·</span>
        <span>{game.kickoff}</span>
      </div>

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        {awayTeam.city} {awayTeam.name}
        <span className="mx-2 text-muted-foreground font-normal">@</span>
        {homeTeam.city} {homeTeam.name}
      </h1>

      {/* Scoreboard */}
      <Card className="mt-8 overflow-hidden">
        <div className="grid sm:grid-cols-2">
          <ScorePanel
            team={awayTeam}
            score={awayScore}
            winProb={p.awayWinProb}
            label="Away"
          />
          <ScorePanel
            team={homeTeam}
            score={homeScore}
            winProb={p.homeWinProb}
            label="Home"
            home
          />
        </div>
        <CardContent className="border-t bg-muted/20 py-4">
          <p className="text-center text-sm text-muted-foreground">
            Predicted score{" "}
            <span className="font-semibold text-foreground">
              {homeTeam.abbreviation} {homeScore} – {awayTeam.abbreviation}{" "}
              {awayScore}
            </span>{" "}
            (rounded means from {p.simulations.toLocaleString()} sims)
          </p>
        </CardContent>
      </Card>

      {/* Key lines */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Predicted spread"
          value={formatSpread(p.predictedSpread, homeTeam.abbreviation)}
          valueClass={spreadColorClass(p.predictedSpread)}
          hint="Home-team perspective · green = home favorite"
        />
        <StatCard
          title="Predicted total"
          value={formatTotal(p.predictedTotal)}
          hint={`Mean combined points ≈ ${p.predictedTotal.toFixed(1)}`}
        />
        <StatCard
          title="Home win probability"
          value={formatWinProb(p.homeWinProb)}
          hint={`Away ${formatWinProb(p.awayWinProb)} · ties split 50/50`}
        />
      </div>

      {/* Interpretation */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Model interpretation</CardTitle>
          <CardDescription>
            Plain-language read of the simulation edge
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p className="text-base font-medium">{p.interpretation}</p>
          <p className="text-muted-foreground">
            Expected scoring rates (Poisson λ): {homeTeam.abbreviation}{" "}
            <strong className="text-foreground">{p.lambdaHome.toFixed(1)}</strong>{" "}
            pts · {awayTeam.abbreviation}{" "}
            <strong className="text-foreground">{p.lambdaAway.toFixed(1)}</strong>{" "}
            pts. Each simulation draws independent scores from those rates, then
            we aggregate means, median margin, and win frequencies.
          </p>
        </CardContent>
      </Card>

      {/* Sample outcomes (published board) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Most common simulation outcomes</CardTitle>
          <CardDescription>
            Baseline board — top scorelines from {p.simulations.toLocaleString()}{" "}
            precomputed Monte Carlo runs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>#</TableHead>
                  <TableHead>
                    {awayTeam.abbreviation} – {homeTeam.abbreviation}
                  </TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {p.sampleOutcomes.map((o, i) => (
                  <TableRow key={`${o.awayScore}-${o.homeScore}-${i}`}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {o.awayScore} – {o.homeScore}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.count.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.pct.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Client-side scenario re-sim (Suspense: useSearchParams for share URLs) */}
      <Suspense
        fallback={
          <Card className="mt-6 border-emerald-500/25">
            <CardHeader>
              <CardTitle className="text-lg">What-if simulator</CardTitle>
              <CardDescription>Loading scenario tools…</CardDescription>
            </CardHeader>
          </Card>
        }
      >
        <WhatIfPanel
          gameId={game.id}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          baseline={p}
          leagueAvgPpg={leagueAvgPpg}
        />
      </Suspense>

      <p className="mt-8 text-xs text-muted-foreground">
        Predictions generated {new Date(p.generatedAt).toLocaleString()}. For
        entertainment and educational purposes only — not gambling advice.
      </p>
    </div>
  );
}

function ScorePanel({
  team,
  score,
  winProb,
  label,
  home,
}: {
  team: { abbreviation: string; city: string; name: string; primaryColor: string };
  score: number;
  winProb: number;
  label: string;
  home?: boolean;
}) {
  return (
    <div
      className={`p-6 sm:p-8 ${home ? "sm:border-l" : ""}`}
      style={{
        background: `linear-gradient(135deg, ${team.primaryColor}18, transparent 70%)`,
      }}
    >
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span
          className="flex size-12 items-center justify-center rounded-lg text-sm font-bold text-white shadow"
          style={{ backgroundColor: team.primaryColor }}
        >
          {team.abbreviation}
        </span>
        <div>
          <p className="font-semibold leading-tight">
            {team.city} {team.name}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatWinProb(winProb)} win prob
          </p>
        </div>
      </div>
      <p className="mt-4 text-5xl font-bold tabular-nums tracking-tight">{score}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${winProb * 100}%`,
            backgroundColor: team.primaryColor,
          }}
        />
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  valueClass,
}: {
  title: string;
  value: string;
  hint: string;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className={`text-2xl tabular-nums ${valueClass ?? ""}`}>
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
