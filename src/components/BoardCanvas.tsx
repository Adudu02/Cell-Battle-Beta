import { useEffect, useRef } from "react";
import type { Cell } from "../game/types";
import { BOARD_COLS, BOARD_ROWS } from "../game/constants";

interface BoardCanvasProps {
  cells: Cell[];
}

const CELL_SIZE = 5; // pixels per board square at native resolution

export default function BoardCanvas({ cells }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = BOARD_COLS * CELL_SIZE;
    const height = BOARD_ROWS * CELL_SIZE;

    // Background grid (petri-dish / slide aesthetic)
    ctx.fillStyle = "#06090e";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.03)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= BOARD_COLS; c += 10) {
      ctx.beginPath();
      ctx.moveTo(c * CELL_SIZE, 0);
      ctx.lineTo(c * CELL_SIZE, height);
      ctx.stroke();
    }
    for (let r = 0; r <= BOARD_ROWS; r += 10) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL_SIZE);
      ctx.lineTo(width, r * CELL_SIZE);
      ctx.stroke();
    }

    // Draw cells
    for (const cell of cells) {
      if (!cell.alive) continue;
      const x = cell.position.col * CELL_SIZE;
      const y = cell.position.row * CELL_SIZE;

      // Health-based brightness: dim health -> dimmer fill
      const healthRatio = Math.max(0.25, cell.health / 100);
      ctx.globalAlpha = healthRatio;
      ctx.fillStyle = cell.color;
      ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);
      ctx.globalAlpha = 1;
    }
  }, [cells]);

  return (
    <canvas
      ref={canvasRef}
      className="board-canvas"
      width={BOARD_COLS * CELL_SIZE}
      height={BOARD_ROWS * CELL_SIZE}
    />
  );
}
