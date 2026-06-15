import { EAT_DAMAGE, INITIAL_AGE, MAX_HEALTH, REPRODUCE_MAX_AGE_EXCLUSIVE, REPRODUCE_MIN_HEALTH, REST_HEAL } from './constants.js';
import { DIRECTIONS } from './directions.js';
import { getCellIdAtCoordinates, moveCell, placeCell, removeCell } from './board.js';
import { DIRECTION_DELTAS } from './directions.js';
import type { ActionCode, Cell, Direction, ParsedAction, SimulationState } from './types.js';

const DIRECTION_SET = new Set<string>(DIRECTIONS);

export const VALID_ACTION_CODES = new Set<ActionCode>([
  'd',
  ...DIRECTIONS.flatMap((direction) => [
    `m${direction}` as ActionCode,
    `a${direction}` as ActionCode,
    `r${direction}` as ActionCode,
  ]),
]);

export function isValidActionCode(value: string): value is ActionCode {
  return VALID_ACTION_CODES.has(value as ActionCode);
}

export function parseActionCode(value: string): ParsedAction | null {
  if (value === 'd') {
    return { kind: 'rest', code: 'd' };
  }

  if (value.length < 2) {
    return null;
  }

  const prefix = value[0];
  const direction = value.slice(1) as Direction;

  if (!DIRECTION_SET.has(direction)) {
    return null;
  }

  if (prefix === 'm') {
    return { kind: 'move', direction, code: value as ActionCode };
  }

  if (prefix === 'a') {
    return { kind: 'eat', direction, code: value as ActionCode };
  }

  if (prefix === 'r') {
    return { kind: 'reproduce', direction, code: value as ActionCode };
  }

  return null;
}

export function resolveAction(
  state: Pick<SimulationState, 'board' | 'cells' | 'currentTurn'>,
  cellsById: Map<string, Cell>,
  cell: Cell,
  action: ParsedAction,
  nextId: () => string,
): string | null {
  if (!cell.alive) {
    return 'cell is no longer alive.';
  }

  if (action.kind === 'rest') {
    cell.health = Math.min(MAX_HEALTH, cell.health + REST_HEAL);
    cell.lastActionStatus = 'success';
    return null;
  }

  const [rowDelta, colDelta] = DIRECTION_DELTAS[action.direction];
  const targetRow = cell.position.row + rowDelta;
  const targetCol = cell.position.col + colDelta;

  if (targetRow < 0 || targetRow >= state.board.rows || targetCol < 0 || targetCol >= state.board.cols) {
    cell.lastActionStatus = 'failed';
    return 'target is outside the board.';
  }

  const occupantId = getCellIdAtCoordinates(state.board, targetRow, targetCol);
  const occupant = occupantId ? cellsById.get(occupantId) : undefined;

  if (action.kind === 'move') {
    if (occupant) {
      cell.lastActionStatus = 'failed';
      return 'destination is occupied.';
    }

    const target = { row: targetRow, col: targetCol };
    moveCell(state.board, cell.position, target, cell.id);
    cell.position = target;
    cell.lastActionStatus = 'success';
    return null;
  }

  if (action.kind === 'eat') {
    if (!occupant) {
      cell.lastActionStatus = 'failed';
      return 'target square is empty.';
    }

    if (!occupant.alive) {
      cell.lastActionStatus = 'failed';
      return 'target is not alive.';
    }

    if (occupant.teamId === cell.teamId) {
      cell.lastActionStatus = 'failed';
      return 'target belongs to the same team.';
    }

    occupant.health = Math.max(0, occupant.health - EAT_DAMAGE);
    if (occupant.health === 0) {
      occupant.alive = false;
      removeCell(state.board, occupant.position);
    }

    cell.lastActionStatus = 'success';
    return null;
  }

  if (cell.health < REPRODUCE_MIN_HEALTH) {
    cell.lastActionStatus = 'failed';
    return `reproduction requires at least ${REPRODUCE_MIN_HEALTH} health.`;
  }

  if (cell.age >= REPRODUCE_MAX_AGE_EXCLUSIVE) {
    cell.lastActionStatus = 'failed';
    return `reproduction requires age below ${REPRODUCE_MAX_AGE_EXCLUSIVE}.`;
  }

  if (occupant) {
    cell.lastActionStatus = 'failed';
    return 'destination is occupied.';
  }

  const childHealth = Math.floor(cell.health / 2);
  const parentHealth = cell.health - childHealth;
  cell.health = parentHealth;
  cell.lastActionStatus = 'success';

  const child: Cell = {
    id: nextId(),
    teamId: cell.teamId,
    teamName: cell.teamName,
    teamColor: cell.teamColor,
    position: { row: targetRow, col: targetCol },
    health: childHealth,
    age: INITIAL_AGE,
    alive: true,
    creationTurn: state.currentTurn,
    createdDuringCurrentTurn: true,
    lastAction: 'born',
    lastActionStatus: 'none',
  };

  state.cells.push(child);
  cellsById.set(child.id, child);
  placeCell(state.board, child);
  return null;
}
