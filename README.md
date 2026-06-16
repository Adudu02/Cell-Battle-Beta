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
- Turn order is deterministic:
  - cells alive at the start of the turn
  - then by creation turn
  - then by start-of-turn row
  - then by start-of-turn column
  - then by internal id
- Turn limit defaults to `5000`.
- The final turn-limit winner is decided by:
  1. living cells
  2. total health
  3. draw if still tied

## Cell Rules

- Health ranges from `0` to `100`.
- A cell at `0` health dies immediately and is removed.
- `Rest` heals `3`, capped at `100`.
- `Eat` deals `5` damage to one adjacent enemy cell.
- `Reproduce` splits the acting cell's health between parent and child.
- In this implementation the starting health is `60` because the provided `Prompt.txt` did not define an initial value from the missing PDF.

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

### Rest

- `d`

## Example Algorithm

```ts
function decide(context) {
  if (context.neighbors.east === "enemy") {
    return "ae";
  }

  if (context.neighbors.east === "empty") {
    return "me";
  }

  return "d";
}
```

## Safety Model

- Validation rejects loops, imports, dangerous APIs, nested functions, and non-literal action returns.
- A sandboxed validation worker runs a probe execution with a `1` second timeout before the match can start.
- The simulation engine is separate from the React UI.
- The board uses `canvas` instead of rendering `20,000` React nodes.
