import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Terminal } from 'lucide-react';
import type { TurnLog } from '../domain/types';

interface LogsPanelProps {
  logs: TurnLog[];
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const errorLogs = logs.filter((log) => log.type === 'error');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="w-full">
      <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[280px] shadow-lg relative">
        <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2 text-xs font-mono">
          <div className="flex items-center gap-1.5 font-bold tracking-wider text-slate-300">
            <Terminal className="h-4 w-4 text-rose-500 animate-pulse" />
            VALIDATION & RUNTIME ERROR TELEMETRY
          </div>
          <span className="text-slate-500 text-[10px] uppercase">Live Stream</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 pr-2 font-mono text-[11px]">
          {errorLogs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-550 italic gap-2 py-4">
              <span className="text-emerald-400 font-bold block text-sm">NO RUNTIME ERRORS DETECTED</span>
              <span className="text-[10px] text-slate-500">Simulation is currently running without strategy faults.</span>
            </div>
          ) : (
            errorLogs.map((log, index) => (
              <div
                key={`${log.turn}-${index}`}
                className="px-2.5 py-1.5 rounded border bg-red-950/20 border-red-900/40 flex justify-between gap-3"
              >
                <span className="text-red-400 leading-tight flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {log.message}
                </span>
                <span className="text-slate-500 text-[10px] self-start font-semibold whitespace-nowrap">
                  TURN {log.turn}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
