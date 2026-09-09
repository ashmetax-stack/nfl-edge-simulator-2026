import Link from "next/link";
import { GameCard } from "@/components/games/game-card";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingsBadge } from "@/components/teams/ratings-badge";
import { getFeaturedGames, getMeta, getTeamStatsMeta } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  BarChart3,
  Calculator,
  Dices,
  Shield,
} from "lucide-react";

export default function HomePage() {
  const meta = getMeta();
  const featured = getFeaturedGames(6);
  const statsMeta = getTeamStatsMeta();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              2026 NFL season · {meta.simulationsPerGame.toLocaleString()} sims /
              game
            </Badge>
            <RatingsBadge meta={statsMeta} />
          </div>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            NFL Edge Simulator{" "}
            <span className="text-emerald-600 dark:text-emerald-400">2026</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Pre-computed Monte Carlo predictions for every regular-season game —
            spreads, totals, and win probabilities powered by a Poisson scoring
            model.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/schedule"
              className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}
            >
              Browse full schedule
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/about"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              How the model works
            </Link>
          </div>
          <p className="mt-6 text-xs text-muted-foreground max-w-lg">
            {meta.disclaimer}
          </p>
        </div>
      </section>

      {/* Featured week */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              Week {meta.currentWeek} featured games
            </h2>
            <p className="text-muted-foreground text-sm">
              This week's slate in kickoff order — predicted score, spread,
              total, and win %
            </p>
          </div>
          <Link
            href="/schedule"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1")}
          >
            All {meta.totalGames} games
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-muted-foreground">No games found for this week.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((item) => (
              <GameCard key={item.game.id} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* How it works teaser */}
      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight mb-2">
            How the model works
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl text-sm">
            A transparent, educational pipeline — not a black box.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StepCard
              icon={<BarChart3 className="size-5" />}
              title="1. Team rates"
              body="Each club has offense PPG and defense points allowed. Edit them in teams.json anytime."
            />
            <StepCard
              icon={<Calculator className="size-5" />}
              title="2. Expected points"
              body="Matchup λ values combine offense × opponent defense, plus home-field advantage."
            />
            <StepCard
              icon={<Dices className="size-5" />}
              title="3. Monte Carlo"
              body={`${meta.simulationsPerGame.toLocaleString()} Poisson score draws per game build the score distribution.`}
            />
            <StepCard
              icon={<Shield className="size-5" />}
              title="4. Betting lines"
              body="We publish median spread, mean total, and win probabilities — pre-computed for speed."
            />
          </div>
          <div className="mt-8">
            <Link
              href="/about"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Full methodology & disclaimer
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="bg-background/80">
      <CardHeader className="pb-2">
        <div className="mb-2 flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          {icon}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm leading-relaxed">{body}</CardDescription>
      </CardContent>
    </Card>
  );
}
