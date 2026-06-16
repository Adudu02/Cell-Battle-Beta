// Core simulation engine for Battle of Cells.
//
// The engine is kept fully separate from React. It owns the authoritative
// game state and exposes pure-ish functions to advance the simulation by one
// turn. The board itself is represented implicitly via an occupancy grid for
// O(1) position lookups; the list of cells is the source of truth for
// rendering and statistics.

import type {
  BoardPosition,
  Cell,
  CellContext,
  ErrorLogEntry,
  GameState,
  NeighborsInfo,
  NeighborState,
  Player,
} from "./types";
import { BOARD_COLS, BOARD_ROWS, EAT_DAMAGE, MAX_ERROR_LOG_ENTRIES, MAX_HEALTH, REST_RECOVERY } from "./constants";
import { ALL_DIRECTIONS, getNeighborPosition, isOnBoard, directionFromActionCode } from "./directions";
import { isEatAction, isMoveAction, isReproduceAction, isRestAction, isValidActionCode } from "./actions";
import { runAlgorithm, RuntimeError, type FunctionDecl } from "./interpreter";
import { SIMULATION_TIMEOUT_MS } from "./constants";

// ---------------------------------------------------------------------------
// Occupancy grid
// ---------------------------------------------------------------------------

// A flat array indexed by row * BOARD_COLS + col. Stores the internalId of
// the occupying cell, or -1 if empty.
export class OccupancyGrid {
  private grid: Int32Array;

  constructor() {
    this.grid = new Int32Array(BOARD_ROWS * BOARD_COLS).fill(-1);
  }

  private index(pos: BoardPosition): number {
    return pos.row * BOARD_COLS + pos.col;
  }

  get(pos: BoardPosition): number {
    if (!isOnBoard(pos)) return -1;
    return this.grid[this.index(pos)];
  }

  set(pos: BoardPosition, internalId: number): void {
    this.grid[this.index(pos)] = internalId;
  }

  clear(pos: BoardPosition): void {
    this.grid[this.index(pos)] = -1;
  }

  isEmpty(pos: BoardPosition): boolean {
    if (!isOnBoard(pos)) return false;
    return this.grid[this.index(pos)] === -1;
  }

  static fromCells(cells: Cell[]): OccupancyGrid {
    const grid = new OccupancyGrid();
    for (const cell of cells) {
      if (cell.alive) {
        grid.set(cell.position, cell.internalId);
      }
    }
    return grid;
  }
}

// ---------------------------------------------------------------------------
// Neighbor computation
// ---------------------------------------------------------------------------

