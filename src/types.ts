import type { Cell, GameResult, SimulationState, TeamSummary, ValidationResult } from './domain/types';
import type { TemplateName } from './domain/templates';

export type Screen = 'setup' | 'simulation' | 'results';
export type GameState = 'setup' | 'running' | 'paused' | 'finished';

export interface PlayerConfigForm {
  id: 1 | 2;
  name: string;
  color: string;
  code: string;
  selectedTemplate: TemplateName;
  validation: ValidationResult | null;
  confirmed: boolean;
}

export interface SimulationSettings {
  maxTurns: number;
  speed: 1 | 2 | 5;
  turnDelay: number;
}

export interface SetupIssue {
  message: string;
  playerId?: 1 | 2;
}

export interface RuntimeViewModel {
  state: SimulationState | null;
  gameState: GameState;
  screen: Screen;
  selectedCellId: string | null;
}

export type { Cell, GameResult, SimulationState, TeamSummary, ValidationResult };
