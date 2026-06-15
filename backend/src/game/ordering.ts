import type { Cell } from './types.js';

export interface TurnOrderEntry {
  id: string;
  age: number;
  creationTurn: number;
  row: number;
  col: number;
}

export function compareCellsForTurn(
  left: Pick<Cell, 'age' | 'creationTurn' | 'position'>,
  right: Pick<Cell, 'age' | 'creationTurn' | 'position'>,
): number {
  if (left.age !== right.age) {
    return left.age - right.age;
  }
  if (left.creationTurn !== right.creationTurn) {
    return left.creationTurn - right.creationTurn;
  }
  if (left.position.row !== right.position.row) {
    return left.position.row - right.position.row;
  }
  return left.position.col - right.position.col;
}

export function buildTurnOrder(cells: Cell[]): TurnOrderEntry[] {
  const order: TurnOrderEntry[] = [];

  for (const cell of cells) {
    if (!cell.alive) {
      continue;
    }

    order.push({
      id: cell.id,
      age: cell.age,
      creationTurn: cell.creationTurn,
      row: cell.position.row,
      col: cell.position.col,
    });
  }

  order.sort((left, right) =>
    compareCellsForTurn(
      { age: left.age, creationTurn: left.creationTurn, position: { row: left.row, col: left.col } },
      { age: right.age, creationTurn: right.creationTurn, position: { row: right.row, col: right.col } },
    ),
  );

  return order;
}
