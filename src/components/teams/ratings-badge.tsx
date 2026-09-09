import { Badge } from "@/components/ui/badge";
import type { TeamStatsMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RatingsBadgeProps {
  meta?: TeamStatsMeta;
  className?: string;
  /** Compact single-line badge vs. multi-line callout */
  variant?: "badge" | "callout";
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function RatingsBadge({
  meta,
  className,
  variant = "badge",
}: RatingsBadgeProps) {
  if (!meta) {
    if (variant === "callout") {
      return (
        <p className={cn("text-sm text-muted-foreground", className)}>
          Team ratings have not been synced yet. Run{" "}
          <code className="rounded bg-muted px-1 text-xs">npm run fetch-stats</code>
          .
        </p>
      );
    }
    return (
      <Badge variant="secondary" className={className}>
        Ratings: not synced
      </Badge>
    );
  }

  const when = formatWhen(meta.statsAsOf);
  const preseason = meta.statsWeek == null || meta.gamesPlayedMax <= 0;

  if (variant === "callout") {
    return (
      <div
        className={cn(
          "rounded-lg border bg-muted/30 px-4 py-3 text-sm space-y-1",
          className
        )}
      >
        <p className="font-medium text-foreground">
          {preseason
            ? `Using ${meta.priorSeason} full-season rates`
            : `Ratings as of Week ${meta.statsWeek} (${meta.currentSeason} season)`}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Source: ESPN standings · updated {when}
          {preseason
            ? `. Current year gets weight as games are played (full weight at ${meta.blendGamesFullWeight} GP).`
            : ` · mean blend weight toward ${meta.currentSeason}: ${(meta.blendWeightCurrentMean * 100).toFixed(0)}% (full at ${meta.blendGamesFullWeight} GP).`}{" "}
          League avg PPG: {meta.leagueAvgPpg.toFixed(1)}.
        </p>
      </div>
    );
  }

  return (
    <Badge variant="secondary" className={cn("font-normal", className)}>
      {preseason
        ? `Ratings: ${meta.priorSeason} full-season rates`
        : `Ratings: Week ${meta.statsWeek} · ${when}`}
    </Badge>
  );
}
