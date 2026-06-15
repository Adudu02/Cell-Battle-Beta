import { describe, expect, it } from 'vitest';
import { buildTurnOrder } from '../../src/game/ordering.js';
import type { Cell } from '../../src/game/types.js';

function makeCell(id: string, row: number, col: number, age: number, creationTurn: number, alive = true): Cell {
  return {
    id,
    teamId: 1,
    teamName: 'Alpha',
    teamColor: '#22d3ee',
    position: { row, col },
    health: 100,
    age,
    alive,
    creationTurn,
    createdDuringCurrentTurn: false,
    lastAction: 'none',
    lastActionStatus: 'none',
  };
}

describe('ordering', () => {
  it('sorts by age, creation turn, row, then column', () => {
    const order = buildTurnOrder([
      makeCell('fourth', 1, 2, 1, 0),
      makeCell('second', 1, 1, 1, 0),
      makeCell('third', 0, 1, 1, 1),
      makeCell('first', 0, 0, 0, 5),
    ]);

    expect(order.map((entry) => entry.id)).toEqual(['first', 'second', 'fourth', 'third']);
  });

  it('skips dead cells', () => {
    const order = buildTurnOrder([makeCell('alive', 0, 0, 1, 0), makeCell('dead', 0, 1, 0, 0, false)]);
    expect(order.map((entry) => entry.id)).toEqual(['alive']);
  });
});
