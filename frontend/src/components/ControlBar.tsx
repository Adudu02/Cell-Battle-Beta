import React from 'react';
import { Play, Pause, SkipForward, RotateCcw, Sliders, Square } from 'lucide-react';
import type { GameState, SimulationSettings, TickExecutionProfile } from '../types';

interface ControlBarProps {
  currentTurn: number;
  gameState: GameState;
  settings: SimulationSettings;
  lastTickProfile: TickExecutionProfile | null;
  setSettings: React.Dispatch<React.SetStateAction<SimulationSettings>>;
  onTogglePlay: () => void;
  onNextStep: () => void;
  onReset: () => void;
  onEnd: () => void;
}

export const ControlBar: React.FC<ControlBarProps> = ({
  currentTurn,
  gameState,
  settings,
  lastTickProfile,
  setSettings,
  onTogglePlay,
  onNextStep,
  onReset,
  onEnd,
}) => {
  const isRunning = gameState === 'running';

  const getStatusColor = () => {
    switch (gameState) {
      case 'running': return 'bg-emerald-500 text-slate-950';
      case 'paused': return 'bg-amber-500 text-slate-950';
      case 'finished': return 'bg-rose-500 text-slate-950';
      default: return 'bg-slate-700 text-slate-300';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col md:flex-row gap-4 items-center justify-between text-slate-200">
      {/* 1. Turns and status gauges */}
      <div className="flex items-center gap-4 font-mono">
        <div>
          <span className="text-[10px] text-slate-500 block">SIMULATION STATE</span>
          <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded uppercase ${getStatusColor()}`}>
            {gameState}
          </span>
        </div>
        <div className="border-l border-slate-800 pl-4">
          <span className="text-[10px] text-slate-500 block">TURN PROGRESSION</span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold text-white">{currentTurn}</span>
            <span className="text-slate-500 text-xs">/ {settings.maxTurns}</span>
          </div>
        </div>
      </div>

      {/* 2. Primary Playback actions */}
      <div className="flex items-center gap-2">
        {/* Toggle Play/Pause */}
        <button
          id="play-pause-btn"
          onClick={onTogglePlay}
          disabled={gameState === 'finished'}
          className={`flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg font-mono text-xs font-bold uppercase tracking-wider transition-all border ${
            isRunning
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-500'
              : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-500'
          } disabled:bg-slate-800 disabled:text-slate-600 disabled:border-transparent disabled:cursor-not-allowed`}
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4 fill-current" />
              PAUSE
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-current" />
              PLAY
            </>
          )}
        </button>

        {/* Step Forward (single turn) */}
        <button
          id="step-forward-btn"
          onClick={onNextStep}
          disabled={isRunning || gameState === 'finished'}
          className="flex items-center justify-center gap-1 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 h-10 px-3 rounded-lg font-mono text-xs text-slate-300 disabled:text-slate-600 disabled:border-slate-850 disabled:bg-slate-950/40 disabled:cursor-not-allowed"
          title="Single Turn Step"
        >
          <SkipForward className="h-3.5 w-3.5" />
          <span>STEP</span>
        </button>

        {/* Reset match */}
        <button
          id="reset-simulation-btn"
          onClick={onReset}
          className="flex items-center justify-center gap-1 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-900 h-10 px-3 rounded-lg font-mono text-xs text-slate-300"
          title="Reset Match Coordinates"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>RESTART</span>
        </button>

        <button
          id="end-simulation-btn"
          onClick={onEnd}
          disabled={gameState === 'finished'}
          className="flex items-center justify-center gap-1 bg-rose-950 border border-rose-800 hover:border-rose-700 hover:bg-rose-900 h-10 px-3 rounded-lg font-mono text-xs text-rose-200 disabled:text-slate-600 disabled:border-slate-850 disabled:bg-slate-950/40 disabled:cursor-not-allowed"
          title="Finish the current match early"
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          <span>END MATCH</span>
        </button>
      </div>

      {lastTickProfile && (
        <div className="flex items-center gap-3 font-mono text-[10px] text-slate-400 border-l border-slate-800 pl-4">
          <div>
            <span className="text-slate-500 block">LAST TICK</span>
            <span className="text-cyan-300 font-bold">{lastTickProfile.totalMs.toFixed(1)}ms</span>
          </div>
          <div>
            <span className="text-slate-500 block">BATCH</span>
            <span>{lastTickProfile.executedSteps}/{lastTickProfile.requestedSteps}</span>
          </div>
          <div>
            <span className="text-slate-500 block">CELLS</span>
            <span>{lastTickProfile.livingCellsAfter.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-slate-500 block">PAYLOAD</span>
            <span>{Math.round(lastTickProfile.payloadBytes / 1024).toLocaleString()} KB</span>
          </div>
        </div>
      )}

      {/* 3. Speed selection presets */}
      <div className="flex items-center gap-3 font-mono text-xs">
        <span className="text-slate-500 flex items-center gap-1">
          <Sliders className="h-3.5 w-3.5 text-cyan-400" />
          CLOCK SPEED:
        </span>
        <div className="inline-flex rounded-lg p-0.5 bg-slate-950 border border-slate-800">
          {[1, 2, 5].map(speed => (
            <button
              id={`controls-speed-${speed}`}
              key={speed}
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, speed: speed as 1|2|5 }))}
              className={`px-3 py-1 text-xs font-mono rounded-md font-bold transition-all ${
                settings.speed === speed
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
