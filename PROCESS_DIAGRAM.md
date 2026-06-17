# Battle of Cells — Full Process Flow Diagram

## High-Level Architecture

```mermaid
graph TB
    subgraph Entry["Entry Point"]
        HTML[index.html] --> MTX[src/main.tsx]
        MTX --> App[src/App.tsx]
        App --> CSS[src/styles/global.css]
    end

    subgraph Screens["Screen Router"]
        App --> CS[ConfigurationScreen]
        App --> SS[SimulationScreen]
        App --> FS[FinalScreen]
    end

    subgraph Config["Player Configuration"]
        CS --> PCP1[PlayerConfigPanel — P1]
        CS --> PCP2[PlayerConfigPanel — P2]
        PCP1 --> CE1[CodeEditor]
        PCP2 --> CE2[CodeEditor]
        PCP1 --> AD[AlgorithmDictionary]
        PCP2 --> AD
        AD --> AT[algorithmTemplates.ts]
    end

    subgraph Validation["Algorithm Validation"]
        PCP1 --> HV[handleValidate]
        HV --> VA[validation.ts]
        VA --> AW[algorithmWorker.ts — Web Worker]
        VA --> TS[TypeScript Compiler API]
    end

    subgraph Engine["Simulation Engine"]
        SS --> ENG[engine.ts]
        ENG --> IST[initialState.ts]
        ENG --> ACT[actions.ts]
        ENG --> DIR[directions.ts]
        ENG --> VIC[victory.ts]
        ENG --> CON[constants.ts]
    end

    subgraph Render["Canvas Rendering"]
        SS --> BC[BoardCanvas — 2 layered canvases]
        SS --> SP[StatsPanel]
        SS --> EP[ErrorPanel]
    end
```

## Complete Process Flow — From Start to Finish

