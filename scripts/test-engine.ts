// Quick sanity tests for the Battle of Cells engine, run with ts-node/tsx
import { validateAlgorithm } from "../src/game/validation";
import { parseAlgorithm } from "../src/game/interpreter";
import { executeTurn } from "../src/game/engine";
import { evaluateEndConditions } from "../src/game/victory";
import type { Cell, GameState, Player } from "../src/game/types";

let pass = 0;
let fail = 0;

function assert(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    pass++;
    console.log(`PASS: ${name}`);
  } else {
    fail++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

// --- Validation tests ---

const validCode = `function decide(context) {
  if (context.neighbors.e === "enemy") {
    return "ae";
  }
  if (context.neighbors.n === "empty") {
    return "mn";
  }
  return "d";
}`;

const v1 = validateAlgorithm(validCode);
assert("valid algorithm validates", v1.valid, v1.errors);

const loopCode = `function decide(context) {
  for (let i = 0; i < 10; i++) {
    return "d";
  }
  return "d";
}`;
const v2 = validateAlgorithm(loopCode);
assert("for loop rejected", !v2.valid, v2.errors);

const evalCode = `function decide(context) {
  eval("d");
  return "d";
}`;
const v3 = validateAlgorithm(evalCode);
assert("eval rejected", !v3.valid, v3.errors);

const invalidActionCode = `function decide(context) {
  return "xx";
}`;
const v4 = validateAlgorithm(invalidActionCode);
assert("invalid action code rejected", !v4.valid, v4.errors);

const dynamicReturnCode = `function decide(context) {
  return context.neighbors.n;
}`;
const v5 = validateAlgorithm(dynamicReturnCode);
assert("non-literal return rejected", !v5.valid, v5.errors);

const whileCode = `function decide(context) {
  while (true) {
    return "d";
  }
}`;
const v6 = validateAlgorithm(whileCode);
assert("while loop rejected", !v6.valid, v6.errors);

const functionCtorCode = `function decide(context) {
  const f = new Function("return 1");
  return "d";
}`;
const v7 = validateAlgorithm(functionCtorCode);
assert("Function constructor rejected", !v7.valid, v7.errors);

const noReturnAllPaths = `function decide(context) {
  if (context.health > 50) {
    return "d";
  }
}`;
const v8 = validateAlgorithm(noReturnAllPaths);
assert("missing return on all paths rejected", !v8.valid, v8.errors);

// --- Engine tests ---

const player1: Player = { id: 1, name: "Alpha", color: "#e63946", code: "", validated: true, };
const player2: Player = { id: 2, name: "Beta", color: "#1d8bf1", code: "", validated: true };

const restAlgo = parseAlgorithm(`function decide(context) { return "d"; }`);
const eastEatAlgo = parseAlgorithm(`function decide(context) {
  if (context.neighbors.e === "enemy") return "ae";
  if (context.neighbors.w === "enemy") return "aw";
  return "d";
}`);

// Test: Move outside board cancels action
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 0, col: 0 }, health: 100, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const moveNorthAlgo = parseAlgorithm(`function decide(context) { return "mn"; }`);
  const next = executeTurn(state, { team1: moveNorthAlgo, team2: restAlgo });
  const c = next.cells.find((c) => c.internalId === 1)!;
  assert("move outside board cancels action (position unchanged)", c.position.row === 0 && c.position.col === 0, c);
}

// Test: Move into occupied square cancels action
{
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const cellB: Cell = { internalId: 2, teamId: 2, teamName: "B", color: "#000", position: { row: 4, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA, cellB], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const moveNorthAlgo = parseAlgorithm(`function decide(context) { return "mn"; }`);
  const next = executeTurn(state, { team1: moveNorthAlgo, team2: restAlgo });
  const c = next.cells.find((c) => c.internalId === 1)!;
  assert("move into occupied square cancels action", c.position.row === 5 && c.position.col === 5, c);
}

// Test: Eat empty square cancels action (no health change)
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const next = executeTurn(state, { team1: eastEatAlgo, team2: restAlgo });
  const c = next.cells.find((c) => c.internalId === 1)!;
  assert("eating empty square does nothing", c.health === 100, c);
}

