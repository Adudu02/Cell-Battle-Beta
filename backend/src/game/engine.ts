import { performance } from 'node:perf_hooks';
import { parseActionCode, resolveAction } from './actions.js';
import { buildBoardFromCells, cloneBoard, createInitialCells, getCellIdAtCoordinates } from './board.js';
import { BOARD_COLS, BOARD_ROWS, DEFAULT_TURN_LIMIT } from './constants.js';
import { DIRECTIONS, DIRECTION_DELTAS } from './directions.js';
import { compareCellsForTurn } from './ordering.js';
import { evaluateManualStop, evaluateResult } from './scoring.js';
import { executeStrategy, getValidatedProgram, validateMatchSetup, validateStrategy } from './validation.js';
import type {
  Cell,
  Direction,
  MatchStartInput,
  PlayerDefinition,
  SerializedSimulationState,
  SimulationState,
  StrategyCellContext,
  StrategyEnvironmentContext,
  StrategyProgram,
  TeamId,
  TurnExecutionProfile,
  TurnLog,
} from './types.js';

const MAX_RETAINED_LOGS = 250;

interface NeighborOffset {
  direction: Direction;
  rowDelta: number;
  colDelta: number;
  north: boolean;
  south: boolean;
  east: boolean;
  west: boolean;
}

const NEIGHBOR_OFFSETS: NeighborOffset[] = DIRECTIONS.map((direction) => {
  const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
  return {
    direction,
    rowDelta,
    colDelta,
    north: direction === 'nw' || direction === 'n' || direction === 'ne',
    south: direction === 'sw' || direction === 's' || direction === 'se',
    east: direction === 'ne' || direction === 'e' || direction === 'se',
    west: direction === 'nw' || direction === 'w' || direction === 'sw',
  };
});

interface CreateSimulationOptions {
  rng?: () => number;
  startingCells?: Cell[];
  currentTurn?: number;
  logs?: TurnLog[];
  nextCellId?: number;
  status?: SimulationState['status'];
}

interface AggregatedActionFailure {
  teamId: TeamId;
  teamName: string;
  actionCode: string;
  reason: string;
  count: number;
}

export function startMatch(input: MatchStartInput, rng: () => number = Math.random): { match: SimulationState | null; errors: string[] } {
  const issues = validateMatchSetup(input.players);
  if (issues.length > 0) {
    return { match: null, errors: issues };
  }

  const teams = input.players.map((player, index) => {
    const validation = validateStrategy(player.code);
    return {
      id: (index + 1) as TeamId,
      name: player.name.trim(),
      color: player.color,
      code: validation.normalizedCode ?? player.code,
      validation,
    };
  }) as [PlayerDefinition, PlayerDefinition];

  const match = createSimulationState(
    {
      teams,
      turnLimit: input.turnLimit ?? DEFAULT_TURN_LIMIT,
      boardRows: BOARD_ROWS,
      boardCols: BOARD_COLS,
    },
    { rng, status: 'paused' },
  );

  return { match, errors: [] };
}

export function createSimulationState(
  config: SimulationState['config'],
  options: CreateSimulationOptions = {},
): SimulationState {
  const startingCells =
    options.startingCells ??
    createInitialCells(
      [
        { name: config.teams[0].name, color: config.teams[0].color },
        { name: config.teams[1].name, color: config.teams[1].color },
      ],
      config.boardRows,
      config.boardCols,
      options.rng ?? Math.random,
    );
  const board = buildBoardFromCells(config.boardRows, config.boardCols, startingCells);

  return {
    status: options.status ?? 'paused',
    locked: true,
    config,
    board,
    cells: startingCells.map(cloneCell),
    currentTurn: options.currentTurn ?? 1,
    logs:
      options.logs ??
      [
        {
          turn: 0,
          type: 'system',
          message: `${config.teams[0].name} and ${config.teams[1].name} deployed to the board.`,
        },
      ],
    result: null,
    nextCellId: options.nextCellId ?? startingCells.length + 1,
  };
}

