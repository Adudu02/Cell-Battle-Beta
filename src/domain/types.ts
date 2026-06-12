import type { DIRECTION_DELTAS } from './directions';

export type TeamId = 1 | 2;
export type Direction = keyof typeof DIRECTION_DELTAS;
export type ActionCode = 'd' | `m${Direction}` | `a${Direction}` | `r${Direction}`;
export type NeighborState = 'empty' | 'allied' | 'enemy' | 'outside';
export type CellActionStatus = 'success' | 'failed' | 'invalid' | 'error' | 'none';
export type LogType = 'system' | 'error' | 'result';

export interface BoardPosition {
  row: number;
  col: number;
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
  createdTurn: number;
  createdDuringCurrentTurn: boolean;
  lastAction: string;
  lastActionStatus: CellActionStatus;
}

export interface BoardState {
  rows: number;
  cols: number;
  occupancy: Map<string, string>;
}

export interface TeamSummary {
  id: TeamId;
  name: string;
  color: string;
  livingCells: number;
  totalHealth: number;
  averageVitality: number;
}

export interface MatchConfig {
  teams: [PlayerDefinition, PlayerDefinition];
  turnLimit: number;
  boardRows?: number;
  boardCols?: number;
}

export interface TurnLog {
  turn: number;
  type: LogType;
  message: string;
  teamId?: TeamId;
  cellId?: string;
}

export interface GameResult {
  winner: TeamId | 'draw';
  reason: 'elimination' | 'double_elimination' | 'turn_limit';
  finalTurn: number;
  teamSummaries: [TeamSummary, TeamSummary];
}

export interface SimulationState {
  config: Required<Pick<MatchConfig, 'turnLimit'>> & {
    boardRows: number;
    boardCols: number;
    teams: [PlayerDefinition, PlayerDefinition];
  };
  board: BoardState;
  cells: Cell[];
  currentTurn: number;
  logs: TurnLog[];
  result: GameResult | null;
  nextCellId: number;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedCode?: string;
  program?: StrategyProgram;
}

export interface StrategyProgram {
  body: Statement[];
}

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

export type Expression =
  | LiteralExpression
  | LookupExpression
  | UnaryExpression
  | BinaryExpression;

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
}

export type ParsedAction =
  | { kind: 'rest'; code: 'd' }
  | { kind: 'move'; direction: Direction; code: ActionCode }
  | { kind: 'eat'; direction: Direction; code: ActionCode }
  | { kind: 'reproduce'; direction: Direction; code: ActionCode };
