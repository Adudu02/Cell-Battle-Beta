import type { ErrorLogEntry, Player } from "../game/types";

interface ErrorPanelProps {
  errors: ErrorLogEntry[];
  player1: Player;
  player2: Player;
}

export default function ErrorPanel({ errors, player1, player2 }: ErrorPanelProps) {
  const teamName = (teamId: 1 | 2) => (teamId === 1 ? player1.name : player2.name);

  return (
    <div className="panel">
      <h2>Errors</h2>
      {errors.length === 0 ? (
        <div className="empty-note">No algorithm or runtime errors yet.</div>
      ) : (
        <div className="error-panel">
          {errors
            .slice()
            .reverse()
            .map((e, i) => (
              <div className="error-entry" key={i}>
                <div className="meta">
                  Turn {e.turn} · {teamName(e.teamId)} {e.count > 1 ? `(x${e.count})` : ""}
                </div>
                {e.message}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
