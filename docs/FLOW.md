# docs/FLOW.md

# Battle of Cells - Flow

## 1. Configuration Flow

1. Start.
2. Show configuration screen.
3. Player 1 enters name and color.
4. Player 1 writes function.
5. Player 1 validates function.
6. If Player 1 function is invalid:

   * show error,
   * allow correction,
   * validate again.
7. Player 2 enters name and color.
8. Player 2 writes function.
9. Player 2 validates function.
10. If Player 2 function is invalid:

* show error,
* allow correction,
* validate again.

11. If both players are valid:

* allow Play.

12. If any player is missing or invalid:

* block Play.

## 2. Match Start Flow

1. User presses Play.
2. Validate both functions again.
3. If any function is invalid:

   * show error,
   * do not start simulation.
4. If both functions are valid:

   * lock match configuration,
   * create 100x200 board,
   * create one random initial cell per player,
   * initialize turn = 1,
   * show board, current turn, and statistics.

## 3. Turn Cycle

For each turn:

1. Check if turn is within the turn limit.
2. If turn limit was already exceeded, end simulation.
3. Take start-of-turn snapshot.
4. Sort living cells by priority:

   * lower age,
   * lower creation turn,
   * lower start row,
   * lower start column.
5. Select next living cell.
6. If the cell is dead, skip it.
7. Collect cell and environment data.
8. Execute the player function.
9. If the returned code is invalid:

   * cancel action,
   * log error,
   * continue.
10. Resolve action:

* move,
* eat,
* reproduce,
* rest.

11. Update board immediately after the action.
12. Continue until all eligible cells from the start-of-turn list have been processed.

## 4. Move Flow

1. Get direction.
2. Check destination.
3. If outside board:

   * cancel action.
4. If occupied:

   * cancel action.
5. If empty:

   * move cell.

Movement does not damage enemies.

## 5. Eat Flow

1. Get direction.
2. Check target square.
3. If outside board:

   * cancel action.
4. If no enemy cell:

   * cancel action.
5. If enemy cell exists:

   * apply 5 damage.
6. If enemy health reaches 0:

   * remove enemy immediately.

## 6. Reproduce Flow

1. Check cell has at least 50 health.
2. Check cell is younger than 55.
3. Check destination is inside board.
4. Check destination is empty.
5. If any condition fails:

   * cancel action.
6. If valid:

   * split health,
   * original keeps extra point if health is odd,
   * create newborn allied cell,
   * newborn age = 1,
   * newborn does not act this turn.

## 7. Rest Flow

1. Recover 3 health.
2. If health exceeds 100:

   * set health to 100.

## 8. End of Turn Flow

1. Increase age of surviving living cells by 1.
2. Do not apply aging damage.
3. Do not remove cells because of old age.
4. Evaluate end conditions:

   * only one team alive,
   * both teams dead,
   * turn limit reached.
5. If simulation continues:

   * turn = turn + 1.

## 9. End Conditions

The simulation ends when:

* only one team remains alive,
* both teams have no living cells,
* the user presses End Match,
* the turn limit is reached.

If only one team remains alive:

* that team wins.

If both teams have no living cells:

* draw.

If turn limit is reached:

1. compare living cells,
2. if tied, compare total health,
3. if still tied, draw.

If the user presses End Match:

1. compare living cells,
2. if tied, compare total health,
3. if still tied, draw.

## 10. Final Screen

Show:

* winner or draw,
* player/team names,
* team colors,
* living cells per team,
* total health per team,
* final turn,
* cause of termination,
* option to return to configuration.
