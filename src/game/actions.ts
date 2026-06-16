import type { ActionCode, ActionKind, DirectionCode } from "./types";

const ACTION_PREFIX_TO_KIND: Record<string, ActionKind> = {
  m: "move",
  a: "eat",
  r: "reproduce",
  d: "rest",
};

export function parseActionCode(action: ActionCode): {
  kind: ActionKind;
  direction: DirectionCode | null;
} {
  if (action === "d") {
    return { kind: "rest", direction: null };
  }

  return {
    kind: ACTION_PREFIX_TO_KIND[action[0]] ?? "rest",
    direction: action.slice(1) as DirectionCode,
  };
}