export function runSimulationTurn(state: SimulationState): SimulationState {
  return runSimulationTurnInternal(state).nextState;
}

export function runSimulationTurnProfiled(
  state: SimulationState,
): { nextState: SimulationState; profile: TurnExecutionProfile } {
  return runSimulationTurnInternal(state, true);
}

function runSimulationTurnInternal(
  state: SimulationState,
  captureProfile: boolean = false,
): { nextState: SimulationState; profile: TurnExecutionProfile } {
  const totalStartedAt = captureProfile ? performance.now() : 0;

  if (state.result) {
    const nextState: SimulationState = { ...state, status: 'finished' };
    return {
      nextState,
      profile: {
        cellCloneMs: 0,
        orderSortMs: 0,
        boardCloneMs: 0,
        setupMs: 0,
        actionLoopMs: 0,
        cleanupMs: 0,
        resultMs: 0,
        totalMs: captureProfile ? performance.now() - totalStartedAt : 0,
      },
    };
  }

  const setupStartedAt = captureProfile ? performance.now() : 0;
  const turn = state.currentTurn;
  const { cells, cellsById, orderedCells, teamHealthByTeamId, cellCloneMs, orderSortMs } = cloneCellsForTurn(
    state.cells,
    captureProfile,
  );
  const boardCloneStartedAt = captureProfile ? performance.now() : 0;
  const board = cloneBoard(state.board);
  const boardCloneMs = captureProfile ? performance.now() - boardCloneStartedAt : 0;
  const [teamOne, teamTwo] = state.config.teams;
  const programOne = getValidatedProgram(teamOne);
  const programTwo = getValidatedProgram(teamTwo);
  const logs: TurnLog[] = [];
  const aggregatedActionFailures = new Map<string, AggregatedActionFailure>();
  const strategyCell: StrategyCellContext = {
    health: 0,
    age: 0,
    row: 0,
    col: 0,
  };
  const environment = createReusableEnvironmentContext(state);
  const actionState = { board, cells, currentTurn: turn };
  let nextCellId = state.nextCellId;
  const setupMs = captureProfile ? performance.now() - setupStartedAt : 0;

  const actionLoopStartedAt = captureProfile ? performance.now() : 0;
  for (const cell of orderedCells) {
    if (!cell.alive) {
      continue;
    }

    const program = cell.teamId === teamOne.id ? programOne : programTwo;

    if (!program) {
      cell.lastAction = 'invalid';
      cell.lastActionStatus = 'invalid';
      logs.push({
        turn,
        type: 'error',
        message: `${cell.teamName} has no validated strategy. The cell lost its action.`,
        teamId: cell.teamId,
        cellId: cell.id,
      });
      continue;
    }

    fillEnvironmentContext(
      environment,
      state,
      board,
      cellsById,
      cell,
      teamHealthByTeamId[cell.teamId],
    );
    strategyCell.health = cell.health;
    strategyCell.age = cell.age;
    strategyCell.row = cell.position.row;
    strategyCell.col = cell.position.col;
    const execution = executeProgramAction(program, strategyCell, environment);

    if (!execution) {
      cell.lastAction = 'invalid';
      cell.lastActionStatus = 'error';
      logs.push({
        turn,
        type: 'error',
        message: `${cell.teamName} produced a runtime error at (${cell.position.row}, ${cell.position.col}). The cell lost its action.`,
        teamId: cell.teamId,
        cellId: cell.id,
      });
      continue;
    }

    const parsedAction = parseActionCode(execution);
    if (!parsedAction) {
      cell.lastAction = execution;
      cell.lastActionStatus = 'invalid';
      logs.push({
        turn,
        type: 'error',
        message: `${cell.teamName} returned "${execution}", which is not a valid action code.`,
        teamId: cell.teamId,
        cellId: cell.id,
      });
      continue;
    }

    cell.lastAction = parsedAction.code;
    const actingHealthBefore = cell.health;
    const targetCellBefore =
      parsedAction.kind === 'eat'
        ? resolveTargetCell(board, cellsById, cell, parsedAction.direction)
        : null;
    const targetHealthBefore = targetCellBefore?.health ?? 0;

    const failureReason = resolveAction(actionState, cellsById, cell, parsedAction, () => {
      const childId = `cell-${nextCellId}`;
      nextCellId += 1;
      return childId;
    });

    if (failureReason) {
      recordActionFailure(aggregatedActionFailures, cell, parsedAction.code, failureReason);
    }

    if (parsedAction.kind === 'rest') {
      teamHealthByTeamId[cell.teamId] += cell.health - actingHealthBefore;
    }

    if (targetCellBefore) {
      teamHealthByTeamId[targetCellBefore.teamId] += targetCellBefore.health - targetHealthBefore;
    }
  }

  for (const entry of aggregatedActionFailures.values()) {
    logs.push({
      turn,
      type: 'action_failure',
      message:
        `${entry.teamName} had ${entry.count} blocked ${entry.count === 1 ? 'action' : 'actions'} ` +
        `for ${entry.actionCode}: ${entry.reason}`,
      teamId: entry.teamId,
    });
  }
  const actionLoopMs = captureProfile ? performance.now() - actionLoopStartedAt : 0;

  const cleanupStartedAt = captureProfile ? performance.now() : 0;
  const livingCells: Cell[] = [];
  for (const cell of cells) {
    if (!cell.alive) {
      continue;
    }

    cell.age += 1;
    cell.createdDuringCurrentTurn = false;
    livingCells.push(cell);
  }
  const cleanupMs = captureProfile ? performance.now() - cleanupStartedAt : 0;

  const resultStartedAt = captureProfile ? performance.now() : 0;
  const result = evaluateResult(state.config.teams, livingCells, turn, state.config.turnLimit);
  const updatedLogs = appendLogs(state.logs, logs);

  if (result) {
    updatedLogs.push({
      turn,
      type: 'result',
      message:
        result.winner === 'draw'
          ? `Match ended in a draw on turn ${turn}.`
          : `${result.teamSummaries.find((summary) => summary.id === result.winner)?.name ?? 'A team'} won on turn ${turn}.`,
    });

    const nextState: SimulationState = {
      ...state,
      status: 'finished',
      board,
      cells: livingCells,
      currentTurn: turn,
      logs: updatedLogs,
      result,
      nextCellId,
    };
    const resultMs = captureProfile ? performance.now() - resultStartedAt : 0;

    return {
      nextState,
      profile: {
        cellCloneMs,
        orderSortMs,
        boardCloneMs,
        setupMs,
        actionLoopMs,
        cleanupMs,
        resultMs,
        totalMs: captureProfile ? performance.now() - totalStartedAt : 0,
      },
    };
  }

  const nextState: SimulationState = {
    ...state,
    board,
    cells: livingCells,
    currentTurn: turn + 1,
    logs: updatedLogs,
    result: null,
    nextCellId,
  };
  const resultMs = captureProfile ? performance.now() - resultStartedAt : 0;

  return {
    nextState,
    profile: {
      cellCloneMs,
      orderSortMs,
      boardCloneMs,
      setupMs,
      actionLoopMs,
      cleanupMs,
      resultMs,
      totalMs: captureProfile ? performance.now() - totalStartedAt : 0,
    },
  };
}

