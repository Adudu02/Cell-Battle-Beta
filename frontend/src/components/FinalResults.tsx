import React from 'react';
import { Activity, Flame, Hourglass, RefreshCw, Sliders, Trophy } from 'lucide-react';
import type { GameResult } from '../types';

interface FinalResultsProps {
  result: GameResult;
  onRestartSimulation: () => void;
  onBackToSetup: () => void;
}

export const FinalResults: React.FC<FinalResultsProps> = ({
  result,
  onRestartSimulation,
  onBackToSetup,
}) => {
  const isDraw = result.winner === 'draw';
  const winningSummary = isDraw
    ? null
    : result.teamSummaries.find((summary) => summary.id === result.winner) ?? null;

  const reasonText =
    result.reason === 'elimination'
      ? 'One team completely eliminated the other.'
      : result.reason === 'double_elimination'
        ? 'Both teams were wiped out in the same turn close.'
        : result.reason === 'manual_stop'
          ? 'The match was ended early and scored using living cells first, then total health.'
        : 'The turn limit was reached and the tie-break rules were applied.';

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 font-mono text-slate-100 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-2xl relative overflow-hidden">
        <div
          className="absolute -top-24 -left-20 w-48 h-48 rounded-full blur-3xl opacity-20"
          style={{ backgroundColor: winningSummary?.color ?? '#fbbf24' }}
        />

        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-950 border border-slate-800 rounded-full text-[11px] font-bold text-slate-400">
          <Hourglass className="h-3.5 w-3.5 text-cyan-400" />
          <span>SIMULATION COMPLETED AT TURN {result.finalTurn}</span>
        </div>

        {isDraw ? (
          <div className="space-y-2">
            <div className="inline-flex p-3.5 bg-amber-950/20 border border-amber-900/30 rounded-2xl text-amber-500 mb-2">
              <Activity className="h-10 w-10 animate-pulse" />
            </div>
            <h1 className="text-3xl font-extrabold text-amber-400 tracking-tight">DRAW</h1>
            <p className="text-sm text-slate-400 max-w-md mx-auto">{reasonText}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div
              className="inline-flex p-3.5 rounded-2xl mb-2"
              style={{
                backgroundColor: `${winningSummary?.color ?? '#ffffff'}15`,
                border: `1px solid ${winningSummary?.color ?? '#ffffff'}30`,
                color: winningSummary?.color ?? '#ffffff',
              }}
            >
              <Trophy className="h-10 w-10" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              <span style={{ color: winningSummary?.color }}>{winningSummary?.name.toUpperCase()}</span> WINS
            </h1>
            <p className="text-sm text-slate-400 max-w-sm mx-auto mt-2">{reasonText}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {result.teamSummaries.map((summary) => (
          <div key={summary.id} className="bg-slate-900 border border-slate-850 rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 left-0 h-1" style={{ backgroundColor: summary.color }} />
            <div className="flex justify-between items-center pb-3 border-b border-slate-850">
              <h3 className="font-bold text-lg text-white truncate max-w-[150px]">{summary.name}</h3>
              <span className="text-[10px] text-slate-500">PLAYER {summary.id}</span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  LIVING CELLS:
                </span>
                <span className="text-white font-extrabold">{summary.livingCells}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Flame className="h-4 w-4 text-orange-400" />
                  TOTAL HEALTH:
                </span>
                <span className="text-white font-extrabold">{summary.totalHealth}</span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">AVERAGE VITALITY:</span>
                <span className="text-white font-extrabold">{summary.averageVitality}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 pt-4">
        <button
          type="button"
          onClick={onRestartSimulation}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 rounded-xl font-bold font-mono text-sm shadow-md transition-all hover:brightness-110 flex items-center justify-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          RELAUNCH MATCH
        </button>

        <button
          type="button"
          onClick={onBackToSetup}
          className="flex-1 py-3 px-4 bg-slate-850 border border-slate-750 hover:bg-slate-800 text-slate-200 rounded-xl font-bold font-mono text-sm transition-all flex items-center justify-center gap-2"
        >
          <Sliders className="h-4 w-4" />
          RECONFIGURE
        </button>
      </div>
    </div>
  );
};
