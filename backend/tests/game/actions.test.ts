import { describe, expect, it } from 'vitest';
import { parseActionCode, resolveAction } from '../../src/game/actions.js';
import { buildBoardFromCells } from '../../src/game/board.js';
import type { Cell, SimulationState } from '../../src/game/types.js';

function makeCell(teamId: 1 | 2, id: string, row: number, col: number, overrides: Partial<Cell> = {}): Cell {
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
    ...overrides,
  };
}

function makeState(cells: Cell[]): { state: Pick<SimulationState, 'board' | 'cells' | 'currentTurn'>; cellsById: Map<string, Cell> } {
  return {
    state: {
      board: buildBoardFromCells(5, 5, cells),
      cells,
      currentTurn: 1,
    },
    cellsById: new Map(cells.map((cell) => [cell.id, cell])),
  };
}

describe('actions', () => {
  it('parses valid action codes and rejects invalid ones', () => {
    expect(parseActionCode('mn')).toEqual({ kind: 'move', direction: 'n', code: 'mn' });
    expect(parseActionCode('ase')).toEqual({ kind: 'eat', direction: 'se', code: 'ase' });
    expect(parseActionCode('move')).toBeNull();
  });

  it('valid move to empty square succeeds', () => {
    const mover = makeCell(1, 'a', 2, 2);
    const enemy = makeCell(2, 'b', 4, 4);
    const { state, cellsById } = makeState([mover, enemy]);
    resolveAction(state, cellsById, mover, parseActionCode('me')!, () => 'cell-3');
    expect(mover.position).toEqual({ row: 2, col: 3 });
    expect(mover.lastActionStatus).toBe('success');
  });

  it('move outside the board is canceled', () => {
    const mover = makeCell(1, 'a', 0, 0);
    const enemy = makeCell(2, 'b', 4, 4);
    const { state, cellsById } = makeState([mover, enemy]);
    resolveAction(state, cellsById, mover, parseActionCode('mn')!, () => 'cell-3');
    expect(mover.position).toEqual({ row: 0, col: 0 });
    expect(mover.lastActionStatus).toBe('failed');
  });

  it('move to allied or enemy cell is canceled and does not damage', () => {
    const mover = makeCell(1, 'a', 2, 2);
    const ally = makeCell(1, 'ally', 2, 3);
    const enemy = makeCell(2, 'enemy', 2, 1);
    let scenario = makeState([mover, ally, enemy]);
    resolveAction(scenario.state, scenario.cellsById, mover, parseActionCode('me')!, () => 'cell-4');
    expect(mover.position).toEqual({ row: 2, col: 2 });

    const moverTwo = makeCell(1, 'a2', 2, 2);
    const enemyTwo = makeCell(2, 'enemy2', 2, 3, { health: 100 });
    scenario = makeState([moverTwo, enemyTwo]);
    resolveAction(scenario.state, scenario.cellsById, moverTwo, parseActionCode('me')!, () => 'cell-3');
    expect(enemyTwo.health).toBe(100);
    expect(moverTwo.lastActionStatus).toBe('failed');
  });

  it('eating damages enemies and removes them at zero health', () => {
    const attacker = makeCell(1, 'a', 2, 2);
    const enemy = makeCell(2, 'b', 2, 3, { health: 5 });
    const { state, cellsById } = makeState([attacker, enemy]);
    resolveAction(state, cellsById, attacker, parseActionCode('ae')!, () => 'cell-3');
    expect(enemy.health).toBe(0);
    expect(enemy.alive).toBe(false);
  });

  it('eating empty, outside, or allied targets is canceled', () => {
    const attacker = makeCell(1, 'a', 0, 0);
    const ally = makeCell(1, 'ally', 0, 1);
    let scenario = makeState([attacker, ally]);
    resolveAction(scenario.state, scenario.cellsById, attacker, parseActionCode('an')!, () => 'cell-3');
    expect(attacker.lastActionStatus).toBe('failed');

    const attackerTwo = makeCell(1, 'a2', 1, 1);
    scenario = makeState([attackerTwo]);
    resolveAction(scenario.state, scenario.cellsById, attackerTwo, parseActionCode('ae')!, () => 'cell-2');
    expect(attackerTwo.lastActionStatus).toBe('failed');
  });

  it('reproduction enforces requirements and preserves health totals', () => {
    const parent = makeCell(1, 'a', 2, 2, { health: 51 });
    const enemy = makeCell(2, 'b', 4, 4);
    const { state, cellsById } = makeState([parent, enemy]);
    resolveAction(state, cellsById, parent, parseActionCode('re')!, () => 'cell-3');
    const child = state.cells.find((cell) => cell.id === 'cell-3');
    expect(parent.health).toBe(26);
    expect(child?.health).toBe(25);
    expect(child?.age).toBe(1);

    const lowHealthParent = makeCell(1, 'low', 1, 1, { health: 49 });
    const low = makeState([lowHealthParent, makeCell(2, 'enemy-low', 4, 4)]);
    resolveAction(low.state, low.cellsById, lowHealthParent, parseActionCode('re')!, () => 'cell-3');
    expect(low.state.cells).toHaveLength(2);

    const oldParent = makeCell(1, 'old', 1, 1, { age: 55 });
    const old = makeState([oldParent, makeCell(2, 'enemy-old', 4, 4)]);
    resolveAction(old.state, old.cellsById, oldParent, parseActionCode('re')!, () => 'cell-3');
    expect(old.state.cells).toHaveLength(2);
  });

  it('rest restores health up to 100', () => {
    const cell = makeCell(1, 'a', 2, 2, { health: 98 });
    const { state, cellsById } = makeState([cell, makeCell(2, 'b', 4, 4)]);
    resolveAction(state, cellsById, cell, parseActionCode('d')!, () => 'cell-3');
    expect(cell.health).toBe(100);
  });
});
