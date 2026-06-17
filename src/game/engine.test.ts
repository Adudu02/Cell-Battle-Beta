import { describe, expect, test } from "vitest";
import { createEngineFromState } from "./engine";
import { createInitialState } from "./initialState";
import { ALGORITHM_TEMPLATES } from "./algorithmTemplates";
import { createAlgorithmRunner } from "./validation";
import type { AlgorithmRunner, PlayerConfig, TeamId } from "./types";

function createPlayers(): Record<TeamId, PlayerConfig> {
  return {
    p1: {
      id: "p1",
      teamName: "Alpha",
      teamColor: "#1ad1ea",
      algorithmSource: "function decide(context) { return 'ae'; }",
    },
    p2: {
      id: "p2",
      teamName: "Beta",
      teamColor: "#ff7a54",
      algorithmSource: "function decide(context) { return 'aw'; }",
    },
  };
}

describe("combat resolution", () => {
  test("eat instantly eliminates the target and advances the attacker", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;
    const p2 = state.cellsById.get(2)!;

    state.occupancy[p1.position.row * 200 + p1.position.col] = -1;
    state.occupancy[p2.position.row * 200 + p2.position.col] = -1;

    p1.position = { row: 12, col: 12 };
    p2.position = { row: 12, col: 13 };
    state.occupancy[12 * 200 + 12] = p1.id;
    state.occupancy[12 * 200 + 13] = p2.id;

    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "ae",
      p2: () => "aw",
    };

    const snapshot = createEngineFromState(state, runners).stepTurn();
    const movedAttacker = snapshot.cells!.find((cell) => cell.id === p1.id)!;

    expect(snapshot.stats.p2.livingCells).toBe(0);
    expect(movedAttacker.position).toEqual({ row: 12, col: 13 });
    expect(snapshot.result?.winnerTeamId).toBe("p1");
  });

  test("newest created cell acts first when both have actions queued", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;
    const p2 = state.cellsById.get(2)!;

    state.occupancy[p1.position.row * 200 + p1.position.col] = -1;
    state.occupancy[p2.position.row * 200 + p2.position.col] = -1;

    p1.position = { row: 20, col: 20 };
    p2.position = { row: 20, col: 21 };
    p1.createdTurn = 1;
    p2.createdTurn = 9;
    state.cellsByCreatedTurn = new Map([
      [1, [p1.id]],
      [9, [p2.id]],
    ]);
    state.createdTurnGroups = [1, 9];
    state.occupancy[20 * 200 + 20] = p1.id;
    state.occupancy[20 * 200 + 21] = p2.id;

    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "ae",
      p2: () => "aw",
    };

    const snapshot = createEngineFromState(state, runners).stepTurn();

    expect(snapshot.stats.p1.livingCells).toBe(0);
    expect(snapshot.stats.p2.livingCells).toBe(1);
    expect(snapshot.cells!.find((cell) => cell.id === p2.id)?.position).toEqual({
      row: 20,
      col: 20,
    });
  });

  test("lower id breaks ties when creation turn matches", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;
    const p2 = state.cellsById.get(2)!;

    state.occupancy[p1.position.row * 200 + p1.position.col] = -1;
    state.occupancy[p2.position.row * 200 + p2.position.col] = -1;

    p1.position = { row: 18, col: 19 };
    p2.position = { row: 18, col: 18 };
    p1.createdTurn = 4;
    p2.createdTurn = 4;
    state.cellsByCreatedTurn = new Map([[4, [p1.id, p2.id]]]);
    state.createdTurnGroups = [4];
    state.occupancy[18 * 200 + 19] = p1.id;
    state.occupancy[18 * 200 + 18] = p2.id;

    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "aw",
      p2: () => "ae",
    };

    const snapshot = createEngineFromState(state, runners).stepTurn();

    expect(snapshot.stats.p1.livingCells).toBe(1);
    expect(snapshot.stats.p2.livingCells).toBe(0);
    expect(snapshot.cells!.find((cell) => cell.id === p1.id)?.position).toEqual({
      row: 18,
      col: 18,
    });
  });

  test("manual end match resolves a winner by living cell count", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;

    const bonusCell = {
      id: 3,
      teamId: "p1" as const,
      teamName: p1.teamName,
      teamColor: p1.teamColor,
      position: { row: p1.position.row, col: p1.position.col + 1 },
      alive: true,
      createdTurn: 2,
    };

    state.cellsById.set(bonusCell.id, bonusCell);
    state.aliveCells.add(bonusCell.id);
    state.cellsByCreatedTurn.set(2, [bonusCell.id]);
    state.createdTurnGroups.push(2);
    state.occupancy[bonusCell.position.row * 200 + bonusCell.position.col] = bonusCell.id;
    state.teamStats.p1.livingCells = 2;

    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "ae",
      p2: () => "aw",
    };

    const snapshot = createEngineFromState(state, runners).endMatch();

    expect(snapshot.result?.termination).toBe("manual");
    expect(snapshot.result?.winnerTeamId).toBe("p1");
    expect(snapshot.result?.cause).toContain("Match ended manually");
  });

  test("dead cells are pruned from state after combat resolves", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const p1 = state.cellsById.get(1)!;
    const p2 = state.cellsById.get(2)!;

    state.occupancy[p1.position.row * 200 + p1.position.col] = -1;
    state.occupancy[p2.position.row * 200 + p2.position.col] = -1;

    p1.position = { row: 15, col: 15 };
    p2.position = { row: 15, col: 16 };
    state.occupancy[15 * 200 + 15] = p1.id;
    state.occupancy[15 * 200 + 16] = p2.id;

    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "ae",
      p2: () => "aw",
    };

    createEngineFromState(state, runners).stepTurn();

    expect(state.cellsById.has(p2.id)).toBe(false);
    expect(state.cellsByCreatedTurn.get(0)).toEqual([p1.id]);
    expect(state.createdTurnGroups).toEqual([0]);
    expect(state.aliveCells.size).toBe(1);
  });

  test("incremental snapshots skip full cell arrays after initialization", () => {
    const state = createInitialState(createPlayers(), () => 0.5);
    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: () => "re",
      p2: () => "rw",
    };

    const engine = createEngineFromState(state, runners);
    const initialSnapshot = engine.getSnapshot();
    const nextSnapshot = engine.stepTurn();

    expect(initialSnapshot.boardPatch.fullSync).toBe(true);
    expect(initialSnapshot.cells?.length).toBe(2);
    expect(nextSnapshot.boardPatch.fullSync).toBe(false);
    expect(nextSnapshot.cells).toBeUndefined();
  });
});

