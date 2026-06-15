# docs/DECISIONS.md

# Battle of Cells - Project Decisions

## Current Requirement Source

The project follows the updated Battle of Cells business requirements and flow diagram.

The previous requirement about one main cell leaving static trails is obsolete and must not be implemented.

## Core Game Type

Battle of Cells is a local turn-based web simulation for two local players.

Each player controls a team/species through a Python-like function.

Each living cell executes one action per turn according to its team function.

## MVP Scope

Included:

* Local web app.
* Two local players.
* Fixed 100x200 board.
* One initial cell per player.
* Health.
* Age.
* Movement.
* Eating.
* Reproduction.
* Resting.
* Turn system.
* Execution order based on age, creation turn, and start-of-turn position.
* Python-like user function.
* Function validation.
* Configuration screen.
* Simulation screen.
* Final result screen.
* TDD tests.
* SDD documentation.

Excluded:

* Online multiplayer.
* Authentication.
* Real database.
* Obstacles.
* External food/resources.
* Bots.
* Special abilities.
* Energy system.
* Ranking.
* Matchmaking.
* Full unrestricted Python execution.
* Previous main-cell trail mechanic.

## Important Removed Rule

The original document included age damage and old-age death.

That rule is removed.

Do not implement:

* health loss from age 70 onward,
* automatic death at age 90.

## Correct Age Rule

Age is used only for:

* display,
* reproduction condition,
* execution priority.

Age still increases by 1 at the end of each turn for surviving cells.

Age does not damage cells.

Age does not directly kill cells.

## Execution Priority

Cells act one by one.

There are no simultaneous actions.

Priority order:

1. Lower age first.
2. Lower creation turn first.
3. Lower row at start-of-turn snapshot.
4. Lower column at start-of-turn snapshot.

Visible unique cell IDs are not business rules.

Internal IDs may exist only as technical implementation details.

## Match Lock

After Play is pressed:

* player names cannot be edited,
* colors cannot be edited,
* code cannot be edited,
* rules cannot be edited,
* initial conditions cannot be edited.

Pause does not unlock editing.

## Function Safety

The user function is Python-like, but not full Python in the MVP.

Validation must reject unsafe or unsupported features.

The function can only return valid literal action strings.

The function cannot mutate game state directly.
