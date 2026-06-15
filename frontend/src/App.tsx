import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Dna } from 'lucide-react';
import { endMatch, getMatchState, pauseMatch, playMatch, resetMatch, startMatch, tickMatch } from './api/gameApi';
import { validatePlayerCode } from './api/validationApi';
import { CodeEditor } from './components/CodeEditor';
import { ControlBar } from './components/ControlBar';
import { FinalResults } from './components/FinalResults';
import { GameBoard } from './components/GameBoard';
import { LogsPanel } from './components/LogsPanel';
import { PlayerSidebar } from './components/SidebarStats';
import { CODE_TEMPLATES } from './domain/templates';
import type { GameState, PlayerConfigForm, Screen, SimulationSettings, SimulationState, SetupIssue, TickExecutionProfile } from './types';

const DEFAULT_TURN_LIMIT = 5000;

function getStepsPerTick(speed: SimulationSettings['speed']): number {
  if (speed === 5) {
    return 25;
  }
  if (speed === 2) {
    return 3;
  }
  return 1;
}

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
    validation: null,
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
  const [lastTickProfile, setLastTickProfile] = useState<TickExecutionProfile | null>(null);
  const [startErrors, setStartErrors] = useState<SetupIssue[]>([]);
  const simTimerRef = useRef<number | null>(null);
  const tickInFlightRef = useRef(false);

  useEffect(() => {
    let delay = 360;
    if (settings.speed === 2) delay = 180;
    if (settings.speed === 5) delay = 120;
    setSettings((previous) => (previous.turnDelay === delay ? previous : { ...previous, turnDelay: delay }));
  }, [settings.speed]);

  useEffect(() => {
    if (gameState !== 'running' || !matchState || matchState.result) {
      if (simTimerRef.current) {
        window.clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      return;
    }

    simTimerRef.current = window.setInterval(async () => {
      if (tickInFlightRef.current) {
        return;
      }

      tickInFlightRef.current = true;
      try {
        const next = await tickMatch(getStepsPerTick(settings.speed));
        setMatchState(next.match);
        setLastTickProfile(next.profile);
        setGameState(next.match.result ? 'finished' : next.match.status);
      } finally {
        tickInFlightRef.current = false;
      }
    }, settings.turnDelay);

    return () => {
      if (simTimerRef.current) {
        window.clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [gameState, matchState, settings.speed, settings.turnDelay]);

  useEffect(() => {
    if (!matchState?.result) {
      return;
    }

    setGameState('finished');
    setScreen('results');
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
  }, [matchState?.result]);

  useEffect(() => {
    void (async () => {
      try {
        const existingMatch = await getMatchState();
        if (!existingMatch) {
          return;
        }

        setMatchState(existingMatch);
        setScreen(existingMatch.result ? 'results' : 'simulation');
        setGameState(existingMatch.result ? 'finished' : existingMatch.status);
      } catch {
        setMatchState(null);
      }
    })();
  }, []);

  const setupIssues = [...collectSetupIssues([p1, p2]), ...startErrors];
  const canStart = setupIssues.length === 0;

  const updatePlayer = (playerId: 1 | 2, nextPlayer: PlayerConfigForm) => {
    if (playerId === 1) {
      setP1(nextPlayer);
      return;
    }
    setP2(nextPlayer);
  };

  const handleValidatePlayer = async (playerId: 1 | 2) => {
    const player = playerId === 1 ? p1 : p2;
    const validation = await validatePlayerCode(player.code);
    updatePlayer(playerId, {
      ...player,
      validation,
    });
  };

  const handleStartSimulation = async () => {
    setStartErrors([]);
    if (!canStart) {
      return;
    }

    try {
      const state = await startMatch({
        players: [
          { name: p1.name.trim(), color: p1.color, code: p1.code },
          { name: p2.name.trim(), color: p2.color, code: p2.code },
        ],
        turnLimit: settings.maxTurns,
      });

      setMatchState(state);
      setLastTickProfile(null);
      setScreen('simulation');
      setGameState('paused');
    } catch (error) {
      setStartErrors([{ message: error instanceof Error ? error.message : 'Unable to start the match.' }]);
    }
  };

  const handleSingleStep = async () => {
    if (gameState === 'running') {
      return;
    }

    const next = await tickMatch(1);
    setMatchState(next.match);
    setLastTickProfile(next.profile);
    setGameState(next.match.result ? 'finished' : 'paused');
  };

  const handleTogglePlay = async () => {
    if (!matchState || matchState.result) {
      return;
    }

    if (gameState === 'running') {
      const paused = await pauseMatch();
      setMatchState(paused);
      setGameState('paused');
      return;
    }

    const playing = await playMatch();
    setMatchState(playing);
    setGameState('running');
  };

  const handleResetMatch = async () => {
    const restarted = await startMatch({
      players: [
        { name: p1.name.trim(), color: p1.color, code: p1.code },
        { name: p2.name.trim(), color: p2.color, code: p2.code },
      ],
      turnLimit: settings.maxTurns,
    });
    setMatchState(restarted);
    setLastTickProfile(null);
    setScreen('simulation');
    setGameState('paused');
  };

  const handleRestartSimulation = async () => {
    const restarted = await startMatch({
      players: [
        { name: p1.name.trim(), color: p1.color, code: p1.code },
        { name: p2.name.trim(), color: p2.color, code: p2.code },
      ],
      turnLimit: settings.maxTurns,
    });
    setMatchState(restarted);
    setLastTickProfile(null);
    setScreen('simulation');
    setGameState('paused');
  };

  const handleBackToSetup = async () => {
    if (simTimerRef.current) {
      window.clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    await resetMatch();
    setGameState('setup');
    setScreen('setup');
    setMatchState(null);
    setLastTickProfile(null);
  };

  const handleEndMatch = async () => {
    if (!matchState || matchState.result) {
      return;
    }

    const ended = await endMatch();
    setMatchState(ended);
    setGameState('finished');
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
            onClick={() => {
              void handleBackToSetup();
            }}
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
            onValidatePlayer={(playerId) => {
              void handleValidatePlayer(playerId);
            }}
            onStartSimulation={() => {
              void handleStartSimulation();
            }}
            canStart={canStart}
          />
        )}

        {screen === 'simulation' && matchState && (
          <div className="space-y-4 px-4">
            <ControlBar
              currentTurn={matchState.currentTurn}
              gameState={gameState}
              settings={settings}
              lastTickProfile={lastTickProfile}
              setSettings={setSettings}
              onTogglePlay={() => {
                void handleTogglePlay();
              }}
              onNextStep={() => {
                void handleSingleStep();
              }}
              onReset={() => {
                void handleResetMatch();
              }}
              onEnd={() => {
                void handleEndMatch();
              }}
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
                />
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
            onRestartSimulation={() => {
              void handleRestartSimulation();
            }}
            onBackToSetup={() => {
              void handleBackToSetup();
            }}
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