export function advanceSimulation(state: SimulationState, steps: number = 1): SimulationState {
  let nextState = state;
  const safeSteps = Number.isFinite(steps) ? Math.max(1, Math.floor(steps)) : 1;

  for (let index = 0; index < safeSteps; index += 1) {
    nextState = runSimulationTurn(nextState);
    if (nextState.result) {
      return nextState;
    }
  }

  return nextState;
}

export function endSimulationEarly(state: SimulationState): SimulationState {
  if (state.result) {
    return {
      ...state,
      status: 'finished',
    };
  }

  const result = evaluateManualStop(state.config.teams, state.cells, state.currentTurn);

  return {
    ...state,
    status: 'finished',
    result,
    logs: [
      ...state.logs.slice(-(MAX_RETAINED_LOGS - 1)),
      {
        turn: state.currentTurn,
        type: 'result',
        message: `Match was ended early on turn ${state.currentTurn}.`,
      },
    ],
  };
}

export function serializeMatchState(state: SimulationState): SerializedSimulationState {
  return {
    status: state.status,
    locked: state.locked,
    config: state.config,
    cells: state.cells.map(cloneCell),
    currentTurn: state.currentTurn,
    logs: [...state.logs],
    result: state.result,
  };
}

function createReusableEnvironmentContext(state: SimulationState): StrategyEnvironmentContext {
  return {
    n: 'outside',
    s: 'outside',
    e: 'outside',
    w: 'outside',
    ne: 'outside',
    nw: 'outside',
    se: 'outside',
    sw: 'outside',
    team_health: 0,
    turn: state.currentTurn,
    rows: state.config.boardRows,
    cols: state.config.boardCols,
    has_adjacent_ally: false,
    has_adjacent_enemy: false,
    enemy_count: 0,
    occupied_count: 0,
    empty_count: 0,
    first_enemy_direction: 'none',
    north_occupied_count: 0,
    south_occupied_count: 0,
    east_occupied_count: 0,
    west_occupied_count: 0,
  };
}

