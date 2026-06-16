// Victory / end-condition evaluation for Battle of Cells

import type { Cell, GameState, MatchResult, Player, TerminationCause } from "./types";

interface TeamStats {
  livingCells: number;
  totalHealth: number;
}

function computeTeamStats(cells: Cell[], teamId: 1 | 2): TeamStats {
  let livingCells = 0;
  let totalHealth = 0;
  for (const c of cells) {
    if (c.alive && c.teamId === teamId) {
      livingCells += 1;
      totalHealth += c.health;
    }
  }
  return { livingCells, totalHealth };
}

// Determines whether the match should end after the given turn has fully
// executed, and if so, computes the final result.
export function evaluateEndConditions(
  state: GameState,
  player1: Player,
  player2: Player,
): { finished: boolean; result: MatchResult | null } {
  const team1 = computeTeamStats(state.cells, 1);
  const team2 = computeTeamStats(state.cells, 2);

  const team1Alive = team1.livingCells > 0;
  const team2Alive = team2.livingCells > 0;

  let winner: 1 | 2 | "draw" | null = null;
  let cause: TerminationCause = null;

  if (!team1Alive && !team2Alive) {
    winner = "draw";
    cause = "draw_no_survivors";
  } else if (!team1Alive && team2Alive) {
    winner = 2;
    cause = "elimination";
  } else if (team1Alive && !team2Alive) {
    winner = 1;
    cause = "elimination";
  } else if (state.currentTurn >= state.turnLimit) {
    // Turn limit reached after this turn fully executed
    cause = "turn_limit";
    if (team1.livingCells > team2.livingCells) {
      winner = 1;
    } else if (team2.livingCells > team1.livingCells) {
      winner = 2;
    } else if (team1.totalHealth > team2.totalHealth) {
      winner = 1;
    } else if (team2.totalHealth > team1.totalHealth) {
      winner = 2;
    } else {
      winner = "draw";
    }
  }

  if (cause === null) {
    return { finished: false, result: null };
  }

  const result: MatchResult = {
    winner,
    team1Name: player1.name,
    team2Name: player2.name,
    team1Color: player1.color,
    team2Color: player2.color,
    team1LivingCells: team1.livingCells,
    team2LivingCells: team2.livingCells,
    team1TotalHealth: team1.totalHealth,
    team2TotalHealth: team2.totalHealth,
    finalTurn: state.currentTurn,
    cause,
  };

  return { finished: true, result };
}
