/**
 * What-if scenario presets.
 * Each preset is applied as deltas from the published board rates so weekly
 * ESPN rating updates stay meaningful.
 */

import { HOME_FIELD_ADVANTAGE } from "./simulation";
import { round1 } from "./stats-blend";

export interface WhatIfScenarioInputs {
  homeOffense: number;
  homeDefense: number;
  awayOffense: number;
  awayDefense: number;
  hfa: number;
  simulations: number;
}

export type WhatIfPresetId =
  | "baseline"
  | "neutral-site"
  | "home-injury"
  | "away-injury"
  | "home-lockdown"
  | "away-lockdown"
  | "shootout"
  | "defensive-struggle";

export interface WhatIfPreset {
  id: WhatIfPresetId;
  label: string;
  /** Short chip label */
  shortLabel: string;
  description: string;
  /**
   * Build scenario inputs from the published board baseline.
   * Preserves the caller's current simulation count.
   */
  apply: (
    board: WhatIfScenarioInputs,
    simulations: number
  ) => WhatIfScenarioInputs;
}

function clampRate(n: number): number {
  if (Number.isNaN(n)) return 20;
  return Math.min(45, Math.max(8, round1(n)));
}

function clampHfa(n: number): number {
  return Math.min(10, Math.max(-2, round1(n)));
}

/** Board defaults used when constructing a fresh scenario. */
export function boardScenarioInputs(
  homeOffense: number,
  homeDefense: number,
  awayOffense: number,
  awayDefense: number,
  simulations = 5000
): WhatIfScenarioInputs {
  return {
    homeOffense,
    homeDefense,
    awayOffense,
    awayDefense,
    hfa: HOME_FIELD_ADVANTAGE,
    simulations,
  };
}

/**
 * Presets always start from the published board (not the current dirty draft),
 * so stacking chips doesn't compound wildly. Users can still hand-edit after.
 */
export const WHAT_IF_PRESETS: WhatIfPreset[] = [
  {
    id: "baseline",
    label: "Board rates",
    shortLabel: "Board",
    description: "Published team rates and standard home-field advantage.",
    apply: (board, simulations) => ({
      ...board,
      hfa: HOME_FIELD_ADVANTAGE,
      simulations,
    }),
  },
  {
    id: "neutral-site",
    label: "Neutral site",
    shortLabel: "Neutral",
    description: "No home-field advantage (HFA = 0).",
    apply: (board, simulations) => ({
      ...board,
      hfa: 0,
      simulations,
    }),
  },
  {
    id: "home-injury",
    label: "Home injury",
    shortLabel: "Home ↓",
    description: "Home offense −3.0 PPG (e.g. missing a star skill player).",
    apply: (board, simulations) => ({
      ...board,
      homeOffense: clampRate(board.homeOffense - 3),
      hfa: board.hfa,
      simulations,
    }),
  },
  {
    id: "away-injury",
    label: "Away injury",
    shortLabel: "Away ↓",
    description: "Away offense −3.0 PPG.",
    apply: (board, simulations) => ({
      ...board,
      awayOffense: clampRate(board.awayOffense - 3),
      hfa: board.hfa,
      simulations,
    }),
  },
  {
    id: "home-lockdown",
    label: "Home lockdown D",
    shortLabel: "Home D",
    description: "Home defense allows 2.5 fewer PPG (stronger unit).",
    apply: (board, simulations) => ({
      ...board,
      homeDefense: clampRate(board.homeDefense - 2.5),
      hfa: board.hfa,
      simulations,
    }),
  },
  {
    id: "away-lockdown",
    label: "Away lockdown D",
    shortLabel: "Away D",
    description: "Away defense allows 2.5 fewer PPG.",
    apply: (board, simulations) => ({
      ...board,
      awayDefense: clampRate(board.awayDefense - 2.5),
      hfa: board.hfa,
      simulations,
    }),
  },
  {
    id: "shootout",
    label: "Shootout",
    shortLabel: "Shootout",
    description: "Both offenses +2.0 PPG.",
    apply: (board, simulations) => ({
      ...board,
      homeOffense: clampRate(board.homeOffense + 2),
      awayOffense: clampRate(board.awayOffense + 2),
      hfa: board.hfa,
      simulations,
    }),
  },
  {
    id: "defensive-struggle",
    label: "Defensive struggle",
    shortLabel: "Low scoring",
    description: "Both offenses −2.0 PPG (sloppy / weather / grind-it-out).",
    apply: (board, simulations) => ({
      ...board,
      homeOffense: clampRate(board.homeOffense - 2),
      awayOffense: clampRate(board.awayOffense - 2),
      hfa: board.hfa,
      simulations,
    }),
  },
];

export function getPreset(id: WhatIfPresetId): WhatIfPreset | undefined {
  return WHAT_IF_PRESETS.find((p) => p.id === id);
}

/** Detect which single preset (if any) matches the current draft vs board. */
export function matchPresetId(
  draft: WhatIfScenarioInputs,
  board: WhatIfScenarioInputs
): WhatIfPresetId | null {
  for (const preset of WHAT_IF_PRESETS) {
    const applied = preset.apply(board, draft.simulations);
    if (
      applied.homeOffense === draft.homeOffense &&
      applied.homeDefense === draft.homeDefense &&
      applied.awayOffense === draft.awayOffense &&
      applied.awayDefense === draft.awayDefense &&
      applied.hfa === draft.hfa
    ) {
      return preset.id;
    }
  }
  return null;
}

export { clampRate, clampHfa };
