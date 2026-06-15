import { describe, expect, it } from 'vitest';
import { advanceSimulation, createSimulationState, endSimulationEarly, runSimulationTurn, startMatch } from '../../src/game/engine.js';
import { validateStrategy } from '../../src/game/validation.js';
import type { Cell, PlayerDefinition } from '../../src/game/types.js';

function makePlayer(id: 1 | 2, name: string, color: string, code: string): PlayerDefinition {
  const validation = validateStrategy(code);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  return {
    id,
    name,
    color,
    code,
    validation,
  };
}

function makeCell(player: PlayerDefinition, id: string, row: number, col: number, overrides: Partial<Cell> = {}): Cell {
  return {
    id,
    teamId: player.id,
    teamName: player.name,
    teamColor: player.color,
    position: { row, col },
    health: 100,
    age: 1,
    alive: true,
    creationTurn: 0,
    createdDuringCurrentTurn: false,
    lastAction: 'none',
    lastActionStatus: 'none',
    ...overrides,
  };
}

function makeMatchConfig(codeOne: string, codeTwo: string, turnLimit = 10) {
  return {
    teams: [
      makePlayer(1, 'Alpha', '#22d3ee', codeOne),
      makePlayer(2, 'Beta', '#f43f5e', codeTwo),
    ] as [PlayerDefinition, PlayerDefinition],
    turnLimit,
    boardRows: 5,
    boardCols: 5,
  };
}

describe('engine', () => {
  it('turn starts at 1 and surviving cells age by 1 without age damage or old-age death', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    return "d"`,
      `def action(cell, environment):
    return "d"`,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'a', 2, 2, { age: 89, health: 50 }),
        makeCell(config.teams[1], 'b', 4, 4),
      ],
    });

    expect(state.currentTurn).toBe(1);
    const next = runSimulationTurn(state);
    const aged = next.cells.find((cell) => cell.id === 'a');
    expect(aged?.age).toBe(90);
    expect(aged?.health).toBe(53);
    expect(aged?.alive).toBe(true);
  });

  it('newborn cells do not act during the same turn and board updates immediately', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    if cell["health"] >= 50:
        return "re"
    return "me"`,
      `def action(cell, environment):
    return "ae"`,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'a', 2, 2),
        makeCell(config.teams[1], 'b', 4, 4),
      ],
    });

    const next = runSimulationTurn(state);
    const child = next.cells.find((cell) => cell.id !== 'a' && cell.teamId === 1);
    expect(child?.lastAction).toBe('born');
    expect(child?.age).toBe(2);
  });

  it('uses the start-of-turn snapshot for order even if positions change during the turn', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    if cell["col"] == 0:
        return "me"
    return "mw"`,
      `def action(cell, environment):
    return "d"`,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'left', 1, 0, { age: 1, creationTurn: 0 }),
        makeCell(config.teams[0], 'right', 1, 2, { age: 1, creationTurn: 1 }),
        makeCell(config.teams[1], 'enemy', 4, 4),
      ],
    });

    const next = runSimulationTurn(state);
    expect(next.cells.find((cell) => cell.id === 'left')?.position).toEqual({ row: 1, col: 1 });
    expect(next.cells.find((cell) => cell.id === 'right')?.position).toEqual({ row: 1, col: 2 });
  });

  it('resolves elimination, double elimination, and turn-limit outcomes correctly', () => {
    const eliminationConfig = makeMatchConfig(
      `def action(cell, environment):
    return "ae"`,
      `def action(cell, environment):
    return "d"`,
    );
    const elimination = runSimulationTurn(
      createSimulationState(eliminationConfig, {
        startingCells: [
          makeCell(eliminationConfig.teams[0], 'a', 2, 2),
          makeCell(eliminationConfig.teams[1], 'b', 2, 3, { health: 5 }),
        ],
      }),
    );
    expect(elimination.result?.winner).toBe(1);
    expect(elimination.cells).toHaveLength(1);
    expect(elimination.cells[0]?.id).toBe('a');

    const drawConfig = makeMatchConfig(
      `def action(cell, environment):
    return "d"`,
      `def action(cell, environment):
    return "d"`,
      1,
    );
    const draw = runSimulationTurn(
      createSimulationState(drawConfig, {
        startingCells: [
          makeCell(drawConfig.teams[0], 'a', 2, 2, { health: 80 }),
          makeCell(drawConfig.teams[1], 'b', 4, 4, { health: 80 }),
        ],
      }),
    );
    expect(draw.result?.winner).toBe('draw');
    expect(draw.result?.reason).toBe('turn_limit');
  });

  it('startMatch validates both players and returns a locked paused match', () => {
    const started = startMatch({
      players: [
        {
          name: 'Alpha',
          color: '#22d3ee',
          code: `def action(cell, environment):
    return "d"`,
        },
        {
          name: 'Beta',
          color: '#f43f5e',
          code: `def action(cell, environment):
    return "d"`,
        },
      ],
      turnLimit: 5,
    });

    expect(started.errors).toEqual([]);
    expect(started.match?.locked).toBe(true);
    expect(started.match?.status).toBe('paused');
  });

  it('can end a match early and score the current board immediately', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    return "d"`,
      `def action(cell, environment):
    return "d"`,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'a', 1, 1),
        makeCell(config.teams[0], 'a2', 1, 2),
        makeCell(config.teams[1], 'b', 3, 3),
      ],
    });

    const ended = endSimulationEarly(state);
    expect(ended.status).toBe('finished');
    expect(ended.result?.reason).toBe('manual_stop');
    expect(ended.result?.winner).toBe(1);
  });

  it('can advance multiple turns in one call for high-speed playback', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    return "d"`,
      `def action(cell, environment):
    return "d"`,
      10,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'a', 1, 1),
        makeCell(config.teams[1], 'b', 3, 3),
      ],
    });

    const advanced = advanceSimulation(state, 3);
    expect(advanced.currentTurn).toBe(4);
  });

  it('aggregates blocked action logs by team and reason', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    if cell["health"] >= 50:
        return "re"
    return "d"`,
      `def action(cell, environment):
    return "d"`,
      5,
    );

    const next = runSimulationTurn(
      createSimulationState(config, {
        startingCells: [
          makeCell(config.teams[0], 'a', 2, 2, { health: 80 }),
          makeCell(config.teams[0], 'b', 2, 3, { health: 80 }),
          makeCell(config.teams[1], 'enemy', 4, 4),
        ],
      }),
    );

    const failureLog = next.logs.find((log) => log.type === 'action_failure');
    expect(failureLog?.teamId).toBe(1);
    expect(failureLog?.message).toContain('Alpha had');
    expect(failureLog?.message).toContain('blocked action');
  });

  it('caps retained logs so long matches do not resend the full history', () => {
    const config = makeMatchConfig(
      `def action(cell, environment):
    return "d"`,
      `def action(cell, environment):
    return "d"`,
    );

    const state = createSimulationState(config, {
      startingCells: [
        makeCell(config.teams[0], 'a', 1, 1),
        makeCell(config.teams[1], 'b', 3, 3),
      ],
      logs: Array.from({ length: 300 }, (_, index) => ({
        turn: index,
        type: 'system' as const,
        message: `log ${index}`,
      })),
    });

    const next = runSimulationTurn(state);
    expect(next.logs).toHaveLength(250);
    expect(next.logs[0]?.message).toBe('log 50');
  });
});
