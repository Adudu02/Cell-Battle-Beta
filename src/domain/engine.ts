import {
  AGING_DAMAGE,
  AGING_DAMAGE_START_AGE,
  BOARD_COLS,
  BOARD_ROWS,
  DEFAULT_TURN_LIMIT,
  EAT_DAMAGE,
  INITIAL_AGE,
  INITIAL_HEALTH,
  MAX_AGE,
  MAX_HEALTH,
  REPRODUCE_MAX_AGE_EXCLUSIVE,
  REPRODUCE_MIN_HEALTH,
  REST_HEAL,
} from './constants';
import { parseActionCode } from './actionCodes';
import { buildBoardFromCells, cloneBoard, getCellIdAt, getNeighborStates, isInsideBoard, moveCell, placeCell, removeCell } from './board';
import { DIRECTION_DELTAS, DIRECTIONS } from './directions';
import { executeStrategy, getValidatedProgram } from './strategy';
import type {
  BoardPosition,
  Cell,
  GameResult,
  MatchConfig,
  ParsedAction,
  PlayerDefinition,
  SimulationState,
  StrategyCellContext,
  StrategyEnvironmentContext,
  TeamId,
  TeamSummary,
  TurnLog,
} from './types';

interface CreateSimulationOptions {
  rng?: () => number;
  startingCells?: Cell[];
  currentTurn?: number;
  logs?: TurnLog[];
  nextCellId?: number;
}

export function createSimulationState(
  config: MatchConfig,
  options: CreateSimulationOptions = {},
): SimulationState {
  const boardRows = config.boardRows ?? BOARD_ROWS;
  const boardCols = config.boardCols ?? BOARD_COLS;
  const normalizedConfig = {
    turnLimit: config.turnLimit ?? DEFAULT_TURN_LIMIT,
    boardRows,
    boardCols,
    teams: config.teams,
  };
  const startingCells = options.startingCells ?? createInitialCells(normalizedConfig.teams, boardRows, boardCols, options.rng ?? Math.random);
  const board = buildBoardFromCells(boardRows, boardCols, startingCells);

  return {
    config: normalizedConfig,
    board,
    cells: startingCells,
    currentTurn: options.currentTurn ?? 1,
    logs:
      options.logs ??
      [
        {
          turn: 0,
          type: 'system',
          message: `${normalizedConfig.teams[0].name} and ${normalizedConfig.teams[1].name} deployed to the board.`,
        },
      ],
    result: null,
    nextCellId: options.nextCellId ?? startingCells.length + 1,
  };
}

export function restartSimulation(state: SimulationState, rng?: () => number): SimulationState {
  return createSimulationState(
    {
      teams: state.config.teams,
      turnLimit: state.config.turnLimit,
      boardRows: state.config.boardRows,
      boardCols: state.config.boardCols,
    },
    { rng },
  );
}