function fillEnvironmentContext(
  environment: StrategyEnvironmentContext,
  state: SimulationState,
  board: SimulationState['board'],
  cellsById: Map<string, Cell>,
  cell: Cell,
  teamHealth: number,
): void {
  environment.n = 'outside';
  environment.s = 'outside';
  environment.e = 'outside';
  environment.w = 'outside';
  environment.ne = 'outside';
  environment.nw = 'outside';
  environment.se = 'outside';
  environment.sw = 'outside';
  environment.team_health = teamHealth;
  environment.turn = state.currentTurn;
  environment.rows = state.config.boardRows;
  environment.cols = state.config.boardCols;
  let hasAdjacentAlly = false;
  let hasAdjacentEnemy = false;
  let enemyCount = 0;
  let occupiedCount = 0;
  let emptyCount = 0;
  let firstEnemyDirection: StrategyEnvironmentContext['first_enemy_direction'] = 'none';
  let northOccupiedCount = 0;
  let southOccupiedCount = 0;
  let eastOccupiedCount = 0;
  let westOccupiedCount = 0;

  for (const offset of NEIGHBOR_OFFSETS) {
    const targetRow = cell.position.row + offset.rowDelta;
    const targetCol = cell.position.col + offset.colDelta;
    let neighbor: StrategyEnvironmentContext['n'] = 'outside';

    if (targetRow >= 0 && targetRow < board.rows && targetCol >= 0 && targetCol < board.cols) {
      const occupantId = getCellIdAtCoordinates(board, targetRow, targetCol);

      if (!occupantId) {
        neighbor = 'empty';
      } else {
        const occupant = cellsById.get(occupantId);
        neighbor = occupant && occupant.teamId === cell.teamId ? 'allied' : 'enemy';
      }
    }

    environment[offset.direction] = neighbor;

    if (neighbor === 'allied') {
      hasAdjacentAlly = true;
      occupiedCount += 1;
    } else if (neighbor === 'enemy') {
      hasAdjacentEnemy = true;
      enemyCount += 1;
      occupiedCount += 1;
      if (firstEnemyDirection === 'none') {
        firstEnemyDirection = offset.direction;
      }
    } else if (neighbor === 'empty') {
      emptyCount += 1;
    }

    if (neighbor !== 'empty' && neighbor !== 'outside') {
      if (offset.north) {
        northOccupiedCount += 1;
      }
      if (offset.south) {
        southOccupiedCount += 1;
      }
      if (offset.east) {
        eastOccupiedCount += 1;
      }
      if (offset.west) {
        westOccupiedCount += 1;
      }
    }
  }

  environment.has_adjacent_ally = hasAdjacentAlly;
  environment.has_adjacent_enemy = hasAdjacentEnemy;
  environment.enemy_count = enemyCount;
  environment.occupied_count = occupiedCount;
  environment.empty_count = emptyCount;
  environment.first_enemy_direction = firstEnemyDirection;
  environment.north_occupied_count = northOccupiedCount;
  environment.south_occupied_count = southOccupiedCount;
  environment.east_occupied_count = eastOccupiedCount;
  environment.west_occupied_count = westOccupiedCount;
}

