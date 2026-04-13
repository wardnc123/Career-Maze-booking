import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore, login } from '@/services/authService';
import { resetBookingStore, createBooking } from '@/services/bookingService';
import { generateSessions } from '@/services/sessionService';
import type { Session } from '@/models/types';

let sessions: Session[];
let token: string;

function makeGetRequest(authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return new NextRequest(new URL('/api/admin/stats', 'http://localhost:3000'), {
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

describe('GET /api/admin/stats', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication required');
  });

  it('returns 401 for invalid token', async () => {
    const res = await GET(makeGetRequest('invalid-token'));
    expect(res.status).toBe(401);
  });

  it('returns stats with zero bookings initially', async () => {
    const res = await GET(makeGetRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalBookings).toBe(0);
    expect(body.fullSessions).toBe(0);
    expect(body.emptySessions).toBe(300);
    expect(body.waitlistCount).toBe(0);
  });

  it('returns correct stats after bookings are created', async () => {
    const s = sessions[0];
    await createBooking({ sessionId: s.id, name: 'A', email: 'a@test.com', role: 'Dev', pf: 'PF1' });
    await createBooking({ sessionId: s.id, name: 'B', email: 'b@test.com', role: 'Dev', pf: 'PF2' });
    await createBooking({ sessionId: s.id, name: 'C', email: 'c@test.com', role: 'Dev', pf: 'PF3' });

    const res = await GET(makeGetRequest(token));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalBookings).toBe(3);
    expect(body.fullSessions).toBe(1);
    expect(body.emptySessions).toBe(299);
  });
});
