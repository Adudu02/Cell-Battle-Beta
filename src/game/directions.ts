import type { BoardPosition, DirectionCode, DirectionName } from "./types";

export const DIRECTION_CODE_TO_NAME: Record<DirectionCode, DirectionName> = {
  n: "north",
  s: "south",
  e: "east",
  w: "west",
  ne: "northeast",
  nw: "northwest",
  se: "southeast",
  sw: "southwest",
};

export const DIRECTION_NAME_TO_CODE: Record<DirectionName, DirectionCode> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northeast: "ne",
  northwest: "nw",
  southeast: "se",
  southwest: "sw",
};

export const DIRECTION_DELTAS: Record<
  DirectionCode,
  { row: number; col: number }
> = {
  n: { row: -1, col: 0 },
  s: { row: 1, col: 0 },
  e: { row: 0, col: 1 },
  w: { row: 0, col: -1 },
  ne: { row: -1, col: 1 },
  nw: { row: -1, col: -1 },
  se: { row: 1, col: 1 },
  sw: { row: 1, col: -1 },
};

export const DIRECTION_NAMES = Object.values(
  DIRECTION_CODE_TO_NAME,
) as DirectionName[];

export function moveToDirection(
  position: BoardPosition,
  direction: DirectionCode,
): BoardPosition {
  const delta = DIRECTION_DELTAS[direction];
  return {
    row: position.row + delta.row,
    col: position.col + delta.col,
  };
}