export function computeNeighbors(
  pos: BoardPosition,
  selfTeamId: 1 | 2,
  occupancy: OccupancyGrid,
  cellsById: Map<number, Cell>,
): NeighborsInfo {
  const result = {} as NeighborsInfo;

  for (const dir of ALL_DIRECTIONS) {
    const neighborPos = getNeighborPosition(pos, dir);
    let state: NeighborState;

    if (!isOnBoard(neighborPos)) {
      state = "outside";
    } else {
      const occupantId = occupancy.get(neighborPos);
      if (occupantId === -1) {
        state = "empty";
      } else {
        const occupant = cellsById.get(occupantId);
        if (!occupant) {
          state = "empty";
        } else if (occupant.teamId === selfTeamId) {
          state = "allied";
        } else {
          state = "enemy";
        }
      }
    }

    result[dir] = state;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Context building
// ---------------------------------------------------------------------------

export function buildCellContext(
  cell: Cell,
  currentTurn: number,
  teamTotalHealth: number,
  occupancy: OccupancyGrid,
  cellsById: Map<number, Cell>,
): CellContext {
  const neighbors = computeNeighbors(cell.position, cell.teamId, occupancy, cellsById);
  const nearbyAllies = ALL_DIRECTIONS.some((d) => neighbors[d] === "allied");
  const nearbyEnemies = ALL_DIRECTIONS.some((d) => neighbors[d] === "enemy");

  return {
    health: cell.health,
    position: { ...cell.position },
    teamTotalHealth,
    currentTurn,
    boardSize: { rows: BOARD_ROWS, cols: BOARD_COLS },
    neighbors,
    nearbyAllies,
    nearbyEnemies,
  };
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

import { INITIAL_HEALTH, DEFAULT_TURN_LIMIT } from "./constants";

export function createInitialGameState(_player1: Player, _player2: Player): GameState {
  let nextId = 1;

  const cell1: Cell = {
    internalId: nextId++,
    teamId: 1,
    teamName: _player1.name,
    color: _player1.color,
    position: { row: Math.floor(BOARD_ROWS / 3), col: Math.floor(BOARD_COLS / 4) },
    health: INITIAL_HEALTH,
    alive: true,
    creationTurn: 1,
  };

  const cell2: Cell = {
    internalId: nextId++,
    teamId: 2,
    teamName: _player2.name,
    color: _player2.color,
    position: { row: Math.floor((BOARD_ROWS * 2) / 3), col: Math.floor((BOARD_COLS * 3) / 4) },
    health: INITIAL_HEALTH,
    alive: true,
    creationTurn: 1,
  };

  return {
    cells: [cell1, cell2],
    currentTurn: 1,
    turnLimit: DEFAULT_TURN_LIMIT,
    isRunning: false,
    isPaused: false,
    isFinished: false,
    result: null,
    errors: [],
    nextInternalId: nextId,
  };
}

// ---------------------------------------------------------------------------
// Turn execution
// ---------------------------------------------------------------------------

interface CompiledAlgorithms {
  team1: FunctionDecl;
  team2: FunctionDecl;
}

// NOTE: there used to be a getTeamTotalHealth(cells, teamId) helper here that
// re-scanned the full cell list on every call. It was called once per living
// cell per turn (cells.concat(newCellsCreated) included), which made the
// whole turn O(N^2) in the number of cells. It has been replaced by a
// dictionary of running totals (`teamHealthTotals`, keyed by team ID) that is
// computed once per turn in O(N) and kept up to date in O(1) as actions
// resolve (rest, eat damage, reproduction split). See executeTurn below.

function addError(errors: ErrorLogEntry[], turn: number, teamId: 1 | 2, message: string): ErrorLogEntry[] {
  // Aggregate identical errors instead of logging unbounded entries
  const existing = errors.find((e) => e.teamId === teamId && e.message === message);
  if (existing) {
    existing.count += 1;
    existing.turn = turn;
    return errors;
  }
  const next = [...errors, { turn, teamId, message, count: 1 }];
  if (next.length > MAX_ERROR_LOG_ENTRIES) {
    next.shift();
  }
  return next;
}

// Executes a single global turn and returns the new game state.
// Mutation is performed on shallow copies to keep this reasonably efficient
// while still producing new references for React state updates.
export function executeTurn(state: GameState, algorithms: CompiledAlgorithms): GameState {
  if (state.isFinished) return state;

  const cells = state.cells.map((c) => ({ ...c, position: { ...c.position } }));
  const cellsById = new Map<number, Cell>(cells.map((c) => [c.internalId, c]));
  const occupancy = OccupancyGrid.fromCells(cells);

  // Snapshot start-of-turn positions for deterministic ordering and for the
  // "second cell interacts with new position if first cell moved" rule, the
  // occupancy grid itself (mutated as actions resolve) provides current truth.
  const startSnapshot = new Map<number, BoardPosition>();
  for (const c of cells) {
    startSnapshot.set(c.internalId, { ...c.position });
  }

  // Deterministic execution order:
  // 1. Cells alive at the start of the turn (excludes cells created during
  //    this turn via reproduction, since those are appended afterward and
  //    are never part of `cells`/`executionOrder` for this turn)
  // 2. Sort by creation turn
  // 3. Then by row at start-of-turn snapshot
  // 4. Then by column at start-of-turn snapshot
  // 5. Then by internal ID as final tiebreaker
  const executionOrder = cells
    .filter((c) => c.alive)
    .sort((a, b) => {
      if (a.creationTurn !== b.creationTurn) return a.creationTurn - b.creationTurn;
      const aPos = startSnapshot.get(a.internalId)!;
      const bPos = startSnapshot.get(b.internalId)!;
      if (aPos.row !== bPos.row) return aPos.row - bPos.row;
      if (aPos.col !== bPos.col) return aPos.col - bPos.col;
      return a.internalId - b.internalId;
    });

  let errors = state.errors;
  const newCellsCreated: Cell[] = [];
  let nextInternalId = state.nextInternalId;

  // Running total health per team, keyed by team ID. Built once in O(N) and
  // then kept up to date in O(1) as actions change cell health, instead of
  // re-scanning all cells every time a cell's algorithm needs its team total.
  const teamHealthTotals = new Map<1 | 2, number>([[1, 0], [2, 0]]);
  for (const c of cells) {
    if (c.alive) {
      teamHealthTotals.set(c.teamId, teamHealthTotals.get(c.teamId)! + c.health);
    }
  }

  for (const cell of executionOrder) {
    const current = cellsById.get(cell.internalId);
    if (!current || !current.alive) {
      // Cell died before its turn to act
      continue;
    }

    // Cells in `executionOrder` were all present at the start of this turn,
    // so the "newborn does not act this turn" rule is automatically
    // satisfied: cells created via reproduction during this turn are only
    // added to `newCellsCreated` and never appear in `executionOrder`.

    const teamTotalHealth = teamHealthTotals.get(current.teamId)!;
    const context = buildCellContext(current, state.currentTurn, teamTotalHealth, occupancy, cellsById);

    const algorithm = current.teamId === 1 ? algorithms.team1 : algorithms.team2;

    let actionCode: unknown;
    let runtimeFailed = false;
    const start = performance.now();
    try {
      actionCode = runAlgorithm(algorithm, context);
      const elapsed = performance.now() - start;
      if (elapsed > SIMULATION_TIMEOUT_MS) {
        errors = addError(errors, state.currentTurn, current.teamId, "Timed out");
        runtimeFailed = true;
      }
    } catch (err) {
      const message = err instanceof RuntimeError ? err.message : "Unknown runtime error";
      errors = addError(errors, state.currentTurn, current.teamId, message);
      runtimeFailed = true;
    }

    if (runtimeFailed) continue;

    if (typeof actionCode !== "string" || !isValidActionCode(actionCode)) {
      errors = addError(errors, state.currentTurn, current.teamId, `Invalid action returned: ${JSON.stringify(actionCode)}`);
      continue;
    }

    // --- Resolve the action ---
    if (isRestAction(actionCode)) {
      const before = current.health;
      current.health = Math.min(MAX_HEALTH, current.health + REST_RECOVERY);
      const delta = current.health - before;
      if (delta !== 0) {
        teamHealthTotals.set(current.teamId, teamHealthTotals.get(current.teamId)! + delta);
      }
      continue;
    }

    const dir = directionFromActionCode(actionCode);
    if (!dir) {
      // Should not happen given isValidActionCode, but guard regardless
      continue;
    }
    const targetPos = getNeighborPosition(current.position, dir);

    if (isMoveAction(actionCode)) {
      if (!isOnBoard(targetPos)) {
        // Moving outside the board cancels the action
        continue;
      }
      if (!occupancy.isEmpty(targetPos)) {
        // Moving into an occupied square cancels the action
        continue;
      }
      occupancy.clear(current.position);
      current.position = targetPos;
      occupancy.set(current.position, current.internalId);
      continue;
    }

    if (isEatAction(actionCode)) {
      if (!isOnBoard(targetPos)) {
        continue;
      }
      const occupantId = occupancy.get(targetPos);
      if (occupantId === -1) {
        // No enemy in that direction -> action canceled
        continue;
      }
      const target = cellsById.get(occupantId);
      if (!target || !target.alive || target.teamId === current.teamId) {
        // Allied cell or unknown -> canceled (cannot eat allies)
        continue;
      }
      const healthBefore = target.health;
      target.health = Math.max(0, target.health - EAT_DAMAGE);
      const damageDealt = healthBefore - target.health;
      if (damageDealt !== 0) {
        teamHealthTotals.set(target.teamId, teamHealthTotals.get(target.teamId)! - damageDealt);
      }
      if (target.health <= 0) {
        target.alive = false;
        occupancy.clear(targetPos);
      }
      continue;
    }

    if (isReproduceAction(actionCode)) {
      if (!isOnBoard(targetPos)) {
        continue;
      }
      if (!occupancy.isEmpty(targetPos)) {
        continue;
      }
      const totalHealth = current.health;
      const newCellHealth = Math.floor(totalHealth / 2);
      const originalHealth = totalHealth - newCellHealth;

      current.health = originalHealth;
      // Reproduction splits one cell's health into two; the team's total
      // health is unchanged (originalHealth + newCellHealth === totalHealth),
      // so teamHealthTotals does not need an update here. The new cell is
      // simply not in teamHealthTotals yet for *this* turn's context lookups,
      // which is correct since it cannot act (and thus never reads its team
      // total) until the following turn.

      const newCell: Cell = {
        internalId: nextInternalId++,
        teamId: current.teamId,
        teamName: current.teamName,
        color: current.color,
        position: { ...targetPos },
        health: newCellHealth,
        alive: true,
        creationTurn: state.currentTurn,
      };

      occupancy.set(targetPos, newCell.internalId);
      cellsById.set(newCell.internalId, newCell);
      newCellsCreated.push(newCell);
      continue;
    }
  }

  const allCells = [...cells, ...newCellsCreated];

  // Remove dead cells from the board entirely (per spec: removed immediately)
  const survivingCells = allCells.filter((c) => c.alive);

  return {
    ...state,
    cells: survivingCells,
    errors,
    nextInternalId,
  };
}