describe("algorithm templates", () => {
  test("stress template attacks before further expansion", () => {
    const stressTemplate = ALGORITHM_TEMPLATES.find((template) => template.id === "stress");
    expect(stressTemplate).toBeDefined();

    const runner = createAlgorithmRunner(stressTemplate!.source);
    const action = runner({
      position: { row: 50, col: 50 },
      currentTurn: 120,
      boardSize: { rows: 100, cols: 200 },
      neighbors: {
        north: "allied",
        south: "allied",
        east: "enemy",
        west: "allied",
        northeast: "allied",
        northwest: "allied",
        southeast: "allied",
        southwest: "allied",
      },
      nearbyAllies: ["north", "south", "west", "northeast", "northwest", "southeast", "southwest"],
      nearbyEnemies: ["east"],
      hasNearbyAllies: true,
      hasNearbyEnemies: true,
    });

    expect(action).toBe("ae");
  });

  test("stress template still attacks when empties remain nearby", () => {
    const stressTemplate = ALGORITHM_TEMPLATES.find((template) => template.id === "stress");
    expect(stressTemplate).toBeDefined();

    const runner = createAlgorithmRunner(stressTemplate!.source);
    const action = runner({
      position: { row: 50, col: 50 },
      currentTurn: 120,
      boardSize: { rows: 100, cols: 200 },
      neighbors: {
        north: "empty",
        south: "empty",
        east: "enemy",
        west: "empty",
        northeast: "empty",
        northwest: "allied",
        southeast: "empty",
        southwest: "allied",
      },
      nearbyAllies: ["northwest", "southwest"],
      nearbyEnemies: ["east"],
      hasNearbyAllies: true,
      hasNearbyEnemies: true,
    });

    expect(action).toBe("ae");
  });

  test("stress template match runs for repeated turns without runtime errors", () => {
    const stressTemplate = ALGORITHM_TEMPLATES.find((template) => template.id === "stress");
    expect(stressTemplate).toBeDefined();

    const state = createInitialState(createPlayers(), () => 0.5);
    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: createAlgorithmRunner(stressTemplate!.source),
      p2: createAlgorithmRunner(stressTemplate!.source),
    };

    const snapshot = createEngineFromState(state, runners).stepTurns(24);

    expect(snapshot.currentTurn).toBeGreaterThan(20);
    expect(snapshot.errors).toEqual([]);
    expect(snapshot.stats.p1.livingCells + snapshot.stats.p2.livingCells).toBeGreaterThan(2);
  });

  test("stress match keeps state maps aligned with living cells", () => {
    const stressTemplate = ALGORITHM_TEMPLATES.find((template) => template.id === "stress");
    expect(stressTemplate).toBeDefined();

    const state = createInitialState(createPlayers(), () => 0.5);
    const runners: Record<TeamId, AlgorithmRunner> = {
      p1: createAlgorithmRunner(stressTemplate!.source),
      p2: createAlgorithmRunner(stressTemplate!.source),
    };

    createEngineFromState(state, runners).stepTurns(32);

    const livingCells = state.teamStats.p1.livingCells + state.teamStats.p2.livingCells;
    expect(state.cellsById.size).toBe(livingCells);
    expect(state.aliveCells.size).toBe(livingCells);
  });
});
