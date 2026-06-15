import { Router } from 'express';
import { validateStrategy } from '../game/validation.js';

export const validationRouter = Router();

validationRouter.post('/player-function', (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  const result = validateStrategy(code);
  res.json(result);
});
