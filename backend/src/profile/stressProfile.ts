import { performance } from 'node:perf_hooks';
import { runSimulationTurnProfiled, serializeMatchState, startMatch } from '../game/engine.js';
import type { MatchStartInput, StressProfileSummary, StressTurnMetric } from '../game/types.js';

export const AGGRESSIVE_STRESS_STRATEGY = `def action(cell, environment):
    if environment["n"] == "enemy":
        return "an"
    if environment["s"] == "enemy":
        return "as"
    if environment["e"] == "enemy":
        return "ae"
    if environment["w"] == "enemy":
        return "aw"
    if environment["ne"] == "enemy":
        return "ane"
    if environment["nw"] == "enemy":
        return "anw"
    if environment["se"] == "enemy":
        return "ase"
    if environment["sw"] == "enemy":
        return "asw"

    if cell["health"] <= 1:
        return "d"

    if cell["health"] >= 50 and environment["n"] == "empty":
        return "rn"
    if cell["health"] >= 50 and environment["s"] == "empty":
        return "rs"
    if cell["health"] >= 50 and environment["e"] == "empty":
        return "re"
    if cell["health"] >= 50 and environment["w"] == "empty":
        return "rw"
    if cell["health"] >= 50 and environment["ne"] == "empty":
        return "rne"
    if cell["health"] >= 50 and environment["nw"] == "empty":
        return "rnw"
    if cell["health"] >= 50 and environment["se"] == "empty":
        return "rse"
    if cell["health"] >= 50 and environment["sw"] == "empty":
        return "rsw"

    return "d"`;

export interface StressProfileOptions {
  turns?: number;
  turnLimit?: number;
  topSlowTurns?: number;
  playerOneCode?: string;
  playerTwoCode?: string;
}

export function runStressProfile(options: StressProfileOptions = {}): StressProfileSummary {
  const requestedTurns = sanitizePositiveInteger(options.turns, 250);
  const turnLimit = sanitizePositiveInteger(options.turnLimit, 5000);
  const topSlowTurns = sanitizePositiveInteger(options.topSlowTurns, 5);
  const input: MatchStartInput = {
    players: [
      {
        name: 'Stress Alpha',
        color: '#22d3ee',
        code: options.playerOneCode ?? AGGRESSIVE_STRESS_STRATEGY,
      },
      {
        name: 'Stress Beta',
        color: '#f43f5e',
        code: options.playerTwoCode ?? AGGRESSIVE_STRESS_STRATEGY,
      },
    ],
    turnLimit,
  };

  const started = startMatch(input, createDeterministicRng());
  if (!started.match) {
    throw new Error(started.errors.join(' '));
  }

  let state = started.match;
  const metrics: StressTurnMetric[] = [];
  let maxPopulation = state.cells.length;

  for (let index = 0; index < requestedTurns; index += 1) {
    const livingCellsBefore = state.cells.length;
    const logsBefore = state.logs.length;

    const { nextState, profile } = runSimulationTurnProfiled(state);
    state = nextState;
    const simulationMs = profile.totalMs;

    const serializationStartedAt = performance.now();
    serializeMatchState(state);
    const serializationMs = performance.now() - serializationStartedAt;

    const livingCellsAfter = state.cells.length;
    maxPopulation = Math.max(maxPopulation, livingCellsAfter);

    metrics.push({
      turn: state.result ? state.currentTurn : state.currentTurn - 1,
      livingCellsBefore,
      livingCellsAfter,
      logsAdded: state.logs.length - logsBefore,
      cellCloneMs: profile.cellCloneMs,
      orderSortMs: profile.orderSortMs,
      boardCloneMs: profile.boardCloneMs,
      setupMs: profile.setupMs,
      actionLoopMs: profile.actionLoopMs,
      cleanupMs: profile.cleanupMs,
      resultMs: profile.resultMs,
      simulationMs,
      serializationMs,
      totalMs: simulationMs + serializationMs,
      ended: Boolean(state.result),
    });

    if (state.result) {
      break;
    }
  }

  return {
    strategyLabel: 'aggressive-breeder-stress',
    requestedTurns,
    executedTurns: metrics.length,
    completedNaturally: Boolean(state.result),
    finalTurn: state.currentTurn,
    maxPopulation,
    finalPopulation: state.cells.length,
    averageCellCloneMs: average(metrics.map((metric) => metric.cellCloneMs)),
    averageOrderSortMs: average(metrics.map((metric) => metric.orderSortMs)),
    averageBoardCloneMs: average(metrics.map((metric) => metric.boardCloneMs)),
    averageSetupMs: average(metrics.map((metric) => metric.setupMs)),
    averageActionLoopMs: average(metrics.map((metric) => metric.actionLoopMs)),
    averageCleanupMs: average(metrics.map((metric) => metric.cleanupMs)),
    averageResultMs: average(metrics.map((metric) => metric.resultMs)),
    averageSimulationMs: average(metrics.map((metric) => metric.simulationMs)),
    averageSerializationMs: average(metrics.map((metric) => metric.serializationMs)),
    averageTotalMs: average(metrics.map((metric) => metric.totalMs)),
    slowestTurns: [...metrics]
      .sort((left, right) => right.totalMs - left.totalMs)
      .slice(0, topSlowTurns),
    metrics,
  };
}

