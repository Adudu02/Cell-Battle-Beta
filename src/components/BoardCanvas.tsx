import { useEffect, useRef } from "react";
import type { BoardPatch, Cell } from "../game/types";

interface BoardCanvasProps {
  cells?: Cell[];
  boardPatch: BoardPatch;
  occupiedCount: number;
}

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const CELL_SIZE = 6;
const CELL_INSET = 1;
const BOARD_BACKGROUND = "#08111a";
const GRID_STROKE = "rgba(145, 170, 190, 0.05)";
const TOTAL_SQUARES = 100 * 200;

function configureCanvas(canvas: HTMLCanvasElement, dpr: number): CanvasRenderingContext2D | null {
  canvas.width = CANVAS_WIDTH * dpr;
  canvas.height = CANVAS_HEIGHT * dpr;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  return context;
}

function drawGrid(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  context.fillStyle = BOARD_BACKGROUND;
  context.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  context.strokeStyle = GRID_STROKE;
  context.lineWidth = 1;

  for (let x = 0; x <= CANVAS_WIDTH; x += CELL_SIZE) {
    context.beginPath();
    context.moveTo(x + 0.5, 0);
    context.lineTo(x + 0.5, CANVAS_HEIGHT);
    context.stroke();
  }

  for (let y = 0; y <= CANVAS_HEIGHT; y += CELL_SIZE) {
    context.beginPath();
    context.moveTo(0, y + 0.5);
    context.lineTo(CANVAS_WIDTH, y + 0.5);
    context.stroke();
  }
}

function clearBoardCell(
  context: CanvasRenderingContext2D,
  row: number,
  col: number,
): void {
  context.clearRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE, CELL_SIZE);
}

function drawBoardCell(
  context: CanvasRenderingContext2D,
  row: number,
  col: number,
  color: string,
): void {
  context.fillStyle = color;
  context.fillRect(
    col * CELL_SIZE + CELL_INSET,
    row * CELL_SIZE + CELL_INSET,
    CELL_SIZE - CELL_INSET * 2,
    CELL_SIZE - CELL_INSET * 2,
  );
}

export function BoardCanvas({ cells, boardPatch, occupiedCount }: BoardCanvasProps) {
  const gridCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cellsCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const initializedRef = useRef(false);
  const dprRef = useRef(0);
  const occupiedPercent = ((occupiedCount / TOTAL_SQUARES) * 100).toFixed(1);

  useEffect(() => {
    const gridCanvas = gridCanvasRef.current;
    const cellsCanvas = cellsCanvasRef.current;
    if (!gridCanvas || !cellsCanvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const needsResize =
      dprRef.current !== dpr ||
      gridCanvas.width !== CANVAS_WIDTH * dpr ||
      gridCanvas.height !== CANVAS_HEIGHT * dpr;

    const gridContext = needsResize ? configureCanvas(gridCanvas, dpr) : gridCanvas.getContext("2d");
    const cellsContext = needsResize ? configureCanvas(cellsCanvas, dpr) : cellsCanvas.getContext("2d");
    if (!gridContext || !cellsContext) {
      return;
    }

    if (needsResize) {
      dprRef.current = dpr;
      drawGrid(gridContext);
      initializedRef.current = false;
    }

    // Full sync repaints only the dynamic layer; later turns patch changed squares.
    if (!initializedRef.current || boardPatch.fullSync) {
      cellsContext.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      for (const cell of cells ?? []) {
        drawBoardCell(
          cellsContext,
          cell.position.row,
          cell.position.col,
          cell.teamColor,
        );
      }
      initializedRef.current = true;
      return;
    }

    for (const change of boardPatch.changes) {
      clearBoardCell(cellsContext, change.row, change.col);
      if (change.color) {
        drawBoardCell(cellsContext, change.row, change.col, change.color);
      }
    }
  }, [boardPatch, cells]);

  return (
    <div className="board-frame">
      <div className="board-frame__meta">
        <span>100 x 200 board</span>
        <span>{occupiedCount.toLocaleString()} occupied ({occupiedPercent}%)</span>
        <span>Canvas render</span>
      </div>
      <div className="board-canvas-stack">
        <canvas
          ref={gridCanvasRef}
          className="board-canvas board-canvas--grid"
          style={{ width: "100%", height: "auto" }}
        />
        <canvas
          ref={cellsCanvasRef}
          className="board-canvas board-canvas--cells"
          style={{ width: "100%", height: "auto" }}
        />
      </div>
    </div>
  );
}
