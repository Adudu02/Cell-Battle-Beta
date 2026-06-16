import { useEffect, useRef } from "react";
import type { Cell } from "../game/types";

interface BoardCanvasProps {
  cells: Cell[];
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 6;

export function BoardCanvas({ cells }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gridCacheRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_WIDTH * dpr;
    canvas.height = CANVAS_HEIGHT * dpr;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Draw cached grid once
    if (!gridCacheRef.current) {
      const offscreen = document.createElement("canvas");
      offscreen.width = CANVAS_WIDTH * dpr;
      offscreen.height = CANVAS_HEIGHT * dpr;
      const oc = offscreen.getContext("2d")!;
      oc.setTransform(dpr, 0, 0, dpr, 0, 0);

      oc.fillStyle = "#050a10";
      oc.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      oc.strokeStyle = "rgba(145, 170, 190, 0.12)";
      oc.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
        oc.beginPath();
        oc.moveTo(x + 0.5, 0);
        oc.lineTo(x + 0.5, CANVAS_HEIGHT);
        oc.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
        oc.beginPath();
        oc.moveTo(0, y + 0.5);
        oc.lineTo(CANVAS_WIDTH, y + 0.5);
        oc.stroke();
      }

      gridCacheRef.current = offscreen;
    }

    context.drawImage(gridCacheRef.current, 0, 0);

    for (const cell of cells) {
      context.fillStyle = cell.teamColor;
      context.fillRect(
        cell.position.col * CELL_SIZE + 1,
        cell.position.row * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2,
      );
    }
  }, [cells]);

  return (
    <div className="board-frame">
      <div className="board-frame__meta">
        <span>100 x 200 board</span>
        <span>Canvas render</span>
      </div>
      <canvas
        ref={canvasRef}
        className="board-canvas"
        style={{ width: "100%", height: "auto" }}
      />
    </div>
  );
}