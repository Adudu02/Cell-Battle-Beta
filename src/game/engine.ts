import { MAX_HEALTH, REST_HEAL, EAT_DAMAGE, MAX_RUNTIME_ERRORS, BOARD_COLS, BOARD_ROWS } from "./constants";
import { parseActionCode } from "./actions";
import { DIRECTION_NAME_TO_CODE, DIRECTION_NAMES, DIRECTION_DELTAS } from "./directions";
import { createInitialState, type InternalGameState } from "./initialState";
import { evaluateVictory } from "./victory";
import type {
  AlgorithmRunner,
  Cell,
  CellContext,
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

// No sort — just filter alive cells; sorting happens once in executeTurn
function listCells(state: InternalGameState): Cell[] {
  const cells: Cell[] = [];
  for (const id of state.aliveCells) {
    const cell = state.cellsById.get(id);
    if (cell) cells.push(cell);
  }
  return cells;
}

function toSnapshot(state: InternalGameState): SimulationSnapshot {
  return {
    players: state.players,
    currentTurn: state.currentTurn,
    turnLimit: state.turnLimit,
    cells: listCells(state),
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

// Reusable scratch buffer avoids per-call allocations
const _nDir: DirectionName[] = ["north","south","east","west","northeast","northwest","southeast","southwest"];
const _neighborOut: [DirectionName, NeighborState][] = [
  ["north","empty"],["south","empty"],["east","empty"],["west","empty"],
  ["northeast","empty"],["northwest","empty"],["southeast","empty"],["southwest","empty"],
];

function buildCellContext(state: InternalGameState, cell: Cell): CellContext {
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
      _neighborOut[i][1] = other.teamId === cell.teamId ? "allied" : "enemy";
    }
  }

  const neighbors = {
    north: _neighborOut[0][1], south: _neighborOut[1][1],
    east: _neighborOut[2][1], west: _neighborOut[3][1],
    northeast: _neighborOut[4][1], northwest: _neighborOut[5][1],
    southeast: _neighborOut[6][1], southwest: _neighborOut[7][1],
  } as CellContext["neighbors"];

  const nearbyAllies: DirectionName[] = [];
  const nearbyEnemies: DirectionName[] = [];
  for (let i = 0; i < 8; i++) {
    if (_neighborOut[i][1] === "allied") nearbyAllies.push(_nDir[i]);
    if (_neighborOut[i][1] === "enemy") nearbyEnemies.push(_nDir[i]);
  }

  return {
    health: cell.health,
    position: cell.position,
    teamTotalHealth: state.teamStats[cell.teamId].totalHealth,
    currentTurn: state.currentTurn,
    boardSize: { rows: BOARD_ROWS, cols: BOARD_COLS },
    neighbors,
    nearbyAllies,
    nearbyEnemies,
    hasNearbyAllies: nearbyAllies.length > 0,
    hasNearbyEnemies: nearbyEnemies.length > 0,
  };
}

function removeCell(state: InternalGameState, cell: Cell): void {
  cell.alive = false;
  state.aliveCells.delete(cell.id);
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  state.teamStats[cell.teamId].livingCells -= 1;
}

function applyDamage(state: InternalGameState, cell: Cell, amount: number): void {
  const appliedDamage = Math.min(amount, cell.health);
  state.teamStats[cell.teamId].totalHealth -= appliedDamage;
  cell.health = Math.max(0, cell.health - appliedDamage);
  if (cell.health === 0 && cell.alive) {
    removeCell(state, cell);
  }
}

function healCell(state: InternalGameState, cell: Cell, amount: number): void {
  const nextHealth = Math.min(MAX_HEALTH, cell.health + amount);
  state.teamStats[cell.teamId].totalHealth += nextHealth - cell.health;
  cell.health = nextHealth;
}

function moveCell(state: InternalGameState, cell: Cell, row: number, col: number): void {
  state.occupancy[boardIndex(cell.position.row, cell.position.col)] = -1;
  cell.position = { row, col };
  state.occupancy[boardIndex(row, col)] = cell.id;
}

function reproduceCell(
  state: InternalGameState,
  cell: Cell,
  row: number,
  col: number,
): void {
  const originalHealth = Math.ceil(cell.health / 2);
  const newHealth = Math.floor(cell.health / 2);
  cell.health = originalHealth;

  if (newHealth <= 0) return;

  const newCell: Cell = {
    id: state.nextCellId,
    teamId: cell.teamId,
    teamName: cell.teamName,
    teamColor: cell.teamColor,
    position: { row, col },
    health: newHealth,
    alive: true,
    createdTurn: state.currentTurn,
  };

  state.nextCellId += 1;
  state.cellsById.set(newCell.id, newCell);
  state.aliveCells.add(newCell.id);
  state.occupancy[boardIndex(row, col)] = newCell.id;
  state.teamStats[cell.teamId].livingCells += 1;
}

function resolveAction(
  state: InternalGameState,
  cell: Cell,
  action: ReturnType<typeof parseActionCode>,
): void {
  if (action.kind === "rest") {
    healCell(state, cell, REST_HEAL);
    return;
  }

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
    applyDamage(state, occupant, EAT_DAMAGE);
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
  const turnOrder = listCells(state)
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
    });

  for (const snapshot of turnOrder) {
    const cell = state.cellsById.get(snapshot.id);
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
    isFinished() { return state.result !== null; },
  };
}