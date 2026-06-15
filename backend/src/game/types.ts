import type { DIRECTION_DELTAS } from './directions.js';

export type TeamId = 1 | 2;
export type Direction = keyof typeof DIRECTION_DELTAS;
export type ActionCode = 'd' | `m${Direction}` | `a${Direction}` | `r${Direction}`;
export type NeighborState = 'empty' | 'allied' | 'enemy' | 'outside';
export type MatchStatus = 'paused' | 'running' | 'finished';
export type CellActionStatus = 'success' | 'failed' | 'invalid' | 'error' | 'none';
export type LogType = 'system' | 'error' | 'result' | 'action_failure';

export interface BoardPosition {
  row: number;
  col: number;
}

export interface PlayerSubmission {
  name: string;
  color: string;
  code: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedCode?: string;
  program?: StrategyProgram;
}

export interface PlayerDefinition {
  id: TeamId;
  name: string;
  color: string;
  code: string;
  validation: ValidationResult;
}

export interface Cell {
  id: string;
  teamId: TeamId;
  teamName: string;
  teamColor: string;
  position: BoardPosition;
  health: number;
  age: number;
  alive: boolean;
  creationTurn: number;
  createdDuringCurrentTurn: boolean;
  lastAction: string;
  lastActionStatus: CellActionStatus;
}

export interface BoardState {
  rows: number;
  cols: number;
  occupancy: Array<string | undefined>;
}

export interface TeamSummary {
  id: TeamId;
  name: string;
  color: string;
  livingCells: number;
  totalHealth: number;
  averageVitality: number;
}

export interface GameResult {
  winner: TeamId | 'draw';
  reason: 'elimination' | 'double_elimination' | 'turn_limit' | 'manual_stop';
  finalTurn: number;
  teamSummaries: [TeamSummary, TeamSummary];
}

export interface MatchConfig {
  teams: [PlayerDefinition, PlayerDefinition];
  turnLimit: number;
  boardRows: number;
  boardCols: number;
}

export interface TurnLog {
  turn: number;
  type: LogType;
  message: string;
  teamId?: TeamId;
  cellId?: string;
}

export interface SimulationState {
  status: MatchStatus;
  locked: boolean;
  config: MatchConfig;
  board: BoardState;
  cells: Cell[];
  currentTurn: number;
  logs: TurnLog[];
  result: GameResult | null;
  nextCellId: number;
}

export interface SerializedSimulationState {
  status: MatchStatus;
  locked: boolean;
  config: MatchConfig;
  cells: Cell[];
  currentTurn: number;
  logs: TurnLog[];
  result: GameResult | null;
}

export interface TickExecutionProfile {
  requestedSteps: number;
  executedSteps: number;
  livingCellsBefore: number;
  livingCellsAfter: number;
  logsBefore: number;
  logsAfter: number;
  cellCloneMs: number;
  orderSortMs: number;
  boardCloneMs: number;
  setupMs: number;
  actionLoopMs: number;
  cleanupMs: number;
  resultMs: number;
  simulationMs: number;
  serializationMs: number;
  totalMs: number;
  payloadBytes: number;
}

export interface StrategyProgram {
  body: Statement[];
  executor?: StrategyExecutor;
}

export type StrategyExecutor = (
  cell: StrategyCellContext,
  environment: StrategyEnvironmentContext,
) => string | null;

export type Statement = ReturnStatement | IfStatement;

export interface ReturnStatement {
  type: 'return';
  value: ActionCode;
}

export interface IfStatement {
  type: 'if';
  condition: Expression;
  consequent: Statement[];
  alternate?: Statement[];
}

export type Expression = LiteralExpression | LookupExpression | UnaryExpression | BinaryExpression;

export interface LiteralExpression {
  type: 'literal';
  value: string | number | boolean;
}

export interface LookupExpression {
  type: 'lookup';
  source: 'cell' | 'environment';
  key: string;
}

export interface UnaryExpression {
  type: 'unary';
  operator: 'not';
  expression: Expression;
}

export interface BinaryExpression {
  type: 'binary';
  operator: 'and' | 'or' | '==' | '!=' | '<' | '<=' | '>' | '>=';
  left: Expression;
  right: Expression;
}

export interface StrategyCellContext {
  health: number;
  age: number;
  row: number;
  col: number;
}

export interface StrategyEnvironmentContext {
  n: NeighborState;
  s: NeighborState;
  e: NeighborState;
  w: NeighborState;
  ne: NeighborState;
  nw: NeighborState;
  se: NeighborState;
  sw: NeighborState;
  team_health: number;
  turn: number;
  rows: number;
  cols: number;
  has_adjacent_ally: boolean;
  has_adjacent_enemy: boolean;
  enemy_count: number;
  occupied_count: number;
  empty_count: number;
  first_enemy_direction: Direction | 'none';
  north_occupied_count: number;
  south_occupied_count: number;
  east_occupied_count: number;
  west_occupied_count: number;
}

export type ParsedAction =
  | { kind: 'rest'; code: 'd' }
  | { kind: 'move'; direction: Direction; code: ActionCode }
  | { kind: 'eat'; direction: Direction; code: ActionCode }
  | { kind: 'reproduce'; direction: Direction; code: ActionCode };

export interface MatchStartInput {
  players: [PlayerSubmission, PlayerSubmission];
  turnLimit?: number;
}

export interface StressTurnMetric {
  turn: number;
  livingCellsBefore: number;
  livingCellsAfter: number;
  logsAdded: number;
  cellCloneMs: number;
  orderSortMs: number;
  boardCloneMs: number;
  setupMs: number;
  actionLoopMs: number;
  cleanupMs: number;
  resultMs: number;
  simulationMs: number;
  serializationMs: number;
  totalMs: number;
  ended: boolean;
}

export interface StressProfileSummary {
  strategyLabel: string;
  requestedTurns: number;
  executedTurns: number;
  completedNaturally: boolean;
  finalTurn: number;
  maxPopulation: number;
  finalPopulation: number;
  averageCellCloneMs: number;
  averageOrderSortMs: number;
  averageBoardCloneMs: number;
  averageSetupMs: number;
  averageActionLoopMs: number;
  averageCleanupMs: number;
  averageResultMs: number;
  averageSimulationMs: number;
  averageSerializationMs: number;
  averageTotalMs: number;
  slowestTurns: StressTurnMetric[];
  metrics: StressTurnMetric[];
}

export interface TurnExecutionProfile {
  cellCloneMs: number;
  orderSortMs: number;
  boardCloneMs: number;
  setupMs: number;
  actionLoopMs: number;
  cleanupMs: number;
  resultMs: number;
  totalMs: number;
}
