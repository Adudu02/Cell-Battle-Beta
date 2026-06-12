import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Dna } from 'lucide-react';
import { CodeEditor } from './components/CodeEditor';
import { ControlBar } from './components/ControlBar';
import { FinalResults } from './components/FinalResults';
import { GameBoard } from './components/GameBoard';
import { LogsPanel } from './components/LogsPanel';
import { PlayerSidebar } from './components/SidebarStats';
import { BOARD_COLS, BOARD_ROWS, DEFAULT_TURN_LIMIT } from './domain/constants';
import { createSimulationState, restartSimulation, runSimulationTurn } from './domain/engine';
import { CODE_TEMPLATES } from './domain/templates';
import { validateStrategy } from './domain/strategy';
import type { PlayerDefinition } from './domain/types';
import type { GameState, PlayerConfigForm, Screen, SimulationSettings, SimulationState, SetupIssue } from './types';

function createPlayerForm(
  id: 1 | 2,
  name: string,
  color: string,
  selectedTemplate: keyof typeof CODE_TEMPLATES,
): PlayerConfigForm {
  return {
    id,
    name,
    color,
    selectedTemplate,
    code: CODE_TEMPLATES[selectedTemplate],
    validation: validateStrategy(CODE_TEMPLATES[selectedTemplate]),
    confirmed: false,
  };
}

function buildPlayerDefinition(player: PlayerConfigForm): PlayerDefinition | null {
  if (!player.validation?.isValid) {
    return null;
  }

  return {
    id: player.id,
    name: player.name.trim(),
    color: player.color,
    code: player.code,
    validation: player.validation,
  };
}

