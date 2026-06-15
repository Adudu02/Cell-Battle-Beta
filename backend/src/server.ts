import cors from 'cors';
import express from 'express';
import { gameRouter } from './routes/game.routes.js';
import { validationRouter } from './routes/validation.routes.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/validation', validationRouter);
  app.use('/api/game', gameRouter);

  return app;
}

const port = Number(process.env.PORT ?? 3000);

if (process.env.VITEST !== 'true') {
  createApp().listen(port, () => {
    console.log(`Battle of Cells backend listening on port ${port}`);
  });
}
