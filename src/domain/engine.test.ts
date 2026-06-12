import test from 'node:test';
import assert from 'node:assert/strict';
import { parseActionCode } from './actionCodes';
import { DIRECTION_DELTAS, DIRECTIONS } from './directions';
import { createSimulationState, runSimulationTurn } from './engine';
import { validateStrategy } from './strategy';
import type { Cell, Direction, MatchConfig, PlayerDefinition } from './types';

const CENTER = { row: 2, col: 2 };

function makeValidatedPlayer(id: 1 | 2, name: string, color: string, code: string): PlayerDefinition {
  const validation = validateStrategy(code);
  assert.equal(validation.isValid, true, validation.errors.join(', '));

  return {
    id,
    name,
    color,
    code,
    validation,
  };
}

function makeCell(
  player: PlayerDefinition,
  id: string,
  row: number,
  col: number,
  overrides: Partial<Cell> = {},
): Cell {
  return {
    id,
    teamId: player.id,
    teamName: player.name,
    teamColor: player.color,
    position: { row, col },
    health: 100,
    age: 1,
    alive: true,
    createdTurn: 0,
    createdDuringCurrentTurn: false,
    lastAction: 'none',
    lastActionStatus: 'none',
    ...overrides,
  };
}

function makeConfig(teamOneCode: string, teamTwoCode: string, turnLimit = 10): MatchConfig {
  return {
    teams: [
      makeValidatedPlayer(1, 'Alpha', '#22d3ee', teamOneCode),
      makeValidatedPlayer(2, 'Beta', '#f43f5e', teamTwoCode),
    ],
    turnLimit,
    boardRows: 5,
    boardCols: 5,
  };
}

function makeState(config: MatchConfig, cells: Cell[], currentTurn = 1) {
  return createSimulationState(config, {
    startingCells: cells,
    currentTurn,
    logs: [],
    nextCellId: cells.length + 1,
  });
}

const REST = `def action(cell, environment):
    return "d"`;

function actionStrategy(action: string) {
  return `def action(cell, environment):
    return "${action}"`;
}

function offsetFromCenter(direction: Direction) {
  const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
  return {
    row: CENTER.row + rowDelta,
    col: CENTER.col + colDelta,
  };
}

test('valid action codes parse and invalid ones are rejected', () => {
  assert.deepEqual(parseActionCode('mn'), { kind: 'move', direction: 'n', code: 'mn' });
  assert.deepEqual(parseActionCode('ase'), { kind: 'eat', direction: 'se', code: 'ase' });
  assert.equal(parseActionCode('move'), null);
  assert.equal(parseActionCode(''), null);

  const validation = validateStrategy(`def action(cell, environment):
    return "move"`);
  assert.equal(validation.isValid, false);
});

test('movement respects board bounds and occupied squares', () => {
  const outsideConfig = makeConfig(
    `def action(cell, environment):
    return "mw"`,
    REST,
  );
  const outsideState = makeState(outsideConfig, [
    makeCell(outsideConfig.teams[0], 'a', 2, 0),
    makeCell(outsideConfig.teams[1], 'b', 2, 1),
  ]);

  const next = runSimulationTurn(outsideState);
  const mover = next.cells.find((cell) => cell.id === 'a');
  assert.deepEqual(mover?.position, { row: 2, col: 0 });
  assert.equal(mover?.lastActionStatus, 'failed');

  const occupiedConfig = makeConfig(
    `def action(cell, environment):
    return "me"`,
    REST,
  );
  const occupiedState = makeState(occupiedConfig, [
    makeCell(occupiedConfig.teams[0], 'a', 2, 2),
    makeCell(occupiedConfig.teams[1], 'b', 2, 3),
  ]);

  const occupied = runSimulationTurn(occupiedState);
  assert.deepEqual(occupied.cells.find((cell) => cell.id === 'a')?.position, { row: 2, col: 2 });
});