function collectSetupIssues(players: [PlayerConfigForm, PlayerConfigForm]): SetupIssue[] {
  const [p1, p2] = players;
  const issues: SetupIssue[] = [];

  if (!p1.name.trim()) {
    issues.push({ playerId: 1, message: 'Player 1 needs a team name.' });
  }
  if (!p2.name.trim()) {
    issues.push({ playerId: 2, message: 'Player 2 needs a team name.' });
  }
  if (p1.name.trim() && p2.name.trim() && p1.name.trim().toLowerCase() === p2.name.trim().toLowerCase()) {
    issues.push({ message: 'Team names must be different.' });
  }
  if (!p1.validation?.isValid) {
    issues.push({ playerId: 1, message: 'Player 1 must validate a legal strategy.' });
  }
  if (!p2.validation?.isValid) {
    issues.push({ playerId: 2, message: 'Player 2 must validate a legal strategy.' });
  }
  if (!p1.confirmed) {
    issues.push({ playerId: 1, message: 'Player 1 must be confirmed after validation.' });
  }
  if (!p2.confirmed) {
    issues.push({ playerId: 2, message: 'Player 2 must be confirmed after validation.' });
  }

  return issues;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup');
  const [gameState, setGameState] = useState<GameState>('setup');
  const [p1, setP1] = useState<PlayerConfigForm>(() =>
    createPlayerForm(1, 'Anabaena-Cyan', '#22d3ee', 'PREDATOR'),
  );
  const [p2, setP2] = useState<PlayerConfigForm>(() =>
    createPlayerForm(2, 'Dicty-Magenta', '#f43f5e', 'EXPANDING_COLONY'),
  );
  const [settings, setSettings] = useState<SimulationSettings>({
    maxTurns: DEFAULT_TURN_LIMIT,
    speed: 2,
    turnDelay: 180,
  });
  const [matchState, setMatchState] = useState<SimulationState | null>(null);
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null);
  const simTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let delay = 360;
    if (settings.speed === 2) delay = 180;
    if (settings.speed === 5) delay = 60;
    setSettings((previous) => (previous.turnDelay === delay ? previous : { ...previous, turnDelay: delay }));
  }, [settings.speed]);

  useEffect(() => {
    if (gameState !== 'running' || !matchState || matchState.result) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      return;
    }

    simTimerRef.current = setInterval(() => {
      setMatchState((previous) => {
        if (!previous || previous.result) {
          return previous;
        }
        return runSimulationTurn(previous);
      });
    }, settings.turnDelay);

    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [gameState, matchState?.result, settings.turnDelay]);

  useEffect(() => {
    if (!matchState?.result) {
      return;
    }

    setGameState('finished');
    setScreen('results');
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, [matchState?.result]);

  const setupIssues = collectSetupIssues([p1, p2]);
  const canStart = setupIssues.length === 0;
  const selectedCell = matchState?.cells.find((cell) => cell.id === selectedCellId && cell.alive) ?? null;

  const updatePlayer = (playerId: 1 | 2, nextPlayer: PlayerConfigForm) => {
    if (playerId === 1) {
      setP1(nextPlayer);
      return;
    }
    setP2(nextPlayer);
  };

  const handleValidatePlayer = (playerId: 1 | 2) => {
    const player = playerId === 1 ? p1 : p2;
    const validation = validateStrategy(player.code);
    updatePlayer(playerId, {
      ...player,
      validation,
      confirmed: false,
    });
  };

  const handleConfirmPlayer = (playerId: 1 | 2) => {
    const player = playerId === 1 ? p1 : p2;
    if (!player.validation?.isValid || !player.name.trim()) {
      return;
    }

    updatePlayer(playerId, {
      ...player,
      confirmed: true,
    });
  };

  const handleStartSimulation = () => {
    const teamOne = buildPlayerDefinition(p1);
    const teamTwo = buildPlayerDefinition(p2);
    if (!teamOne || !teamTwo || !canStart) {
      return;
    }

    const state = createSimulationState({
      teams: [teamOne, teamTwo],
      turnLimit: settings.maxTurns,
      boardRows: BOARD_ROWS,
      boardCols: BOARD_COLS,
    });

    setMatchState(state);
    setSelectedCellId(null);
    setScreen('simulation');
    setGameState('running');
  };

  const handleSingleStep = () => {
    if (gameState === 'running') {
      return;
    }

    setMatchState((previous) => {
      if (!previous || previous.result) {
        return previous;
      }
      return runSimulationTurn(previous);
    });
  };

  const handleTogglePlay = () => {
    if (!matchState || matchState.result) {
      return;
    }
    setGameState((previous) => (previous === 'running' ? 'paused' : 'running'));
  };

  const handleResetMatch = () => {
    setMatchState((previous) => (previous ? restartSimulation(previous) : previous));
    setSelectedCellId(null);
    setScreen('simulation');
    setGameState('paused');
  };

  const handleRestartSimulation = () => {
    setMatchState((previous) => (previous ? restartSimulation(previous) : previous));
    setSelectedCellId(null);
    setScreen('simulation');
    setGameState('running');
  };

  const handleBackToSetup = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setGameState('setup');
    setScreen('setup');
    setMatchState(null);
    setSelectedCellId(null);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans select-none antialiased">
      <header className="border-b border-slate-850 px-6 py-3 bg-[#0a0f1d]/80 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Dna className="h-6 w-6 text-cyan-400 rotate-12" />
          <div>
            <h1 className="text-sm font-black tracking-wide text-white flex items-center gap-1.5 leading-none">
              CELL BATTLE
              <span className="text-[9px] font-mono font-bold bg-cyan-950/60 text-cyan-400 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                MVP
              </span>
            </h1>
            <p className="text-[9px] font-mono text-slate-500 leading-none mt-1">
              BIOPHYSICS STRATEGIC RUNTIME TERMINAL
            </p>
          </div>
        </div>

        {screen === 'results' && (
          <button
            id="back-to-setup-btn"
            onClick={handleBackToSetup}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 rounded text-xs font-mono text-slate-400 hover:text-slate-100 transition-all cursor-pointer"
          >
            <ArrowLeft className="h-3 w-3" />
            BACK TO CONFIG
          </button>
        )}
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto flex flex-col justify-center py-4">
        {screen === 'setup' && (
          <CodeEditor
            p1={p1}
            p2={p2}
            settings={settings}
            setP1={setP1}
            setP2={setP2}
            setSettings={setSettings}
            setupIssues={setupIssues}
            onValidatePlayer={handleValidatePlayer}
            onConfirmPlayer={handleConfirmPlayer}
            onStartSimulation={handleStartSimulation}
            canStart={canStart}
          />
        )}

        {screen === 'simulation' && matchState && (
          <div className="space-y-4 px-4">
            <ControlBar
              currentTurn={matchState.currentTurn}
              gameState={gameState}
              settings={settings}
              setSettings={setSettings}
              onTogglePlay={handleTogglePlay}
              onNextStep={handleSingleStep}
              onReset={handleResetMatch}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              <div className="lg:col-span-3">
                <PlayerSidebar player={matchState.config.teams[0]} cells={matchState.cells} />
              </div>

              <div className="lg:col-span-6 flex flex-col gap-4">
                <GameBoard
                  cells={matchState.cells}
                  p1Color={matchState.config.teams[0].color}
                  p2Color={matchState.config.teams[1].color}
                  rows={matchState.config.boardRows}
                  cols={matchState.config.boardCols}
                  selectedCellId={selectedCellId}
                  onSelectCell={(cell) => setSelectedCellId(cell ? cell.id : null)}
                />

                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                    <h3 className="text-xs font-extrabold font-mono tracking-wider text-slate-200">
                      SELECTED CELL
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">TURN {matchState.currentTurn}</span>
                  </div>

                  {selectedCell ? (
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">TEAM</span>
                        <span style={{ color: selectedCell.teamColor }}>{selectedCell.teamName}</span>
                      </div>
                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">POSITION</span>
                        <span className="text-white">
                          R{selectedCell.position.row} C{selectedCell.position.col}
                        </span>
                      </div>
                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">HEALTH</span>
                        <span className="text-white">{selectedCell.health}</span>
                      </div>
                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-3">
                        <span className="text-slate-500 block mb-1">AGE</span>
                        <span className="text-white">{selectedCell.age}</span>
                      </div>
                      <div className="bg-slate-950 border border-slate-850 rounded-lg p-3 col-span-2">
                        <span className="text-slate-500 block mb-1">LAST ACTION</span>
                        <span className="text-white">
                          {selectedCell.lastAction} ({selectedCell.lastActionStatus})
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-mono text-slate-500 border border-dashed border-slate-800 rounded-lg px-4 py-6 text-center">
                      Click a living cell on the board to inspect team, health, age, position, and last action.
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3">
                <PlayerSidebar player={matchState.config.teams[1]} cells={matchState.cells} />
              </div>
            </div>

            <LogsPanel logs={matchState.logs} />
          </div>
        )}

        {screen === 'results' && matchState?.result && (
          <FinalResults
            result={matchState.result}
            onRestartSimulation={handleRestartSimulation}
            onBackToSetup={handleBackToSetup}
          />
        )}
      </main>

      <footer className="border-t border-slate-850 px-6 py-2 bg-slate-950/40 text-[9px] font-mono text-slate-500 text-center flex flex-col sm:flex-row justify-between gap-1 items-center">
        <span>LOCAL TWO-PLAYER CELL SIMULATION | BOARD 200 x 100 | SAFE STRATEGY SUBSET</span>
        <span>
          MATCH CONFIG LOCKS ON PLAY: <span className="text-emerald-400">ENFORCED</span>
        </span>
      </footer>
    </div>
  );
}
