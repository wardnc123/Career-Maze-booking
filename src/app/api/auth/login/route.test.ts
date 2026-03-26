import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore } from '@/services/authService';

function makePostRequest(body: unknown) {
  return new NextRequest(new URL('/api/auth/login', 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(async () => {
  resetAuthStore();
  await createAdmin('admin', 'password123');
});

describe('POST /api/auth/login', () => {
  it('returns 200 with token for valid credentials', async () => {
    const res = await POST(makePostRequest({ username: 'admin', password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.expiresAt).toBeDefined();
  });

  it('returns 401 for invalid password', async () => {
    const res = await POST(makePostRequest({ username: 'admin', password: 'wrong' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid username or password');
  });

  it('returns 401 for non-existent username', async () => {
    const res = await POST(makePostRequest({ username: 'nobody', password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('Invalid username or password');
  });

  it('returns 400 when username is missing', async () => {
    const res = await POST(makePostRequest({ password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Username is required');
  });

  it('returns 400 when password is missing', async () => {
    const res = await POST(makePostRequest({ username: 'admin' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Password is required');
  });

  it('returns 400 when username is empty string', async () => {
    const res = await POST(makePostRequest({ username: '', password: 'password123' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Username is required');
  });

  it('returns 400 when password is empty string', async () => {
    const res = await POST(makePostRequest({ username: 'admin', password: '' }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Password is required');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/auth/login', 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });
});
