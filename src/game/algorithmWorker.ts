import ts from "typescript";
import type { ActionCode, CellContext } from "./types";
import { ACTION_CODES } from "./constants";

const ACTION_SET = new Set<ActionCode>(ACTION_CODES);

function cloneContext(context: CellContext): CellContext {
  return {
    ...context,
    position: { ...context.position },
    boardSize: { ...context.boardSize },
    neighbors: { ...context.neighbors },
    nearbyAllies: [...context.nearbyAllies],
    nearbyEnemies: [...context.nearbyEnemies],
  };
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);

  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }

  return value;
}

self.onmessage = (
  event: MessageEvent<{ source: string; context: CellContext }>,
) => {
  try {
    const transpiled = ts.transpileModule(event.data.source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.None,
      },
    }).outputText;

    const factory = new Function(`
"use strict";
const window = undefined;
const document = undefined;
const globalThis = undefined;
const self = undefined;
const fetch = undefined;
const XMLHttpRequest = undefined;
const WebSocket = undefined;
const EventSource = undefined;
const Worker = undefined;
const SharedWorker = undefined;
const localStorage = undefined;
const sessionStorage = undefined;
const indexedDB = undefined;
const navigator = undefined;
const location = undefined;
const postMessage = undefined;
const importScripts = undefined;
const Function = undefined;
${transpiled}
if (typeof decide !== "function") {
  throw new Error("Algorithm must declare function decide(context).");
}
return decide;
`);

    const decide = factory() as (context: CellContext) => unknown;
    const action = decide(deepFreeze(cloneContext(event.data.context)));

    if (typeof action !== "string" || !ACTION_SET.has(action as ActionCode)) {
      throw new Error("Algorithm returned an invalid action code.");
    }

    self.postMessage({ ok: true });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Algorithm execution failed.",
    });
  }
};
