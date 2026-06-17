import { describe, expect, test } from "vitest";
import { createInitialState } from "./initialState";
import type { PlayerConfig, TeamId } from "./types";

function createPlayers(): Record<TeamId, PlayerConfig> {
  return {
    p1: {
      id: "p1",
      teamName: "Alpha",
      teamColor: "#1ad1ea",
      algorithmSource: "function decide(context) { return 'mn'; }",
    },
    p2: {
      id: "p2",
      teamName: "Beta",
      teamColor: "#ff7a54",
      algorithmSource: "function decide(context) { return 'ms'; }",
    },
  };
}

describe("initial state spawns", () => {
  test("places players on different squares in opposite board regions", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;
    const p2 = state.cellsById.get(2)!;

    expect(p1.position).not.toEqual(p2.position);
    expect(p1.position.col).toBeLessThan(p2.position.col);
    expect(p1.position.col).toBeLessThan(60);
    expect(p2.position.col).toBeGreaterThan(140);
  });

  test("randomized spawns vary across rng inputs", () => {
    const low = createInitialState(createPlayers(), () => 0);
    const high = createInitialState(createPlayers(), () => 0.999999);
    const lowP1 = low.cellsById.get(1)!;
    const highP1 = high.cellsById.get(1)!;

    expect(lowP1.position).not.toEqual(highP1.position);
  });
});
