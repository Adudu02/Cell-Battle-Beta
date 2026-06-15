# Battle of Cells Test Plan

## Strategy

The project follows documentation-first development and TDD.

Order of work:

1. lock rules in docs,
2. encode rules in tests,
3. implement the engine and API,
4. connect the frontend,
5. run regression tests.

## Backend Unit Tests

### Board

* creates a 100 x 200 board,
* rejects outside positions,
* prevents more than one cell per square,
* creates one initial cell per player,
* random placement avoids occupied squares.

### Directions

* supports `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`,
* calculates adjacent coordinates,
* marks outside neighbors correctly.

### Actions

Movement:

* valid move to empty square succeeds,
* move outside board is canceled,
* move to allied cell is canceled,
* move to enemy cell is canceled,
* movement does not damage enemies.

Eat:

* attack deals 5 damage,
* attack to empty square fails,
* attack outside board fails,
* attack to allied cell fails,
* lethal attack removes the enemy immediately.

Reproduction:

* requires health >= 50,
* requires age < 55,
* requires empty in-bounds destination,
* preserves total health,
* parent keeps extra point on odd values,
* newborn starts at age 1,
* newborn does not act in the same turn.

Rest:

* heals 3,
* caps at 100,
* consumes the action.

### Ordering

* younger cells act first,
* then earlier creation turn,
* then lower row,
* then lower column,
* order uses the start-of-turn snapshot,
* dead cells are skipped.

### Age and Turn Flow

* age increases by 1 for surviving cells,
* age does not damage cells,
* age does not kill cells,
* obsolete 70-damage and 90-death rules do not exist,
* turn starts at 1,
* board updates immediately after each action,
* result is evaluated after the full turn.

### Validation

* accepts valid literal action codes,
* rejects invalid return values,
* rejects loops,
* rejects imports,
* rejects `eval` and `exec`,
* rejects unsafe lookups,
* enforces the documented function header,
* accepts the translated legacy helper environment keys,
* runtime strategy failure only cancels the acting cell.

### Profiling

* aggressive stress strategy remains valid,
* stress profile collects turn-by-turn timing metrics,
* stress profile report is readable from the CLI output.

## Backend API Tests

* validate player function,
* reject invalid player function,
* reject invalid match start,
* start match after valid configuration,
* lock match after start,
* pause does not unlock editing,
* tick advances simulation,
* end scores the current board immediately,
* state returns current board and stats,
* reset clears the active match.

## Frontend Tests

* configuration screen renders both players,
* player name and color are editable,
* code can be entered,
* validation errors are shown,
* imported strategy template is available,
* aggressive stress template is available,
* start is disabled until both players are valid,
* simulation screen shows board, turn, stats, and errors,
* simulation screen can end a match early,
* editing is blocked after start,
* board visuals render without hover or selected-cell interaction,
* final screen shows winner or draw and statistics.

## Manual Verification

Before sign-off:

1. run backend tests,
2. run frontend tests,
3. run the stress profile command for the aggressive reproduction strategy,
4. start backend and frontend locally,
5. validate both sample strategies,
6. start a match,
7. play, pause, single-step, and end a match early,
8. confirm final result screen,
9. return to configuration and start again.
