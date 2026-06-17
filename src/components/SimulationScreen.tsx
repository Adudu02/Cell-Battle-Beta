import type { SimulationSnapshot } from "../game/types";
import { BoardCanvas } from "./BoardCanvas";
import { ErrorPanel } from "./ErrorPanel";
import { StatsPanel } from "./StatsPanel";

interface SimulationScreenProps {
  snapshot: SimulationSnapshot;
  isAutoPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStepTurn: () => void;
  onEndMatch: () => void;
}

export function SimulationScreen({
  snapshot,
  isAutoPlaying,
  onPlay,
  onPause,
  onStepTurn,
  onEndMatch,
}: SimulationScreenProps) {
  return (
    <main className="screen screen--simulation">
      <header className="simulation-header panel">
        <h1>Battle of Cells</h1>
        <div className="simulation-header__status">
          <strong>Turn {snapshot.currentTurn}</strong>
          <span>Turn limit {snapshot.turnLimit}</span>
        </div>
      </header>

      <section className="simulation-layout">
        <StatsPanel snapshot={snapshot} />
        <section className="panel board-panel">
          <BoardCanvas
            cells={snapshot.cells}
            boardPatch={snapshot.boardPatch}
          />
          <div className="controls-row">
            <button
              type="button"
              className="action-button action-button--primary"
              onClick={isAutoPlaying ? onPause : onPlay}
            >
              {isAutoPlaying ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              className="action-button action-button--secondary"
              onClick={onStepTurn}
            >
              Step Turn
            </button>
            <button
              type="button"
              className="action-button action-button--secondary"
              onClick={onEndMatch}
            >
              End Match
            </button>
          </div>
        </section>
        <ErrorPanel errors={snapshot.errors} />
      </section>
    </main>
  );
}
