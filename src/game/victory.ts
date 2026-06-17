import type { InternalGameState } from "./initialState";
import type { MatchResult, TeamId } from "./types";

function buildResult(
  state: InternalGameState,
  winnerTeamId: TeamId | null,
  termination: MatchResult["termination"],
  cause: string,
): MatchResult {
  return {
    winnerTeamId,
    winnerTeamName: winnerTeamId ? state.players[winnerTeamId].teamName : null,
    isDraw: winnerTeamId === null,
    finalTurn: state.currentTurn,
    cause,
    termination,
    livingCellsByTeam: {
      p1: state.teamStats.p1.livingCells,
      p2: state.teamStats.p2.livingCells,
    },
  };
}

export function evaluateVictory(state: InternalGameState): MatchResult | null {
  const p1Living = state.teamStats.p1.livingCells;
  const p2Living = state.teamStats.p2.livingCells;

  if (p1Living === 0 && p2Living === 0) {
    return buildResult(
      state,
      null,
      "mutual-elimination",
      "Both teams were eliminated on the same turn.",
    );
  }

  if (p1Living === 0) {
    return buildResult(
      state,
      "p2",
      "one-team-remaining",
      `${state.players.p2.teamName} remained alive.`,
    );
  }

  if (p2Living === 0) {
    return buildResult(
      state,
      "p1",
      "one-team-remaining",
      `${state.players.p1.teamName} remained alive.`,
    );
  }

  if (state.currentTurn < state.turnLimit) {
    return null;
  }

  if (p1Living !== p2Living) {
    return buildResult(
      state,
      p1Living > p2Living ? "p1" : "p2",
      "turn-limit",
      "Turn limit reached. Winner decided by living cell count.",
    );
  }

  return buildResult(
    state,
    null,
    "turn-limit",
    "Turn limit reached with tied living cell counts.",
  );
}

export function createManualResult(state: InternalGameState): MatchResult {
  const p1Living = state.teamStats.p1.livingCells;
  const p2Living = state.teamStats.p2.livingCells;

  if (p1Living !== p2Living) {
    return buildResult(
      state,
      p1Living > p2Living ? "p1" : "p2",
      "manual",
      "Match ended manually. Winner decided by living cell count.",
    );
  }

  return buildResult(
    state,
    null,
    "manual",
    "Match ended manually with tied living cell counts.",
  );
}
