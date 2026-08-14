/**
 * Shareable What-if scenario URLs.
 *
 * Compact preset form (survives weekly board rating updates):
 *   /games/{id}?preset=neutral-site&sims=5000&run=1
 *
 * Custom absolute rates:
 *   /games/{id}?ho=26&hd=19.5&ao=24&ad=21&hfa=0&sims=5000&run=1
 *
 * Param legend:
 *   ho / hd  — home offense PPG / defense PAPG
 *   ao / ad  — away offense PPG / defense PAPG
 *   hfa      — home-field advantage points
 *   sims     — simulation count (2000 | 5000 | 10000)
 *   preset   — named preset id (applied from published board first)
 *   run      — 1 to auto-run simulation after hydrate
 */

import {
  WHAT_IF_PRESETS,
  clampHfa,
  clampRate,
  getPreset,
  matchPresetId,
  type WhatIfPresetId,
  type WhatIfScenarioInputs,
} from "./what-if-presets";

const VALID_SIMS = new Set([2000, 5000, 10000]);
const PRESET_IDS = new Set(WHAT_IF_PRESETS.map((p) => p.id));

export function isWhatIfPresetId(value: string): value is WhatIfPresetId {
  return PRESET_IDS.has(value as WhatIfPresetId);
}

export interface ParsedWhatIfUrl {
  inputs: WhatIfScenarioInputs;
  /** Preset that was requested (may be null if fully custom) */
  presetId: WhatIfPresetId | null;
  /** Whether the URL asked to auto-run the sim */
  autoRun: boolean;
  /** True when the query string contained any what-if params */
  hasScenario: boolean;
}

function parseNumber(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parseSims(raw: string | null, fallback: number): number {
  const n = parseNumber(raw);
  if (n != null && VALID_SIMS.has(n)) return n;
  return fallback;
}

/**
 * Resolve scenario inputs from URLSearchParams against the published board.
 * Unknown / invalid values are ignored. Explicit rate params override presets.
 */
export function parseWhatIfSearchParams(
  params: URLSearchParams | { get(name: string): string | null },
  board: WhatIfScenarioInputs
): ParsedWhatIfUrl {
  const presetRaw = params.get("preset");
  const hasPreset = !!(presetRaw && isWhatIfPresetId(presetRaw));
  const hasRates =
    params.get("ho") != null ||
    params.get("hd") != null ||
    params.get("ao") != null ||
    params.get("ad") != null ||
    params.get("hfa") != null;
  const hasSims = params.get("sims") != null;
  const runRaw = params.get("run");
  const autoRun = runRaw === "1" || runRaw === "true";
  const hasScenario = hasPreset || hasRates || hasSims || autoRun;

  const simulations = parseSims(params.get("sims"), board.simulations);

  let inputs: WhatIfScenarioInputs = { ...board, simulations };
  let presetId: WhatIfPresetId | null = null;

  if (hasPreset && presetRaw) {
    const preset = getPreset(presetRaw as WhatIfPresetId);
    if (preset) {
      inputs = preset.apply(board, simulations);
      presetId = preset.id;
    }
  }

  // Explicit absolutes always win (custom share or tweak on top of preset)
  const ho = parseNumber(params.get("ho"));
  const hd = parseNumber(params.get("hd"));
  const ao = parseNumber(params.get("ao"));
  const ad = parseNumber(params.get("ad"));
  const hfa = parseNumber(params.get("hfa"));

  if (ho != null) inputs.homeOffense = clampRate(ho);
  if (hd != null) inputs.homeDefense = clampRate(hd);
  if (ao != null) inputs.awayOffense = clampRate(ao);
  if (ad != null) inputs.awayDefense = clampRate(ad);
  if (hfa != null) inputs.hfa = clampHfa(hfa);
  inputs.simulations = simulations;

  // If custom rates diverge from the named preset, treat as custom
  if (presetId) {
    const matched = matchPresetId(inputs, board);
    if (matched !== presetId) {
      presetId = matched;
    }
  } else if (hasRates) {
    presetId = matchPresetId(inputs, board);
  }

  return { inputs, presetId, autoRun, hasScenario };
}

export interface BuildWhatIfQueryOptions {
  /** Include run=1 so recipients auto-simulate */
  autoRun?: boolean;
  /**
   * Prefer compact `preset=` when the scenario matches a named preset.
   * Default true — better when board ratings update weekly.
   */
  preferPreset?: boolean;
}

/**
 * Build query params for the current scenario.
 * Uses compact preset form when possible; otherwise absolute rates.
 */
export function buildWhatIfQuery(
  inputs: WhatIfScenarioInputs,
  board: WhatIfScenarioInputs,
  options: BuildWhatIfQueryOptions = {}
): URLSearchParams {
  const { autoRun = true, preferPreset = true } = options;
  const q = new URLSearchParams();
  const matched = matchPresetId(inputs, board);

  if (preferPreset && matched && matched !== "baseline") {
    // Compact form — re-applies deltas from whatever board ratings exist when opened
    q.set("preset", matched);
  } else {
    // Custom (or forced absolute) rates
    const isBaseline =
      inputs.homeOffense === board.homeOffense &&
      inputs.homeDefense === board.homeDefense &&
      inputs.awayOffense === board.awayOffense &&
      inputs.awayDefense === board.awayDefense &&
      inputs.hfa === board.hfa;

    if (!isBaseline || !preferPreset) {
      q.set("ho", formatNum(inputs.homeOffense));
      q.set("hd", formatNum(inputs.homeDefense));
      q.set("ao", formatNum(inputs.awayOffense));
      q.set("ad", formatNum(inputs.awayDefense));
      q.set("hfa", formatNum(inputs.hfa));
    }
    // Pure baseline + preferPreset → no rate params (clean game URL)
  }

  // Always include sims when not default for reproducibility
  if (inputs.simulations !== 5000) {
    q.set("sims", String(inputs.simulations));
  }

  if (autoRun) {
    q.set("run", "1");
  }

  return q;
}

function formatNum(n: number): string {
  // Trim trailing zeros: 26.0 → 26, 19.5 → 19.5
  return String(Math.round(n * 10) / 10);
}

/** Absolute share URL for the current page + scenario. */
export function buildWhatIfShareUrl(
  origin: string,
  pathname: string,
  inputs: WhatIfScenarioInputs,
  board: WhatIfScenarioInputs,
  options?: BuildWhatIfQueryOptions
): string {
  const q = buildWhatIfQuery(inputs, board, options);
  const qs = q.toString();
  return qs ? `${origin}${pathname}?${qs}` : `${origin}${pathname}`;
}

/** True if the search params contain any what-if keys we care about. */
export function searchParamsHaveWhatIf(
  params: URLSearchParams | { get(name: string): string | null }
): boolean {
  return (
    params.get("preset") != null ||
    params.get("ho") != null ||
    params.get("hd") != null ||
    params.get("ao") != null ||
    params.get("ad") != null ||
    params.get("hfa") != null ||
    params.get("sims") != null ||
    params.get("run") != null
  );
}
