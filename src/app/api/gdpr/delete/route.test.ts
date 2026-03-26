import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore, login } from '@/services/authService';
import { resetBookingStore, createBooking, getAllBookings, getAllWaitlistEntries } from '@/services/bookingService';
import { generateSessions } from '@/services/sessionService';
import type { Session } from '@/models/types';

let sessions: Session[];
let token: string;

function makePostRequest(body: unknown, authToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  return new NextRequest(new URL('/api/gdpr/delete', 'http://localhost:3000'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
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

describe('POST /api/gdpr/delete', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await POST(makePostRequest({ email: 'test@example.com' }));
    expect(res.status).toBe(401);
  });

  it('returns 401 for expired/invalid token', async () => {
    const res = await POST(makePostRequest({ email: 'test@example.com' }, 'invalid-token'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await POST(makePostRequest({}, token));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Email is required');
  });

  it('returns 400 when email is empty string', async () => {
    const res = await POST(makePostRequest({ email: '' }, token));
    expect(res.status).toBe(400);
  });

  it('returns 200 with anonymization counts', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });

    const res = await POST(makePostRequest({ email: 'alice@test.com' }, token));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.bookingsAnonymized).toBe(1);
    expect(json.totalRecordsProcessed).toBe(1);
  });

  it('anonymizes booking personal data via the API', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });

    await POST(makePostRequest({ email: 'alice@test.com' }, token));

    const all = getAllBookings();
    expect(all[0].name).toBe('[DELETED]');
    expect(all[0].email).toBe('[DELETED]');
    expect(all[0].role).toBe('[DELETED]');
    expect(all[0].pf).toBe('[DELETED]');
  });

  it('anonymizes waitlist entries via the API', async () => {
    // Fill session
    await createBooking({ sessionId: sessions[0].id, name: 'A', email: 'a@t.com', role: 'R', pf: 'P1' });
    await createBooking({ sessionId: sessions[0].id, name: 'B', email: 'b@t.com', role: 'R', pf: 'P2' });
    await createBooking({ sessionId: sessions[0].id, name: 'C', email: 'c@t.com', role: 'R', pf: 'P3' });
    // Target goes to waitlist
    await createBooking({ sessionId: sessions[0].id, name: 'Target', email: 'target@test.com', role: 'Dev', pf: 'PF99' });

    const res = await POST(makePostRequest({ email: 'target@test.com' }, token));
    const json = await res.json();
    expect(json.waitlistEntriesAnonymized).toBe(1);

    const entries = getAllWaitlistEntries();
    const anonymized = entries.find((e) => e.sessionId === sessions[0].id);
    expect(anonymized?.name).toBe('[DELETED]');
    expect(anonymized?.email).toBe('[DELETED]');
  });

  it('returns 200 with zero counts when no records match', async () => {
    const res = await POST(makePostRequest({ email: 'nobody@test.com' }, token));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.totalRecordsProcessed).toBe(0);
  });
});
