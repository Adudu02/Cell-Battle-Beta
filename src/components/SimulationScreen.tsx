import { useDeferredValue } from "react";
import type { SimulationSnapshot } from "../game/types";
import { BoardCanvas } from "./BoardCanvas";
import { ErrorPanel } from "./ErrorPanel";
import { StatsPanel } from "./StatsPanel";

interface SimulationScreenProps {
  snapshot: SimulationSnapshot;
  isAutoPlaying: boolean;
  speedMs: number;
  onPlay: () => void;
  onPause: () => void;
  onStepTurn: () => void;
  onSpeedChange: (speedMs: number) => void;
}

const SPEED_OPTIONS = [
  { label: "1x", value: 260 },
  { label: "2x", value: 160 },
  { label: "4x", value: 90 },
];

export function SimulationScreen({
  snapshot,
  isAutoPlaying,
  speedMs,
  onPlay,
  onPause,
  onStepTurn,
  onSpeedChange,
}: SimulationScreenProps) {
  const deferredCells = useDeferredValue(snapshot.cells);

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
          <BoardCanvas cells={deferredCells} />
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
            <div className="speed-picker" role="group" aria-label="Simulation speed">
              {SPEED_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  className={`speed-pill${speedMs === option.value ? " speed-pill--active" : ""}`}
                  onClick={() => onSpeedChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <ErrorPanel errors={snapshot.errors} />
      </section>
    </main>
  );
}
