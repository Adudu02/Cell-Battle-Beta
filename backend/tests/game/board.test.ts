import { describe, expect, it } from 'vitest';
import { buildBoardFromCells, createBoard, createInitialCells, getNeighborPosition, getNeighborStates, isInsideBoard, placeCell } from '../../src/game/board.js';
import type { Cell, Direction } from '../../src/game/types.js';

function makeCell(id: string, teamId: 1 | 2, row: number, col: number): Cell {
  return {
    id,
    teamId,
    teamName: teamId === 1 ? 'Alpha' : 'Beta',
    teamColor: teamId === 1 ? '#22d3ee' : '#f43f5e',
    position: { row, col },
    health: 100,
    age: 1,
    alive: true,
    creationTurn: 0,
    createdDuringCurrentTurn: false,
    lastAction: 'none',
    lastActionStatus: 'none',
  };
}

describe('board', () => {
  it('creates a 100x200 board', () => {
    const board = createBoard(100, 200);
    expect(board.rows).toBe(100);
    expect(board.cols).toBe(200);
  });

  it('rejects positions outside the board', () => {
    const board = createBoard(5, 5);
    expect(isInsideBoard(board, { row: -1, col: 0 })).toBe(false);
    expect(isInsideBoard(board, { row: 5, col: 0 })).toBe(false);
    expect(isInsideBoard(board, { row: 0, col: 5 })).toBe(false);
  });

  it('prevents more than one cell per square', () => {
    const board = createBoard(5, 5);
    placeCell(board, makeCell('a', 1, 1, 1));
    expect(() => placeCell(board, makeCell('b', 2, 1, 1))).toThrow('Cannot place more than one cell');
  });

  it('creates one initial cell per player and avoids occupied random placement', () => {
    const rngValues = [0.1, 0.1, 0.1, 0.1, 0.8, 0.8];
    const cells = createInitialCells(
      [
        { name: 'Alpha', color: '#22d3ee' },
        { name: 'Beta', color: '#f43f5e' },
      ],
      10,
      10,
      () => rngValues.shift() ?? 0.5,
    );

    expect(cells).toHaveLength(2);
    expect(cells[0].teamId).toBe(1);
    expect(cells[1].teamId).toBe(2);
    expect(cells[0].position).not.toEqual(cells[1].position);
  });

  it('supports all directions and marks outside neighbors', () => {
    const directions: Direction[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
    for (const direction of directions) {
      const position = getNeighborPosition({ row: 1, col: 1 }, direction);
      expect(position.row).toBeTypeOf('number');
      expect(position.col).toBeTypeOf('number');
    }

    const cells = [makeCell('a', 1, 0, 0), makeCell('b', 2, 0, 1)];
    const board = buildBoardFromCells(3, 3, cells);
    const states = getNeighborStates(board, new Map(cells.map((cell) => [cell.id, cell])), { row: 0, col: 0 }, 1);
    expect(states.n).toBe('outside');
    expect(states.w).toBe('outside');
    expect(states.e).toBe('enemy');
  });
});