test('movement succeeds inside the board', () => {
  const config = makeConfig(
    `def action(cell, environment):
    return "me"`,
    REST,
  );
  const state = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);

  const next = runSimulationTurn(state);
  const mover = next.cells.find((cell) => cell.id === 'a');
  assert.deepEqual(mover?.position, { row: 2, col: 3 });
  assert.equal(mover?.lastActionStatus, 'success');
});

test('movement succeeds in all directions', () => {
  for (const direction of DIRECTIONS) {
    const config = makeConfig(actionStrategy(`m${direction}`), REST);
    const state = makeState(config, [
      makeCell(config.teams[0], 'a', CENTER.row, CENTER.col),
      makeCell(config.teams[1], 'b', 4, 4),
    ]);

    const next = runSimulationTurn(state);
    const mover = next.cells.find((cell) => cell.id === 'a');
    assert.deepEqual(
      mover?.position,
      offsetFromCenter(direction),
      `Expected move ${direction} to land in the correct neighboring square`,
    );
    assert.equal(mover?.lastActionStatus, 'success', `Expected move ${direction} to succeed`);
  }
});

test('eat damages enemies and cannot target allies', () => {
  const attackConfig = makeConfig(
    `def action(cell, environment):
    return "ae"`,
    `def action(cell, environment):
    return "mw"`,
  );
  const attackState = makeState(attackConfig, [
    makeCell(attackConfig.teams[0], 'a', 2, 2),
    makeCell(attackConfig.teams[1], 'b', 2, 3, { health: 10 }),
  ]);
  const attacked = runSimulationTurn(attackState);
  const target = attacked.cells.find((cell) => cell.id === 'b');
  assert.equal(target?.health, 5);

  const allyConfig = makeConfig(
    `def action(cell, environment):
    return "ae"`,
    REST,
  );
  const allyState = makeState(allyConfig, [
    makeCell(allyConfig.teams[0], 'a', 2, 2),
    makeCell(allyConfig.teams[0], 'ally', 2, 3),
    makeCell(allyConfig.teams[1], 'b', 4, 4),
  ]);
  const allyResult = runSimulationTurn(allyState);
  const attacker = allyResult.cells.find((cell) => cell.id === 'a');
  assert.equal(attacker?.lastActionStatus, 'failed');
});

test('eat can eliminate an adjacent enemy in all directions', () => {
  for (const direction of DIRECTIONS) {
    const targetPosition = offsetFromCenter(direction);
    const config = makeConfig(actionStrategy(`a${direction}`), REST);
    const state = makeState(config, [
      makeCell(config.teams[0], 'a', CENTER.row, CENTER.col, { age: 1 }),
      makeCell(config.teams[1], 'b', targetPosition.row, targetPosition.col, { age: 2, health: 5 }),
    ]);

    const next = runSimulationTurn(state);
    const attacker = next.cells.find((cell) => cell.id === 'a');
    const target = next.cells.find((cell) => cell.id === 'b');
    assert.equal(attacker?.lastActionStatus, 'success', `Expected eat ${direction} to succeed`);
    assert.equal(target?.alive, false, `Expected eat ${direction} to remove the adjacent enemy`);
    assert.equal(target?.health, 0, `Expected eat ${direction} to reduce enemy health to 0`);
  }
});

test('reproduction splits health correctly and respects restrictions', () => {
  const config = makeConfig(
    `def action(cell, environment):
    return "re"`,
    REST,
  );
  const successState = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2, { health: 51 }),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);
  const success = runSimulationTurn(successState);
  const parent = success.cells.find((cell) => cell.id === 'a');
  const child = success.cells.find((cell) => cell.id !== 'a' && cell.teamId === 1);
  assert.equal(parent?.health, 26);
  assert.equal(child?.health, 25);
  assert.equal(child?.position.col, 3);

  const lowHealthState = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2, { health: 49 }),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);
  const lowHealth = runSimulationTurn(lowHealthState);
  assert.equal(lowHealth.cells.filter((cell) => cell.teamId === 1).length, 1);

  const oldAgeState = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2, { age: 55 }),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);
  const oldAge = runSimulationTurn(oldAgeState);
  assert.equal(oldAge.cells.filter((cell) => cell.teamId === 1).length, 1);
});

