import type { MatchStartPayload, SimulationState, TickExecutionProfile } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const data = (await response.json()) as T & { error?: string; details?: string[] };
  if (!response.ok) {
    const message = Array.isArray(data.details) && data.details.length > 0 ? data.details.join(' ') : data.error ?? 'Request failed.';
    throw new Error(message);
  }

  return data;
}

export async function startMatch(payload: MatchStartPayload): Promise<SimulationState> {
  const data = await requestJson<{ match: SimulationState }>('/game/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return data.match;
}

export async function playMatch(): Promise<SimulationState> {
  const data = await requestJson<{ match: SimulationState }>('/game/play', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  return data.match;
}

export async function pauseMatch(): Promise<SimulationState> {
  const data = await requestJson<{ match: SimulationState }>('/game/pause', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  return data.match;
}

export async function tickMatch(steps: number = 1): Promise<{ match: SimulationState; profile: TickExecutionProfile | null }> {
  const data = await requestJson<{ match: SimulationState; profile: TickExecutionProfile | null }>('/game/tick', {
    method: 'POST',
    body: JSON.stringify({ steps }),
  });

  return data;
}

export async function endMatch(): Promise<SimulationState> {
  const data = await requestJson<{ match: SimulationState }>('/game/end', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  return data.match;
}

export async function resetMatch(): Promise<void> {
  await requestJson<{ match: null }>('/game/reset', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function getMatchState(): Promise<SimulationState | null> {
  const data = await requestJson<{ match: SimulationState | null }>('/game/state');
  return data.match;
}
