import { MAX_RUNTIME_ERRORS, BOARD_COLS, BOARD_ROWS } from "./constants";
import { parseActionCode } from "./actions";
import { DIRECTION_DELTAS, DIRECTION_NAME_TO_CODE } from "./directions";
import { createInitialState, type InternalGameState } from "./initialState";
import { createManualResult, evaluateVictory } from "./victory";
import type {
  AlgorithmRunner,
  Cell,
  CellContext,
  BoardCellPatch,
  EngineController,
  PlayerConfig,
  RuntimeErrorEntry,
  SimulationSnapshot,
  TeamId,
  NeighborState,
  DirectionName,
} from "./types";

function boardIndex(row: number, col: number): number {
  return row * BOARD_COLS + col;
}

function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

const BOARD_SIZE = { rows: BOARD_ROWS, cols: BOARD_COLS } as const;
const EMPTY_DIRECTIONS: DirectionName[] = [];

// No sort — just filter alive cells; sorting happens once in executeTurn
function listCells(state: InternalGameState): Cell[] {
  const cells: Cell[] = [];
  for (const id of state.aliveCells) {
    const cell = state.cellsById.get(id);
    if (cell) cells.push(cell);
  }
  return cells;
}

function createTurnOrder(state: InternalGameState): number[] {
  return listCells(state)
    .map((cell) => ({
      id: cell.id,
      createdTurn: cell.createdTurn,
      row: cell.position.row,
      col: cell.position.col,
    }))
    .sort((a, b) => {
      if (a.createdTurn !== b.createdTurn) return a.createdTurn - b.createdTurn;
      if (a.row !== b.row) return a.row - b.row;
      if (a.col !== b.col) return a.col - b.col;
      return a.id - b.id;
    })
    .map((cell) => cell.id);
}

function flushBoardPatch(state: InternalGameState): {
  fullSync: boolean;
  changes: BoardCellPatch[];
} {
  const patch = {
    fullSync: state.boardFullSyncPending,
    changes: [...state.pendingBoardChanges.values()],
  };

  state.boardFullSyncPending = false;
  state.pendingBoardChanges.clear();

  return patch;
}

function toSnapshot(state: InternalGameState): SimulationSnapshot {
  return {
    players: state.players,
    currentTurn: state.currentTurn,
    turnLimit: state.turnLimit,
    cells: listCells(state),
    boardPatch: flushBoardPatch(state),
    stats: {
      p1: { ...state.teamStats.p1 },
      p2: { ...state.teamStats.p2 },
    },
    errors: [...state.errors],
    result: state.result,
  };
}

function recordError(
  state: InternalGameState,
  entry: RuntimeErrorEntry,
): void {
  if (state.errors.length < MAX_RUNTIME_ERRORS) {
    state.errors.push(entry);
    return;
  }
  if (!state.errorOverflowed) {
    state.errorOverflowed = true;
    state.errors.push({
      turn: state.currentTurn,
      teamId: entry.teamId,
      teamName: entry.teamName,
      cellId: entry.cellId,
      message: "Additional runtime errors were suppressed.",
    });
  }
}

// Raw lookup — caller validates bounds
function getCellAt(state: InternalGameState, row: number, col: number): Cell | null {
  const id = state.occupancy[boardIndex(row, col)];
  return id === -1 ? null : state.cellsById.get(id) ?? null;
}

function markBoardPositionDirty(
  state: InternalGameState,
  row: number,
  col: number,
): void {
  const occupant = getCellAt(state, row, col);
  state.pendingBoardChanges.set(boardIndex(row, col), {
    row,
    col,
    color: occupant?.teamColor ?? null,
  });
}

// Reusable scratch buffer avoids per-call allocations
const _nDir: DirectionName[] = ["north","south","east","west","northeast","northwest","southeast","southwest"];
const _neighborOut: [DirectionName, NeighborState][] = [
  ["north","empty"],["south","empty"],["east","empty"],["west","empty"],
  ["northeast","empty"],["northwest","empty"],["southeast","empty"],["southwest","empty"],
];
const _nearbyAllies = new Array<DirectionName>(8);
const _nearbyEnemies = new Array<DirectionName>(8);

function buildCellContext(state: InternalGameState, cell: Cell): CellContext {
  let allyCount = 0;
  let enemyCount = 0;

  for (let i = 0; i < 8; i++) {
    const dirName = _nDir[i];
    const delta = DIRECTION_DELTAS[DIRECTION_NAME_TO_CODE[dirName]];
    const tr = cell.position.row + delta.row;
    const tc = cell.position.col + delta.col;

    if (!isInsideBoard(tr, tc)) {
      _neighborOut[i][1] = "outside";
      continue;
    }

    const id = state.occupancy[boardIndex(tr, tc)];
    if (id === -1) {
      _neighborOut[i][1] = "empty";
    } else {
      const other = state.cellsById.get(id)!;
      if (other.teamId === cell.teamId) {
        _neighborOut[i][1] = "allied";
        _nearbyAllies[allyCount] = dirName;
        allyCount += 1;
      } else {
        _neighborOut[i][1] = "enemy";
        _nearbyEnemies[enemyCount] = dirName;
        enemyCount += 1;
      }
    }
  }

  const neighbors = {
    north: _neighborOut[0][1], south: _neighborOut[1][1],
    east: _neighborOut[2][1], west: _neighborOut[3][1],
    northeast: _neighborOut[4][1], northwest: _neighborOut[5][1],
    southeast: _neighborOut[6][1], southwest: _neighborOut[7][1],
  } as CellContext["neighbors"];

  return {
    position: cell.position,
    currentTurn: state.currentTurn,
    boardSize: BOARD_SIZE,
    neighbors,
    nearbyAllies: allyCount === 0 ? EMPTY_DIRECTIONS : _nearbyAllies.slice(0, allyCount),
    nearbyEnemies: enemyCount === 0 ? EMPTY_DIRECTIONS : _nearbyEnemies.slice(0, enemyCount),
    hasNearbyAllies: allyCount > 0,
    hasNearbyEnemies: enemyCount > 0,
  };
}

