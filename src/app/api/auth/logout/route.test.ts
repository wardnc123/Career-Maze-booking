import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import {
  createAdmin,
  login,
  validateSession,
  resetAuthStore,
  SESSION_TIMEOUT_MS,
} from '@/services/authService';

function makeLogoutRequest(token?: string) {
  const headers: Record<string, string> = {};
  if (token !== undefined) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return new NextRequest(new URL('/api/auth/logout', 'http://localhost:3000'), {
    method: 'POST',
    headers,
  });
}

let validToken: string;

beforeEach(async () => {
  resetAuthStore();
  await createAdmin('admin', 'password123');
  const session = await login('admin', 'password123');
  validToken = session!.id;
});

describe('POST /api/auth/logout', () => {
  it('returns 200 and destroys session for valid token', async () => {
    const res = await POST(makeLogoutRequest(validToken));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Logged out successfully');

    // Session should be destroyed
    expect(validateSession(validToken)).toBeNull();
  });

  it('returns 401 when no Authorization header', async () => {
    const req = new NextRequest(new URL('/api/auth/logout', 'http://localhost:3000'), {
      method: 'POST',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const req = new NextRequest(new URL('/api/auth/logout', 'http://localhost:3000'), {
      method: 'POST',
      headers: { Authorization: validToken },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 for invalid/non-existent token', async () => {
    const res = await POST(makeLogoutRequest('nonexistent-token'));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Your session has expired. Please log in again');
  });

  it('returns 401 for expired session', async () => {
    // Simulate expiry by backdating the session
    const session = validateSession(validToken);
    session!.lastActiveAt = new Date(Date.now() - SESSION_TIMEOUT_MS - 1000);

    const res = await POST(makeLogoutRequest(validToken));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Your session has expired. Please log in again');
  });

  it('returns 401 when Bearer token is empty', async () => {
    const res = await POST(makeLogoutRequest(''));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Authentication required');
  });
});
