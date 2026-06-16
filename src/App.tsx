import React, { useMemo, useState } from "react";
import ConfigurationScreen from "./components/ConfigurationScreen";
import SimulationScreen from "./components/SimulationScreen";
import FinalScreen from "./components/FinalScreen";
import type { GamePhase, GameState, Player } from "./game/types";
import { createInitialGameState } from "./game/engine";
import { parseAlgorithm } from "./game/interpreter";
import "./styles/global.css";

export default function App() {
  const [phase, setPhase] = useState<GamePhase>("configuration");
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);

  // Algorithms are parsed once at match start and frozen for the duration of
  // the match (the code itself is locked once Play is pressed).
  const algorithms = useMemo(() => {
    if (!player1 || !player2) return null;
    try {
      return {
        team1: parseAlgorithm(player1.code),
        team2: parseAlgorithm(player2.code),
      };
    } catch {
      return null;
    }
  }, [player1, player2]);

  const handleStart = (p1: Player, p2: Player) => {
    setPlayer1(p1);
    setPlayer2(p2);
    setGameState(createInitialGameState(p1, p2));
    setPhase("simulation");
  };

  const handleFinished = () => {
    setPhase("final");
  };

  const handleNewMatch = () => {
    setPlayer1(null);
    setPlayer2(null);
    setGameState(null);
    setPhase("configuration");
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="logo">
          <span className="dot" />
          <div>
            <h1>Battle of Cells</h1>
            <div className="subtitle">Local two-player cell simulation MVP</div>
          </div>
        </div>
        {phase === "simulation" && player1 && player2 && (
          <div className="subtitle">
            {player1.name} vs {player2.name}
          </div>
        )}
      </header>

      <main className="main-content">
        {phase === "configuration" && <ConfigurationScreen onStart={handleStart} />}

        {phase === "simulation" && gameState && player1 && player2 && algorithms && (
          <SimulationScreen
            gameState={gameState}
            setGameState={setGameState as React.Dispatch<React.SetStateAction<GameState>>}
            player1={player1}
            player2={player2}
            algorithms={algorithms}
            onFinished={handleFinished}
          />
        )}

        {phase === "final" && gameState?.result && (
          <FinalScreen result={gameState.result} onNewMatch={handleNewMatch} />
        )}
      </main>
    </div>
  );
}
