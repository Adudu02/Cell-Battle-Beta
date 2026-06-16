// Action categorization helpers for Battle of Cells

import type { ActionCode } from "./types";
import { VALID_ACTION_CODES } from "./types";

export function isValidActionCode(code: string): code is ActionCode {
  return (VALID_ACTION_CODES as string[]).includes(code);
}

export function isMoveAction(code: ActionCode): boolean {
  return code.startsWith("m");
}

export function isEatAction(code: ActionCode): boolean {
  return code.startsWith("a");
}

export function isReproduceAction(code: ActionCode): boolean {
  return code.startsWith("r");
}

export function isRestAction(code: ActionCode): boolean {
  return code === "d";
}
