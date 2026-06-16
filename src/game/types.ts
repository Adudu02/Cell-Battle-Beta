// Core type definitions for Battle of Cells

export type Direction = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type MoveAction = "mn" | "ms" | "me" | "mw" | "mne" | "mnw" | "mse" | "msw";
export type EatAction = "an" | "as" | "ae" | "aw" | "ane" | "anw" | "ase" | "asw";
export type ReproduceAction =
  | "rn"
  | "rs"
  | "re"
  | "rw"
  | "rne"
  | "rnw"
  | "rse"
  | "rsw";
export type RestAction = "d";

export type ActionCode = MoveAction | EatAction | ReproduceAction | RestAction;

export const VALID_ACTION_CODES: ActionCode[] = [
  "mn", "ms", "me", "mw", "mne", "mnw", "mse", "msw",
  "an", "as", "ae", "aw", "ane", "anw", "ase", "asw",
  "rn", "rs", "re", "rw", "rne", "rnw", "rse", "rsw",
  "d",
];

export interface BoardPosition {
  row: number;
  col: number;
}

export type NeighborState = "empty" | "allied" | "enemy" | "outside";

export interface NeighborsInfo {
  n: NeighborState;
  s: NeighborState;
  e: NeighborState;
  w: NeighborState;
  ne: NeighborState;
  nw: NeighborState;
  se: NeighborState;
  sw: NeighborState;
}

// Safe context object passed to user algorithms
export interface CellContext {
  health: number;
  position: BoardPosition;
  teamTotalHealth: number;
  currentTurn: number;
  boardSize: { rows: number; cols: number };
  neighbors: NeighborsInfo;
  nearbyAllies: boolean;
  nearbyEnemies: boolean;
}

export interface Player {
  id: 1 | 2;
  name: string;
  color: string;
  code: string;
  validated: boolean;
}

export interface Cell {
  internalId: number;
  teamId: 1 | 2;
  teamName: string;
  color: string;
  position: BoardPosition;
  health: number;
  alive: boolean;
  creationTurn: number;
}

export type TerminationCause =
  | "elimination"
  | "draw_no_survivors"
  | "turn_limit"
  | null;

export interface MatchResult {
  winner: 1 | 2 | "draw" | null;
  team1Name: string;
  team2Name: string;
  team1Color: string;
  team2Color: string;
  team1LivingCells: number;
  team2LivingCells: number;
  team1TotalHealth: number;
  team2TotalHealth: number;
  finalTurn: number;
  cause: TerminationCause;
}

export interface ErrorLogEntry {
  turn: number;
  teamId: 1 | 2;
  message: string;
  count: number;
}

export interface GameState {
  cells: Cell[];
  currentTurn: number;
  turnLimit: number;
  isRunning: boolean;
  isPaused: boolean;
  isFinished: boolean;
  result: MatchResult | null;
  errors: ErrorLogEntry[];
  nextInternalId: number;
}

export type GamePhase = "configuration" | "simulation" | "final";
