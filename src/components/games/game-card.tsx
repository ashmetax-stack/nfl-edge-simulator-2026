import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { GameWithPrediction } from "@/lib/types";
import {
  formatGameDate,
  formatSpread,
  formatTotal,
  formatWinProb,
  spreadColorClass,
} from "@/lib/format";
import { cn } from "@/lib/utils";

interface GameCardProps {
  item: GameWithPrediction;
  className?: string;
}

export function GameCard({ item, className }: GameCardProps) {
  const { game, homeTeam, awayTeam, prediction } = item;
  const homeFav = prediction.predictedSpread < 0;

  return (
    <Link href={`/games/${game.id}`} className={cn("block group", className)}>
      <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              Week {game.week} · {formatGameDate(game.date)}
            </span>
            <Badge variant="secondary" className="font-normal">
              {game.kickoff}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <TeamRow
              abbr={awayTeam.abbreviation}
              city={awayTeam.city}
              name={awayTeam.name}
              color={awayTeam.primaryColor}
              winProb={prediction.awayWinProb}
              score={prediction.predictedAwayScore}
              isFavorite={!homeFav && Math.abs(prediction.predictedSpread) > 0.25}
            />
            <TeamRow
              abbr={homeTeam.abbreviation}
              city={homeTeam.city}
              name={homeTeam.name}
              color={homeTeam.primaryColor}
              winProb={prediction.homeWinProb}
              score={prediction.predictedHomeScore}
              isFavorite={homeFav}
              isHome
            />
          </div>

          <div className="grid grid-cols-3 gap-2 border-t pt-3 text-center text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Spread
              </p>
              <p className={spreadColorClass(prediction.predictedSpread)}>
                {formatSpread(prediction.predictedSpread, homeTeam.abbreviation)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Total
              </p>
              <p className="font-semibold">{formatTotal(prediction.predictedTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                Home win
              </p>
              <p className="font-semibold">
                {formatWinProb(prediction.homeWinProb)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground group-hover:text-foreground/80 transition-colors">
            View full simulation →
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}

function TeamRow({
  abbr,
  city,
  name,
  color,
  winProb,
  score,
  isFavorite,
  isHome,
}: {
  abbr: string;
  city: string;
  name: string;
  color: string;
  winProb: number;
  score: number;
  isFavorite?: boolean;
  isHome?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm"
        style={{ backgroundColor: color }}
        title={`${city} ${name}`}
      >
        {abbr}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {isHome ? "" : "@ "}
          {city} {name}
          {isFavorite && (
            <span className="ml-1.5 text-[10px] font-normal uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              fav
            </span>
          )}
        </p>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary/80 transition-all"
            style={{ width: `${Math.max(winProb * 100, 4)}%` }}
          />
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold tabular-nums leading-none">
          {Math.round(score)}
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums">
          {(winProb * 100).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}
