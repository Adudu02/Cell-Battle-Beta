import type { BoardPosition, BoardState, Cell, NeighborState, TeamId } from './types';
import { DIRECTION_DELTAS, DIRECTIONS } from './directions';

function toKey(position: BoardPosition): string {
  return `${position.row},${position.col}`;
}

export function createBoard(rows: number, cols: number): BoardState {
  return {
    rows,
    cols,
    occupancy: new Map<string, string>(),
  };
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    rows: board.rows,
    cols: board.cols,
    occupancy: new Map(board.occupancy),
  };
}

export function isInsideBoard(board: BoardState, position: BoardPosition): boolean {
  return (
    position.row >= 0 &&
    position.row < board.rows &&
    position.col >= 0 &&
    position.col < board.cols
  );
}

export function getCellIdAt(board: BoardState, position: BoardPosition): string | undefined {
  return board.occupancy.get(toKey(position));
}

export function placeCell(board: BoardState, cell: Cell): void {
  board.occupancy.set(toKey(cell.position), cell.id);
}

export function removeCell(board: BoardState, position: BoardPosition): void {
  board.occupancy.delete(toKey(position));
}

export function moveCell(board: BoardState, from: BoardPosition, to: BoardPosition, cellId: string): void {
  board.occupancy.delete(toKey(from));
  board.occupancy.set(toKey(to), cellId);
}

export function buildBoardFromCells(rows: number, cols: number, cells: Cell[]): BoardState {
  const board = createBoard(rows, cols);

  for (const cell of cells) {
    if (cell.alive) {
      placeCell(board, cell);
    }
  }

  return board;
}

export function getNeighborStates(
  board: BoardState,
  cellsById: Map<string, Cell>,
  position: BoardPosition,
  teamId: TeamId,
): Record<string, NeighborState> {
  const result: Record<string, NeighborState> = {};

  for (const direction of DIRECTIONS) {
    const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
    const target = {
      row: position.row + rowDelta,
      col: position.col + colDelta,
    };

    if (!isInsideBoard(board, target)) {
      result[direction] = 'outside';
      continue;
    }

    const occupantId = getCellIdAt(board, target);
    if (!occupantId) {
      result[direction] = 'empty';
      continue;
    }

    const occupant = cellsById.get(occupantId);
    result[direction] = occupant && occupant.teamId === teamId ? 'allied' : 'enemy';
  }

  return result;
}
