# Cell Battle MVP

Local two-player browser simulation where each team provides a restricted Python-like strategy and the match resolves on a 100 x 200 board.

## Local Commands

Use the repo-local helper scripts if this machine does not have Node on `PATH`:

1. Install dependencies:
   `run-install.cmd`
2. Start the dev server:
   `run-dev.cmd`
3. Run lint, tests, and production build:
   `run-checks.cmd`

The dev server runs on [http://localhost:3000](http://localhost:3000).

## Notes

- The project uses a local portable Node runtime under `.tools/node-v26.3.0-win-x64`.
- Strategies are validated against the MVP-safe subset before a match can start.
- Match configuration locks as soon as the simulation starts.
