import type { Cell, Player } from "../game/types";

interface StatsPanelProps {
  cells: Cell[];
  player1: Player;
  player2: Player;
}

function computeStats(cells: Cell[], teamId: 1 | 2) {
  let living = 0;
  let totalHealth = 0;
  for (const c of cells) {
    if (c.alive && c.teamId === teamId) {
      living += 1;
      totalHealth += c.health;
    }
  }
  return { living, totalHealth };
}

export default function StatsPanel({ cells, player1, player2 }: StatsPanelProps) {
  const t1 = computeStats(cells, 1);
  const t2 = computeStats(cells, 2);

  return (
    <div className="panel">
      <h2>Statistics</h2>

      <div className="legend-row">
        <span className="swatch" style={{ background: player1.color }} />
        <strong>{player1.name}</strong>
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="label">Living cells</div>
          <div className="value">{t1.living}</div>
        </div>
        <div className="stat-box">
          <div className="label">Total health</div>
          <div className="value">{t1.totalHealth}</div>
        </div>
      </div>

      <div className="legend-row" style={{ marginTop: "1.1rem" }}>
        <span className="swatch" style={{ background: player2.color }} />
        <strong>{player2.name}</strong>
      </div>
      <div className="stat-grid">
        <div className="stat-box">
          <div className="label">Living cells</div>
          <div className="value">{t2.living}</div>
        </div>
        <div className="stat-box">
          <div className="label">Total health</div>
          <div className="value">{t2.totalHealth}</div>
        </div>
      </div>
    </div>
  );
}
