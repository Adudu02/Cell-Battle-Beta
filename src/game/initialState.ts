// Example algorithms for Battle of Cells.
// These are provided as starting points / templates for players.

export const EXAMPLE_AGGRESSIVE = `function decide(context) {
  if (context.neighbors.n === "enemy") {
    return "an";
  }
  if (context.neighbors.s === "enemy") {
    return "as";
  }
  if (context.neighbors.e === "enemy") {
    return "ae";
  }
  if (context.neighbors.w === "enemy") {
    return "aw";
  }
  if (context.neighbors.ne === "enemy") {
    return "ane";
  }
  if (context.neighbors.nw === "enemy") {
    return "anw";
  }
  if (context.neighbors.se === "enemy") {
    return "ase";
  }
  if (context.neighbors.sw === "enemy") {
    return "asw";
  }

  if (context.neighbors.e === "empty") {
    return "me";
  }
  if (context.neighbors.n === "empty") {
    return "mn";
  }

  return "d";
}`;

export const EXAMPLE_BALANCED = `function decide(context) {
  if (context.neighbors.e === "enemy") {
    return "ae";
  }
  if (context.neighbors.n === "enemy") {
    return "an";
  }

  if (context.health < 70) {
    return "d";
  }

  if (context.health > 60 && context.neighbors.s === "empty") {
    return "rs";
  }

  if (context.neighbors.e === "empty") {
    return "me";
  }

  return "d";
}`;

export const EXAMPLE_DEFAULT = `function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  if (context.neighbors.north === "empty") {
    return "mn";
  }

  return "d";
}`;

// Note: EXAMPLE_DEFAULT mirrors the format shown in the spec, but the actual
// NeighborsInfo keys are the direction codes (n, s, e, w, ne, nw, se, sw),
// not full words. EXAMPLE_AGGRESSIVE and EXAMPLE_BALANCED use the correct keys.
export const PLAYER1_DEFAULT_TEMPLATE = EXAMPLE_AGGRESSIVE;
export const PLAYER2_DEFAULT_TEMPLATE = EXAMPLE_BALANCED;
