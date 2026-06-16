// Stress test for Battle of Cells.
//
// Unlike scripts/test-engine.ts (correctness), this script measures
// PERFORMANCE under heavy load:
//   1. A "reproduction storm" scenario where both teams reproduce
//      aggressively to fill as much of the 100x200 board as possible,
//      then fight it out — this stresses the occupancy grid, neighbor
//      computation, and per-cell algorithm execution at high cell counts.
//   2. A full 5000-turn match run end-to-end, timing total wall-clock time
//      and turns/second.
//   3. A worst-case "all cells alive, no eliminations" scenario sustained
//      across many turns (cells just rest forever) to measure steady-state
//      per-turn cost once the board is saturated.
//
// Run with: npx tsx scripts/stress-test.ts

import { parseAlgorithm, runAlgorithm } from "../src/game/interpreter";
import { executeTurn } from "../src/game/engine";
import { evaluateEndConditions } from "../src/game/victory";
import { BOARD_ROWS, BOARD_COLS, DEFAULT_TURN_LIMIT } from "../src/game/constants";
import type { Cell, GameState, Player } from "../src/game/types";

const player1: Player = { id: 1, name: "Stress-A", color: "#e63946", code: "", validated: true };
const player2: Player = { id: 2, name: "Stress-B", color: "#1d8bf1", code: "", validated: true };

