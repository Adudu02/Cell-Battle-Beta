import React from 'react';
import { AlertTriangle, BookOpen, Check, Code2, Play, Settings2, Sparkles } from 'lucide-react';
import { CODE_TEMPLATES } from '../domain/templates';
import type { PlayerConfigForm, SetupIssue, SimulationSettings } from '../types';

interface CodeEditorProps {
  p1: PlayerConfigForm;
  p2: PlayerConfigForm;
  settings: SimulationSettings;
  setP1: React.Dispatch<React.SetStateAction<PlayerConfigForm>>;
  setP2: React.Dispatch<React.SetStateAction<PlayerConfigForm>>;
  setSettings: React.Dispatch<React.SetStateAction<SimulationSettings>>;
  setupIssues: SetupIssue[];
  onValidatePlayer: (playerId: 1 | 2) => void;
  onStartSimulation: () => void;
  canStart: boolean;
}

const NEON_COLORS = [
  { name: 'Cyan Glow', hex: '#22d3ee' },
  { name: 'Lime Bio', hex: '#4ade80' },
  { name: 'Amber Heat', hex: '#fbbf24' },
  { name: 'Magenta Pulse', hex: '#f43f5e' },
  { name: 'Purple Vortex', hex: '#bc5bf5' },
  { name: 'Orange Flare', hex: '#fb923c' },
];

function updatePlayerFromTemplate(player: PlayerConfigForm, templateName: keyof typeof CODE_TEMPLATES): PlayerConfigForm {
  return {
    ...player,
    selectedTemplate: templateName,
    code: CODE_TEMPLATES[templateName],
    validation: null,
  };
}