export function formatStressProfileReport(summary: StressProfileSummary): string {
  const lines = [
    `Stress strategy profile: ${summary.strategyLabel}`,
    `Requested turns: ${summary.requestedTurns}`,
    `Executed turns: ${summary.executedTurns}`,
    `Completed naturally: ${summary.completedNaturally ? 'yes' : 'no'}`,
    `Final turn marker: ${summary.finalTurn}`,
    `Max population: ${summary.maxPopulation}`,
    `Final population: ${summary.finalPopulation}`,
    `Average cell clone ms/turn: ${summary.averageCellCloneMs.toFixed(3)}`,
    `Average order sort ms/turn: ${summary.averageOrderSortMs.toFixed(3)}`,
    `Average board clone ms/turn: ${summary.averageBoardCloneMs.toFixed(3)}`,
    `Average setup ms/turn: ${summary.averageSetupMs.toFixed(3)}`,
    `Average action loop ms/turn: ${summary.averageActionLoopMs.toFixed(3)}`,
    `Average cleanup ms/turn: ${summary.averageCleanupMs.toFixed(3)}`,
    `Average result ms/turn: ${summary.averageResultMs.toFixed(3)}`,
    `Average simulation ms/turn: ${summary.averageSimulationMs.toFixed(3)}`,
    `Average serialization ms/turn: ${summary.averageSerializationMs.toFixed(3)}`,
    `Average total ms/turn: ${summary.averageTotalMs.toFixed(3)}`,
    'Slowest turns:',
    ...summary.slowestTurns.map(
      (metric) =>
        `  turn ${metric.turn}: total=${metric.totalMs.toFixed(3)}ms sim=${metric.simulationMs.toFixed(3)}ms setup=${metric.setupMs.toFixed(3)}ms clone=${metric.cellCloneMs.toFixed(3)}ms sort=${metric.orderSortMs.toFixed(3)}ms board=${metric.boardCloneMs.toFixed(3)}ms action=${metric.actionLoopMs.toFixed(3)}ms cleanup=${metric.cleanupMs.toFixed(3)}ms result=${metric.resultMs.toFixed(3)}ms serialize=${metric.serializationMs.toFixed(3)}ms cells ${metric.livingCellsBefore}->${metric.livingCellsAfter}`,
    ),
  ];

  return lines.join('\n');
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sanitizePositiveInteger(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}

function createDeterministicRng(): () => number {
  let seed = 123456789;

  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}
