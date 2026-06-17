import type { SimulationSnapshot } from "../game/types";

interface FinalScreenProps {
  snapshot: SimulationSnapshot;
  onNewMatch: () => void;
}

export function FinalScreen({ snapshot, onNewMatch }: FinalScreenProps) {
  const result = snapshot.result;
  if (!result) {
    return null;
  }

  return (
    <main className="screen screen--final">
      <section className="panel final-panel">
        <header className="final-panel__header">
          <p>Match Complete</p>
          <h1>{result.isDraw ? "Draw" : `${result.winnerTeamName} Wins`}</h1>
          <span>{result.cause}</span>
        </header>

        <div className="final-grid">
          {(["p1", "p2"] as const).map((teamId) => (
            <article key={teamId} className="final-team-card">
              <div className="team-card__title">
                <span
                  className="team-card__swatch"
                  style={{ backgroundColor: snapshot.players[teamId].teamColor }}
                />
                <div>
                  <strong>{snapshot.players[teamId].teamName}</strong>
                  <span>{teamId === "p1" ? "Player 1" : "Player 2"}</span>
                </div>
              </div>
              <dl className="stat-pairs">
                <div>
                  <dt>Living Cells</dt>
                  <dd>{result.livingCellsByTeam[teamId].toLocaleString()}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>

        <dl className="final-summary">
          <div>
            <dt>Final Turn</dt>
            <dd>{result.finalTurn}</dd>
          </div>
          <div>
            <dt>Cause of Termination</dt>
            <dd>{result.cause}</dd>
          </div>
        </dl>

        <button
          type="button"
          className="action-button action-button--primary action-button--large"
          onClick={onNewMatch}
        >
          New Match
        </button>
      </section>
    </main>
  );
}
