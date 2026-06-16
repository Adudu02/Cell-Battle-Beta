import type { RuntimeErrorEntry } from "../game/types";

interface ErrorPanelProps {
  errors: RuntimeErrorEntry[];
}

export function ErrorPanel({ errors }: ErrorPanelProps) {
  return (
    <aside className="panel side-panel">
      <header className="panel__header">
        <h2>Runtime Errors</h2>
      </header>
      {errors.length === 0 ? (
        <div className="empty-state">
          <strong>No runtime errors</strong>
          <p>Validated algorithms are executing cleanly so far.</p>
        </div>
      ) : (
        <div className="error-list">
          {errors.map((error, index) => (
            <article key={`${error.turn}-${error.cellId}-${index}`} className="error-card">
              <header>
                <strong>{error.teamName}</strong>
                <span>Turn {error.turn}</span>
              </header>
              <p>{error.message}</p>
              <small>Cell #{error.cellId}</small>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