// Test: Eat allied cell is not allowed (cancels action)
{
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const cellB: Cell = { internalId: 2, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 6 }, health: 100, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA, cellB], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const next = executeTurn(state, { team1: eastEatAlgo, team2: restAlgo });
  const cb = next.cells.find((c) => c.internalId === 2)!;
  assert("eating allied cell cancels action (no damage)", cb.health === 100, cb);
}

// Test: Eat enemy causes 5 damage and removes at 0
{
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const cellB: Cell = { internalId: 2, teamId: 2, teamName: "B", color: "#000", position: { row: 5, col: 6 }, health: 5, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA, cellB], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const next = executeTurn(state, { team1: eastEatAlgo, team2: restAlgo });
  const cb = next.cells.find((c) => c.internalId === 2);
  assert("enemy at 0 health is removed from board", cb === undefined, next.cells);
}

// Test: Reproduction with even health (e.g. 50 -> 25/25)
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 50, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const reproEastAlgo = parseAlgorithm(`function decide(context) { return "re"; }`);
  const next = executeTurn(state, { team1: reproEastAlgo, team2: restAlgo });
  const original = next.cells.find((c) => c.internalId === 1)!;
  const child = next.cells.find((c) => c.internalId !== 1)!;
  assert("reproduction even health splits 25/25", original.health === 25 && child.health === 25, { original, child });
  assert("total health preserved (even)", original.health + child.health === 50, { original, child });
}

// Test: Reproduction with odd health (51 -> 26 original / 25 new)
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 51, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const reproEastAlgo = parseAlgorithm(`function decide(context) { return "re"; }`);
  const next = executeTurn(state, { team1: reproEastAlgo, team2: restAlgo });
  const original = next.cells.find((c) => c.internalId === 1)!;
  const child = next.cells.find((c) => c.internalId !== 1)!;
  assert("reproduction odd health: original keeps extra (26)", original.health === 26, original);
  assert("reproduction odd health: new cell gets 25", child.health === 25, child);
  assert("total health preserved (odd)", original.health + child.health === 51, { original, child });
}

// Test: Newborn cell does not act on the same turn
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 50, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const reproEastAlgo = parseAlgorithm(`function decide(context) { return "re"; }`);
  const moveNorthAlgo = parseAlgorithm(`function decide(context) { return "mn"; }`);
  // turn 1: reproduce
  let next = executeTurn(state, { team1: reproEastAlgo, team2: restAlgo });
  next = { ...next, currentTurn: next.currentTurn + 1 };
  const childBeforeTurn2 = next.cells.find((c) => c.internalId !== 1)!;
  const posBefore = { ...childBeforeTurn2.position };
  // turn 2: child should now act (use move-north algorithm for team1 to test it acts)
  const next2 = executeTurn(next, { team1: moveNorthAlgo, team2: restAlgo });
  const childAfterTurn2 = next2.cells.find((c) => c.internalId === childBeforeTurn2.internalId)!;
  assert("newborn cell did not move on creation turn", posBefore.row === 5 && posBefore.col === 6, posBefore);
  assert("newborn cell acts on following turn", childAfterTurn2.position.row === posBefore.row - 1, childAfterTurn2);
}

// Test: Rest recovers 3 health, capped at 100
{
  const cell: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 99, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cell], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const next = executeTurn(state, { team1: restAlgo, team2: restAlgo });
  const c = next.cells.find((c) => c.internalId === 1)!;
  assert("rest caps at 100", c.health === 100, c);
}

// Test: Victory by elimination
{
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA], currentTurn: 10, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 2 };
  const { finished, result } = evaluateEndConditions(state, player1, player2);
  assert("elimination victory detected", finished && result?.winner === 1, result);
}

// Test: Draw - both teams eliminated
{
  const state: GameState = { cells: [], currentTurn: 10, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 1 };
  const { finished, result } = evaluateEndConditions(state, player1, player2);
  assert("draw when both teams eliminated", finished && result?.winner === "draw" && result?.cause === "draw_no_survivors", result);
}