```mermaid
flowchart TD
    START([App Startup]) --> LOAD[Load stored config from localStorage]
    LOAD --> |No stored data| DEFAULTS[Use TEAM_DEFAULTS]
    LOAD --> |Has stored data| RESTORE[Restore saved player drafts]
    DEFAULTS --> CONFIG_SCREEN
    RESTORE --> CONFIG_SCREEN

    CONFIG_SCREEN[Configuration Screen] --> P1_SET[Player 1: Set Team Name, Color, Algorithm]
    CONFIG_SCREEN --> P2_SET[Player 2: Set Team Name, Color, Algorithm]

    P1_SET --> VALIDATE_P1{Validate Algorithm?}
    P2_SET --> VALIDATE_P2{Validate Algorithm?}

    VALIDATE_P1 -->|Click Validate| STRUCT_VALID
    VALIDATE_P2 -->|Click Validate| STRUCT_VALID

    subgraph VALIDATION["Validation Pipeline"]
        STRUCT_VALID[normalizeAlgorithmSource] --> PARSE[Parse TypeScript AST]
        PARSE --> CHECK_FUNC{Exactly 1 "decide" function\nwith 1 parameter?}
        CHECK_FUNC -->|No| FAIL_STRUCT[Reject: structural error]
        CHECK_FUNC -->|Yes| WALK[Walk AST — reject dangerous constructs]
        WALK --> REJECT{Loops / Imports / Nested functions /\nFunction calls / Classes / Await / Try-catch?}
        REJECT -->|Yes| FAIL_STRUCT
        REJECT -->|No| CHECK_RETURNS[Validate return statements\nare literal ActionCodes]
        CHECK_RETURNS -->|Invalid code| FAIL_STRUCT
        CHECK_RETURNS -->|Valid| WORKER_PROBE[Run probe in Web Worker\n1-second timeout]
        WORKER_PROBE -->|Throws / Timeout| FAIL_WORKER[Reject: runtime error]
        WORKER_PROBE -->|Returns valid action| PASS[Validation PASSED]
    end

    FAIL_STRUCT --> SHOW_ERR[Show validation errors in UI]
    FAIL_WORKER --> SHOW_ERR
    PASS --> ENABLE_START[Enable "Play Match" button]

    ENABLE_START --> START_MATCH{Click Play Match}

    START_MATCH --> CAN_START{Team names unique\n& non-empty\n& both valid?}
    CAN_START -->|No| CONFIG_SCREEN
    CAN_START -->|Yes| BUILD_ENGINE

    subgraph ENGINE_SETUP["Engine Initialization"]
        BUILD_ENGINE[createAlgorithmRunner × 2] --> INIT_STATE[createInitialState]
        INIT_STATE --> OCC[Int32Array 20000 occupancy grid — all -1]
        OCC --> SPAWN[Spawn starting cells]
        SPAWN --> P1_SPAWN[P1 cell → left half\ncols 8-40]
        SPAWN --> P2_SPAWN[P2 cell → right half\ncols 140-192]
        P1_SPAWN --> MAPS[Initialize tracking maps:\ncellsById, aliveCells,\ncellsByCreatedTurn]
        P2_SPAWN --> MAPS
    end

    BUILD_ENGINE --> SIM_SCREEN

    SIM_SCREEN[Simulation Screen] --> AUTOPLAY

    subgraph GAME_LOOP["Game Loop — Per Turn"]
        AUTOPLAY[Autoplay: requestAnimationFrame\n30 turns/second] --> STEP[engine.stepTurn]
        STEP --> EXEC[executeTurn]

        EXEC --> ORDER[Build execution order]
        ORDER --> NEWEST_FIRST[Iterate createdTurnGroups\nREVERSE — newest first]
        NEWEST_FIRST --> CELL_LOOP{For each living cell}
        CELL_LOOP --> BUILD_CTX[buildCellContext\nCheck 8 neighbors via occupancy grid]
        BUILD_CTX --> CALL_ALG[call runners[teamId](context)]
        CALL_ALG --> USER_FN["User's decide(context)"]
        USER_FN --> RET[Return ActionCode string]
        RET --> PARSE_ACT[parseActionCode → kind + direction]
        PARSE_ACT --> RESOLVE{Resolve Action}

        RESOLVE -->|Move| MOVE[target inside board + empty → moveCell]
        RESOLVE -->|Eat| EAT[target enemy → removeCell + moveCell]
        RESOLVE -->|Reproduce| REPRO[target empty → reproduceCell]
        RESOLVE -->|Invalid| SKIP[Skip — action not performed]

        MOVE --> NEXT_CELL
        EAT --> NEXT_CELL
        REPRO --> NEXT_CELL
        SKIP --> NEXT_CELL

        NEXT_CELL{More cells?} -->|Yes| CELL_LOOP
        NEXT_CELL -->|No| COMPACT

        COMPACT[compactDirtyTurnGroups\nprune dead cells from buckets] --> VICTORY_CHECK

        VICTORY_CHECK{evaluateVictory}
        VICTORY_CHECK -->|Both teams 0| DRAW_MUTUAL[Mutual Elimination Draw]
        VICTORY_CHECK -->|One team 0| TEAM_WINS[Other team wins]
        VICTORY_CHECK -->|Turn 5000 reached| TURN_LIMIT[Winner by cell count\nor draw if tied]
        VICTORY_CHECK -->|Continue| INCREMENT[Increment currentTurn]
    end

    DRAW_MUTUAL --> RESULT
    TEAM_WINS --> RESULT
    TURN_LIMIT --> RESULT
    INCREMENT --> AUTOPLAY

    subgraph SNAPSHOT["Snapshot & Render"]
        INCREMENT --> SNAPS[toSnapshot]
        SNAPS --> PATCH[flushBoardPatch]
        PATCH --> FIRST{First snapshot?}
        FIRST -->|Yes| FULL[Full cell array — fullSync]
        FIRST -->|No| INCR[Incremental BoardPatch\ncells changed this turn]
        FULL --> REACT_COMMIT[React state update]
        INCR --> REACT_COMMIT
        REACT_COMMIT --> CANVAS[BoardCanvas redraws\nonly changed squares]
        REACT_COMMIT --> STATS[StatsPanel updates\ncell counts]
        REACT_COMMIT --> ERRORS[ErrorPanel shows\nruntime errors if any]
    end

    RESULT([Game Over]) --> FINAL_SCREEN
    subgraph ENDGAME["End of Match"]
        FINAL_SCREEN[Final Screen] --> SHOW_RESULT[Show winner / draw\nliving cells, final turn, cause]
        SHOW_RESULT --> NEW_MATCH{Click New Match}
        NEW_MATCH --> RESET[resetMatch → clear engine, state]
        RESET --> CONFIG_SCREEN

        MANUAL_END[User clicks End Match\nduring simulation] --> ENGINE_END[engine.endMatch\ncreateManualResult]
        ENGINE_END --> RESULT
    end

    style START fill:#22c55e,color:#fff
    style RESULT fill:#ef4444,color:#fff
    style PASS fill:#22c55e,color:#fff
    style FAIL_STRUCT fill:#ef4444,color:#fff
    style FAIL_WORKER fill:#ef4444,color:#fff
    style USER_FN fill:#f59e0b,color:#000
```

## Data Flow Between Engine and React

