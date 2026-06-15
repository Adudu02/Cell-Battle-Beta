import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';
import { resetActiveMatchForTests } from '../../src/routes/game.routes.js';
import { createApp } from '../../src/server.js';

const app = createApp();

function validPlayer(name: string, color: string) {
  return {
    name,
    color,
    code: `def action(cell, environment):
    return "d"`,
  };
}

afterEach(() => {
  resetActiveMatchForTests();
});

describe('game routes', () => {
  it('starts a valid match and locks it', async () => {
    const response = await request(app).post('/api/game/start').send({
      players: [validPlayer('Alpha', '#22d3ee'), validPlayer('Beta', '#f43f5e')],
      turnLimit: 5,
    });

    expect(response.status).toBe(200);
    expect(response.body.match.locked).toBe(true);
    expect(response.body.match.status).toBe('paused');
  });

  it('blocks start if either player is invalid', async () => {
    const response = await request(app).post('/api/game/start').send({
      players: [validPlayer('Alpha', '#22d3ee'), { ...validPlayer('Beta', '#f43f5e'), code: 'bad' }],
      turnLimit: 5,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid match configuration.');
  });

  it('play, pause, tick, end, state, and reset work for an active match', async () => {
    await request(app).post('/api/game/start').send({
      players: [validPlayer('Alpha', '#22d3ee'), validPlayer('Beta', '#f43f5e')],
      turnLimit: 5,
    });

    const played = await request(app).post('/api/game/play').send({});
    expect(played.status).toBe(200);
    expect(played.body.match.status).toBe('running');

    const ticked = await request(app).post('/api/game/tick').send({ steps: 2 });
    expect(ticked.status).toBe(200);
    expect(ticked.body.match.currentTurn).toBeGreaterThanOrEqual(3);
    expect(ticked.body.profile.executedSteps).toBeGreaterThanOrEqual(1);
    expect(ticked.body.profile.payloadBytes).toBeGreaterThan(0);

    const paused = await request(app).post('/api/game/pause').send({});
    expect(paused.status).toBe(200);
    expect(paused.body.match.status).toBe('paused');
    expect(paused.body.match.locked).toBe(true);

    const state = await request(app).get('/api/game/state');
    expect(state.status).toBe(200);
    expect(state.body.match).not.toBeNull();
    expect(Array.isArray(state.body.match.cells)).toBe(true);

    const ended = await request(app).post('/api/game/end').send({});
    expect(ended.status).toBe(200);
    expect(ended.body.match.status).toBe('finished');
    expect(ended.body.match.result.reason).toBe('manual_stop');

    const reset = await request(app).post('/api/game/reset').send({});
    expect(reset.status).toBe(200);
    expect(reset.body.match).toBeNull();
  });
});
