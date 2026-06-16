# Simulation Bottleneck Analysis

```mermaid
flowchart TD
    subgraph ENGINE["Engine — executeTurn() per turn"]
        direction TB
        A["listCells()
        └─ iterate all Map values
        └─ filter alive
        └─ sort by id"] --> B["Turn order snapshot
        └─ .map() → N new objects
        └─ .sort() by 4 criteria"]

        B --> C{"For each living cell N"}

        C -->|N times| D["buildCellContext(cell)
        ⚠ HIGH ALLOCATION"]

        D --> D1["8× moveToDirection()
        └─ 8 BoardPosition objects"]
        D1 --> D2["8× isInsideBoard()
        └─ 64 comparisons"]
        D2 --> D3["8× getCellAt()
        ⚠ REDUNDANT isInsideBoard
        └─ boardIndex compute
        └─ Int32Array lookup
        └─ Map.get(id)"]
        D3 --> D4["8-entry neighbors object"]
        D4 --> D5["2× DIRECTION_NAMES.filter()
        └─ nearbyAllies array
        └─ nearbyEnemies array"]
        D5 --> D6["Return CellContext object
        └─ position clone
        └─ boardSize object"]

        D6 --> E["runner(context)
        └─ user algorithm call"]

        E --> F["resolveAction()"]
        F --> G{"Action type"}

        G -->|move| H1["moveCell()
        └─ 2× boardIndex
        └─ 2× occupancy writes
        ⚠ new BoardPosition"]
        G -->|eat| H2["applyDamage()
        └─ stats update
        └─ maybe removeCell"]
        G -->|reproduce| H3["reproduceCell()
        └─ new Cell object
        └─ Map.set + occupancy"]
        G -->|rest| H4["healCell()
        └─ Math.min, stats"]

        C -->|After loop| I["evaluateVictory()
        └─ simple checks"]
        I --> J["currentTurn += 1"]
    end

    subgraph SNAPSHOT["toSnapshot() — per stepTurn()"]
        S1["listCells() AGAIN
        └─ iterate all Map values
        └─ filter alive
        └─ sort by id
        ⚠ DUPLICATE WORK"]
        S1 --> S2["Clone stats
        └─ p1 + p2 spread
        └─ slice errors array"]
        S2 --> S3["Return new SimulationSnapshot"]
    end

    subgraph RENDER["React Render Pipeline"]
        R1["App: setInterval → advanceTurn()
        └─ stepTurn() → toSnapshot()"]
        R1 --> R2["startTransition → setSimulation()"]
        R2 --> R3["SimulationScreen render
        └─ useDeferredValue(cells)"]
        R3 --> R4["StatsPanel render
        └─ two team cards
        └─ < 1ms"]
        R3 --> R5["BoardCanvas
        ⚠ FULL CANVAS REDRAW"]
        R5 --> R6["Clear entire canvas
        └─ Draw ALL grid lines (201+101)
        └─ Draw ALL living cells
        └─ shadowBlur per cell
        ⚠ No incremental update"]
        R3 --> R7["ErrorPanel render"]
    end

    ENGINE --> SNAPSHOT
    SNAPSHOT --> RENDER

    style A fill:#f44336,color:#fff
    style S1 fill:#f44336,color:#fff
    style D fill:#ff9800,color:#fff
    style D3 fill:#ff9800,color:#fff
    style D5 fill:#ff9800,color:#fff
    style R6 fill:#f44336,color:#fff
    style H1 fill:#ff9800,color:#fff
    style H3 fill:#ff9800,color:#fff
```

## Bottleneck Priority (worst first)

| # | Bottleneck | Location | Impact | Why |
|---|-----------|----------|--------|-----|
| **1** | **Redundant double sort** | `listCells()` in `toSnapshot` + `executeTurn` | HIGH | Every turn sorts all alive cells **twice** — once by `id` in `listCells`, then again by 4 criteria in `executeTurn`. The first sort is thrown away. |
| **2** | **Full Map scan per turn** | `listCells()` iterates `cellsById.values()` | HIGH | Iterates **every cell ever created** (dead + alive), filters alive. With 20k+ cells over a match, this grows linearly with total cells, not just alive cells. |
| **3** | **`buildCellContext` object flood** | Engine line 80–120 | HIGH | Creates `N × 8` BoardPosition objects + `N × 2` arrays + `N` CellContext objects per turn. For 10k cells = ~110k allocations/turn. Major GC pressure. |
| **4** | **Canvas full redraw every frame** | `BoardCanvas.tsx` | MEDIUM | Redraws grid lines (302 lines) and every cell every frame. Grid lines are static — should be drawn once to an offscreen canvas. `shadowBlur` per cell also hurts. |
| **5** | **Redundant `isInsideBoard` in `getCellAt`** | `engine.ts:72` | MEDIUM | Callers already check bounds, but `getCellAt` checks again. 8× per cell × N cells = thousands of redundant comparisons. |
| **6** | **`setInterval` + `startTransition` race** | `App.tsx:255` | LOW | `setInterval` queues turns regardless of whether React has finished rendering the previous frame. With `startTransition`/`useDeferredValue`, renders stack up. |

## Fix Recommendations

1. **Combine sorts**: Remove `listCells()` sort, use a single sort in `executeTurn` with all 4 criteria
2. **Maintain an alive-cell list**: Keep a separate array/set of alive cell IDs to avoid scanning dead cells
3. **Cache context allocations**: Reuse a single `CellContext` object and mutate it instead of allocating
4. **Offscreen canvas for grid**: Draw the grid once, only redraw cells on top
5. **Remove `isInsideBoard` from `getCellAt`**: Make it a raw lookup, let callers validate
6. **Batch turns**: Execute multiple turns before triggering a React update, emit snapshots at animation-frame rate instead of per-turn
