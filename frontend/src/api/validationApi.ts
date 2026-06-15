import type { ValidationResult } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export async function validatePlayerCode(code: string): Promise<ValidationResult> {
  const response = await fetch(`${API_BASE}/validation/player-function`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  return (await response.json()) as ValidationResult;
}
