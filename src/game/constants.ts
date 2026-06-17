import type { ActionCode, TeamId } from "./types";

export const BOARD_ROWS = 100;
export const BOARD_COLS = 200;
export const DEFAULT_TURN_LIMIT = 5000;
export const MAX_RUNTIME_ERRORS = 24;

export const TEAM_COLORS = [
  "#1ad1ea",
  "#4cd269",
  "#ffc83d",
  "#ff8b3d",
  "#f45a67",
  "#7b58d8",
  "#3967dc",
  "#6d737a",
] as const;

export const TEAM_DEFAULTS: Record<
  TeamId,
  { teamName: string; teamColor: string; algorithmSource: string }
> = {
  p1: {
    teamName: "Alpha Division",
    teamColor: TEAM_COLORS[0],
    algorithmSource: `function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  if (context.neighbors.north === "enemy") {
    return "an";
  }

  if (context.neighbors.east === "empty") {
    return "me";
  }

  return "mn";
}`,
  },
  p2: {
    teamName: "Beta Legion",
    teamColor: TEAM_COLORS[4],
    algorithmSource: `function decide(context) {
  if (context.neighbors.west === "enemy") {
    return "aw";
  }

  if (context.hasNearbyEnemies) {
    return "aw";
  }

  if (context.neighbors.west === "empty") {
    return "mw";
  }

  return "ms";
}`,
  },
};

export const ACTION_CODES: readonly ActionCode[] = [
  "mn",
  "ms",
  "me",
  "mw",
  "mne",
  "mnw",
  "mse",
  "msw",
  "an",
  "as",
  "ae",
  "aw",
  "ane",
  "anw",
  "ase",
  "asw",
  "rn",
  "rs",
  "re",
  "rw",
  "rne",
  "rnw",
  "rse",
  "rsw",
] as const;
