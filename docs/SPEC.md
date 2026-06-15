# Battle of Cells Specification

## Product Summary

Battle of Cells is a local two-player web simulation. Each player controls a team of cells through a restricted Python-like function. Every living cell executes at most one action per turn according to that function.

This specification replaces all previous trail-based or main-cell gameplay.

## Removed Rules

The following obsolete rules are removed and must not exist in code, tests, or docs:

* Main-cell trail gameplay.
* Static trail occupation mechanics.
* Age damage from age 70 onward.
* Automatic death at age 90.

## MVP Scope

Included:

* Local web app.
* Two local players.
* Fixed 100 x 200 board.
* One initial random cell per player.
* Four actions: move, eat, reproduce, rest.
* Turn execution ordering based on age and start-of-turn snapshot.
* Safe Python-like strategy validation.
* Configuration screen.
* Simulation screen.
* Final results screen.

Excluded:

* Online multiplayer.
* Authentication.
* Database.
* Obstacles.
* External food or resources.
* Full Python execution.
* Hidden gameplay mechanics outside this document.

## Match Flow

1. Show configuration screen.
2. Player 1 enters name and color.
3. Player 1 writes function.
4. Player 1 validates function.
5. Repeat for Player 2.
6. Start is blocked until both players are valid.
7. On match start, validate both functions again.
8. Create the board and one initial random cell per player.
9. Set turn to 1 and lock configuration.
10. Show simulation screen.
11. User presses Play to advance automatically, uses Step for single turns, or ends the match early.
12. End on elimination, double elimination, manual stop, or turn limit.
13. Show final result screen.

## Board Rules

* Board size is fixed at 100 rows x 200 columns.
* Rows and columns are zero-based internally.
* No square outside the board is valid.
* No obstacles exist.
* No resources exist.
* No more than one cell can occupy the same square.
* Initial placement must avoid occupied squares.

## Cell Model

Each cell stores at least:

* team/player reference,
* position,
* health,
* age,
* alive/dead status,
* creation turn,
* last recorded action,
* last action result.

Visible unique IDs are not business rules. Internal IDs may exist only for implementation.

## Health Rules

* Health range is 0 to 100.
* Initial cells start with 100 health.
* If health reaches 0, the cell dies.
* Dead cells are removed immediately from the board.
* Health cannot go below 0.
* Rest restores 3 health, capped at 100.
* Eat deals 5 damage to one adjacent enemy.
* Movement has no health cost.
* Eating does not heal the attacker.

## Age Rules

* Initial cells start at age 1.
* Newborn cells start at age 1.
* Surviving cells age by 1 at the end of each completed turn.
* Age does not reduce health.
* Age does not directly kill cells.
* Age is used only for display, reproduction eligibility, and execution ordering.

## Valid Actions

Move:

* `mn`, `ms`, `me`, `mw`, `mne`, `mnw`, `mse`, `msw`

Eat:

* `an`, `as`, `ae`, `aw`, `ane`, `anw`, `ase`, `asw`

Reproduce:

* `rn`, `rs`, `re`, `rw`, `rne`, `rnw`, `rse`, `rsw`

Rest:

* `d`

Any other return value is invalid.

## Movement Rules

* Cells interact only with the 8 neighboring squares.
* A move changes position by one square.
* Movement succeeds only when the target square is inside the board and empty.
* Movement into allied or enemy occupied squares is canceled.
* Movement never damages a target.

## Eat Rules

* Eat is the attack action.
* The action code prefix is `a`.
* Eat targets exactly one adjacent square.
* Only enemy cells can be attacked.
* If the target is outside, empty, or allied, the action is canceled.
* A valid attack deals 5 damage.
* If target health reaches 0, remove the target immediately.

## Reproduction Rules

Reproduction is allowed only if:

* health is at least 50 before splitting,
* age is less than 55,
* direction is valid,
* destination is inside the board,
* destination is empty.

If valid:

* parent health is split in half,
* even values split evenly,
* odd values keep the extra point on the parent,
* total health is preserved,
* newborn belongs to the same team,
* newborn starts at age 1,
* newborn acts starting next turn only.

If invalid:

* the action is canceled,
* the cell loses its action for that turn.

## Rest Rules

* Rest consumes the action.
* Rest restores 3 health.
* Health cannot exceed 100.

## Turn Execution

* Global turn starts at 1.
* At the start of each turn, capture a snapshot of all living cells.
* Sort cells by:
  1. lower age,
  2. lower creation turn,
  3. lower row in the snapshot,
  4. lower column in the snapshot.
* Resolve actions one by one using the current board state at execution time.
* Newborn cells do not act on the same turn they are created.
* If a cell dies before its turn arrives, it is skipped.
* After all eligible cells act, age living survivors by 1.
* Then evaluate end conditions.
* If the match continues, increment the turn number.

## Function Input

Each strategy receives:

Cell data:

* `health`
* `age`
* `row`
* `col`

Environment data:

* `turn`
* `rows`
* `cols`
* `team_health`
* `n`, `s`, `e`, `w`, `ne`, `nw`, `se`, `sw`
* `has_adjacent_ally`
* `has_adjacent_enemy`
* `enemy_count`
* `occupied_count`
* `empty_count`
* `first_enemy_direction`
* `north_occupied_count`
* `south_occupied_count`
* `east_occupied_count`
* `west_occupied_count`

Neighbor values are one of:

* `empty`
* `allied`
* `enemy`
* `outside`

## Function Safety

Allowed:

* `if` / `else`
* literal string returns
* boolean logic
* reading allowed lookup keys

Blocked:

* loops,
* imports,
* file or network access,
* `eval`,
* `exec`,
* direct game-state mutation,
* arbitrary attribute or object access outside the allowed subset.

## Function Validation

Validation must check:

* exact function header,
* allowed syntax only,
* valid literal action codes,
* no loops or imports,
* no unsafe access,
* execution completes within 1 second in a sample context,
* invalid code prevents match start.

If a strategy fails at runtime during simulation:

* only that cell loses its action,
* the match continues,
* the error is logged.

## End Conditions

Default turn limit is 5000.

The simulation ends when:

* only one team remains alive,
* both teams have no living cells,
* the user manually stops the match and scores the current board immediately,
* the turn limit is reached after fully executing the last allowed turn.

Winner resolution:

* one surviving team: that team wins,
* both teams dead: draw,
* turn limit:
  1. more living cells wins,
  2. if tied, greater total health wins,
  3. if still tied, draw.
* manual stop:
  1. more living cells wins,
  2. if tied, greater total health wins,
  3. if still tied, draw.

## Required Screens

### Configuration

Must support:

* player name input,
* player color input,
* code entry,
* code validation,
* validation error display,
* imported strategy template guidance,
* start disabled until both players are valid.

### Simulation

Must show:

* board,
* turn,
* turn limit,
* play/pause,
* manual end button,
* error panel,
* per-team stats,
* selected cell details.

Editing is blocked once the match starts.

### Final Result

Must show:

* winner or draw,
* team names and colors,
* living cell count,
* total health,
* final turn,
* termination reason,
* option to return to configuration.