function removeCell(state: InternalGameState, cell: Cell): void {
  cell.alive = false;
  state.aliveCells.delete(cell.id);
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  markBoardPositionDirty(state, cell.position.row, cell.position.col);
  state.teamStats[cell.teamId].livingCells -= 1;
}

function moveCell(state: InternalGameState, cell: Cell, row: number, col: number): void {
  const previousRow = cell.position.row;
  const previousCol = cell.position.col;
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  cell.position = { row, col };
  state.occupancy[boardIndex(row, col)] = cell.id;
  markBoardPositionDirty(state, previousRow, previousCol);
  markBoardPositionDirty(state, row, col);
}

function reproduceCell(
  state: InternalGameState,
  cell: Cell,
  row: number,
  col: number,
): void {
  const newCell: Cell = {
    id: state.nextCellId,
    teamId: cell.teamId,
    teamName: cell.teamName,
    teamColor: cell.teamColor,
    position: { row, col },
    alive: true,
    createdTurn: state.currentTurn,
  };

  state.nextCellId += 1;
  state.cellsById.set(newCell.id, newCell);
  state.aliveCells.add(newCell.id);
  let createdTurnBucket = state.cellsByCreatedTurn.get(state.currentTurn);
  if (!createdTurnBucket) {
    createdTurnBucket = [];
    state.cellsByCreatedTurn.set(state.currentTurn, createdTurnBucket);
    state.createdTurnGroups.push(state.currentTurn);
  }
  createdTurnBucket.push(newCell.id);
  state.occupancy[boardIndex(row, col)] = newCell.id;
  markBoardPositionDirty(state, row, col);
  state.teamStats[cell.teamId].livingCells += 1;
}

function resolveAction(
  state: InternalGameState,
  cell: Cell,
  action: ReturnType<typeof parseActionCode>,
): void {
  if (!action.direction) return;

  const { row: dr, col: dc } = DIRECTION_DELTAS[action.direction];
  const tr = cell.position.row + dr;
  const tc = cell.position.col + dc;

  if (!isInsideBoard(tr, tc)) return;

  const occupant = getCellAt(state, tr, tc);

  if (action.kind === "move") {
    if (occupant) return;
    moveCell(state, cell, tr, tc);
    return;
  }

  if (action.kind === "eat") {
    if (!occupant || occupant.teamId === cell.teamId) return;
    removeCell(state, occupant);
    moveCell(state, cell, tr, tc);
    return;
  }

  if (action.kind === "reproduce") {
    if (occupant) return;
    reproduceCell(state, cell, tr, tc);
  }
}

function executeTurn(
  state: InternalGameState,
  runners: Record<TeamId, AlgorithmRunner>,
): void {
  const turnOrder = createTurnOrder(state);

  for (const cellId of turnOrder) {
    const cell = state.cellsById.get(cellId);
    if (!cell || !cell.alive) continue;

    try {
      const context = buildCellContext(state, cell);
      const actionCode = runners[cell.teamId](context);
      resolveAction(state, cell, parseActionCode(actionCode));
    } catch (error) {
      recordError(state, {
        turn: state.currentTurn,
        teamId: cell.teamId,
        teamName: cell.teamName,
        cellId: cell.id,
        message: error instanceof Error ? error.message : "Unknown runtime error.",
      });
    }
  }

  state.result = evaluateVictory(state);
  if (!state.result) {
    state.currentTurn += 1;
  }
}

export function createEngine(
  players: Record<TeamId, PlayerConfig>,
  runners: Record<TeamId, AlgorithmRunner>,
): EngineController {
  return createEngineFromState(createInitialState(players), runners);
}

export function createEngineFromState(
  state: InternalGameState,
  runners: Record<TeamId, AlgorithmRunner>,
): EngineController {
  return {
    getSnapshot() { return toSnapshot(state); },
    stepTurn() {
      if (!state.result) executeTurn(state, runners);
      return toSnapshot(state);
    },
    stepTurns(maxTurns) {
      let turns = 0;
      while (!state.result && turns < maxTurns) {
        executeTurn(state, runners);
        turns += 1;
      }
      return toSnapshot(state);
    },
    endMatch() {
      if (!state.result) {
        state.result = evaluateVictory(state) ?? createManualResult(state);
      }
      return toSnapshot(state);
    },
    isFinished() { return state.result !== null; },
  };
}
