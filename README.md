# NFL Edge Simulator 2026

A modern Next.js web app that shows **predicted spreads, totals, and win probabilities** for every 2026 NFL regular-season game using a **Monte Carlo + Poisson** scoring model.

Predictions are **pre-computed** so pages load instantly from JSON — no simulation work on each request.

## Features

- **Home** — hero, current-week featured games, model overview
- **Schedule** — all 272 games with week filter, team search, color-coded spreads
- **Game detail** — predicted score, spread/total, win probs, interpretation, sample outcomes
- **What-if sim** — presets, **Run simulation**, baseline vs scenario deltas, **shareable scenario URLs** (`?preset=…&run=1` or custom rates)
- **Team stats** — 32-team offense/defense table with ESPN blend pipeline + local overrides
- **Methodology** — full model explanation + entertainment-only disclaimer
- **Dark mode** — system / light / dark via next-themes
- **Responsive** — mobile cards + desktop tables

## Tech stack

- Next.js 14+ (App Router) + TypeScript
- Tailwind CSS v4
- shadcn/ui (Base UI primitives)
- Local JSON data (`src/data/`)

## Quick start

```bash
cd nfl-edge-simulator-2026
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production build:

```bash
npm run build
npm start
```

## Updating team ratings (accuracy pipeline)

### Weekly refresh (recommended)

Pull ESPN standings, blend prior season + current YTD, recompute all lines:

```bash
npm run update-week
```

Also refresh the ESPN schedule (flex / times):

```bash
npm run update-week -- --schedule
```

### What the blend does

```text
weight = min(1, gamesPlayed / 8)
offensePpg  = weight * currentYTD + (1 - weight) * priorSeason
defensePapg = weight * currentYTD + (1 - weight) * priorSeason
```

| Phase | Behavior |
|-------|----------|
| Preseason | 100% prior season (e.g. 2025 finals) |
| Weeks 1–7 | Gradual shift toward 2026 YTD |
| Week 8+ | Full current-season rates |

### Individual commands

```bash
npm run fetch-stats       # ESPN standings → teams.json
npm run fetch-schedule    # ESPN slate → schedule.json
npm run precompute        # Monte Carlo → predictions.json
```

### Manual edits

You can still hand-edit `offensePpg` / `defensePapg` in `teams.json`, then `npm run precompute`. The next `fetch-stats` will overwrite those with ESPN values.

### Shareable What-if URLs

On any game page, use **Copy link** in the What-if panel (or craft a query string):

```text
# Named preset (best — survives weekly rating updates)
/games/espn-401872656?preset=neutral-site&run=1

# Custom absolute rates
/games/espn-401872656?ho=26&hd=19.5&ao=24&ad=21&hfa=0&sims=5000&run=1
```

| Param | Meaning |
|-------|---------|
| `preset` | `neutral-site`, `home-injury`, `away-injury`, `home-lockdown`, `away-lockdown`, `shootout`, `defensive-struggle`, `baseline` |
| `ho` / `hd` | Home offense PPG / defense PAPG |
| `ao` / `ad` | Away offense PPG / defense PAPG |
| `hfa` | Home-field advantage points |
| `sims` | `2000` \| `5000` \| `10000` |
| `run` | `1` = hydrate and auto-run simulation |

### Browser-only overrides

On **Team Stats**, local tweaks go to **localStorage** only — they do **not** rewrite precomputed game lines.

## Project structure

```
nfl-edge-simulator-2026/
├── scripts/
│   ├── fetch-espn-schedule.ts      # Pull 2026 slate from ESPN
│   ├── fetch-team-stats.ts         # ESPN standings → blended teams.json
│   ├── update-week.ts              # stats (+ optional schedule) + precompute
│   └── precompute-predictions.ts   # Monte Carlo batch over schedule.json
├── src/
│   ├── app/
│   │   ├── page.tsx                # Home
│   │   ├── schedule/page.tsx
│   │   ├── games/[id]/page.tsx
│   │   ├── teams/page.tsx
│   │   └── about/page.tsx
│   ├── components/
│   │   ├── games/                  # Cards, table, filters
│   │   ├── teams/                  # Stats table + ratings badge
│   │   ├── layout/                 # Header, footer, theme
│   │   └── ui/                     # shadcn components
│   ├── data/
│   │   ├── teams.json              # Blended ratings (fetch-stats)
│   │   ├── schedule.json           # ESPN regular season (fetch-schedule)
│   │   └── predictions.json        # generated
│   └── lib/
│       ├── simulation.ts           # Poisson + Monte Carlo engine
│       ├── stats-blend.ts          # Prior/YTD blend math
│       ├── data.ts                 # Loaders / joins
│       ├── format.ts
│       └── types.ts
└── package.json
```

## Model (short version)

```
λ_home = (home.offense × away.defense / leagueAvg) + homeFieldAdvantage
λ_away = (away.offense × home.defense / leagueAvg)

For i in 1…10,000:
  homeScore ~ Poisson(λ_home)
  awayScore ~ Poisson(λ_away)
```

We publish mean scores/totals, median-based home spread (negative = home favorite), and win probabilities (ties split 50/50).

See **Methodology** in the app for full details.

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm start` | Serve production build |
| `npm run fetch-stats` | ESPN standings → blended `teams.json` |
| `npm run fetch-schedule` | ESPN slate → `schedule.json` |
| `npm run precompute` | Monte Carlo → `predictions.json` |
| `npm run update-week` | `fetch-stats` + `precompute` (add `--schedule` for slate) |
| `npm run lint` | ESLint |

## Notes

- The 2026 schedule is pulled from **ESPN** (`npm run fetch-schedule`); times/TV can still flex.
- This project is for **entertainment and education only** — not gambling advice.
- Default settings: **10,000** sims per game, **+2.4** home-field points (configurable in `src/lib/simulation.ts` and the precompute script).

## License

Private / personal use unless you add a license of your choice.
