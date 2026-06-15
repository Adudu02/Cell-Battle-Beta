import { Router } from 'express';
import { performance } from 'node:perf_hooks';
import { endSimulationEarly, runSimulationTurnProfiled, serializeMatchState, startMatch } from '../game/engine.js';
import type { MatchStartInput, SimulationState, TickExecutionProfile, TurnExecutionProfile } from '../game/types.js';

let activeMatch: SimulationState | null = null;

export function resetActiveMatchForTests() {
  activeMatch = null;
}

export const gameRouter = Router();

gameRouter.get('/state', (_req, res) => {
  res.json({
    match: activeMatch ? serializeMatchState(activeMatch) : null,
  });
});

gameRouter.post('/start', (req, res) => {
  const input = req.body as MatchStartInput;
  const { match, errors } = startMatch(input);

  if (!match) {
    return res.status(400).json({
      error: 'Invalid match configuration.',
      details: errors,
    });
  }

  activeMatch = match;
  return res.json({ match: serializeMatchState(activeMatch) });
});

gameRouter.post('/play', (_req, res) => {
  if (!activeMatch) {
    return res.status(404).json({ error: 'No active match.' });
  }

  if (activeMatch.result) {
    return res.status(409).json({ error: 'Cannot play a finished match.' });
  }

  activeMatch = {
    ...activeMatch,
    status: 'running',
  };

  return res.json({ match: serializeMatchState(activeMatch) });
});

gameRouter.post('/pause', (_req, res) => {
  if (!activeMatch) {
    return res.status(404).json({ error: 'No active match.' });
  }

  activeMatch = {
    ...activeMatch,
    status: activeMatch.result ? 'finished' : 'paused',
    locked: true,
  };

  return res.json({ match: serializeMatchState(activeMatch) });
});

gameRouter.post('/tick', (req, res) => {
  if (!activeMatch) {
    return res.status(404).json({ error: 'No active match.' });
  }

  let profile: TickExecutionProfile | null = null;

  if (!activeMatch.result) {
    const requestedSteps = typeof req.body?.steps === 'number' ? req.body.steps : 1;
    const profiled = advanceSimulationWithProfile(activeMatch, requestedSteps);
    const nextState = profiled.nextState;
    activeMatch = {
      ...nextState,
      status: nextState.result ? 'finished' : activeMatch.status,
    };
    profile = profiled.profile;
  }

  const serializationStartedAt = performance.now();
  const match = serializeMatchState(activeMatch);
  const serializationMs = performance.now() - serializationStartedAt;

  if (profile) {
    profile.serializationMs = serializationMs;
    profile.payloadBytes = Buffer.byteLength(JSON.stringify({ match, profile }), 'utf8');
    profile.totalMs = profile.simulationMs + profile.serializationMs;
  }

  return res.json({ match, profile });
});

gameRouter.post('/end', (_req, res) => {
  if (!activeMatch) {
    return res.status(404).json({ error: 'No active match.' });
  }

  activeMatch = endSimulationEarly(activeMatch);
  return res.json({ match: serializeMatchState(activeMatch) });
});

gameRouter.post('/reset', (_req, res) => {
  activeMatch = null;
  return res.json({ match: null });
});

function advanceSimulationWithProfile(
  state: SimulationState,
  steps: number = 1,
): { nextState: SimulationState; profile: TickExecutionProfile } {
  let nextState = state;
  const safeSteps = Number.isFinite(steps) ? Math.max(1, Math.floor(steps)) : 1;
  const profileTotals: TurnExecutionProfile = {
    cellCloneMs: 0,
    orderSortMs: 0,
    boardCloneMs: 0,
    setupMs: 0,
    actionLoopMs: 0,
    cleanupMs: 0,
    resultMs: 0,
    totalMs: 0,
  };
  let executedSteps = 0;

  const livingCellsBefore = state.cells.length;
  const logsBefore = state.logs.length;

  for (let index = 0; index < safeSteps; index += 1) {
    const profiledTurn = runSimulationTurnProfiled(nextState);
    nextState = profiledTurn.nextState;
    executedSteps += 1;
    profileTotals.cellCloneMs += profiledTurn.profile.cellCloneMs;
    profileTotals.orderSortMs += profiledTurn.profile.orderSortMs;
    profileTotals.boardCloneMs += profiledTurn.profile.boardCloneMs;
    profileTotals.setupMs += profiledTurn.profile.setupMs;
    profileTotals.actionLoopMs += profiledTurn.profile.actionLoopMs;
    profileTotals.cleanupMs += profiledTurn.profile.cleanupMs;
    profileTotals.resultMs += profiledTurn.profile.resultMs;
    profileTotals.totalMs += profiledTurn.profile.totalMs;

    if (nextState.result) {
      break;
    }
  }

  return {
    nextState,
    profile: {
      requestedSteps: safeSteps,
      executedSteps,
      livingCellsBefore,
      livingCellsAfter: nextState.cells.length,
      logsBefore,
      logsAfter: nextState.logs.length,
      cellCloneMs: profileTotals.cellCloneMs,
      orderSortMs: profileTotals.orderSortMs,
      boardCloneMs: profileTotals.boardCloneMs,
      setupMs: profileTotals.setupMs,
      actionLoopMs: profileTotals.actionLoopMs,
      cleanupMs: profileTotals.cleanupMs,
      resultMs: profileTotals.resultMs,
      simulationMs: profileTotals.totalMs,
      serializationMs: 0,
      totalMs: profileTotals.totalMs,
      payloadBytes: 0,
    },
  };
}