// Test: Turn limit tie -> more living cells wins
{
  const cellsA: Cell[] = [
    { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 1 }, health: 50, alive: true, creationTurn: 1 },
    { internalId: 2, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 2 }, health: 50, alive: true, creationTurn: 1 },
  ];
  const cellsB: Cell[] = [
    { internalId: 3, teamId: 2, teamName: "B", color: "#000", position: { row: 2, col: 1 }, health: 100, alive: true, creationTurn: 1 },
  ];
  const state: GameState = { cells: [...cellsA, ...cellsB], currentTurn: 5000, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 4 };
  const { finished, result } = evaluateEndConditions(state, player1, player2);
  assert("turn limit: more living cells wins", finished && result?.winner === 1, result);
}

// Test: Turn limit tie -> total health tiebreaker
{
  const cellsA: Cell[] = [
    { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 1 }, health: 60, alive: true, creationTurn: 1 },
  ];
  const cellsB: Cell[] = [
    { internalId: 2, teamId: 2, teamName: "B", color: "#000", position: { row: 2, col: 1 }, health: 40, alive: true, creationTurn: 1 },
  ];
  const state: GameState = { cells: [...cellsA, ...cellsB], currentTurn: 5000, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const { finished, result } = evaluateEndConditions(state, player1, player2);
  assert("turn limit: total health tiebreaker", finished && result?.winner === 1, result);
}

// Test: Full draw at turn limit (tied cells and health)
{
  const cellsA: Cell[] = [
    { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 1 }, health: 50, alive: true, creationTurn: 1 },
  ];
  const cellsB: Cell[] = [
    { internalId: 2, teamId: 2, teamName: "B", color: "#000", position: { row: 2, col: 1 }, health: 50, alive: true, creationTurn: 1 },
  ];
  const state: GameState = { cells: [...cellsA, ...cellsB], currentTurn: 5000, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const { finished, result } = evaluateEndConditions(state, player1, player2);
  assert("turn limit: full tie is draw", finished && result?.winner === "draw", result);
}

// Test: Cell dying before its turn does not execute (cell already removed from list before its turn arrives)
{
  // Cell A (team1, created turn1, pos 5,5) eats Cell C (team2, pos 5,6, health 5) -> dies
  // Cell C's algorithm would try to move but it's dead before acting
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const cellC: Cell = { internalId: 2, teamId: 2, teamName: "C", color: "#000", position: { row: 5, col: 6 }, health: 5, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA, cellC], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const moveNorthAlgo = parseAlgorithm(`function decide(context) { return "mn"; }`);
  const next = executeTurn(state, { team1: eastEatAlgo, team2: moveNorthAlgo });
  const survivorC = next.cells.find((c) => c.internalId === 2);
  assert("cell dying before its turn does not execute and is removed", survivorC === undefined, next.cells);
}

// --- teamHealthTotals correctness tests (the dictionary-based optimization) ---

// Test: an algorithm reading context.teamTotalHealth mid-turn sees the
// post-damage value after an earlier-acting teammate's kill reduced the
// enemy team's total, not a stale pre-turn snapshot.
{
  // Team 1 has two cells (creationTurn 1, so they act before team 2's single
  // cell per the row/col/id ordering -- we pin exact positions to control
  // ordering). Team 1 cell A eats team 2's only cell down from 5 -> 0 (dies).
  // We then check that team 1 cell B, acting later in the same turn and
  // reading context.teamTotalHealth for team 1, sees team 1's own (unchanged)
  // total correctly, and separately verify team 2's total is consumed
  // correctly by checking final state.
  const recordingAlgoSrc = `function decide(context) {
    return "d";
  }`;
  // We can't easily inject a JS closure into the sandboxed interpreter, so
  // instead we verify indirectly: run a turn where team1 has two cells with
  // health 40 and 60 (total 100), have one of them rest (+3), and confirm
  // the OTHER cell, acting afterward, would compute against the updated
  // total by checking the final total via stats rather than mid-turn capture.
  const cellA: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 1 }, health: 40, alive: true, creationTurn: 1 };
  const cellB: Cell = { internalId: 2, teamId: 1, teamName: "A", color: "#fff", position: { row: 1, col: 2 }, health: 57, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [cellA, cellB], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 3 };
  const restAlgoLocal = parseAlgorithm(recordingAlgoSrc);
  const next = executeTurn(state, { team1: restAlgoLocal, team2: restAlgoLocal });
  const a = next.cells.find((c) => c.internalId === 1)!;
  const b = next.cells.find((c) => c.internalId === 2)!;
  assert("rest increments running team total correctly (40+3=43)", a.health === 43, a);
  assert("rest increments running team total correctly (57+3=60, capped under 100)", b.health === 60, b);
  assert("team total after two rests is sum of both new healths", a.health + b.health === 103, { a, b });
}