export function runSimulationTurn(state: SimulationState): SimulationState {
  if (state.result) {
    return state;
  }

  const turn = state.currentTurn;
  const cells = state.cells.map((cell) => ({
    ...cell,
    position: { ...cell.position },
  }));
  const board = cloneBoard(state.board);
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]));
  const logs: TurnLog[] = [];
  let nextCellId = state.nextCellId;

  const startOfTurnCells = cells
    .filter((cell) => cell.alive)
    .map((cell) => ({
      id: cell.id,
      age: cell.age,
      createdTurn: cell.createdTurn,
      row: cell.position.row,
      col: cell.position.col,
    }))
    .sort((left, right) => {
      if (left.age !== right.age) return left.age - right.age;
      if (left.createdTurn !== right.createdTurn) return left.createdTurn - right.createdTurn;
      if (left.row !== right.row) return left.row - right.row;
      return left.col - right.col;
    });

  for (const snapshot of startOfTurnCells) {
    const cell = cellsById.get(snapshot.id);
    if (!cell || !cell.alive) {
      continue;
    }

    const player = state.config.teams.find((team) => team.id === cell.teamId);
    const program = player ? getValidatedProgram(player) : null;

    if (!player || !program) {
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

    const environment = buildEnvironmentContext(state, board, cellsById, cell);
    const strategyCell: StrategyCellContext = {
      health: cell.health,
      age: cell.age,
      row: cell.position.row,
      col: cell.position.col,
    };
    const execution = executeStrategy(program, strategyCell, environment);

    if (execution.error || !execution.action) {
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

    const parsedAction = parseActionCode(execution.action);
    if (!parsedAction) {
      cell.lastAction = execution.action;
      cell.lastActionStatus = 'invalid';
      logs.push({
        turn,
        type: 'error',
        message: `${cell.teamName} returned "${execution.action}", which is not a valid action code.`,
        teamId: cell.teamId,
        cellId: cell.id,
      });
      continue;
    }

    cell.lastAction = parsedAction.code;
    resolveAction(parsedAction, cell, cells, cellsById, board, turn, () => {
      const childId = `cell-${nextCellId}`;
      nextCellId += 1;
      return childId;
    });
  }

  for (const cell of cells) {
    if (!cell.alive) {
      continue;
    }

    if (cell.createdDuringCurrentTurn) {
      cell.createdDuringCurrentTurn = false;
      continue;
    }

    cell.age += 1;
    if (cell.age >= AGING_DAMAGE_START_AGE) {
      cell.health -= AGING_DAMAGE;
    }

    if (cell.health <= 0 || cell.age >= MAX_AGE) {
      cell.alive = false;
      removeCell(board, cell.position);
      cell.health = Math.max(0, cell.health);
    }

    cell.createdDuringCurrentTurn = false;
  }

  const result = evaluateResult(state.config.teams, cells, turn, state.config.turnLimit);
  const updatedLogs = [...state.logs, ...logs];

  if (result) {
    updatedLogs.push({
      turn,
      type: 'result',
      message:
        result.winner === 'draw'
          ? `Match ended in a draw on turn ${turn}.`
          : `${result.teamSummaries.find((summary) => summary.id === result.winner)?.name ?? 'A team'} won on turn ${turn}.`,
    });

    return {
      ...state,
      board,
      cells,
      currentTurn: turn,
      logs: updatedLogs,
      result,
      nextCellId,
    };
  }

  return {
    ...state,
    board,
    cells,
    currentTurn: turn + 1,
    logs: updatedLogs,
    result: null,
    nextCellId,
  };
}

export function summarizeTeams(teams: [PlayerDefinition, PlayerDefinition], cells: Cell[]): [TeamSummary, TeamSummary] {
  return teams.map((team) => {
    const livingCells = cells.filter((cell) => cell.alive && cell.teamId === team.id);
    const totalHealth = livingCells.reduce((sum, cell) => sum + cell.health, 0);

    return {
      id: team.id,
      name: team.name,
      color: team.color,
      livingCells: livingCells.length,
      totalHealth,
      averageVitality: livingCells.length > 0 ? Math.round(totalHealth / livingCells.length) : 0,
    };
  }) as [TeamSummary, TeamSummary];
}

function buildEnvironmentContext(
  state: SimulationState,
  board: SimulationState['board'],
  cellsById: Map<string, Cell>,
  cell: Cell,
): StrategyEnvironmentContext {
  const neighbors = getNeighborStates(board, cellsById, cell.position, cell.teamId);
  const teamHealth = Array.from(cellsById.values()).reduce((sum, current) => {
    if (!current.alive || current.teamId !== cell.teamId) {
      return sum;
    }
    return sum + current.health;
  }, 0);

  return {
    n: neighbors.n,
    s: neighbors.s,
    e: neighbors.e,
    w: neighbors.w,
    ne: neighbors.ne,
    nw: neighbors.nw,
    se: neighbors.se,
    sw: neighbors.sw,
    team_health: teamHealth,
    turn: state.currentTurn,
    rows: state.config.boardRows,
    cols: state.config.boardCols,
    has_adjacent_ally: DIRECTIONS.some((direction) => neighbors[direction] === 'allied'),
    has_adjacent_enemy: DIRECTIONS.some((direction) => neighbors[direction] === 'enemy'),
  };
}

function resolveAction(
  action: ParsedAction,
  cell: Cell,
  cells: Cell[],
  cellsById: Map<string, Cell>,
  board: SimulationState['board'],
  turn: number,
  createChildId: () => string,
) {
  if (!cell.alive) {
    return;
  }

  if (action.kind === 'rest') {
    cell.health = Math.min(MAX_HEALTH, cell.health + REST_HEAL);
    cell.lastActionStatus = 'success';
    return;
  }

  const target = offsetPosition(cell.position, action.direction);
  if (!isInsideBoard(board, target)) {
    cell.lastActionStatus = 'failed';
    return;
  }

  const occupantId = getCellIdAt(board, target);
  const occupant = occupantId ? cellsById.get(occupantId) : undefined;

  if (action.kind === 'move') {
    if (occupant) {
      cell.lastActionStatus = 'failed';
      return;
    }

    moveCell(board, cell.position, target, cell.id);
    cell.position = target;
    cell.lastActionStatus = 'success';
    return;
  }

  if (action.kind === 'eat') {
    if (!occupant || occupant.teamId === cell.teamId || !occupant.alive) {
      cell.lastActionStatus = 'failed';
      return;
    }

    occupant.health -= EAT_DAMAGE;
    if (occupant.health <= 0) {
      occupant.alive = false;
      occupant.health = 0;
      removeCell(board, occupant.position);
    }
    cell.lastActionStatus = 'success';
    return;
  }

  if (cell.health < REPRODUCE_MIN_HEALTH || cell.age >= REPRODUCE_MAX_AGE_EXCLUSIVE || occupant) {
    cell.lastActionStatus = 'failed';
    return;
  }

  const childHealth = Math.floor(cell.health / 2);
  const parentHealth = cell.health - childHealth;
  cell.health = parentHealth;
  cell.lastActionStatus = 'success';

  const child: Cell = {
    id: createChildId(),
    teamId: cell.teamId,
    teamName: cell.teamName,
    teamColor: cell.teamColor,
    position: target,
    health: childHealth,
    age: INITIAL_AGE,
    alive: true,
    createdTurn: turn,
    createdDuringCurrentTurn: true,
    lastAction: 'born',
    lastActionStatus: 'none',
  };

  cells.push(child);
  cellsById.set(child.id, child);
  placeCell(board, child);
}

function offsetPosition(position: BoardPosition, direction: keyof typeof DIRECTION_DELTAS): BoardPosition {
  const [rowDelta, colDelta] = DIRECTION_DELTAS[direction];
  return {
    row: position.row + rowDelta,
    col: position.col + colDelta,
  };
}

function createInitialCells(
  teams: [PlayerDefinition, PlayerDefinition],
  rows: number,
  cols: number,
  rng: () => number,
): Cell[] {
  const taken = new Set<string>();

  return teams.map((team, index) => {
    let position: BoardPosition;
    do {
      position = {
        row: Math.floor(rng() * rows),
        col: Math.floor(rng() * cols),
      };
    } while (taken.has(`${position.row},${position.col}`));

    taken.add(`${position.row},${position.col}`);

    return {
      id: `cell-${index + 1}`,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      position,
      health: INITIAL_HEALTH,
      age: INITIAL_AGE,
      alive: true,
      createdTurn: 0,
      createdDuringCurrentTurn: false,
      lastAction: 'none',
      lastActionStatus: 'none',
    };
  });
}

function evaluateResult(
  teams: [PlayerDefinition, PlayerDefinition],
  cells: Cell[],
  turn: number,
  turnLimit: number,
): GameResult | null {
  const summaries = summarizeTeams(teams, cells);
  const [teamOne, teamTwo] = summaries;

  if (teamOne.livingCells === 0 && teamTwo.livingCells === 0) {
    return {
      winner: 'draw',
      reason: 'double_elimination',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamOne.livingCells === 0) {
    return {
      winner: teamTwo.id,
      reason: 'elimination',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamTwo.livingCells === 0) {
    return {
      winner: teamOne.id,
      reason: 'elimination',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (turn < turnLimit) {
    return null;
  }

  if (teamOne.livingCells > teamTwo.livingCells) {
    return {
      winner: teamOne.id,
      reason: 'turn_limit',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamTwo.livingCells > teamOne.livingCells) {
    return {
      winner: teamTwo.id,
      reason: 'turn_limit',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamOne.totalHealth > teamTwo.totalHealth) {
    return {
      winner: teamOne.id,
      reason: 'turn_limit',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamTwo.totalHealth > teamOne.totalHealth) {
    return {
      winner: teamTwo.id,
      reason: 'turn_limit',
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  return {
    winner: 'draw',
    reason: 'turn_limit',
    finalTurn: turn,
    teamSummaries: summaries,
  };
}
