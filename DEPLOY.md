# Deploy NFL Edge Simulator 2026

Recommended path: **GitHub** (source of truth) → **Vercel** (hosting).

## Prerequisites

- GitHub account
- [Vercel](https://vercel.com) account (free tier is fine; sign in with GitHub)

`gh` CLI is available at `~/.local/bin/gh` if you installed it for this project.  
Add to your shell (optional):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

---

## 1. Log in to GitHub CLI

```bash
export PATH="$HOME/.local/bin:$PATH"
gh auth login
```

Choose:

- GitHub.com  
- HTTPS  
- Login with a web browser  

---

## 2. Create the GitHub repo and push

From the project folder:

```bash
cd ~/nfl-edge-simulator-2026
export PATH="$HOME/.local/bin:$PATH"

# Public repo (or use --private)
gh repo create nfl-edge-simulator-2026 --public --source=. --remote=origin --push
```

If the repo already exists on GitHub:

```bash
git remote add origin https://github.com/YOUR_USERNAME/nfl-edge-simulator-2026.git
git push -u origin main
```

---

## 3. Deploy on Vercel (recommended)

### Option A — Vercel dashboard (easiest)

1. Open [https://vercel.com/new](https://vercel.com/new)  
2. **Import** `nfl-edge-simulator-2026` from GitHub  
3. Framework: **Next.js** (auto-detected)  
4. Leave build settings default:
   - Build: `next build` / `npm run build`  
   - Output: Next.js default  
5. Click **Deploy**

You get a URL like `https://nfl-edge-simulator-2026.vercel.app`.

### Option B — Vercel CLI

```bash
cd ~/nfl-edge-simulator-2026
npx vercel login
npx vercel          # preview
npx vercel --prod   # production
```

Link the project to the GitHub repo when prompted so future `git push` auto-deploys.

---

## 4. After deploy

- Open the production URL and smoke-test Home, Schedule, a game page, What-if + **Copy link**  
- Share a scenario, e.g.  
  `https://YOUR_DOMAIN/games/espn-401872656?preset=neutral-site&run=1`

### Weekly updates (after real games start)

On your machine (or later a GitHub Action):

```bash
npm run update-week
git add src/data && git commit -m "Weekly stats + predictions" && git push
```

Vercel rebuilds automatically from `main`.

---

## Notes

- No API keys required for the current app  
- Schedule + predictions are static JSON baked into the build  
- What-if sims run in the visitor’s browser  

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Build fails on Vercel | Check build logs; run `npm run build` locally |
| 404 on game links | Confirm `src/data/schedule.json` and `predictions.json` are committed |
| `gh: command not found` | `export PATH="$HOME/.local/bin:$PATH"` |
