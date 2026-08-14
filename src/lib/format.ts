/**
 * Display helpers for spreads, totals, and win probabilities.
 */

/** Format home-perspective spread for betting UI (e.g. "H -3.5" / "H +2.5"). */
export function formatSpread(spread: number, homeAbbr?: string): string {
  const label = homeAbbr ?? "H";
  if (Math.abs(spread) < 0.05) return `${label} PK`;
  const sign = spread > 0 ? "+" : "";
  return `${label} ${sign}${spread.toFixed(1)}`;
}

/** Color class for spread: green = home favorite, red = away favorite. */
export function spreadColorClass(spread: number): string {
  if (spread < -0.25) return "text-emerald-600 dark:text-emerald-400 font-semibold";
  if (spread > 0.25) return "text-rose-600 dark:text-rose-400 font-semibold";
  return "text-muted-foreground font-medium";
}

export function formatTotal(total: number): string {
  return `O/U ${total.toFixed(1)}`;
}

export function formatWinProb(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

export function formatScore(home: number, away: number): string {
  return `${Math.round(home)} – ${Math.round(away)}`;
}

/** Pretty date from YYYY-MM-DD */
export function formatGameDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShortDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
