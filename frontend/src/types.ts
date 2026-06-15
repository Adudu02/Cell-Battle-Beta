import type { TemplateName } from './domain/templates';

export type Screen = 'setup' | 'simulation' | 'results';
export type GameState = 'setup' | 'running' | 'paused' | 'finished';
export type TeamId = 1 | 2;
export type CellActionStatus = 'success' | 'failed' | 'invalid' | 'error' | 'none';
export type MatchStatus = 'paused' | 'running' | 'finished';
export type LogType = 'system' | 'error' | 'result' | 'action_failure';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedCode?: string;
}

export interface PlayerConfigForm {
  id: TeamId;
  name: string;
  color: string;
  code: string;
  selectedTemplate: TemplateName;
  validation: ValidationResult | null;
}

export interface PlayerDefinition {
  id: TeamId;
  name: string;
  color: string;
  code: string;
  validation: ValidationResult;
}

export interface SimulationSettings {
  maxTurns: number;
  speed: 1 | 2 | 5;
  turnDelay: number;
}

export interface SetupIssue {
  message: string;
  playerId?: TeamId;
}

export interface BoardPosition {
  row: number;
  col: number;
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

export interface MatchConfig {
  turnLimit: number;
  boardRows: number;
  boardCols: number;
  teams: [PlayerDefinition, PlayerDefinition];
}

export interface TurnLog {
  turn: number;
  type: LogType;
  message: string;
  teamId?: TeamId;
  cellId?: string;
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

export interface SimulationState {
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

export interface MatchStartPayload {
  players: [
    { name: string; color: string; code: string },
    { name: string; color: string; code: string },
  ];
  turnLimit: number;
}
