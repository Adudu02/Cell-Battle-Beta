export const DIRECTION_DELTAS = {
  n: [-1, 0],
  s: [1, 0],
  e: [0, 1],
  w: [0, -1],
  ne: [-1, 1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [1, -1],
} as const;

export const DIRECTIONS = Object.keys(DIRECTION_DELTAS) as Array<keyof typeof DIRECTION_DELTAS>;
