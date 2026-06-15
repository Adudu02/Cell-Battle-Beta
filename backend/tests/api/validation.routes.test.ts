import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/server.js';

const app = createApp();

describe('validation routes', () => {
  it('validates a legal player function', async () => {
    const response = await request(app).post('/api/validation/player-function').send({
      code: `def action(cell, environment):
    return "d"`,
    });

    expect(response.status).toBe(200);
    expect(response.body.isValid).toBe(true);
  });

  it('rejects an invalid player function', async () => {
    const response = await request(app).post('/api/validation/player-function').send({
      code: `def action(cell, environment):
    return "not-real"`,
    });

    expect(response.status).toBe(200);
    expect(response.body.isValid).toBe(false);
  });
});
