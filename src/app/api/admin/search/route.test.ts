import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore, login } from '@/services/authService';
import { resetBookingStore, createBooking } from '@/services/bookingService';
import { generateSessions } from '@/services/sessionService';
import type { Session } from '@/models/types';

let sessions: Session[];
let token: string;

function makeGetRequest(query: string, authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return new NextRequest(new URL(`/api/admin/search?q=${encodeURIComponent(query)}`, 'http://localhost:3000'), {
    method: 'GET',
    headers,
  });
}

beforeEach(async () => {
  resetAuthStore();
  resetBookingStore();
  sessions = generateSessions();
  await createAdmin('admin', 'password123');
  const session = await login('admin', 'password123');
  token = session!.id;
});

describe('GET /api/admin/search', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await GET(makeGetRequest('test'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 400 when query is empty', async () => {
    const req = new NextRequest(new URL('/api/admin/search?q=', 'http://localhost:3000'), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('required');
  });

  it('returns matching bookings by name', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice Smith', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });
    await createBooking({ sessionId: sessions[1].id, name: 'Bob Jones', email: 'bob@test.com', role: 'QA', pf: 'PF2' });

    const res = await GET(makeGetRequest('Alice', token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Alice Smith');
  });

  it('returns matching bookings by email', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@example.com', role: 'Dev', pf: 'PF1' });

    const res = await GET(makeGetRequest('alice@example', token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe('alice@example.com');
  });

  it('returns matching bookings by PF', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF-UNIQUE' });

    const res = await GET(makeGetRequest('PF-UNIQUE', token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].pf).toBe('PF-UNIQUE');
  });

  it('returns empty array for non-matching query', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });

    const res = await GET(makeGetRequest('zzzzz', token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(0);
  });
});
