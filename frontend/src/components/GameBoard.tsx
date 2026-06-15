import React, { useEffect, useRef, useState } from 'react';
import { Dna } from 'lucide-react';
import type { Cell } from '../types';

interface GameBoardProps {
  cells: Cell[];
  p1Color: string;
  p2Color: string;
  rows: number;
  cols: number;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  cells,
  p1Color,
  p2Color,
  rows,
  cols,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 800;
      setDimensions({ width, height: Math.floor(width / 2) });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    context.fillStyle = '#0a0f1d';
    context.fillRect(0, 0, dimensions.width, dimensions.height);

    const cellWidth = dimensions.width / cols;
    const cellHeight = dimensions.height / rows;

    context.strokeStyle = '#152033';
    context.lineWidth = 0.5;

    for (let column = 0; column <= cols; column += 10) {
      const x = column * cellWidth;
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, dimensions.height);
      context.stroke();
    }

    for (let row = 0; row <= rows; row += 10) {
      const y = row * cellHeight;
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(dimensions.width, y);
      context.stroke();
    }

    cells.forEach((cell) => {
      if (!cell.alive) {
        return;
      }

      const x = cell.position.col * cellWidth;
      const y = cell.position.row * cellHeight;
      const color = cell.teamId === 1 ? p1Color : p2Color;

      context.fillStyle = color;
      context.shadowBlur = 4;
      context.shadowColor = color;
      context.fillRect(x + 0.5, y + 0.5, Math.max(1, cellWidth - 0.5), Math.max(1, cellHeight - 0.5));
      context.shadowBlur = 0;
    });
  }, [cells, cols, dimensions, p1Color, p2Color, rows]);

  return (
    <div className="relative flex flex-col bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden p-3 shadow-xl">
      <div className="flex justify-between items-center pb-2 mb-2 border-b border-slate-800 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span>
            MATRIX RESOLUTION: {cols} x {rows}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-500">ZOOM: FIT</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-[2/1] bg-[#0a0f1d] rounded-lg overflow-hidden border border-slate-800"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          className="block w-full h-full"
        />

        {cells.filter((cell) => cell.alive).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 text-center">
            <Dna className="h-10 w-10 text-cyan-400 animate-pulse mb-2" />
            <p className="text-sm font-semibold text-slate-200">BOARD EMPTY</p>
            <p className="text-xs text-slate-400 font-mono mt-1">Both teams have been eliminated.</p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-slate-500">
        <span>LIVE BOARD VISUALIZATION</span>
        <div className="flex gap-2">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p1Color }} />
            Team 1
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: p2Color }} />
            Team 2
          </span>
        </div>
      </div>
    </div>
  );
};