function formatMs(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

function memMB(): number {
  if (typeof process !== "undefined" && process.memoryUsage) {
    return process.memoryUsage().heapUsed / (1024 * 1024);
  }
  return -1;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function summarize(label: string, samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = samples.reduce((a, b) => a + b, 0);
  const avg = total / samples.length;
  console.log(
    `${label}: n=${samples.length} avg=${formatMs(avg)} p50=${formatMs(percentile(sorted, 50))} ` +
      `p95=${formatMs(percentile(sorted, 95))} p99=${formatMs(percentile(sorted, 99))} max=${formatMs(sorted[sorted.length - 1])}`,
  );
}

// ---------------------------------------------------------------------------
// Scenario 1: Reproduction storm
// ---------------------------------------------------------------------------
// Both teams reproduce in a checkerboard expansion pattern until the board
// is as full as the algorithm allows, then switch to combat. This forces
// the occupancy grid and neighbor scans to operate at near-maximum cell
// density (up to ~10,000 cells on a 20,000-square board, capped 1 cell per
// square per team region).

function runReproductionStorm() {
  console.log("\n=== Scenario 1: Reproduction storm ===");

  // Reproduce east while space allows, then south, then start eating/resting.
  // This deterministic pattern creates a dense, non-trivial cluster of cells
  // without relying on randomness (keeps the stress test reproducible).
  const expanderAlgo = parseAlgorithm(`function decide(context) {
    if (context.neighbors.e === "enemy") return "ae";
    if (context.neighbors.n === "enemy") return "an";
    if (context.neighbors.s === "enemy") return "as";
    if (context.neighbors.w === "enemy") return "aw";

    if (context.health > 40 && context.neighbors.e === "empty") return "re";
    if (context.health > 40 && context.neighbors.s === "empty") return "rs";

    return "d";
  }`);

  let cellId = 1;
  const cellA: Cell = {
    internalId: cellId++,
    teamId: 1,
    teamName: player1.name,
    color: player1.color,
    position: { row: 1, col: 1 },
    health: 100,
    alive: true,
    creationTurn: 1,
  };
  const cellB: Cell = {
    internalId: cellId++,
    teamId: 2,
    teamName: player2.name,
    color: player2.color,
    position: { row: BOARD_ROWS - 2, col: BOARD_COLS - 2 },
    health: 100,
    alive: true,
    creationTurn: 1,
  };

  let state: GameState = {
    cells: [cellA, cellB],
    currentTurn: 1,
    turnLimit: DEFAULT_TURN_LIMIT,
    isRunning: true,
    isPaused: false,
    isFinished: false,
    result: null,
    errors: [],
    nextInternalId: cellId,
  };

  const turnTimes: number[] = [];
  const cellCountSamples: { turn: number; cells: number }[] = [];
  const memSamples: number[] = [];

  const startMem = memMB();
  const overallStart = performance.now();

  const TURNS_TO_RUN = 400; // enough to saturate a large region of the board

  for (let i = 0; i < TURNS_TO_RUN; i++) {
    const { finished } = evaluateEndConditions(state, player1, player2);
    if (finished) {
      console.log(`Match ended early at turn ${state.currentTurn} during storm scenario.`);
      break;
    }

    const t0 = performance.now();
    state = executeTurn(state, { team1: expanderAlgo, team2: expanderAlgo });
    const t1 = performance.now();

    turnTimes.push(t1 - t0);
    state = { ...state, currentTurn: state.currentTurn + 1 };

    if (i % 50 === 0) {
      cellCountSamples.push({ turn: state.currentTurn, cells: state.cells.length });
      memSamples.push(memMB());
    }
  }

  const overallEnd = performance.now();

  console.log(`Turns executed: ${turnTimes.length}`);
  console.log(`Final cell count: ${state.cells.length} (max theoretical: ${BOARD_ROWS * BOARD_COLS})`);
  console.log(`Total wall time: ${formatMs(overallEnd - overallStart)}`);
  summarize("Per-turn execution time", turnTimes);
  console.log("Cell-count growth over time:", cellCountSamples.map((s) => `t${s.turn}:${s.cells}`).join(" "));
  if (startMem >= 0) {
    console.log(`Heap usage (MB) over time: start=${startMem.toFixed(1)} ${memSamples.map((m) => m.toFixed(1)).join(" ")}`);
  }
}

// ---------------------------------------------------------------------------
// Scenario 2: Full 5000-turn match, two moderately complex algorithms
// ---------------------------------------------------------------------------

function runFullMatch() {
  console.log("\n=== Scenario 2: Full 5000-turn match (moderate algorithms) ===");

  const algoA = parseAlgorithm(`function decide(context) {
    if (context.neighbors.e === "enemy") return "ae";
    if (context.neighbors.s === "enemy") return "as";
    if (context.neighbors.n === "enemy") return "an";
    if (context.neighbors.w === "enemy") return "aw";

    if (context.health < 50) return "d";

    if (context.health > 70 && context.neighbors.e === "empty") return "re";

    if (context.neighbors.s === "empty") return "ms";
    if (context.neighbors.e === "empty") return "me";

    return "d";
  }`);

  const algoB = parseAlgorithm(`function decide(context) {
    if (context.neighbors.w === "enemy") return "aw";
    if (context.neighbors.n === "enemy") return "an";
    if (context.neighbors.s === "enemy") return "as";
    if (context.neighbors.e === "enemy") return "ae";

    if (context.health < 50) return "d";

    if (context.health > 70 && context.neighbors.w === "empty") return "rw";

    if (context.neighbors.n === "empty") return "mn";
    if (context.neighbors.w === "empty") return "mw";

    return "d";
  }`);

  let cellId = 1;
  const cellA: Cell = {
    internalId: cellId++,
    teamId: 1,
    teamName: player1.name,
    color: player1.color,
    position: { row: Math.floor(BOARD_ROWS / 3), col: Math.floor(BOARD_COLS / 4) },
    health: 100,
    alive: true,
    creationTurn: 1,
  };
  const cellB: Cell = {
    internalId: cellId++,
    teamId: 2,
    teamName: player2.name,
    color: player2.color,
    position: { row: Math.floor((BOARD_ROWS * 2) / 3), col: Math.floor((BOARD_COLS * 3) / 4) },
    health: 100,
    alive: true,
    creationTurn: 1,
  };

  let state: GameState = {
    cells: [cellA, cellB],
    currentTurn: 1,
    turnLimit: DEFAULT_TURN_LIMIT,
    isRunning: true,
    isPaused: false,
    isFinished: false,
    result: null,
    errors: [],
    nextInternalId: cellId,
  };

  const turnTimes: number[] = [];
  const overallStart = performance.now();
  let endedEarly = false;
  let endTurn = DEFAULT_TURN_LIMIT;

  for (let i = 0; i < DEFAULT_TURN_LIMIT; i++) {
    const t0 = performance.now();
    state = executeTurn(state, { team1: algoA, team2: algoB });
    const t1 = performance.now();
    turnTimes.push(t1 - t0);

    const { finished, result } = evaluateEndConditions(state, player1, player2);
    if (finished) {
      endedEarly = state.currentTurn < DEFAULT_TURN_LIMIT;
      endTurn = state.currentTurn;
      console.log(`Match concluded at turn ${state.currentTurn}: winner=${result?.winner}, cause=${result?.cause}`);
      break;
    }
    state = { ...state, currentTurn: state.currentTurn + 1 };
  }

  const overallEnd = performance.now();
  const totalMs = overallEnd - overallStart;

  console.log(`Ended ${endedEarly ? "early" : "at turn limit"} (turn ${endTurn})`);
  console.log(`Total wall time: ${formatMs(totalMs)} for ${turnTimes.length} turns`);
  console.log(`Throughput: ${(turnTimes.length / (totalMs / 1000)).toFixed(0)} turns/sec`);
  summarize("Per-turn execution time", turnTimes);
  console.log(`Final living cells — A: ${state.cells.filter((c) => c.alive && c.teamId === 1).length}, B: ${state.cells.filter((c) => c.alive && c.teamId === 2).length}`);
}

// ---------------------------------------------------------------------------
// Scenario 3: Steady-state saturated board (many cells, all resting)
// ---------------------------------------------------------------------------
// Pre-populates the board with a large, fixed number of cells (no
// reproduction during the timed loop) and measures pure per-turn cost of
// running every cell's algorithm + neighbor computation at a known,
// constant cell count. This isolates engine overhead from population
// growth dynamics.

function runSaturatedSteadyState(targetCellsPerTeam: number, turnsToRun: number) {
  console.log(`\n=== Scenario 3: Saturated steady-state (${targetCellsPerTeam * 2} total cells, ${turnsToRun} turns) ===`);

  const restAlgo = parseAlgorithm(`function decide(context) {
    if (context.neighbors.n === "enemy") return "an";
    if (context.neighbors.s === "enemy") return "as";
    if (context.neighbors.e === "enemy") return "ae";
    if (context.neighbors.w === "enemy") return "aw";
    return "d";
  }`);

  const cells: Cell[] = [];
  let internalId = 1;

  // Place team 1 cells in the top half, team 2 in the bottom half, packed
  // densely but with at least one empty buffer column so initial moves/eats
  // have well-defined neighbors.
  const cols = BOARD_COLS;
  let placed = 0;
  for (let row = 0; row < Math.floor(BOARD_ROWS / 2) && placed < targetCellsPerTeam; row += 2) {
    for (let col = 0; col < cols && placed < targetCellsPerTeam; col += 2) {
      cells.push({
        internalId: internalId++,
        teamId: 1,
        teamName: player1.name,
        color: player1.color,
        position: { row, col },
        health: 80,
        alive: true,
        creationTurn: 1,
      });
      placed++;
    }
  }

  placed = 0;
  for (let row = Math.floor(BOARD_ROWS / 2); row < BOARD_ROWS && placed < targetCellsPerTeam; row += 2) {
    for (let col = 0; col < cols && placed < targetCellsPerTeam; col += 2) {
      cells.push({
        internalId: internalId++,
        teamId: 2,
        teamName: player2.name,
        color: player2.color,
        position: { row, col },
        health: 80,
        alive: true,
        creationTurn: 1,
      });
      placed++;
    }
  }

  let state: GameState = {
    cells,
    currentTurn: 1,
    turnLimit: DEFAULT_TURN_LIMIT,
    isRunning: true,
    isPaused: false,
    isFinished: false,
    result: null,
    errors: [],
    nextInternalId: internalId,
  };

  console.log(`Placed ${state.cells.length} cells total before timing starts.`);

  const turnTimes: number[] = [];
  const overallStart = performance.now();

  for (let i = 0; i < turnsToRun; i++) {
    const t0 = performance.now();
    state = executeTurn(state, { team1: restAlgo, team2: restAlgo });
    const t1 = performance.now();
    turnTimes.push(t1 - t0);
    state = { ...state, currentTurn: state.currentTurn + 1 };
  }

  const overallEnd = performance.now();
  console.log(`Total wall time: ${formatMs(overallEnd - overallStart)} for ${turnsToRun} turns at ${cells.length} cells`);
  summarize("Per-turn execution time", turnTimes);
}

// ---------------------------------------------------------------------------
// Scenario 4: Pathological algorithm complexity (deeply nested conditionals)
// ---------------------------------------------------------------------------
// Validates that even a maximally elaborate (but still loop-free, per the
// MVP rules) decision tree does not blow the per-cell time budget. This
// approximates the most "expensive" legal algorithm a player could submit.

function runPathologicalAlgorithm() {
  console.log("\n=== Scenario 4: Pathological deeply-nested algorithm ===");

  // Build a long chain of if/else-if covering every neighbor x every state,
  // plus nested boolean conditions, to maximize interpreter tree-walk depth
  // for a single decision without using any loop construct.
  const conditions: string[] = [];
  const directions = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
  const states = ["enemy", "allied", "empty", "outside"];
  for (const dir of directions) {
    for (const st of states) {
      conditions.push(
        `if (context.neighbors.${dir} === "${st}" && context.health > 0 && context.health <= 100 && (context.nearbyAllies || context.nearbyEnemies || true)) return "d";`,
      );
    }
  }
  const source = `function decide(context) {\n  ${conditions.join("\n  ")}\n  return "d";\n}`;

  const algo = parseAlgorithm(source);
  console.log(`Generated algorithm with ${conditions.length} chained conditions.`);

  const ctx = {
    health: 55,
    position: { row: 10, col: 10 },
    teamTotalHealth: 500,
    currentTurn: 1,
    boardSize: { rows: BOARD_ROWS, cols: BOARD_COLS },
    neighbors: { n: "empty", s: "empty", e: "empty", w: "empty", ne: "empty", nw: "empty", se: "empty", sw: "outside" } as const,
    nearbyAllies: false,
    nearbyEnemies: false,
  };

  const SAMPLES = 5000;
  const times: number[] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t0 = performance.now();
    runAlgorithm(algo, ctx);
    times.push(performance.now() - t0);
  }
  summarize("Single invocation time (worst-case decision tree)", times);
}

// ---------------------------------------------------------------------------
// Run all scenarios
// ---------------------------------------------------------------------------

async function main() {
  console.log("Battle of Cells — Stress Test");
  console.log(`Board: ${BOARD_ROWS}x${BOARD_COLS} (${BOARD_ROWS * BOARD_COLS} squares) | Turn limit: ${DEFAULT_TURN_LIMIT}`);

  runReproductionStorm();
  runFullMatch();
  runSaturatedSteadyState(500, 200); // 1000 total cells, 200 turns
  runSaturatedSteadyState(2000, 50); // 4000 total cells, 50 turns (heavier density, shorter run)
  runPathologicalAlgorithm();

  console.log("\nStress test complete.");
}

main();
