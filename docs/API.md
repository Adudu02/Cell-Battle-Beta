# Battle of Cells API

Base URL: `http://localhost:3000/api`

## Health

### `GET /health`

Response:

```json
{
  "ok": true
}
```

## Validation

### `POST /validation/player-function`

Validates one Python-like strategy.

Request:

```json
{
  "code": "def action(cell, environment):\n    return \"d\""
}
```

Response:

```json
{
  "isValid": true,
  "errors": [],
  "normalizedCode": "def action(cell, environment):\n    return \"d\""
}
```

Invalid response example:

```json
{
  "isValid": false,
  "errors": [
    "Only the MVP subset is allowed. Loops, imports, and dangerous features are blocked."
  ]
}
```

## Game

### `GET /game/state`

Returns the current match state if one exists.

Response example:

```json
{
  "match": {
    "status": "paused",
    "locked": true,
    "currentTurn": 1,
    "config": {
      "turnLimit": 5000,
      "boardRows": 100,
      "boardCols": 200,
      "teams": []
    },
    "cells": [],
    "logs": [],
    "result": null
  }
}
```

If no active match exists:

```json
{
  "match": null
}
```

### `POST /game/start`

Creates a new active match, validates both players again, locks configuration, places the initial cells, and returns the paused initial state.

Request:

```json
{
  "players": [
    {
      "name": "Alpha",
      "color": "#22d3ee",
      "code": "def action(cell, environment):\n    return \"d\""
    },
    {
      "name": "Beta",
      "color": "#f43f5e",
      "code": "def action(cell, environment):\n    return \"d\""
    }
  ],
  "turnLimit": 5000
}
```

Validation failure response:

```json
{
  "error": "Invalid match configuration.",
  "details": [
    "Player 2 strategy is invalid."
  ]
}
```

### `POST /game/play`

Marks the active match as `running`.

Response:

```json
{
  "match": {}
}
```

### `POST /game/pause`

Marks the active match as `paused`. The match remains locked.

### `POST /game/tick`

Advances the simulation by exactly one turn if the match is active and not finished. This endpoint is used for both manual step and automatic playback.

### `POST /game/end`

Ends the active match immediately and scores the current board using the same tiebreakers as the turn-limit result.

Response:

```json
{
  "match": {
    "status": "finished",
    "result": {
      "winner": 1,
      "reason": "manual_stop",
      "finalTurn": 42,
      "teamSummaries": []
    }
  }
}
```

### `POST /game/reset`

Clears the active match and returns to configuration state.

Response:

```json
{
  "match": null
}
```

## Status Semantics

* `paused`: active match exists, board visible, waiting for user input.
* `running`: frontend may continue calling `tick`.
* `finished`: result is final, no more turns advance.

## Error Handling

* `400`: invalid request payload or invalid game configuration.
* `404`: action requires an active match but none exists.
* `409`: action conflicts with current state, such as trying to play a finished match.
