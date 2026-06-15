import type { Cell, GameResult, PlayerDefinition, TeamSummary } from './types.js';

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

export function evaluateResult(
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

  return resolveWinnerByScore(summaries, turn, 'turn_limit');
}

export function evaluateManualStop(
  teams: [PlayerDefinition, PlayerDefinition],
  cells: Cell[],
  turn: number,
): GameResult {
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

  return resolveWinnerByScore(summaries, turn, 'manual_stop');
}

function resolveWinnerByScore(
  summaries: [TeamSummary, TeamSummary],
  turn: number,
  reason: 'turn_limit' | 'manual_stop',
): GameResult {
  const [teamOne, teamTwo] = summaries;

  if (teamOne.livingCells !== teamTwo.livingCells) {
    return {
      winner: teamOne.livingCells > teamTwo.livingCells ? teamOne.id : teamTwo.id,
      reason,
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  if (teamOne.totalHealth !== teamTwo.totalHealth) {
    return {
      winner: teamOne.totalHealth > teamTwo.totalHealth ? teamOne.id : teamTwo.id,
      reason,
      finalTurn: turn,
      teamSummaries: summaries,
    };
  }

  return {
    winner: 'draw',
    reason,
    finalTurn: turn,
    teamSummaries: summaries,
  };
}
