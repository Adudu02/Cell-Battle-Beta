import { DIRECTIONS } from './directions';
import type { ActionCode, Direction, ParsedAction } from './types';

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
