import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { SimulationState, TickExecutionProfile } from './types';

const mockValidation = vi.fn();
const mockStartMatch = vi.fn();
const mockPlayMatch = vi.fn();
const mockPauseMatch = vi.fn();
const mockTickMatch = vi.fn();
const mockEndMatch = vi.fn();
const mockResetMatch = vi.fn();
const mockGetMatchState = vi.fn();

vi.mock('./api/validationApi', () => ({
  validatePlayerCode: (...args: unknown[]) => mockValidation(...args),
}));

vi.mock('./api/gameApi', () => ({
  startMatch: (...args: unknown[]) => mockStartMatch(...args),
  playMatch: (...args: unknown[]) => mockPlayMatch(...args),
  pauseMatch: (...args: unknown[]) => mockPauseMatch(...args),
  tickMatch: (...args: unknown[]) => mockTickMatch(...args),
  endMatch: (...args: unknown[]) => mockEndMatch(...args),
  resetMatch: (...args: unknown[]) => mockResetMatch(...args),
  getMatchState: (...args: unknown[]) => mockGetMatchState(...args),
}));

vi.mock('./components/GameBoard', () => ({
  GameBoard: () => <div>Mock board</div>,
}));

function makeMatch(overrides: Partial<SimulationState> = {}): SimulationState {
  return {
    status: 'paused',
    locked: true,
    currentTurn: 1,
    config: {
      turnLimit: 5000,
      boardRows: 100,
      boardCols: 200,
      teams: [
        {
          id: 1,
          name: 'Alpha',
          color: '#22d3ee',
          code: 'def action(cell, environment):\n    return "d"',
          validation: { isValid: true, errors: [] },
        },
        {
          id: 2,
          name: 'Beta',
          color: '#f43f5e',
          code: 'def action(cell, environment):\n    return "d"',
          validation: { isValid: true, errors: [] },
        },
      ],
    },
    cells: [
      {
        id: 'cell-1',
        teamId: 1,
        teamName: 'Alpha',
        teamColor: '#22d3ee',
        position: { row: 3, col: 4 },
        health: 87,
        age: 5,
        alive: true,
        creationTurn: 0,
        createdDuringCurrentTurn: false,
        lastAction: 'd',
        lastActionStatus: 'success',
      },
      {
        id: 'cell-2',
        teamId: 2,
        teamName: 'Beta',
        teamColor: '#f43f5e',
        position: { row: 8, col: 9 },
        health: 91,
        age: 5,
        alive: true,
        creationTurn: 0,
        createdDuringCurrentTurn: false,
        lastAction: 'ae',
        lastActionStatus: 'success',
      },
    ],
    logs: [{ turn: 1, type: 'action_failure', message: 'Alpha had 1 blocked action for re: destination is occupied.' }],
    result: null,
    ...overrides,
  };
}

function makeTickProfile(overrides: Partial<TickExecutionProfile> = {}): TickExecutionProfile {
  return {
    requestedSteps: 25,
    executedSteps: 25,
    livingCellsBefore: 1200,
    livingCellsAfter: 1240,
    logsBefore: 20,
    logsAfter: 22,
    cellCloneMs: 2,
    orderSortMs: 1,
    boardCloneMs: 1,
    setupMs: 4,
    actionLoopMs: 18,
    cleanupMs: 1,
    resultMs: 1,
    simulationMs: 24,
    serializationMs: 2,
    totalMs: 26,
    payloadBytes: 262144,
    ...overrides,
  };
}

function makeTickResponse(match: SimulationState, profile: TickExecutionProfile | null = makeTickProfile()) {
  return { match, profile };
}

async function validateBothPlayers() {
  const validateButtons = screen.getAllByRole('button', { name: /validate code/i });
  await userEvent.click(validateButtons[0]);
  await userEvent.click(validateButtons[1]);
}

describe('App', () => {
  beforeEach(() => {
    mockValidation.mockReset();
    mockStartMatch.mockReset();
    mockPlayMatch.mockReset();
    mockPauseMatch.mockReset();
    mockTickMatch.mockReset();
    mockEndMatch.mockReset();
    mockResetMatch.mockReset();
    mockGetMatchState.mockReset();
    mockGetMatchState.mockResolvedValue(null);
  });

  it('renders both players and keeps start disabled until both are valid', () => {
    render(<App />);

    expect(screen.getByText('Player 1 Setup')).toBeInTheDocument();
    expect(screen.getByText('Player 2 Setup')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start simulation/i })).toBeDisabled();
  });

  it('shows validation errors returned by the backend', async () => {
    mockValidation.mockResolvedValueOnce({ isValid: false, errors: ['Bad strategy.'] });

    render(<App />);
    const validateButtons = screen.getAllByRole('button', { name: /validate code/i });
    await userEvent.click(validateButtons[0]);

    expect(await screen.findByText('Bad strategy.')).toBeInTheDocument();
  });

  it('starts the simulation after both players validate', async () => {
    mockValidation.mockResolvedValue({ isValid: true, errors: [] });
    mockStartMatch.mockResolvedValue(makeMatch());

    render(<App />);
    await validateBothPlayers();
    await userEvent.click(screen.getByRole('button', { name: /start simulation/i }));

    expect(await screen.findByText('Mock board')).toBeInTheDocument();
    expect(screen.getByText(/blocked action feed/i)).toBeInTheDocument();
  });

  it('shows the aggressive stress template option in setup', () => {
    render(<App />);
    expect(screen.getAllByRole('option', { name: /aggressive stress/i }).length).toBeGreaterThan(0);
  });

  it('shows final results when the backend returns a finished match', async () => {
    mockValidation.mockResolvedValue({ isValid: true, errors: [] });
    mockStartMatch.mockResolvedValue(makeMatch());
    mockPlayMatch.mockResolvedValue(makeMatch({ status: 'running' }));
    mockTickMatch.mockResolvedValue(
      makeTickResponse(makeMatch({
        status: 'finished',
        result: {
          winner: 1,
          reason: 'elimination',
          finalTurn: 3,
          teamSummaries: [
            { id: 1, name: 'Alpha', color: '#22d3ee', livingCells: 2, totalHealth: 140, averageVitality: 70 },
            { id: 2, name: 'Beta', color: '#f43f5e', livingCells: 0, totalHealth: 0, averageVitality: 0 },
          ],
        },
      })),
    );

    render(<App />);
    await validateBothPlayers();
    await userEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    await userEvent.click(screen.getByRole('button', { name: /play/i }));

    await waitFor(() => {
      expect(screen.getByText(/wins/i)).toBeInTheDocument();
    });
  });

  it('can end the match early from the simulation controls', async () => {
    mockValidation.mockResolvedValue({ isValid: true, errors: [] });
    mockStartMatch.mockResolvedValue(makeMatch());
    mockEndMatch.mockResolvedValue(
      makeMatch({
        status: 'finished',
        result: {
          winner: 1,
          reason: 'manual_stop',
          finalTurn: 8,
          teamSummaries: [
            { id: 1, name: 'Alpha', color: '#22d3ee', livingCells: 2, totalHealth: 140, averageVitality: 70 },
            { id: 2, name: 'Beta', color: '#f43f5e', livingCells: 1, totalHealth: 60, averageVitality: 60 },
          ],
        },
      }),
    );

    render(<App />);
    await validateBothPlayers();
    await userEvent.click(screen.getByRole('button', { name: /start simulation/i }));
    await userEvent.click(screen.getByRole('button', { name: /end match/i }));

    await waitFor(() => {
      expect(screen.getByText(/ended early/i)).toBeInTheDocument();
    });
  });
});
