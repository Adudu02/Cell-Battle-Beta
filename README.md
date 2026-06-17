# Battle of Cells

`Battle of Cells` is a local browser MVP built with `React + Vite + TypeScript`.

Two players each write a restricted TypeScript-style `decide(context)` function. Every living cell on the board runs that function once per turn to choose an action.

## Install

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

The app runs locally in the browser at the Vite dev URL.

## Build

```bash
pnpm build
```

## Test

```bash
pnpm test
```

## Game Rules

- The board is fixed at `100 x 200`.
- There are two local players only.
- Each team starts with one living cell.
- Each cell can perform exactly one action per turn.
- Cells do not auto-attack when blocked. Combat only happens if the algorithm explicitly returns an `a...` action.
- Autoplay advances on a frame-driven cadence for smoother visual updates.
- Turn order is deterministic:
  - cells alive at the start of the turn
  - then by newest creation turn first
  - then by lower internal id
- Turn limit defaults to `5000`.
- The final turn-limit winner is decided by:
  1. living cells
  2. draw if still tied

## Cell Rules

- Cells no longer track variable health.
- Every living cell is effectively `1 hp`.
- `Eat` instantly eliminates one adjacent enemy cell.
- If `Eat` kills the target, the attacker advances into that square.
- `Reproduce` creates one new allied cell in an empty neighboring square.
- The match can also be ended manually from the simulation screen.

## Valid Action Codes

### Move

- `mn`, `ms`, `me`, `mw`
- `mne`, `mnw`, `mse`, `msw`

### Eat

- `an`, `as`, `ae`, `aw`
- `ane`, `anw`, `ase`, `asw`

### Reproduce

- `rn`, `rs`, `re`, `rw`
- `rne`, `rnw`, `rse`, `rsw`

## Example Algorithm

```ts
function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  if (context.neighbors.east === "empty") {
    return "me";
  }

  return "mn";
}
```

## Mixed Move + Reproduce Strategy

One cell still gets only one action per turn, but a colony can move and reproduce in the same global turn by giving different cells different roles.

Use the `Marching Bloom` template in the UI for that pattern. It alternates breeder lanes and mover lanes, so part of the colony expands while the rest keeps advancing.

## Safety Model

- Validation rejects loops, imports, dangerous APIs, nested functions, and non-literal action returns.
- A sandboxed validation worker runs a probe execution with a `1` second timeout before the match can start.
- The simulation engine is separate from the React UI.
- The board uses `canvas` instead of rendering `20,000` React nodes.
