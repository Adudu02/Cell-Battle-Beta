import { describe, expect, it } from 'vitest';
import { executeStrategy, validateMatchSetup, validateStrategy } from '../../src/game/validation.js';

describe('validation', () => {
  it('accepts valid literal action codes and rejects invalid ones', () => {
    expect(
      validateStrategy(`def action(cell, environment):
    return "d"`).isValid,
    ).toBe(true);

    expect(
      validateStrategy(`def action(cell, environment):
    return "move"`).isValid,
    ).toBe(false);
  });

  it('rejects loops, imports, eval, exec, and unsafe lookups', () => {
    expect(
      validateStrategy(`def action(cell, environment):
    for x in [1]:
        return "d"`).isValid,
    ).toBe(false);

    expect(
      validateStrategy(`def action(cell, environment):
    import os
    return "d"`).isValid,
    ).toBe(false);

    expect(
      validateStrategy(`def action(cell, environment):
    return eval("d")`).isValid,
    ).toBe(false);

    expect(
      validateStrategy(`def action(cell, environment):
    if environment["secret"] == "x":
        return "d"
    return "mn"`).isValid,
    ).toBe(false);
  });

  it('requires the exact function header', () => {
    expect(
      validateStrategy(`def decide(cell, environment):
    return "d"`).errors[0],
    ).toContain('def action(cell, environment)');
  });

  it('runtime strategy failure only cancels the acting cell', () => {
    const valid = validateStrategy(`def action(cell, environment):
    if cell["health"] > 10:
        return "d"
    return "mn"`);
    expect(valid.isValid).toBe(true);

    const executed = executeStrategy(valid.program!, { health: 20, age: 1, row: 0, col: 0 }, {
      n: 'empty',
      s: 'empty',
      e: 'empty',
      w: 'empty',
      ne: 'empty',
      nw: 'empty',
      se: 'empty',
      sw: 'empty',
      team_health: 100,
      turn: 1,
      rows: 100,
      cols: 200,
      has_adjacent_ally: false,
      has_adjacent_enemy: false,
      enemy_count: 0,
      occupied_count: 0,
      empty_count: 8,
      first_enemy_direction: 'none',
      north_occupied_count: 0,
      south_occupied_count: 0,
      east_occupied_count: 0,
      west_occupied_count: 0,
    });

    expect(executed.action).toBe('d');
  });

  it('invalid setup blocks match start', () => {
    const issues = validateMatchSetup([
      { name: 'Alpha', color: '#22d3ee', code: `def action(cell, environment):
    return "d"` },
      { name: '', color: '#f43f5e', code: `def action(cell, environment):
    return "oops"` },
    ]);

    expect(issues.length).toBeGreaterThan(0);
  });

  it('accepts translated legacy helper keys in the environment', () => {
    const validation = validateStrategy(`def action(cell, environment):
    if environment["enemy_count"] > 3 and environment["first_enemy_direction"] == "n":
        return "an"
    if environment["empty_count"] > 0 and environment["east_occupied_count"] <= environment["west_occupied_count"] and environment["e"] == "empty":
        return "re"
    return "d"`);

    expect(validation.isValid).toBe(true);
  });
});
