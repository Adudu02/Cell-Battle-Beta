// Direction handling for Battle of Cells.
//
// NOTE on normalization:
// The original (Spanish-influenced) business requirements document used
// "o" (oeste), "no" (noroeste), and "so" (suroeste) for West, Northwest,
// and Southwest. The implementation-facing direction codes below use the
// English-friendly equivalents requested by the build spec:
//   west      = "w"
//   northwest = "nw"
//   southwest = "sw"
// All action codes (mw, aw, rw, mnw, anw, rnw, msw, asw, rsw, etc.) use
// these normalized letters consistently throughout the codebase.

import type { BoardPosition, Direction } from "./types";
import { BOARD_COLS, BOARD_ROWS } from "./constants";

export const ALL_DIRECTIONS: Direction[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

// Row/column delta for each direction (row increases downward, col increases rightward)
export const DIRECTION_DELTA: Record<Direction, { dRow: number; dCol: number }> = {
  n: { dRow: -1, dCol: 0 },
  s: { dRow: 1, dCol: 0 },
  e: { dRow: 0, dCol: 1 },
  w: { dRow: 0, dCol: -1 },
  ne: { dRow: -1, dCol: 1 },
  nw: { dRow: -1, dCol: -1 },
  se: { dRow: 1, dCol: 1 },
  sw: { dRow: 1, dCol: -1 },
};

export function isOnBoard(pos: BoardPosition): boolean {
  return pos.row >= 0 && pos.row < BOARD_ROWS && pos.col >= 0 && pos.col < BOARD_COLS;
}

export function getNeighborPosition(pos: BoardPosition, dir: Direction): BoardPosition {
  const delta = DIRECTION_DELTA[dir];
  return { row: pos.row + delta.dRow, col: pos.col + delta.dCol };
}

// Extracts the direction suffix from an action code (e.g. "mne" -> "ne", "aw" -> "w")
export function directionFromActionCode(code: string): Direction | null {
  const suffix = code.slice(1);
  if ((ALL_DIRECTIONS as string[]).includes(suffix)) {
    return suffix as Direction;
  }
  return null;
}