function PlayerPanel({
  player,
  accentColor,
  label,
  setPlayer,
  onValidate,
}: {
  player: PlayerConfigForm;
  accentColor: string;
  label: string;
  setPlayer: React.Dispatch<React.SetStateAction<PlayerConfigForm>>;
  onValidate: () => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-2xl relative">
      <div className="absolute top-0 right-0 left-0 h-1 rounded-t-xl" style={{ backgroundColor: accentColor }} />
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
            {label}
          </h2>
          <span className="text-xs font-mono text-slate-500">
            {player.validation?.isValid ? 'VALID' : 'NEEDS VALIDATION'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">SPECIES IDENTIFIER</label>
            <input
              type="text"
              value={player.name}
              onChange={(event) =>
                setPlayer((previous) => ({
                  ...previous,
                  name: event.target.value,
                }))
              }
              className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-slate-400 mb-1">LOAD TEMPLATE</label>
            <select
              value={player.selectedTemplate}
              onChange={(event) =>
                setPlayer((previous) =>
                  updatePlayerFromTemplate(previous, event.target.value as keyof typeof CODE_TEMPLATES),
                )
              }
              className="w-full bg-slate-950 border border-slate-850 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="PREDATOR">Hunter-Predator</option>
              <option value="EXPANDING_COLONY">Colony Expansion</option>
              <option value="SENTINEL">Sentinel</option>
              <option value="RANDOM_EXPLORER">Explorer</option>
              <option value="AGGRESSIVE_STRESS">Aggressive Stress</option>
              <option value="CROWD_SURVIVAL_TRANSLATED">Imported Strategy</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5">TEAM COLOR</label>
          <div className="flex flex-wrap gap-2">
            {NEON_COLORS.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() =>
                  setPlayer((previous) => ({
                    ...previous,
                    color: color.hex,
                  }))
                }
                className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 border ${
                  player.color === color.hex
                    ? 'border-white/60 bg-white/10 font-bold'
                    : 'border-slate-850 bg-slate-950 text-slate-400 hover:border-slate-700'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color.hex }} />
                {color.name.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-xs font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Code2 className="h-3 w-3" /> strategy.py
            </span>
            <span>action(cell, environment)</span>
          </div>
          <textarea
            value={player.code}
            onChange={(event) =>
              setPlayer((previous) => ({
                ...previous,
                code: event.target.value,
                validation: null,
              }))
            }
            spellCheck={false}
            className="w-full h-80 bg-[#070b13] border border-slate-850 font-mono text-xs p-3.5 rounded text-teal-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 leading-relaxed resize-none overflow-y-auto"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onValidate}
            className="w-full py-2.5 rounded-lg border border-cyan-700/50 bg-cyan-950/30 hover:bg-cyan-900/30 text-cyan-300 font-mono text-xs font-bold transition-all"
          >
            VALIDATE CODE
          </button>
        </div>

        <div
          className={`rounded-lg border px-3 py-2.5 text-xs font-mono ${
            player.validation?.isValid
              ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-300'
              : player.validation
                ? 'border-rose-900/40 bg-rose-950/20 text-rose-300'
                : 'border-slate-800 bg-slate-950 text-slate-500'
          }`}
        >
          {player.validation?.isValid && (
            <span className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Strategy validated. This player is ready to start.
            </span>
          )}
          {!player.validation && <span>Validation pending. Edits require a fresh validation before starting.</span>}
          {player.validation && !player.validation.isValid && (
            <span className="flex items-start gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {player.validation.errors[0]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  p1,
  p2,
  settings,
  setP1,
  setP2,
  setSettings,
  setupIssues,
  onValidatePlayer,
  onStartSimulation,
  canStart,
}) => {
  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-4 font-sans text-slate-100">
      <div className="text-center space-y-2 py-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-800/50 rounded-full text-xs font-mono text-cyan-400">
          <Sparkles className="h-3 w-3" />
          <span>CYTOTOXIC COLONY AUTOMATA - MVP</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500">
          CELL BATTLE
        </h1>
        <p className="text-xs md:text-sm text-slate-400 max-w-2xl mx-auto">
          Validate two restricted Python-like strategies, lock the match, and run the full 100 x 200 simulation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-5">
          <PlayerPanel
            player={p1}
            accentColor={p1.color}
            label="Player 1 Setup"
            setPlayer={setP1}
            onValidate={() => onValidatePlayer(1)}
          />
        </div>

        <div className="lg:col-span-5">
          <PlayerPanel
            player={p2}
            accentColor={p2.color}
            label="Player 2 Setup"
            setPlayer={setP2}
            onValidate={() => onValidatePlayer(2)}
          />
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-xl">
            <h3 className="text-xs font-extrabold font-mono tracking-wider text-slate-200 border-b border-slate-850 pb-2 mb-3 flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-cyan-400" />
              VALID ACTIONS
            </h3>

            <div className="space-y-3 font-mono text-[11px] leading-relaxed">
              <div>
                <p className="text-cyan-400 font-bold">Move</p>
                <p className="text-slate-400 text-[10px]">Use `mn`, `ms`, `me`, `mw`, `mne`, `mnw`, `mse`, `msw`.</p>
              </div>
              <div className="border-t border-slate-850 pt-2">
                <p className="text-cyan-400 font-bold">Eat</p>
                <p className="text-slate-400 text-[10px]">Use `an`, `as`, `ae`, `aw`, `ane`, `anw`, `ase`, `asw`.</p>
              </div>
              <div className="border-t border-slate-850 pt-2">
                <p className="text-cyan-400 font-bold">Reproduce</p>
                <p className="text-slate-400 text-[10px]">Use `rn`, `rs`, `re`, `rw`, `rne`, `rnw`, `rse`, `rsw`.</p>
              </div>
              <div className="border-t border-slate-850 pt-2">
                <p className="text-cyan-400 font-bold">Rest</p>
                <p className="text-slate-400 text-[10px]">Use `d` to heal 3 health, capped at 100.</p>
              </div>
              <div className="border-t border-slate-850 pt-2">
                <p className="text-cyan-400 font-bold">Aggressive Stress</p>
                <p className="text-slate-400 text-[10px]">Use the `Aggressive Stress` template to benchmark heavy reproduction and blocked-action behavior.</p>
              </div>
              <div className="border-t border-slate-850 pt-2">
                <p className="text-cyan-400 font-bold">Imported Strategy</p>
                <p className="text-slate-400 text-[10px]">Use the `Imported Strategy` template for translated logic from older projects. Raw JavaScript snippets are not executed directly here.</p>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-xl">
            <h3 className="text-xs font-extrabold font-mono tracking-wider text-slate-200 border-b border-slate-850 pb-2 mb-3 flex items-center gap-1.5">
              <Settings2 className="h-4 w-4 text-cyan-400" />
              MATCH SETTINGS
            </h3>

            <div className="space-y-4 font-mono text-[11px]">
              <div>
                <label className="block text-slate-400 mb-1">VISUALIZATION SPEED</label>
                <div className="grid grid-cols-3 gap-1">
                  {[1, 2, 5].map((speed) => (
                    <button
                      key={speed}
                      type="button"
                      onClick={() => setSettings((previous) => ({ ...previous, speed: speed as 1 | 2 | 5 }))}
                      className={`py-1 text-center font-bold rounded ${
                        settings.speed === speed
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-950 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">TURN LIMIT</label>
                <select
                  value={settings.maxTurns}
                  onChange={(event) =>
                    setSettings((previous) => ({ ...previous, maxTurns: Number.parseInt(event.target.value, 10) }))
                  }
                  className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1.5 text-white focus:outline-none"
                >
                  <option value={100}>100 turns</option>
                  <option value={1000}>1,000 turns</option>
                  <option value={5000}>5,000 turns</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-850 rounded-xl p-4 shadow-xl">
            <h3 className="text-xs font-extrabold font-mono tracking-wider text-slate-200 border-b border-slate-850 pb-2 mb-3">
              START CHECKLIST
            </h3>

            <div className="space-y-2 text-[11px] font-mono">
              {setupIssues.length === 0 ? (
                <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-emerald-300">
                  Both players are validated and ready to lock the match.
                </div>
              ) : (
                setupIssues.map((issue, index) => (
                  <div
                    key={`${issue.playerId ?? 0}-${index}`}
                    className="rounded-lg border border-rose-900/40 bg-rose-950/20 px-3 py-2 text-rose-300 flex gap-2"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{issue.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onStartSimulation}
              disabled={!canStart}
              className="w-full py-4 rounded-xl font-bold font-mono text-sm tracking-wider shadow-lg transition-transform flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:scale-[1.03] hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:hover:scale-100"
            >
              <Play className="h-4 w-4 fill-current" />
              START SIMULATION
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