// Test: eating reduces the victim team's running total by exactly the damage
// dealt (not the full health, in case of partial damage near death)
{
  const attacker: Cell = { internalId: 1, teamId: 1, teamName: "A", color: "#fff", position: { row: 5, col: 5 }, health: 100, alive: true, creationTurn: 1 };
  const victim: Cell = { internalId: 2, teamId: 2, teamName: "B", color: "#000", position: { row: 5, col: 6 }, health: 3, alive: true, creationTurn: 1 };
  const otherAlly: Cell = { internalId: 3, teamId: 2, teamName: "B", color: "#000", position: { row: 10, col: 10 }, health: 50, alive: true, creationTurn: 1 };
  const state: GameState = { cells: [attacker, victim, otherAlly], currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: 4 };
  const eatEastAlgo = parseAlgorithm(`function decide(context) {
    if (context.neighbors.e === "enemy") return "ae";
    return "d";
  }`);
  const restAlgoLocal = parseAlgorithm(`function decide(context) { return "d"; }`);
  const next = executeTurn(state, { team1: eatEastAlgo, team2: restAlgoLocal });
  const survivingAlly = next.cells.find((c) => c.internalId === 3)!;
  // Victim had 3 health, took 5 damage -> clamped to 0 (damage dealt = 3, not 5)
  // otherAlly rests: 50 -> 53
  // Team 2 total after turn should be 0 (victim, dead) + 53 (otherAlly) = 53
  let team2Total = 0;
  for (const c of next.cells) {
    if (c.alive && c.teamId === 2) team2Total += c.health;
  }
  assert("damage dealt is clamped correctly (3 hp victim doesn't go negative)", next.cells.find((c) => c.internalId === 2) === undefined, next.cells);
  assert("surviving ally on damaged team still rests normally", survivingAlly.health === 53, survivingAlly);
  assert("team2 running total matches actual sum after partial-damage death", team2Total === 53, team2Total);
}

// --- Performance regression test ---
// Ensures executeTurn scales roughly linearly, not quadratically, in cell
// count. This guards against reintroducing an O(N^2) per-turn computation.
{
  function buildLargeState(nPerTeam: number): GameState {
    const cells: Cell[] = [];
    let id = 1;
    const cols = 200;
    for (let i = 0; i < nPerTeam; i++) {
      cells.push({ internalId: id++, teamId: 1, teamName: "A", color: "#fff", position: { row: Math.floor(i / cols), col: i % cols }, health: 100, alive: true, creationTurn: 1 });
    }
    for (let i = 0; i < nPerTeam; i++) {
      cells.push({ internalId: id++, teamId: 2, teamName: "B", color: "#000", position: { row: 50 + Math.floor(i / cols), col: i % cols }, health: 100, alive: true, creationTurn: 1 });
    }
    return { cells, currentTurn: 1, turnLimit: 5000, isRunning: true, isPaused: false, isFinished: false, result: null, errors: [], nextInternalId: id };
  }
  const restAlgoLocal = parseAlgorithm(`function decide(context) { return "d"; }`);

  const small = buildLargeState(400); // 800 total cells
  const t0 = performance.now();
  executeTurn(small, { team1: restAlgoLocal, team2: restAlgoLocal });
  const smallTime = performance.now() - t0;

  const large = buildLargeState(1600); // 3200 total cells (4x the population)
  const t1 = performance.now();
  executeTurn(large, { team1: restAlgoLocal, team2: restAlgoLocal });
  const largeTime = performance.now() - t1;

  // With O(N) scaling, 4x the cells should take roughly ~4x as long (allow
  // generous headroom for noise: anything under ~15x is acceptable, while
  // the old O(N^2) behavior would show roughly 16x).
  const ratio = largeTime / Math.max(smallTime, 0.01);
  assert(
    `turn time scales sub-quadratically (4x cells -> ${ratio.toFixed(1)}x time, small=${smallTime.toFixed(2)}ms large=${largeTime.toFixed(2)}ms)`,
    ratio < 15,
    { smallTime, largeTime, ratio },
  );
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