function executeProgramAction(
  program: StrategyProgram,
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
): string | null {
  try {
    return program.executor ? program.executor(cell, environment) : executeStrategy(program, cell, environment).action;
  } catch {
    return null;
  }
}

function cloneCell(cell: Cell): Cell {
  return {
    id: cell.id,
    teamId: cell.teamId,
    teamName: cell.teamName,
    teamColor: cell.teamColor,
    position: {
      row: cell.position.row,
      col: cell.position.col,
    },
    health: cell.health,
    age: cell.age,
    alive: cell.alive,
    creationTurn: cell.creationTurn,
    createdDuringCurrentTurn: cell.createdDuringCurrentTurn,
    lastAction: cell.lastAction,
    lastActionStatus: cell.lastActionStatus,
  };
}

function cloneCellsForTurn(cells: Cell[], captureProfile: boolean = false): {
  cells: Cell[];
  cellsById: Map<string, Cell>;
  orderedCells: Cell[];
  teamHealthByTeamId: [number, number, number];
  cellCloneMs: number;
  orderSortMs: number;
} {
  const cellCloneStartedAt = captureProfile ? performance.now() : 0;
  const clonedCells: Cell[] = new Array(cells.length);
  const cellsById = new Map<string, Cell>();
  const orderedCells: Cell[] = [];
  const teamHealthByTeamId: [number, number, number] = [0, 0, 0];

  for (let index = 0; index < cells.length; index += 1) {
    const cell = cells[index];
    const clonedCell = cloneCell(cell);
    clonedCells[index] = clonedCell;
    cellsById.set(clonedCell.id, clonedCell);

    if (clonedCell.alive) {
      orderedCells.push(clonedCell);
      teamHealthByTeamId[clonedCell.teamId] += clonedCell.health;
    }
  }
  const cellCloneMs = captureProfile ? performance.now() - cellCloneStartedAt : 0;

  const orderSortStartedAt = captureProfile ? performance.now() : 0;
  orderedCells.sort(compareCellsForTurn);
  const orderSortMs = captureProfile ? performance.now() - orderSortStartedAt : 0;

  return {
    cells: clonedCells,
    cellsById,
    orderedCells,
    teamHealthByTeamId,
    cellCloneMs,
    orderSortMs,
  };
}

function resolveTargetCell(
  board: SimulationState['board'],
  cellsById: Map<string, Cell>,
  cell: Cell,
  direction: Direction,
): Cell | null {
  const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
  const targetId = getCellIdAtCoordinates(board, cell.position.row + rowDelta, cell.position.col + colDelta);
  return targetId ? cellsById.get(targetId) ?? null : null;
}

function recordActionFailure(
  failures: Map<string, AggregatedActionFailure>,
  cell: Cell,
  actionCode: string,
  reason: string,
): void {
  const key = `${cell.teamId}:${actionCode}:${reason}`;
  const existing = failures.get(key);

  if (existing) {
    existing.count += 1;
    return;
  }

  failures.set(key, {
    teamId: cell.teamId,
    teamName: cell.teamName,
    actionCode,
    reason,
    count: 1,
  });
}

function appendLogs(existingLogs: TurnLog[], nextLogs: TurnLog[]): TurnLog[] {
  if (nextLogs.length === 0) {
    return existingLogs.length <= MAX_RETAINED_LOGS ? existingLogs : existingLogs.slice(-MAX_RETAINED_LOGS);
  }

  const combined = [...existingLogs, ...nextLogs];
  return combined.length <= MAX_RETAINED_LOGS ? combined : combined.slice(-MAX_RETAINED_LOGS);
}
