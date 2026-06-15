# Battle of Cells Architecture

## Guiding Principles

* Documentation is the source of truth.
* Game rules live outside React.
* Backend engine logic must be testable without HTTP.
* Frontend focuses on presentation and user workflow.
* The active match lives in backend memory for the MVP.

## High-Level Design

```txt
frontend (React + Vite)
  -> validates code through backend API
  -> starts and controls the active match
  -> renders configuration, simulation, and final result screens

backend (Express + pure TypeScript engine)
  -> validates the Python-like strategy subset
  -> stores one active match in memory
  -> advances the simulation one turn at a time
  -> returns serializable state to the frontend
```

## Repository Layout

```txt
backend/
  src/
    game/
      actions.ts
      board.ts
      constants.ts
      directions.ts
      engine.ts
      ordering.ts
      scoring.ts
      types.ts
      validation.ts
    routes/
      game.routes.ts
      validation.routes.ts
    server.ts
  tests/
    api/
    game/

frontend/
  src/
    api/
    components/
    domain/
    test/
    types/
    App.tsx
    main.tsx
    index.css
  index.html

docs/
  SPEC.md
  ARCHITECTURE.md
  API.md
  TEST_PLAN.md
  ROADMAP.md
  FLOW.md
  DECISIONS.md
```

## Backend Responsibilities

### Engine Modules

* `constants.ts`: board size, health rules, turn limit, action constants.
* `directions.ts`: 8-direction coordinate deltas.
* `types.ts`: shared engine contracts.
* `board.ts`: board occupancy, bounds checks, neighbor inspection, initial placement. The profiling branch uses a dense indexed occupancy array internally instead of string-keyed map lookups.
* `ordering.ts`: deterministic start-of-turn ordering.
* `actions.ts`: action parsing and move/eat/reproduce/rest resolution.
* `validation.ts`: safe parser and interpreter for the Python-like strategy subset.
* `scoring.ts`: team summaries and final result resolution.
* `engine.ts`: match creation and turn advancement orchestration.
* `profile/stressProfile.ts`: repeatable timing and population profiling for the aggressive reproduction stress strategy.

### API Layer

* `validation.routes.ts` exposes strategy validation.
* `game.routes.ts` manages the single active match.
* `server.ts` assembles the Express app and exports it for tests.

## Frontend Responsibilities

The existing frontend is preserved as much as possible:

* configuration UI remains in React,
* board rendering stays client-side,
* selection panels, logs, and final result views remain presentation-focused.

React does not calculate turn order, damage, reproduction, or end conditions. It fetches state from the backend and renders it.

## Profiling Workflow

The profiling branch adds a backend stress-profile command for the known aggressive reproduction strategy. It measures:

* per-turn simulation time,
* per-turn setup, action-loop, cleanup, and result time,
* per-turn serialization time,
* population before and after each turn,
* slowest turns in the run.

This isolates whether slowdown is coming primarily from engine compute, state size growth, or frontend-facing serialization.

The latest optimization pass showed that direct indexed occupancy lookups and ordered-cell iteration reduce engine hot-loop cost more than transport changes did. The branch remains rule-compatible with `main`; only internal data layout and execution flow changed.

## Match Lifecycle

1. User edits player configurations in the frontend.
2. Frontend sends code to `/api/validation/player-function`.
3. Frontend enables confirmation only for valid strategies.
4. Frontend sends both players to `/api/game/start`.
5. Backend validates both strategies again, creates the locked match, and returns a paused initial state.
6. Frontend calls `/api/game/play` and then polls `/api/game/tick` while running.
7. Frontend calls `/api/game/pause` to stop automatic advancement.
8. Frontend calls `/api/game/reset` when returning to configuration.

## Why Rules Stay Outside React

Keeping rules outside React prevents UI state from becoming the source of truth. It also enables:

* deterministic unit tests for rules,
* API integration tests without a browser,
* future reuse of the same engine by other clients,
* easier verification that obsolete gameplay is not leaking back into the project.

## Validation Design

The MVP does not execute unrestricted Python. Instead, it parses a narrow, documented subset and interprets it in TypeScript. This satisfies the business goal of “Python-like” player logic while avoiding arbitrary code execution.

## State Storage

The backend stores one active match in memory. There is no database and no authentication in the MVP. Resetting the server clears the active match.

## Docker

The existing Docker setup remains valid as a dev container. No structural Docker changes are required for this rebuild.