```mermaid
sequenceDiagram
    participant User as User (Browser)
    participant App as App.tsx
    participant Eng as Engine (mutable state)
    participant Snap as SimulationSnapshot (immutable)
    participant UI as React Components
    participant Canvas as BoardCanvas

    User->>App: Click "Play Match"
    App->>Eng: createEngine(players, runners)
    Eng-->>App: EngineController
    App->>Eng: getSnapshot()
    Eng-->>Snap: { fullSync: true, cells: [...], boardPatch }
    App->>UI: setState(snapshot)
    UI->>Canvas: Paint all cells (fullSync)

    loop Autoplay (30 turns/sec)
        App->>Eng: stepTurn()
        Eng->>Eng: executeTurn — run all cells
        Eng->>Eng: compactDirtyTurnGroups
        Eng->>Eng: evaluateVictory
        Eng-->>Snap: { boardPatch: { changes: [...] } }
        App->>UI: setState(snapshot)
        UI->>Canvas: Paint only changed squares
    end

    App->>Eng: isFinished() → true
    App->>UI: Set screen to "final"
    UI-->>User: Show FinalScreen
```

## Turn Execution Order Detail

```mermaid
flowchart LR
    subgraph Turn_N["Turn N Execution"]
        direction TB
        G3["Group: createdTurn = N\n(newest)"]
        G2["Group: createdTurn = N-1"]
        G1["Group: createdTurn = N-2"]
        G0["Group: createdTurn = 0\n(oldest)"]

        G3 --> |lower ID first| C3A[Cell #5] --> C3B[Cell #8]
        G2 --> |lower ID first| C2A[Cell #2] --> C2B[Cell #4] --> C2C[Cell #7]
        G1 --> |lower ID first| C1A[Cell #1] --> C1B[Cell #3]
        G0 --> |lower ID first| C0A[Cell #0] --> C0B[Cell #6]
    end

    style G3 fill:#22d3ee,color:#000
    style G2 fill:#38bdf8,color:#000
    style G1 fill:#818cf8,color:#fff
    style G0 fill:#a78bfa,color:#fff
```

**Turn order rule:** Newest cells act first. Within the same creation turn, lower internal ID acts first. This ensures newer cells (reproduced or spawned) get priority, making reproduction strategies meaningful.

## Board Rendering Architecture

```mermaid
graph TB
    subgraph CanvasStack["BoardCanvas — 2 Layer Stack"]
        direction TB
        STATIC["Static Canvas (grid lines)\nDrawn once on mount/resize"]
        DYNAMIC["Dynamic Canvas (cells)\nUpdated per snapshot"]
    end

    STATIC --> |pointer-events: none| DYNAMIC

    subgraph FullSync["Full Sync (first render)"]
        FS_CLEAR[Clear entire canvas]
        FS_ITER[Iterate all cells]
        FS_DRAW[drawCell for each]
    end

    subgraph Incremental["Incremental Update (per turn)"]
        INC_PATCH[boardPatch.changes]
        INC_CLEAR[clearCell at old position]
        INC_DRAW[drawCell at new position]
    end

    DYNAMIC --> FullSync
    DYNAMIC --> Incremental

    style STATIC fill:#334155,color:#fff
    style DYNAMIC fill:#475569,color:#fff
```

## Security & Sandboxing Model

```mermaid
flowchart TD
    USER_CODE["User writes decide(context)"] --> NORMALIZE[normalizeAlgorithmSource\nstrip BOM, remove export prefix]
    NORMALIZE --> AST[Parse TypeScript AST]
    AST --> STRUCT_CHECK[Structural Validation]
    STRUCT_CHECK --> |Rejects| BLOCK["Blocked constructs:\n• Loops (for, while, do-while)\n• Imports\n• Nested functions / arrow functions\n• Classes\n• Function calls / new expressions\n• Await / try-catch / switch\n• var declarations\n• Non-literal returns"]
    STRUCT_CHECK --> |Passes| WORKER[Web Worker Probe\n1-second timeout]
    WORKER --> |Fails| REJECT[Rejected]
    WORKER --> |Passes| SANDBOX["Sandboxed Runner:\nnew Function(\n  'decide',\n  shadow window/document/\n  globalThis/self/fetch/\n  Worker/localStorage/Function\n  with undefined\n)"]
    SANDBOX --> EXECUTE["During simulation:\n• Context is cloned + deep-frozen\n• decide(frozenContext) called\n• Return validated against ACTION_CODES"]

    style USER_CODE fill:#f59e0b,color:#000
    style BLOCK fill:#ef4444,color:#fff
    style REJECT fill:#ef4444,color:#fff
    style SANDBOX fill:#22c55e,color:#fff
    style EXECUTE fill:#3b82f6,color:#fff
```
