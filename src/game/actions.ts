import type { ActionCode, ActionKind, DirectionCode } from "./types";

const ACTION_PREFIX_TO_KIND: Record<string, ActionKind> = {
  m: "move",
  a: "eat",
  r: "reproduce",
};

export function parseActionCode(action: ActionCode): {
  kind: ActionKind;
  direction: DirectionCode | null;
} {
  return {
    kind: ACTION_PREFIX_TO_KIND[action[0]] ?? "move",
    direction: action.slice(1) as DirectionCode,
  };
}