test('reproduction succeeds in all directions', () => {
  for (const direction of DIRECTIONS) {
    const childPosition = offsetFromCenter(direction);
    const config = makeConfig(actionStrategy(`r${direction}`), REST);
    const state = makeState(config, [
      makeCell(config.teams[0], 'a', CENTER.row, CENTER.col, { health: 50 }),
      makeCell(config.teams[1], 'b', 4, 4),
    ]);

    const next = runSimulationTurn(state);
    const parent = next.cells.find((cell) => cell.id === 'a');
    const children = next.cells.filter((cell) => cell.id !== 'a' && cell.teamId === 1);
    assert.equal(parent?.lastActionStatus, 'success', `Expected reproduce ${direction} to succeed`);
    assert.equal(parent?.health, 25, `Expected reproduce ${direction} to split parent health`);
    assert.equal(children.length, 1, `Expected reproduce ${direction} to create exactly one child`);
    assert.deepEqual(
      children[0]?.position,
      childPosition,
      `Expected reproduce ${direction} to place the child in the correct neighboring square`,
    );
    assert.equal(children[0]?.health, 25, `Expected reproduce ${direction} to split child health evenly`);
  }
});

test('newborn cells do not act on the turn they are created', () => {
  const config = makeConfig(
    `def action(cell, environment):
    if cell["health"] >= 50:
        return "re"
    return "me"`,
    REST,
  );
  const state = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);

  const next = runSimulationTurn(state);
  const child = next.cells.find((cell) => cell.id !== 'a' && cell.teamId === 1);
  assert.ok(child);
  assert.deepEqual(child?.position, { row: 2, col: 3 });
  assert.equal(child?.lastAction, 'born');
});

test('rest caps health at 100 and aging applies from age 70 onward', () => {
  const config = makeConfig(REST, REST);
  const state = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2, { health: 99, age: 69 }),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);

  const next = runSimulationTurn(state);
  const cell = next.cells.find((current) => current.id === 'a');
  assert.equal(cell?.health, 95);
  assert.equal(cell?.age, 70);
});

test('cells die at age 90 after end-of-turn processing', () => {
  const config = makeConfig(REST, REST);
  const state = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2, { age: 89, health: 50 }),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);

  const next = runSimulationTurn(state);
  const cell = next.cells.find((current) => current.id === 'a');
  assert.equal(cell?.alive, false);
});

