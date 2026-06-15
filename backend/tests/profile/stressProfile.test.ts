import { describe, expect, it } from 'vitest';
import { AGGRESSIVE_STRESS_STRATEGY, formatStressProfileReport, runStressProfile } from '../../src/profile/stressProfile.js';
import { validateStrategy } from '../../src/game/validation.js';

describe('stress profile', () => {
  it('keeps the aggressive stress strategy valid in the documented subset', () => {
    const validation = validateStrategy(AGGRESSIVE_STRESS_STRATEGY);
    expect(validation.isValid).toBe(true);
  });

  it('collects per-turn timing and population metrics', () => {
    const summary = runStressProfile({ turns: 5, topSlowTurns: 2 });

    expect(summary.executedTurns).toBeGreaterThan(0);
    expect(summary.metrics).toHaveLength(summary.executedTurns);
    expect(summary.maxPopulation).toBeGreaterThanOrEqual(summary.finalPopulation);
    expect(summary.slowestTurns).toHaveLength(2);
    expect(summary.metrics.every((metric) => metric.totalMs >= 0)).toBe(true);
  });

  it('formats a readable profiling report', () => {
    const summary = runStressProfile({ turns: 3, topSlowTurns: 1 });
    const report = formatStressProfileReport(summary);

    expect(report).toContain('Stress strategy profile');
    expect(report).toContain('Slowest turns:');
  });
});
