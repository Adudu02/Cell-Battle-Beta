# Stress Profiling

## Goal

Measure how the known aggressive reproduction strategy behaves before changing the engine design again.

## Strategy Under Test

The profiling command uses the exact aggressive strategy currently identified as the target workload. Both teams run the same code so the simulation reaches the high-population case quickly.

## Command

```bash
npm run profile:stress -- 1000 10
```

The profiler also supports flags when the shell forwards them correctly:

```bash
npm run profile:stress -- --turns 1000 --top 10
```

## Output

The report includes:

* requested turns,
* executed turns,
* whether the match finished naturally,
* final turn marker,
* max population reached,
* final population,
* average cell clone milliseconds per turn,
* average turn-order sort milliseconds per turn,
* average board clone milliseconds per turn,
* average setup milliseconds per turn,
* average action-loop milliseconds per turn,
* average simulation milliseconds per turn,
* average serialization milliseconds per turn,
* slowest turns with cell growth context.

## How To Read It

If `simulation ms/turn` dominates, the engine loop or strategy interpreter is the main issue.

If `serialization ms/turn` grows sharply with population, frontend payload size is part of the slowdown even before rendering.

If both rise together with population, the next step should focus on algorithmic and data-layout redesign rather than another language switch by itself.

## Current Results

This branch has had three optimization passes so far:

1. playback, logging, Docker, and profiling cleanup,
2. lower-allocation engine hot path,
3. detailed setup profiling and neighbor-scan cleanup.

The current branch preserves all game rules, including age-based turn priority.

### 1000-turn run after current pass

* max population: `19364`
* average cell clone: `1.006ms`
* average order sort: `0.587ms`
* average board clone: `0.073ms`
* average setup: `1.670ms`
* average action loop: `7.560ms`
* average cleanup: `0.314ms`
* average result: `0.350ms`
* average simulation: `9.895ms`
* average serialization: `0.497ms`
* average total: `10.392ms`

## Interpretation

The action loop is still the dominant cost, but it is materially smaller than before. Sorting by age is visible but not dominant. Serialization remains comparatively small in the backend stress profile.

If another optimization round is needed, the next meaningful targets should be:

* faster strategy execution,
* lower per-cell neighbor/environment work,
* compact internal cell storage,
* frontend deltas or sampled snapshots for live playback.
