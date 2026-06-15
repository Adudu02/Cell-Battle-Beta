# Optimization Notes

This document records the optimization work currently merged through the `optimization` branch.

## Goals

The optimization work focused on keeping the game rules unchanged while improving high-population playback and making future bottlenecks visible.

The most important rule preserved is turn order:

```text
age -> creation turn -> row -> column
```

Cells still act one by one in that priority order. The branch does not batch cell actions simultaneously, because that would change conflict behavior when multiple cells target the same square.

## Docker Cleanup

The Docker setup was returned to the main TypeScript runtime and no longer installs Rust or WASM tooling.

Changes:

* `Dockerfile` now uses Node 22 only.
* `docker compose up --build` starts the app directly with `npm ci && npm run dev`.
* `docker-compose.yml` keeps `node_modules` in a Docker-managed volume.
* `.dockerignore` excludes `.git`, `node_modules`, build output, and the removed Rust engine folder.

## Playback And Payload Optimization

High-speed playback now requests more turns per backend tick and renders fewer browser snapshots.

Changes:

* 5x speed requests `25` sequential turns per tick.
* The frontend interval for 5x speed uses `120ms`.
* Backend turn execution remains sequential, so match rules are unchanged.
* The browser receives fewer large state updates during fast playback.

## Log Retention

The engine now keeps only the latest `250` logs in match state.

Reason:

* Long matches previously carried the full log history forever.
* Every `/api/game/tick` serialized and sent those logs back to the frontend.
* Capping logs reduces memory growth and response payload growth.

## Tick Profiling

The `/api/game/tick` response now includes a `profile` object.

Tracked fields:

* requested and executed steps,
* living cells before and after,
* logs before and after,
* cell clone time,
* turn-order sort time,
* board clone time,
* setup time,
* action loop time,
* cleanup time,
* result evaluation time,
* serialization time,
* total time,
* payload size in bytes.

The frontend displays the most important live values in the simulation control bar:

```text
LAST TICK
BATCH
CELLS
PAYLOAD
```

## Stress Profiler Improvements

The stress profiler accepts positional arguments:

```bash
npm run profile:stress -- 1000 10
```

The report now separates:

* `cellCloneMs`,
* `orderSortMs`,
* `boardCloneMs`,
* `setupMs`,
* `actionLoopMs`.

This made it clear that sorting by age is not currently the main bottleneck.

## Engine Hot Path Optimizations

The engine keeps the same behavior, but reduces repeated work inside each turn.

Changes:

* Reuses the strategy `cell` context object for every cell in a turn.
* Reuses the strategy `environment` context object for every cell in a turn.
* Reuses the action state object passed to `resolveAction`.
* Uses a small numeric array for team health instead of a `Map`.
* Calls the compiled strategy executor directly when available.
* Uses explicit cell cloning instead of object spread.
* Avoids creating target position objects in `resolveAction` unless the action actually moves or reproduces.
* Precomputes neighbor direction offsets and direction-group flags.

## Latest Stress Result

Command:

```bash
npm run profile:stress -- 1000 10
```

Latest measured result:

```text
Average total ms/turn: 10.392
Average simulation ms/turn: 9.895
Average action loop ms/turn: 7.560
Average setup ms/turn: 1.670
Average cell clone ms/turn: 1.006
Average order sort ms/turn: 0.587
Average board clone ms/turn: 0.073
```

## Interpretation

The current data says:

* age sorting is not the biggest issue right now,
* board cloning is very small,
* action execution and environment construction remain the main cost,
* payload size and rendering still matter during live playback, but backend action execution is the primary stress-test bottleneck.

## Next Optimization Targets

Good next targets:

* make strategy execution faster,
* reduce per-cell neighbor/environment work further,
* consider a compact internal cell representation,
* consider sending frontend deltas or sampled snapshots instead of full state every tick.

Riskier targets:

* batching all cell decisions at once,
* removing age priority,
* changing conflict resolution rules.

Those would change gameplay behavior and should be treated as design changes, not simple optimizations.
