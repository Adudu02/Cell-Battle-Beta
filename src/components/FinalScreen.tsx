import type { MatchResult } from "../game/types";

interface FinalScreenProps {
  result: MatchResult;
  onNewMatch: () => void;
}

function causeLabel(cause: MatchResult["cause"]): string {
  switch (cause) {
    case "elimination":
      return "All cells of one team were eliminated.";
    case "draw_no_survivors":
      return "Both teams lost all their cells in the same turn.";
    case "turn_limit":
      return "The turn limit was reached.";
    default:
      return "Unknown.";
  }
}

function winnerTitle(result: MatchResult): string {
  if (result.winner === "draw") return "Draw";
  if (result.winner === 1) return `${result.team1Name} wins!`;
  if (result.winner === 2) return `${result.team2Name} wins!`;
  return "Match over";
}

export default function FinalScreen({ result, onNewMatch }: FinalScreenProps) {
  return (
    <div className="final-screen">
      <div className="result-title">{winnerTitle(result)}</div>
      <div className="cause-line">
        Cause of termination: {causeLabel(result.cause)} · Final turn: {result.finalTurn}
      </div>

      <div className="final-cards">
        <div className={`final-card ${result.winner === 1 ? "winner" : ""}`}>
          <div className="team-name">
            <span className="swatch" style={{ background: result.team1Color }} />
            {result.team1Name}
          </div>
          <dl>
            <dt>Living cells</dt>
            <dd>{result.team1LivingCells}</dd>
            <dt>Total health</dt>
            <dd>{result.team1TotalHealth}</dd>
          </dl>
        </div>

        <div className={`final-card ${result.winner === 2 ? "winner" : ""}`}>
          <div className="team-name">
            <span className="swatch" style={{ background: result.team2Color }} />
            {result.team2Name}
          </div>
          <dl>
            <dt>Living cells</dt>
            <dd>{result.team2LivingCells}</dd>
            <dt>Total health</dt>
            <dd>{result.team2TotalHealth}</dd>
          </dl>
        </div>
      </div>

      <button className="primary" onClick={onNewMatch} style={{ fontSize: "1rem", padding: "0.7rem 2.2rem" }}>
        New Match
      </button>
    </div>
  );
}
