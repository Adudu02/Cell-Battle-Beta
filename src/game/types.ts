export type TeamId = "p1" | "p2";

export type DirectionCode =
  | "n"
  | "s"
  | "e"
  | "w"
  | "ne"
  | "nw"
  | "se"
  | "sw";

export type DirectionName =
  | "north"
  | "south"
  | "east"
  | "west"
  | "northeast"
  | "northwest"
  | "southeast"
  | "southwest";

export type ActionCode =
  | "mn"
  | "ms"
  | "me"
  | "mw"
  | "mne"
  | "mnw"
  | "mse"
  | "msw"
  | "an"
  | "as"
  | "ae"
  | "aw"
  | "ane"
  | "anw"
  | "ase"
  | "asw"
  | "rn"
  | "rs"
  | "re"
  | "rw"
  | "rne"
  | "rnw"
  | "rse"
  | "rsw";

export type ActionKind = "move" | "eat" | "reproduce";

export type NeighborState = "empty" | "allied" | "enemy" | "outside";

export interface BoardPosition {
  row: number;
  col: number;
}

export interface Cell {
  id: number;
  teamId: TeamId;
  teamName: string;
  teamColor: string;
  position: BoardPosition;
  alive: boolean;
  createdTurn: number;
}

export interface PlayerConfig {
  id: TeamId;
  teamName: string;
  teamColor: string;
  algorithmSource: string;
}

export interface ValidationResult {
  isValid: boolean;
  normalizedSource: string;
  diagnostics: string[];
}

export interface PlayerDraft extends PlayerConfig {
  validation: {
    status: "idle" | "validating" | "valid" | "invalid";
    diagnostics: string[];
    normalizedSource: string;
  };
}

export interface CellContext {
  position: BoardPosition;
  currentTurn: number;
  boardSize: {
    rows: number;
    cols: number;
  };
  neighbors: Record<DirectionName, NeighborState>;
  nearbyAllies: DirectionName[];
  nearbyEnemies: DirectionName[];
  hasNearbyAllies: boolean;
  hasNearbyEnemies: boolean;
}

export interface TeamStats {
  livingCells: number;
}

export interface BoardCellPatch {
  row: number;
  col: number;
  color: string | null;
}

export interface BoardPatch {
  fullSync: boolean;
  changes: BoardCellPatch[];
}

export interface RuntimeErrorEntry {
  turn: number;
  teamId: TeamId;
  teamName: string;
  cellId: number;
  message: string;
}

export interface MatchResult {
  winnerTeamId: TeamId | null;
  winnerTeamName: string | null;
  isDraw: boolean;
  finalTurn: number;
  cause: string;
  termination: "one-team-remaining" | "mutual-elimination" | "turn-limit" | "manual";
  livingCellsByTeam: Record<TeamId, number>;
}

export interface SimulationSnapshot {
  players: Record<TeamId, PlayerConfig>;
  currentTurn: number;
  turnLimit: number;
  cells?: Cell[];
  boardPatch: BoardPatch;
  stats: Record<TeamId, TeamStats>;
  errors: RuntimeErrorEntry[];
  result: MatchResult | null;
}

export type AlgorithmRunner = (context: CellContext) => ActionCode;

export interface EngineController {
  getSnapshot(): SimulationSnapshot;
  stepTurn(): SimulationSnapshot;
  stepTurns(maxTurns: number): SimulationSnapshot;
  endMatch(): SimulationSnapshot;
  isFinished(): boolean;
}
