# Battle of Cells

A local, two-player, turn-based cell simulation. Each player writes a small
TypeScript-style `decide(context)` function that controls how their team's
cells behave. Validate your algorithm, press Play, and watch the simulation
run on a 100x200 board.

This is a fully local MVP: no backend, no accounts, no online multiplayer.

## Install & Run

```bash
npm install
npm run dev
```

Then open the printed local URL (default `http://localhost:5173`) in your
browser.

To build a production bundle:

```bash
npm run build
npm run preview
```

## Game Flow

1. **Configuration screen** — both players enter a team name, pick a color
   from the predefined palette, and write their `decide` function. Each
   player must click **Validate Algorithm** and get a success result.
2. Once both team names are unique, non-empty, and both algorithms are
   valid, the **Play** button becomes enabled.
3. **Simulation screen** — the match is locked: code, names, colors, and
   rules can no longer be changed. Use **Play/Pause** to run automatic
   turns, or **Step Turn** to advance one turn at a time. Living cells,
   total health per team, and any runtime errors are shown live.
4. **Final screen** — shows the winner (or draw), final stats for both
   teams, the final turn, and the cause of termination. Click **New Match**
   to return to configuration.

## Board Rules

- Fixed board: 100 rows x 200 columns. Never changes size.
- No obstacles, food, or resources — only cells.
- At most one cell per square.
- Squares outside the board are invalid for movement, eating, or
  reproduction.

## Cells

Each cell has a team name, team color, position, health (0–100), team ID,
alive/dead status, and turn of creation. A cell with 0 health is dead and is
immediately removed from the board.

Each living cell performs exactly **one action per turn**, decided by its
team's `decide` function.

## Actions & Return Codes

### Directions

| Direction | Code |
|---|---|
| North | `n` |
| South | `s` |
| East | `e` |
| West | `w` |
| Northeast | `ne` |
| Northwest | `nw` |
| Southeast | `se` |
| Southwest | `sw` |

> Note: the original requirements document used Spanish-influenced codes
> (`o` for west, `no` for northwest, `so` for southwest). This implementation
> normalizes those to the English-friendly `w`, `nw`, and `sw` used
> consistently throughout the code and UI.

### Move — `"m" + direction`

`mn`, `ms`, `me`, `mw`, `mne`, `mnw`, `mse`, `msw`

- Moves one square in the given direction.
- Must target an empty, on-board square, or the action is canceled and the
  turn is consumed.
- Moving toward an enemy does **not** attack it.

### Eat — `"a" + direction`

`an`, `as`, `ae`, `aw`, `ane`, `anw`, `ase`, `asw`

- Can only target an **enemy** cell one square away.
- Deals 5 damage. Does not heal the attacker or grant points.
- If there's no enemy in that direction (empty, allied, or outside), the
  action is canceled and the turn is consumed.
- If the target's health reaches 0, it dies and is removed immediately.

### Reproduce — `"r" + direction`

`rn`, `rs`, `re`, `rw`, `rne`, `rnw`, `rse`, `rsw`

- Target square must be empty and on the board.
- The original cell's health is split: if even, both halves are equal; if
  odd, the original keeps the extra point (e.g. 51 → 26 original / 25 new).
- The new cell joins the same team and does **not** act on the turn it's
  created — it can act starting next turn.

### Rest — `"d"`

- Recovers 3 health, capped at 100.
- No effect (but still consumes the turn) if already at 100 health.

## Algorithm Format

Your algorithm must be a single function:

```ts
function decide(context) {
  if (context.neighbors.e === "enemy") {
    return "ae";
  }

  if (context.neighbors.n === "empty") {
    return "mn";
  }

  return "d";
}
```

### `context` object

| Field | Description |
|---|---|
| `health` | Current cell's health (0–100) |
| `position` | `{ row, col }` of the current cell |
| `teamTotalHealth` | Sum of health across all living cells on your team |
| `currentTurn` | The current global turn number |
| `boardSize` | `{ rows: 100, cols: 200 }` |
| `neighbors` | Object with keys `n, s, e, w, ne, nw, se, sw`, each `"empty"`, `"allied"`, `"enemy"`, or `"outside"` |
| `nearbyAllies` | `true` if any neighboring square contains an allied cell |
| `nearbyEnemies` | `true` if any neighboring square contains an enemy cell |

### Allowed language subset

