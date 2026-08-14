import type { Metadata } from "next";
import Link from "next/link";
import { getMeta } from "@/lib/data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How the NFL Edge Simulator 2026 Monte Carlo + Poisson model works, and important disclaimers.",
};

export default function AboutPage() {
  const meta = getMeta();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">Methodology</h1>
      <p className="mt-2 text-muted-foreground">
        Transparent explanation of the Monte Carlo + Poisson scoring model behind
        every line on this site.
      </p>

      <Card className="mt-8 border-amber-500/40 bg-amber-500/5">
        <CardHeader>
          <CardTitle className="text-lg">Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed space-y-2">
          <p className="font-medium">{meta.disclaimer}</p>
          <p className="text-muted-foreground">
            This tool is a simplified statistical toy for learning how sports
            simulations work. It is{" "}
            <strong className="text-foreground">not</strong> sports betting
            advice, not an official NFL product, and not a guarantee of future
            results. The 2026 regular-season schedule is sourced from ESPN;
            kickoff times and networks can change. Always check local laws before
            any wagering activity.
          </p>
        </CardContent>
      </Card>

      <section className="mt-10 space-y-4">
        <h2 className="text-xl font-semibold">1. Team strength inputs</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Each team has two primary rates stored in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            src/data/teams.json
          </code>
          , refreshed from <strong className="text-foreground">ESPN standings</strong>{" "}
          via <code className="rounded bg-muted px-1.5 py-0.5 text-xs">npm run fetch-stats</code>:
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>
            <strong className="text-foreground">offensePpg</strong> — blended
            points scored per game (model input)
          </li>
          <li>
            <strong className="text-foreground">defensePapg</strong> — blended
            points allowed per game (model input)
          </li>
        </ul>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Early-season noise is reduced by shrinking current YTD rates toward the
          prior full season:
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
{`weight = min(1, gamesPlayed / 8)
rate   = weight * currentYTD + (1 - weight) * priorSeason`}
        </pre>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Before Week 1, the board is pure prior-season rates. By ~8 games, the
          model uses full current-season averages. League average PPG (
          {meta.leagueAvgPpg}) normalizes matchups. Weekly ops:{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            npm run update-week
          </code>
          .
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">2. Expected points (Poisson λ)</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For a game between home H and away A:
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
{`λ_home = (H.offense × A.defense / leagueAvg) + HFA
λ_away = (A.offense × H.defense / leagueAvg)`}
        </pre>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Home-field advantage (HFA) is currently{" "}
          <strong className="text-foreground">
            +{meta.homeFieldAdvantage} points
          </strong>{" "}
          added to the home λ. Rates are clamped to a realistic NFL band so
          extreme overrides do not explode.
        </p>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">3. Monte Carlo simulation</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          For each game we run{" "}
          <strong className="text-foreground">
            {meta.simulationsPerGame.toLocaleString()}
          </strong>{" "}
          independent trials:
        </p>
        <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
          <li>
            Draw home score ~ Poisson(λ_home)
          </li>
          <li>
            Draw away score ~ Poisson(λ_away)
          </li>
          <li>
            Record winner, margin, and total
          </li>
        </ol>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Aggregation:
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>
            <strong className="text-foreground">Predicted scores</strong> — mean
            of simulated scores
          </li>
          <li>
            <strong className="text-foreground">Total</strong> — mean combined
            points
          </li>
          <li>
            <strong className="text-foreground">Spread</strong> — negative median
            home margin (standard home-perspective line; negative = home favorite)
          </li>
          <li>
            <strong className="text-foreground">Win probability</strong> — share
            of sims won, with regulation ties split 50/50
          </li>
        </ul>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">4. Why pre-compute?</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Running {meta.simulationsPerGame.toLocaleString()} draws ×{" "}
          {meta.totalGames} games is cheap on a laptop (~seconds) but wasteful on
          every page view. We store results in{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            src/data/predictions.json
          </code>{" "}
          so the Next.js app only reads JSON. After editing team ratings:
        </p>
        <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs">
          npm run precompute
        </pre>
      </section>

      <Separator className="my-8" />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">5. Limitations</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>No injuries, weather, rest, or coaching adjustments</li>
          <li>Poisson treats scoring as independent counts — real football is more structured</li>
          <li>
            Schedule matchups from ESPN; times/TV subject to NFL flex changes
          </li>
          <li>No market prices or closing-line value</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/schedule" className={cn(buttonVariants())}>
          Explore predictions
        </Link>
        <Link
          href="/teams"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Edit team ratings
        </Link>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Last prediction batch:{" "}
        {new Date(meta.generatedAt).toLocaleString()} · Season {meta.season}
      </p>
    </div>
  );
}
