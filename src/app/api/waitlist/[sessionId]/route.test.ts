import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore, login } from '@/services/authService';
import { generateSessions } from '@/services/sessionService';
import { addToWaitlist, resetWaitlistStore } from '@/services/waitlistService';
import type { Session } from '@/models/types';

let sessions: Session[];
let token: string;

function makeGetRequest(sessionId: string, authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return new NextRequest(
    new URL(`/api/waitlist/${sessionId}`, 'http://localhost:3000'),
    { method: 'GET', headers }
  );
}

beforeEach(async () => {
  resetAuthStore();
  resetWaitlistStore();
  sessions = generateSessions();
  await createAdmin('admin', 'password123');
  const adminSession = await login('admin', 'password123');
  token = adminSession!.id;
});

describe('GET /api/waitlist/:sessionId', () => {
  it('returns 401 when no auth header is provided', async () => {
    const req = makeGetRequest(sessions[0].id);
    const res = await GET(req, { params: Promise.resolve({ sessionId: sessions[0].id }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 when Bearer token is empty', async () => {
    const req = new NextRequest(
      new URL(`/api/waitlist/${sessions[0].id}`, 'http://localhost:3000'),
      { method: 'GET', headers: { Authorization: 'Bearer ' } }
    );
    const res = await GET(req, { params: Promise.resolve({ sessionId: sessions[0].id }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid/expired', async () => {
    const req = makeGetRequest(sessions[0].id, 'invalid-token');
    const res = await GET(req, { params: Promise.resolve({ sessionId: sessions[0].id }) });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('expired');
  });

  it('returns 404 when session does not exist', async () => {
    const req = makeGetRequest('non-existent-id', token);
    const res = await GET(req, { params: Promise.resolve({ sessionId: 'non-existent-id' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Session not found');
  });

  it('returns empty array when session has no waitlist entries', async () => {
    const sessionId = sessions[0].id;
    const req = makeGetRequest(sessionId, token);
    const res = await GET(req, { params: Promise.resolve({ sessionId }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it('returns waitlist entries ordered by creation time', async () => {
    const sessionId = sessions[0].id;

    await addToWaitlist(sessionId, { sessionId, name: 'First', email: 'first@test.com', role: 'Dev', pf: 'PF1' });
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 10));
    await addToWaitlist(sessionId, { sessionId, name: 'Second', email: 'second@test.com', role: 'QA', pf: 'PF2' });

    const req = makeGetRequest(sessionId, token);
    const res = await GET(req, { params: Promise.resolve({ sessionId }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('First');
    expect(body[1].name).toBe('Second');
    expect(new Date(body[0].createdAt).getTime()).toBeLessThanOrEqual(new Date(body[1].createdAt).getTime());
  });

  it('returns only entries for the requested session', async () => {
    const sessionA = sessions[0].id;
    const sessionB = sessions[1].id;

    await addToWaitlist(sessionA, { sessionId: sessionA, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });
    await addToWaitlist(sessionB, { sessionId: sessionB, name: 'Bob', email: 'bob@test.com', role: 'QA', pf: 'PF2' });

    const req = makeGetRequest(sessionA, token);
    const res = await GET(req, { params: Promise.resolve({ sessionId: sessionA }) });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Alice');
  });
});
