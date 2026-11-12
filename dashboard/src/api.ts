import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import type { DashboardData } from './types';

export class AuthError extends Error {}

async function rpc<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const message: string = payload?.message ?? `Request failed (${res.status})`;
    if (payload?.code === '28P01' || message.includes('invalid credentials')) {
      throw new AuthError('Wrong username or password.');
    }
    throw new Error(message);
  }
  return payload as T;
}

export interface Credentials {
  username: string;
  password: string;
}

export function login(c: Credentials) {
  return rpc<{ username: string; name: string }>('dashboard_login', {
    p_username: c.username,
    p_password: c.password,
  });
}

export function fetchData(c: Credentials, from: string, to: string, tz: string) {
  return rpc<DashboardData>('dashboard_data', {
    p_username: c.username,
    p_password: c.password,
    p_from: from,
    p_to: to,
    p_tz: tz,
  });
}
