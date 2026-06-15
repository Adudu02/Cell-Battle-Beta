import React from 'react';
import { Activity, Clock, Heart, Shield, Target } from 'lucide-react';
import type { Cell, PlayerDefinition } from '../types';

interface SidebarStatsProps {
  player: PlayerDefinition;
  cells: Cell[];
}

export const PlayerSidebar: React.FC<SidebarStatsProps> = ({ player, cells }) => {
  const teamCells = cells.filter((cell) => cell.alive && cell.teamId === player.id);
  const livingCount = teamCells.length;
  const totalHealth = teamCells.reduce((sum, cell) => sum + cell.health, 0);
  const averageHealth = livingCount > 0 ? Math.round(totalHealth / livingCount) : 0;
  const oldestAge = teamCells.reduce((oldest, cell) => Math.max(oldest, cell.age), 0);
  const actionCounts: Record<string, number> = {};
  teamCells.forEach((cell) => {
    const action = cell.lastAction || 'none';
    actionCounts[action] = (actionCounts[action] || 0) + 1;
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4 text-slate-200 shadow-lg relative h-full">
      <div className="absolute top-0 right-0 left-0 h-1 rounded-t-xl" style={{ backgroundColor: player.color }} />

      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-1">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">PLAYER 0{player.id}</span>
          <h3 className="text-lg font-bold truncate text-white max-w-[150px]">{player.name}</h3>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono uppercase font-bold"
          style={{ backgroundColor: `${player.color}15`, color: player.color }}
        >
          Species
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs font-mono font-bold">
        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Activity className="h-3 w-3 text-cyan-400" />
            LIVING CELLS
          </span>
          <span className="text-xl font-extrabold text-white">{livingCount}</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-1">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Heart className="h-3 w-3 text-rose-500" />
            TOTAL HEALTH
          </span>
          <span className="text-xl font-extrabold text-white">{totalHealth}</span>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-1 col-span-2">
          <span className="text-[10px] text-slate-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-emerald-400" />
              AVERAGE VITALITY
            </span>
            <span>{averageHealth}</span>
          </span>
          <div className="w-full bg-slate-900 rounded-full h-1.5 mt-1 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${averageHealth}%`, backgroundColor: player.color }} />
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-2.5 rounded-lg flex flex-col gap-1 col-span-2">
          <span className="text-[10px] text-slate-500 flex items-center gap-1">
            <Clock className="h-3 w-3 text-indigo-400" />
            OLDEST LIVING CELL
          </span>
          <span className="text-white">{livingCount > 0 ? `${oldestAge} turns old` : 'None alive'}</span>
        </div>
      </div>

      <div className="border-t border-slate-850 pt-3 flex-1 flex flex-col justify-between">
        <h4 className="text-[10px] font-mono tracking-wider text-slate-500 flex items-center gap-1 uppercase mb-2">
          <Target className="h-3.5 w-3.5 text-cyan-500" />
          LAST ACTION MIX
        </h4>

        {livingCount > 0 ? (
          <div className="space-y-1.5 text-xs font-mono">
            {(Object.entries(actionCounts) as Array<[string, number]>).map(([action, count]) => {
              const percent = Math.round((count / livingCount) * 100);
              return (
                <div key={action} className="flex items-center justify-between text-slate-300">
                  <span className="uppercase text-slate-400">{action}:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-slate-950 h-2 rounded overflow-hidden">
                      <div className="h-full" style={{ width: `${percent}%`, backgroundColor: player.color }} />
                    </div>
                    <span className="w-8 text-right font-bold">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 border border-dashed border-slate-800 rounded bg-slate-950/20 text-slate-500 text-xs italic">
            Colony eliminated. No active cells remain.
          </div>
        )}

        <div className="mt-4 pt-2 border-t border-slate-850 text-[9px] font-mono text-slate-600 flex justify-between">
          <span>VALIDATED STRATEGY: {player.validation.isValid ? 'YES' : 'NO'}</span>
          <span>TEAM ID: {player.id}</span>
        </div>
      </div>
    </div>
  );
};
