import React, { useEffect, useRef, useState } from 'react';
import { Dna } from 'lucide-react';
import type { Cell } from '../types';

interface GameBoardProps {
  cells: Cell[];
  p1Color: string;
  p2Color: string;
  rows: number;
  cols: number;
  selectedCellId: string | null;
  onSelectCell: (cell: Cell | null) => void;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  cells,
  p1Color,
  p2Color,
  rows,
  cols,
  selectedCellId,
  onSelectCell,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number; cell: Cell | null } | null>(null);

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

    if (selectedCellId) {
      const selectedCell = cells.find((cell) => cell.id === selectedCellId && cell.alive);
      if (selectedCell) {
        const x = selectedCell.position.col * cellWidth;
        const y = selectedCell.position.row * cellHeight;
        const color = selectedCell.teamId === 1 ? p1Color : p2Color;

        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.25;
        context.strokeRect(x - 2, y - 2, cellWidth + 4, cellHeight + 4);

        context.strokeStyle = color;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x - 6, y + cellHeight / 2);
        context.lineTo(x + cellWidth + 6, y + cellHeight / 2);
        context.moveTo(x + cellWidth / 2, y - 6);
        context.lineTo(x + cellWidth / 2, y + cellHeight + 6);
        context.stroke();
      }
    }
  }, [cells, cols, dimensions, p1Color, p2Color, rows, selectedCellId]);

  const resolvePointerCell = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const cellWidth = dimensions.width / cols;
    const cellHeight = dimensions.height / rows;

    return {
      row: Math.max(0, Math.min(rows - 1, Math.floor(y / cellHeight))),
      col: Math.max(0, Math.min(cols - 1, Math.floor(x / cellWidth))),
    };
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = resolvePointerCell(event);
    if (!pointer) {
      return;
    }

    const clickedCell =
      cells.find(
        (cell) => cell.alive && cell.position.row === pointer.row && cell.position.col === pointer.col,
      ) ?? null;
    onSelectCell(clickedCell);
  };

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const pointer = resolvePointerCell(event);
    if (!pointer) {
      return;
    }

    const cell =
      cells.find(
        (current) => current.alive && current.position.row === pointer.row && current.position.col === pointer.col,
      ) ?? null;

    setHoveredCell({ ...pointer, cell });
  };

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
          {hoveredCell && (
            <span className="text-cyan-400">
              HOVER: R{hoveredCell.row} C{hoveredCell.col}
              {hoveredCell.cell && (
                <span
                  className="ml-[6px]"
                  style={{ color: hoveredCell.cell.teamId === 1 ? p1Color : p2Color }}
                >
                  [{hoveredCell.cell.teamName} - HP: {hoveredCell.cell.health}]
                </span>
              )}
            </span>
          )}
          <span className="text-slate-500">ZOOM: FIT</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative w-full aspect-[2/1] bg-[#0a0f1d] cursor-crosshair rounded-lg overflow-hidden border border-slate-800"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.width}
          height={dimensions.height}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredCell(null)}
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
        <span>SELECT ANY LIVING CELL TO INSPECT ITS CURRENT STATE</span>
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
