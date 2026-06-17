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
  DirectionName,
} from "./types";

function boardIndex(row: number, col: number): number {
  return row * BOARD_COLS + col;
}

function isInsideBoard(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLS;
}

const BOARD_SIZE = { rows: BOARD_ROWS, cols: BOARD_COLS } as const;
const DIRECTION_NAMES: DirectionName[] = [
  "north",
  "south",
  "east",
  "west",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
];

function createReusableCellContext(): CellContext {
  return {
    position: { row: 0, col: 0 },
    currentTurn: 0,
    boardSize: BOARD_SIZE,
    neighbors: {
      north: "empty",
      south: "empty",
      east: "empty",
      west: "empty",
      northeast: "empty",
      northwest: "empty",
      southeast: "empty",
      southwest: "empty",
    },
    nearbyAllies: [],
    nearbyEnemies: [],
    hasNearbyAllies: false,
    hasNearbyEnemies: false,
  };
}

function listCells(state: InternalGameState): Cell[] {
  const cells: Cell[] = [];
  for (const id of state.aliveCells) {
    const cell = state.cellsById.get(id);
    if (cell) cells.push(cell);
  }
  return cells;
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
  const boardPatch = flushBoardPatch(state);

  return {
    players: state.players,
    currentTurn: state.currentTurn,
    turnLimit: state.turnLimit,
    cells: boardPatch.fullSync ? listCells(state) : undefined,
    boardPatch,
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

function buildCellContext(
  state: InternalGameState,
  cell: Cell,
  context: CellContext,
): CellContext {
  context.position.row = cell.position.row;
  context.position.col = cell.position.col;
  context.currentTurn = state.currentTurn;
  context.nearbyAllies.length = 0;
  context.nearbyEnemies.length = 0;

  for (let i = 0; i < DIRECTION_NAMES.length; i += 1) {
    const dirName = DIRECTION_NAMES[i];
    const delta = DIRECTION_DELTAS[DIRECTION_NAME_TO_CODE[dirName]];
    const tr = cell.position.row + delta.row;
    const tc = cell.position.col + delta.col;

    if (!isInsideBoard(tr, tc)) {
      context.neighbors[dirName] = "outside";
      continue;
    }

    const id = state.occupancy[boardIndex(tr, tc)];
    if (id === -1) {
      context.neighbors[dirName] = "empty";
    } else {
      const other = state.cellsById.get(id)!;
      if (other.teamId === cell.teamId) {
        context.neighbors[dirName] = "allied";
        context.nearbyAllies.push(dirName);
      } else {
        context.neighbors[dirName] = "enemy";
        context.nearbyEnemies.push(dirName);
      }
    }
  }

  context.hasNearbyAllies = context.nearbyAllies.length > 0;
  context.hasNearbyEnemies = context.nearbyEnemies.length > 0;

  return context;
}

function removeCell(state: InternalGameState, cell: Cell): void {
  cell.alive = false;
  state.aliveCells.delete(cell.id);
  state.cellsById.delete(cell.id);
  state.dirtyCreatedTurns.add(cell.createdTurn);
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  markBoardPositionDirty(state, cell.position.row, cell.position.col);
  state.teamStats[cell.teamId].livingCells -= 1;
}

function moveCell(state: InternalGameState, cell: Cell, row: number, col: number): void {
  const previousRow = cell.position.row;
  const previousCol = cell.position.col;
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  cell.position.row = row;
  cell.position.col = col;
  state.occupancy[boardIndex(row, col)] = cell.id;
  markBoardPositionDirty(state, previousRow, previousCol);
  markBoardPositionDirty(state, row, col);
}

function compactDirtyTurnGroups(state: InternalGameState): void {
  if (state.dirtyCreatedTurns.size === 0) {
    return;
  }

  for (const createdTurn of state.dirtyCreatedTurns) {
    const bucket = state.cellsByCreatedTurn.get(createdTurn);
    if (!bucket) {
      continue;
    }

    let writeIndex = 0;
    for (let readIndex = 0; readIndex < bucket.length; readIndex += 1) {
      const cellId = bucket[readIndex];
      if (!state.cellsById.has(cellId)) {
        continue;
      }

      bucket[writeIndex] = cellId;
      writeIndex += 1;
    }

    bucket.length = writeIndex;
    if (bucket.length === 0) {
      state.cellsByCreatedTurn.delete(createdTurn);
    }
  }

  let writeIndex = 0;
  for (let readIndex = 0; readIndex < state.createdTurnGroups.length; readIndex += 1) {
    const createdTurn = state.createdTurnGroups[readIndex];
    if (!state.cellsByCreatedTurn.has(createdTurn)) {
      continue;
    }

    state.createdTurnGroups[writeIndex] = createdTurn;
    writeIndex += 1;
  }
  state.createdTurnGroups.length = writeIndex;
  state.dirtyCreatedTurns.clear();
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
  reusableContext: CellContext,
): void {
  const turnStartGroupLength = state.createdTurnGroups.length;

  for (let groupIndex = turnStartGroupLength - 1; groupIndex >= 0; groupIndex -= 1) {
    const createdTurn = state.createdTurnGroups[groupIndex];
    const bucket = state.cellsByCreatedTurn.get(createdTurn);
    if (!bucket) continue;

    for (let i = 0; i < bucket.length; i += 1) {
      const cellId = bucket[i];
      const cell = state.cellsById.get(cellId);
      if (!cell || !cell.alive) continue;

      try {
        const context = buildCellContext(state, cell, reusableContext);
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
  }

  compactDirtyTurnGroups(state);
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
  const reusableContext = createReusableCellContext();

  return {
    getSnapshot() { return toSnapshot(state); },
    stepTurn() {
      if (!state.result) executeTurn(state, runners, reusableContext);
      return toSnapshot(state);
    },
    stepTurns(maxTurns) {
      let turns = 0;
      while (!state.result && turns < maxTurns) {
        executeTurn(state, runners, reusableContext);
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