test('turn order prefers lower age, then earlier creation turn, then row and column', () => {
  const ageConfig = makeConfig(
    `def action(cell, environment):
    if environment["w"] == "empty":
        return "mw"
    if environment["e"] == "empty":
        return "me"
    return "d"`,
    REST,
  );
  const ageState = makeState(ageConfig, [
    makeCell(ageConfig.teams[0], 'older', 2, 0, { age: 2 }),
    makeCell(ageConfig.teams[0], 'younger', 2, 2, { age: 1 }),
    makeCell(ageConfig.teams[1], 'enemy', 4, 4),
  ]);
  const ageResult = runSimulationTurn(ageState);
  assert.deepEqual(ageResult.cells.find((cell) => cell.id === 'younger')?.position, { row: 2, col: 1 });
  assert.deepEqual(ageResult.cells.find((cell) => cell.id === 'older')?.position, { row: 2, col: 0 });

  const rowConfig = makeConfig(
    `def action(cell, environment):
    if cell["row"] < 2:
        return "ms"
    if cell["row"] >= 2:
        return "mn"
    return "d"`,
    REST,
  );
  const rowState = makeState(rowConfig, [
    makeCell(rowConfig.teams[0], 'top', 1, 1, { createdTurn: 0 }),
    makeCell(rowConfig.teams[0], 'bottom', 3, 1, { createdTurn: 0 }),
    makeCell(rowConfig.teams[1], 'enemy', 4, 4),
  ]);
  const rowResult = runSimulationTurn(rowState);
  assert.deepEqual(rowResult.cells.find((cell) => cell.id === 'top')?.position, { row: 2, col: 1 });
  assert.deepEqual(rowResult.cells.find((cell) => cell.id === 'bottom')?.position, { row: 3, col: 1 });

  const creationConfig = makeConfig(
    `def action(cell, environment):
    if cell["col"] < 1:
        return "me"
    if cell["col"] >= 1:
        return "mw"
    return "d"`,
    REST,
  );
  const creationState = makeState(creationConfig, [
    makeCell(creationConfig.teams[0], 'earlier', 1, 0, { age: 1, createdTurn: 0 }),
    makeCell(creationConfig.teams[0], 'later', 1, 2, { age: 1, createdTurn: 1 }),
    makeCell(creationConfig.teams[1], 'enemy', 4, 4),
  ]);
  const creationResult = runSimulationTurn(creationState);
  assert.deepEqual(creationResult.cells.find((cell) => cell.id === 'earlier')?.position, { row: 1, col: 1 });
  assert.deepEqual(creationResult.cells.find((cell) => cell.id === 'later')?.position, { row: 1, col: 2 });
});

test('turn limit executes the final turn fully before declaring a result', () => {
  const config = makeConfig(
    `def action(cell, environment):
    return "re"`,
    REST,
    1,
  );
  const state = makeState(config, [
    makeCell(config.teams[0], 'a', 2, 2),
    makeCell(config.teams[1], 'b', 4, 4),
  ]);

  const next = runSimulationTurn(state);
  assert.equal(next.result?.finalTurn, 1);
  assert.equal(next.cells.filter((cell) => cell.teamId === 1).length, 2);
});

test('victory is determined by elimination, then living cells, then total health, with draw support', () => {
  const eliminationConfig = makeConfig(
    `def action(cell, environment):
    return "ae"`,
    REST,
  );
  const eliminationState = makeState(eliminationConfig, [
    makeCell(eliminationConfig.teams[0], 'a', 2, 2),
    makeCell(eliminationConfig.teams[1], 'b', 2, 3, { health: 5 }),
  ]);
  const elimination = runSimulationTurn(eliminationState);
  assert.equal(elimination.result?.winner, 1);
  assert.equal(elimination.result?.reason, 'elimination');

  const livingCountConfig = makeConfig(REST, REST, 1);
  const livingCountState = makeState(livingCountConfig, [
    makeCell(livingCountConfig.teams[0], 'a', 2, 2),
    makeCell(livingCountConfig.teams[0], 'a2', 2, 3),
    makeCell(livingCountConfig.teams[1], 'b', 4, 4),
  ]);
  const livingCount = runSimulationTurn(livingCountState);
  assert.equal(livingCount.result?.winner, 1);

  const totalHealthConfig = makeConfig(REST, REST, 1);
  const totalHealthState = makeState(totalHealthConfig, [
    makeCell(totalHealthConfig.teams[0], 'a', 2, 2, { health: 80 }),
    makeCell(totalHealthConfig.teams[1], 'b', 4, 4, { health: 70 }),
  ]);
  const totalHealth = runSimulationTurn(totalHealthState);
  assert.equal(totalHealth.result?.winner, 1);

  const drawConfig = makeConfig(REST, REST, 5);
  const drawState = makeState(drawConfig, [
    makeCell(drawConfig.teams[0], 'a', 2, 2, { age: 89, health: 5 }),
    makeCell(drawConfig.teams[1], 'b', 4, 4, { age: 89, health: 5 }),
  ]);
  const draw = runSimulationTurn(drawState);
  assert.equal(draw.result?.winner, 'draw');
  assert.equal(draw.result?.reason, 'double_elimination');
});
