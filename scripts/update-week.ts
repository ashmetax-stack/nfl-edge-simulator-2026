/**
 * Weekly ops pipeline:
 *   1) (optional) refresh ESPN schedule
 *   2) pull + blend team stats from ESPN standings
 *   3) recompute Monte Carlo predictions
 *
 * Usage:
 *   npm run update-week
 *   npm run update-week -- --schedule
 *   npm run update-week -- --season 2026 --prior 2025
 */

import { spawnSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");

function run(label: string, script: string, extraArgs: string[] = []) {
  console.log(`\n═══ ${label} ═══`);
  const result = spawnSync(
    "npx",
    ["tsx", script, ...extraArgs],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
      shell: process.platform === "win32",
    }
  );
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit ${result.status}`);
  }
}

function main() {
  const argv = process.argv.slice(2);
  const withSchedule = argv.includes("--schedule");
  const passthrough = argv.filter((a) => a !== "--schedule");

  console.log("NFL Edge Simulator — weekly update pipeline");
  console.log(
    withSchedule
      ? "Mode: schedule + stats + precompute"
      : "Mode: stats + precompute (pass --schedule to refresh slate)"
  );

  if (withSchedule) {
    run("Fetch ESPN schedule", "scripts/fetch-espn-schedule.ts");
  }

  run("Fetch + blend team stats", "scripts/fetch-team-stats.ts", passthrough);
  run("Precompute predictions", "scripts/precompute-predictions.ts");

  console.log("\n✓ Weekly update complete.");
  console.log("  Restart or refresh npm run dev / redeploy to publish.");
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
