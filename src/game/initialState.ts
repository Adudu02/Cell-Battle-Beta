import {
  BOARD_COLS, BOARD_ROWS, DEFAULT_TURN_LIMIT, INITIAL_HEALTH,
} from "./constants";
import type { Cell, MatchResult, PlayerConfig, TeamId, TeamStats } from "./types";

export interface InternalGameState {
  players: Record<TeamId, PlayerConfig>;
  currentTurn: number;
  turnLimit: number;
  cellsById: Map<number, Cell>;
  aliveCells: Set<number>;
  occupancy: Int32Array;
  teamStats: Record<TeamId, TeamStats>;
  nextCellId: number;
  errors: {
    turn: number;
    teamId: TeamId;
    teamName: string;
    cellId: number;
    message: string;
  }[];
  errorOverflowed: boolean;
  result: MatchResult | null;
}

function boardIndex(row: number, col: number): number {
  return row * BOARD_COLS + col;
}

export function createInitialState(
  players: Record<TeamId, PlayerConfig>,
): InternalGameState {
  const occupancy = new Int32Array(BOARD_ROWS * BOARD_COLS).fill(-1);
  const cellsById = new Map<number, Cell>();

  const p1Cell: Cell = {
    id: 1,
    teamId: "p1",
    teamName: players.p1.teamName,
    teamColor: players.p1.teamColor,
    position: { row: Math.floor(BOARD_ROWS / 2), col: 24 },
    health: INITIAL_HEALTH,
    alive: true,
    createdTurn: 0,
  };

  const p2Cell: Cell = {
    id: 2,
    teamId: "p2",
    teamName: players.p2.teamName,
    teamColor: players.p2.teamColor,
    position: { row: Math.floor(BOARD_ROWS / 2), col: BOARD_COLS - 25 },
    health: INITIAL_HEALTH,
    alive: true,
    createdTurn: 0,
  };

  cellsById.set(p1Cell.id, p1Cell);
  cellsById.set(p2Cell.id, p2Cell);

  occupancy[boardIndex(p1Cell.position.row, p1Cell.position.col)] = p1Cell.id;
  occupancy[boardIndex(p2Cell.position.row, p2Cell.position.col)] = p2Cell.id;

  return {
    players,
    currentTurn: 1,
    turnLimit: DEFAULT_TURN_LIMIT,
    cellsById,
    aliveCells: new Set([p1Cell.id, p2Cell.id]),
    occupancy,
    teamStats: {
      p1: { livingCells: 1, totalHealth: INITIAL_HEALTH },
      p2: { livingCells: 1, totalHealth: INITIAL_HEALTH },
    },
    nextCellId: 3,
    errors: [],
    errorOverflowed: false,
    result: null,
  };
}