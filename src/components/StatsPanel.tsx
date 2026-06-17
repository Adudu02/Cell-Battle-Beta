import type { SimulationSnapshot } from "../game/types";

interface StatsPanelProps {
  snapshot: SimulationSnapshot;
}

export function StatsPanel({ snapshot }: StatsPanelProps) {
  return (
    <aside className="panel side-panel">
      <header className="panel__header">
        <h2>Statistics</h2>
      </header>
      <div className="stats-stack">
        {(["p1", "p2"] as const).map((teamId) => {
          const player = snapshot.players[teamId];
          const stats = snapshot.stats[teamId];
          return (
            <section key={teamId} className="team-card">
              <div className="team-card__title">
                <span
                  className="team-card__swatch"
                  style={{ backgroundColor: player.teamColor }}
                />
                <div>
                  <strong>{player.teamName}</strong>
                  <span>{teamId === "p1" ? "Player 1" : "Player 2"}</span>
                </div>
              </div>
              <dl className="stat-pairs">
                <div>
                  <dt>Living Cells</dt>
                  <dd>{stats.livingCells.toLocaleString()}</dd>
                </div>
              </dl>
            </section>
          );
        })}

        <section className="legend-card">
          <strong>Legend</strong>
          <ul>
            {(["p1", "p2"] as const).map((teamId) => (
              <li key={teamId}>
                <span
                  className="team-card__swatch"
                  style={{ backgroundColor: snapshot.players[teamId].teamColor }}
                />
                {snapshot.players[teamId].teamName}
              </li>
            ))}
            <li>
              <span className="team-card__swatch team-card__swatch--empty" />
              Empty board cell
            </li>
          </ul>
        </section>
      </div>
    </aside>
  );
}
