# Battle of Cells

Battle of Cells is a local two-player simulation where each player programs a safe Python-like strategy to control a colony of cells.

## Stack

* Frontend: React + Vite + TypeScript
* Backend: Node.js + Express + TypeScript
* Tests: Vitest, React Testing Library, Supertest

## Install

```bash
npm install
```

## Run

Backend:

```bash
npm run dev:backend
```

Frontend:

```bash
npm run dev:frontend
```

Or run both together:

```bash
npm run dev
```

Frontend URL: [http://localhost:5173](http://localhost:5173)  
Backend URL: [http://localhost:3000](http://localhost:3000)

## Tests

All tests:

```bash
npm test
```

Backend only:

```bash
npm run test:backend
```

Frontend only:

```bash
npm run test:frontend
```

Stress profile:

```bash
npm run profile:stress -- --turns 250 --top 5
```

Longer stress profile:

```bash
npm run profile:stress -- --turns 1000 --top 10
```

## Docker

Run the game in Docker:

```bash
docker compose up --build
```

Then open [http://localhost:5173](http://localhost:5173).

The backend is available at [http://localhost:3000](http://localhost:3000).

## Documentation

See the [docs](docs) directory for the specification, architecture, API, test plan, roadmap, flow, decisions, profiling notes, and optimization notes.
