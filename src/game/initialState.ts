import {
  BOARD_COLS, BOARD_ROWS, DEFAULT_TURN_LIMIT,
} from "./constants";
import type {
  BoardCellPatch,
  Cell,
  MatchResult,
  PlayerConfig,
  TeamId,
  TeamStats,
} from "./types";

export interface InternalGameState {
  players: Record<TeamId, PlayerConfig>;
  currentTurn: number;
  turnLimit: number;
  cellsById: Map<number, Cell>;
  aliveCells: Set<number>;
  cellsByCreatedTurn: Map<number, number[]>;
  createdTurnGroups: number[];
  occupancy: Int32Array;
  teamStats: Record<TeamId, TeamStats>;
  nextCellId: number;
  pendingBoardChanges: Map<number, BoardCellPatch>;
  boardFullSyncPending: boolean;
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

function randomInt(min: number, max: number, rng: () => number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function createRandomStartingCells(
  players: Record<TeamId, PlayerConfig>,
  rng: () => number,
): [Cell, Cell] {
  const leftMinCol = 8;
  const leftMaxCol = Math.max(leftMinCol, Math.floor(BOARD_COLS * 0.2));
  const rightMinCol = Math.min(
    BOARD_COLS - 9,
    Math.max(leftMaxCol + 20, Math.floor(BOARD_COLS * 0.8)),
  );
  const rightMaxCol = BOARD_COLS - 9;

  const p1Cell: Cell = {
    id: 1,
    teamId: "p1",
    teamName: players.p1.teamName,
    teamColor: players.p1.teamColor,
    position: {
      row: randomInt(8, BOARD_ROWS - 9, rng),
      col: randomInt(leftMinCol, leftMaxCol, rng),
    },
    alive: true,
    createdTurn: 0,
  };

  const p2Cell: Cell = {
    id: 2,
    teamId: "p2",
    teamName: players.p2.teamName,
    teamColor: players.p2.teamColor,
    position: {
      row: randomInt(8, BOARD_ROWS - 9, rng),
      col: randomInt(rightMinCol, rightMaxCol, rng),
    },
    alive: true,
    createdTurn: 0,
  };

  return [p1Cell, p2Cell];
}

export function createInitialState(
  players: Record<TeamId, PlayerConfig>,
  rng: () => number = Math.random,
): InternalGameState {
  const occupancy = new Int32Array(BOARD_ROWS * BOARD_COLS).fill(-1);
  const cellsById = new Map<number, Cell>();
  const [p1Cell, p2Cell] = createRandomStartingCells(players, rng);

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
    cellsByCreatedTurn: new Map([[0, [p1Cell.id, p2Cell.id]]]),
    createdTurnGroups: [0],
    occupancy,
    teamStats: {
      p1: { livingCells: 1 },
      p2: { livingCells: 1 },
    },
    nextCellId: 3,
    pendingBoardChanges: new Map(),
    boardFullSyncPending: true,
    errors: [],
    errorOverflowed: false,
    result: null,
  };
}
