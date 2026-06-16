import React, { useCallback, useEffect, useRef, useState } from "react";
import BoardCanvas from "./BoardCanvas";
import StatsPanel from "./StatsPanel";
import ErrorPanel from "./ErrorPanel";
import type { GameState, Player } from "../game/types";
import type { FunctionDecl } from "../game/interpreter";
import { executeTurn } from "../game/engine";
import { evaluateEndConditions } from "../game/victory";

interface SimulationScreenProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  player1: Player;
  player2: Player;
  algorithms: { team1: FunctionDecl; team2: FunctionDecl };
  onFinished: (state: GameState) => void;
}

const TURN_INTERVAL_MS = 60;

export default function SimulationScreen({
  gameState,
  setGameState,
  player1,
  player2,
  algorithms,
  onFinished,
}: SimulationScreenProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const stepOnce = useCallback(() => {
    setGameState((prev) => {
      if (prev.isFinished) return prev;

      const advanced = executeTurn(prev, algorithms);
      const { finished, result } = evaluateEndConditions(advanced, player1, player2);

      if (finished) {
        const finalState: GameState = {
          ...advanced,
          isFinished: true,
          isRunning: false,
          isPaused: false,
          result,
        };
        return finalState;
      }

      return {
        ...advanced,
        currentTurn: advanced.currentTurn + 1,
      };
    });
  }, [algorithms, player1, player2, setGameState]);

  // Watch for finished state to trigger the final screen transition.
  // We don't need to call setIsPlaying(false) here: the playback-loop effect
  // below already guards on `gameState.isFinished` and will not (re)schedule
  // its interval once the match ends.
  useEffect(() => {
    if (gameState.isFinished && gameState.result) {
      onFinished(gameState);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isFinished]);

  // Automatic playback loop
  useEffect(() => {
    if (isPlaying && !gameState.isFinished) {
      intervalRef.current = window.setInterval(() => {
        stepOnce();
      }, TURN_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, gameState.isFinished, stepOnce]);

  const handlePlayPause = () => {
    if (gameState.isFinished) return;
    setIsPlaying((p) => !p);
  };

  const handleStep = () => {
    if (gameState.isFinished) return;
    setIsPlaying(false);
    stepOnce();
  };

  return (
    <div>
      <div className="sim-controls">
        <span className="locked-badge">🔒 Match locked</span>
        <button onClick={handlePlayPause} className="primary" disabled={gameState.isFinished}>
          {isPlaying && !gameState.isFinished ? "Pause" : "Play"}
        </button>
        <button onClick={handleStep} disabled={isPlaying || gameState.isFinished}>
          Step Turn
        </button>
        <div className="turn-info">
          <span>
            Turn: <strong>{gameState.currentTurn}</strong>
          </span>
          <span>
            Limit: <strong>{gameState.turnLimit}</strong>
          </span>
        </div>
      </div>

      <div className="sim-layout">
        <div>
          <div className="board-wrapper">
            <BoardCanvas cells={gameState.cells} />
          </div>
        </div>

        <div className="sidebar">
          <div className="panel">
            <h2>Legend</h2>
            <div className="legend-row">
              <span className="swatch" style={{ background: player1.color }} />
              <span>{player1.name} (Player 1)</span>
            </div>
            <div className="legend-row">
              <span className="swatch" style={{ background: player2.color }} />
              <span>{player2.name} (Player 2)</span>
            </div>
          </div>

          <StatsPanel cells={gameState.cells} player1={player1} player2={player2} />
          <ErrorPanel errors={gameState.errors} player1={player1} player2={player2} />
        </div>
      </div>
    </div>
  );
}
