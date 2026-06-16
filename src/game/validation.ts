// Algorithm validation for Battle of Cells.
//
// Validates a user-submitted "decide" function against the restricted
// language subset, checks that all literal returns are valid action codes,
// and runs the function against a representative test context to ensure it
// does not throw and does not exceed the time limit.

import {
  allPathsReturn,
  collectReturnedStringLiterals,
  parseAlgorithm,
  runAlgorithm,
  RuntimeError,
  ValidationError,
  type FunctionDecl,
} from "./interpreter";
import { isValidActionCode } from "./actions";
import { VALIDATION_TIMEOUT_MS } from "./constants";
import type { CellContext } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  parsed?: FunctionDecl;
}

function buildTestContexts(): CellContext[] {
  const base: CellContext = {
    health: 100,
    position: { row: 50, col: 100 },
    teamTotalHealth: 100,
    currentTurn: 1,
    boardSize: { rows: 100, cols: 200 },
    neighbors: {
      n: "empty",
      s: "empty",
      e: "empty",
      w: "empty",
      ne: "empty",
      nw: "empty",
      se: "empty",
      sw: "empty",
    },
    nearbyAllies: false,
    nearbyEnemies: false,
  };

  // A handful of varied contexts to increase the chance of surfacing runtime errors
  return [
    base,
    {
      ...base,
      health: 30,
      neighbors: { ...base.neighbors, e: "enemy", n: "allied" },
      nearbyEnemies: true,
      nearbyAllies: true,
    },
    {
      ...base,
      health: 100,
      position: { row: 0, col: 0 },
      neighbors: {
        n: "outside",
        nw: "outside",
        ne: "outside",
        w: "outside",
        sw: "outside",
        s: "empty",
        e: "empty",
        se: "empty",
      },
    },
    {
      ...base,
      health: 1,
      neighbors: { ...base.neighbors, s: "enemy" },
      nearbyEnemies: true,
    },
  ];
}

// Runs a function with a synchronous timeout guard. Since the interpreter is
// a simple tree-walker with no loops, runaway execution is not realistically
// possible, but we still measure elapsed time as a safety net and to satisfy
// the "function executes within 1 second" requirement.
function runWithTimeout(fn: FunctionDecl, context: CellContext): { result?: unknown; error?: string; timedOut?: boolean } {
  const start = performance.now();
  try {
    const result = runAlgorithm(fn, context);
    const elapsed = performance.now() - start;
    if (elapsed > VALIDATION_TIMEOUT_MS) {
      return { timedOut: true };
    }
    return { result };
  } catch (err) {
    const elapsed = performance.now() - start;
    if (elapsed > VALIDATION_TIMEOUT_MS) {
      return { timedOut: true };
    }
    if (err instanceof RuntimeError) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : "Unknown runtime error" };
  }
}

export function validateAlgorithm(source: string): ValidationResult {
  const errors: string[] = [];

  if (!source || source.trim().length === 0) {
    return { valid: false, errors: ["Algorithm code cannot be empty."] };
  }

  // 1. Parse / syntax + disallowed-construct checks
  let parsed: FunctionDecl;
  try {
    parsed = parseAlgorithm(source);
  } catch (err) {
    if (err instanceof ValidationError) {
      return { valid: false, errors: [err.message] };
    }
    return { valid: false, errors: ["Unknown syntax error while parsing the algorithm."] };
  }

  // 2. Function name check (informational; "decide" is the documented convention)
  if (parsed.name !== "decide") {
    errors.push(`Function should be named 'decide' (found '${parsed.name}'). It will still be executed, but please rename it for clarity.`);
  }

  // 3. Ensure every code path returns a value
  if (!allPathsReturn(parsed.body)) {
    errors.push("Not all code paths return an action. Make sure every branch (including a final fallback) returns a valid action code.");
  }

  // 4. Collect literal string returns and validate them as action codes
  const { literals, hasNonLiteralReturn } = collectReturnedStringLiterals(parsed);
  if (literals.length === 0) {
    errors.push("The function must return at least one literal action code string (e.g. \"mn\", \"ae\", \"d\").");
  }
  for (const lit of literals) {
    if (!isValidActionCode(lit)) {
      errors.push(`"${lit}" is not a valid action code.`);
    }
  }
  if (hasNonLiteralReturn) {
    errors.push("All returns must be literal action code strings (dynamically computed return values are not allowed).");
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 5. Run against representative test contexts
  const testContexts = buildTestContexts();
  for (const ctx of testContexts) {
    const outcome = runWithTimeout(parsed, ctx);
    if (outcome.timedOut) {
      return { valid: false, errors: ["Timed out"] };
    }
    if (outcome.error) {
      return { valid: false, errors: [`Runtime error during test execution: ${outcome.error}`] };
    }
    if (typeof outcome.result !== "string" || !isValidActionCode(outcome.result)) {
      return {
        valid: false,
        errors: [`Function returned an invalid value during test execution: ${JSON.stringify(outcome.result)}`],
      };
    }
  }

  return { valid: true, errors: [], parsed };
}