- `function decide(context) { ... }`
- `const` / `let` variable declarations
- `if` / `else if` / `else` (with or without braces for single statements)
- Comparisons: `===`, `!==`, `==`, `!=`, `<`, `<=`, `>`, `>=`
- Boolean logic: `&&`, `||`, `!`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Member access on `context` (e.g. `context.neighbors.e`)
- `return` statements with **literal string** action codes only

### Not allowed

- `for`, `while`, `do...while` loops
- `import` / `require`
- `eval`, `Function` constructor, `new`
- Function calls of any kind
- Dynamically computed return values — every `return` must be a literal
  string action code
- File access, network access, or any browser APIs

## Validation

Click **Validate Algorithm** before pressing Play. The validator checks:

- The code parses within the allowed subset (no loops, no eval, etc.)
- Every code path returns a literal action code
- All literal returns are valid action codes
- The function runs without throwing on several test contexts
- The function completes within the 1-second safety timeout

Strategy quality is **not** validated — a function can be "bad" at winning
and still be considered valid.

## Turn System & Execution Order

- The global turn starts at 1. Default turn limit: 5000 turns.
- Cells act one at a time; actions apply immediately to the board.
- Execution order each turn: cells alive at the start of the turn, sorted by
  creation turn, then start-of-turn row, then start-of-turn column, then an
  internal tiebreaker ID.
- If a cell dies before its turn arrives, it does not act.
- Newborn cells (from reproduction) skip the turn they were created on.

## Victory Conditions

- **Elimination**: if one team has zero living cells and the other has at
  least one, the team with living cells wins.
- **Draw**: if both teams reach zero living cells in the same turn.
- **Turn limit**: turn 5000 is executed in full, then:
  1. More living cells wins.
  2. If tied, higher total health wins.
  3. If still tied, it's a draw.

## Example Algorithms

**Aggressive** — attacks any adjacent enemy, otherwise moves toward open
space:

```ts
function decide(context) {
  if (context.neighbors.n === "enemy") return "an";
  if (context.neighbors.s === "enemy") return "as";
  if (context.neighbors.e === "enemy") return "ae";
  if (context.neighbors.w === "enemy") return "aw";
  if (context.neighbors.ne === "enemy") return "ane";
  if (context.neighbors.nw === "enemy") return "anw";
  if (context.neighbors.se === "enemy") return "ase";
  if (context.neighbors.sw === "enemy") return "asw";

  if (context.neighbors.e === "empty") return "me";
  if (context.neighbors.n === "empty") return "mn";

  return "d";
}
```

**Balanced** — attacks when possible, rests when low on health, otherwise
reproduces or expands:

```ts
function decide(context) {
  if (context.neighbors.e === "enemy") return "ae";
  if (context.neighbors.n === "enemy") return "an";

  if (context.health < 70) return "d";

  if (context.health > 60 && context.neighbors.s === "empty") return "rs";

  if (context.neighbors.e === "empty") return "me";

  return "d";
}
```

## Project Structure

```
src/
  main.tsx
  App.tsx
  game/
    types.ts          # Core type definitions
    constants.ts       # Board size, health limits, colors, etc.
    directions.ts      # Direction deltas and normalization
    actions.ts          # Action code categorization helpers
    interpreter.ts      # Restricted-subset tokenizer/parser/evaluator
    validation.ts        # Algorithm validation pipeline
    engine.ts             # Turn execution, occupancy grid, action resolution
    victory.ts             # End-condition and winner evaluation
    initialState.ts        # Example/template algorithms
  components/
    ConfigurationScreen.tsx
    PlayerConfigPanel.tsx
    CodeEditor.tsx
    SimulationScreen.tsx
    BoardCanvas.tsx
    StatsPanel.tsx
    ErrorPanel.tsx
    FinalScreen.tsx
  styles/
    global.css
```

## Implementation Notes

- The 100x200 board is rendered with a single `<canvas>` element — no
  per-cell DOM/React components.
- The simulation engine maintains an occupancy grid (flat `Int32Array`) for
  O(1) position lookups, separate from React state.
- User algorithms are never passed to `eval` or `new Function`. Instead, a
  small hand-written interpreter parses and executes the restricted
  language subset directly.
- React state updates are batched once per executed turn, not once per cell
  action.
- Errors are aggregated by team and message (with a count) rather than
  logged without bound.
