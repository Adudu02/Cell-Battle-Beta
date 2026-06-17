export interface AlgorithmTemplate {
  id: string;
  label: string;
  description: string;
  source: string;
}

export const ALGORITHM_TEMPLATES: AlgorithmTemplate[] = [
  {
    id: "starter",
    label: "Starter",
    description: "Simple move, attack, otherwise reposition.",
    source: `function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  if (context.neighbors.north === "empty") {
    return "rn";
  }

  if (context.neighbors.east === "empty") {
    return "me";
  }

  return "mn";
}`,
  },
  {
    id: "hunter",
    label: "Hunter",
    description: "Attack first, then move toward open lanes.",
    source: `function decide(context) {
  if (context.neighbors.east === "enemy") return "ae";
  if (context.neighbors.west === "enemy") return "aw";
  if (context.neighbors.north === "enemy") return "an";
  if (context.neighbors.south === "enemy") return "as";

  if (context.neighbors.east === "empty") return "me";
  if (context.neighbors.northeast === "empty") return "mne";
  if (context.neighbors.southeast === "empty") return "mse";

  return "mw";
}`,
  },
  {
    id: "growth",
    label: "Growth",
    description: "Reproduce into open space, attack if threatened.",
    source: `function decide(context) {
  if (context.neighbors.east === "empty") return "re";
  if (context.neighbors.north === "empty") return "rn";
  if (context.neighbors.south === "empty") return "rs";
  if (context.neighbors.west === "empty") return "rw";

  if (context.neighbors.east === "enemy") return "ae";
  if (context.neighbors.west === "enemy") return "aw";

  return "mn";
}`,
  },
  {
    id: "stress",
    label: "Stress",
    description: "Attack first and rotate expansion lanes to keep load tests dense.",
    source: `function decide(context) {
  if (context.neighbors.east === "enemy") return "ae";
  if (context.neighbors.west === "enemy") return "aw";
  if (context.neighbors.north === "enemy") return "an";
  if (context.neighbors.south === "enemy") return "as";
  if (context.neighbors.northeast === "enemy") return "ane";
  if (context.neighbors.northwest === "enemy") return "anw";
  if (context.neighbors.southeast === "enemy") return "ase";
  if (context.neighbors.southwest === "enemy") return "asw";

  const phase = (context.position.row + context.position.col + context.currentTurn) % 4;

  if (phase === 0) {
    if (context.neighbors.east === "empty") return "re";
    if (context.neighbors.south === "empty") return "rs";
    if (context.neighbors.west === "empty") return "rw";
    if (context.neighbors.north === "empty") return "rn";
    if (context.neighbors.southeast === "empty") return "rse";
    if (context.neighbors.southwest === "empty") return "rsw";
    if (context.neighbors.northeast === "empty") return "rne";
    if (context.neighbors.northwest === "empty") return "rnw";
  }

  if (phase === 1) {
    if (context.neighbors.south === "empty") return "rs";
    if (context.neighbors.west === "empty") return "rw";
    if (context.neighbors.north === "empty") return "rn";
    if (context.neighbors.east === "empty") return "re";
    if (context.neighbors.southwest === "empty") return "rsw";
    if (context.neighbors.northwest === "empty") return "rnw";
    if (context.neighbors.northeast === "empty") return "rne";
    if (context.neighbors.southeast === "empty") return "rse";
  }

  if (phase === 2) {
    if (context.neighbors.west === "empty") return "rw";
    if (context.neighbors.north === "empty") return "rn";
    if (context.neighbors.east === "empty") return "re";
    if (context.neighbors.south === "empty") return "rs";
    if (context.neighbors.northwest === "empty") return "rnw";
    if (context.neighbors.northeast === "empty") return "rne";
    if (context.neighbors.southeast === "empty") return "rse";
    if (context.neighbors.southwest === "empty") return "rsw";
  }

  if (context.neighbors.north === "empty") return "rn";
  if (context.neighbors.east === "empty") return "re";
  if (context.neighbors.south === "empty") return "rs";
  if (context.neighbors.west === "empty") return "rw";
  if (context.neighbors.northeast === "empty") return "rne";
  if (context.neighbors.southeast === "empty") return "rse";
  if (context.neighbors.southwest === "empty") return "rsw";
  if (context.neighbors.northwest === "empty") return "rnw";

  return "me";
}`,
  },
];

export const ALGORITHM_DICTIONARY = {
  contextFields: [
    "context.position.row",
    "context.position.col",
    "context.currentTurn",
    "context.boardSize.rows",
    "context.boardSize.cols",
    "context.hasNearbyAllies",
    "context.hasNearbyEnemies",
  ],
  neighbors: [
    "context.neighbors.north",
    "context.neighbors.south",
    "context.neighbors.east",
    "context.neighbors.west",
    "context.neighbors.northeast",
    "context.neighbors.northwest",
    "context.neighbors.southeast",
    "context.neighbors.southwest",
  ],
  neighborStates: ['"empty"', '"allied"', '"enemy"', '"outside"'],
  actionCodes: [
    "mn ms me mw mne mnw mse msw",
    "an as ae aw ane anw ase asw",
    "rn rs re rw rne rnw rse rsw",
  ],
};
