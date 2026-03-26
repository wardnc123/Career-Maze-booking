import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { createAdmin, resetAuthStore, login } from '@/services/authService';
import { resetBookingStore, createBooking } from '@/services/bookingService';
import { generateSessions } from '@/services/sessionService';
import type { Session } from '@/models/types';

let sessions: Session[];
let token: string;

function makeGetRequest(params?: string, authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const url = params
    ? `/api/admin/export?${params}`
    : '/api/admin/export';
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
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

describe('GET /api/admin/export', () => {
  it('returns 401 when no auth header is provided', async () => {
    const res = await GET(makeGetRequest(undefined));
    expect(res.status).toBe(401);
  });

  it('returns CSV with header only when no bookings exist', async () => {
    const res = await GET(makeGetRequest(undefined, token));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/csv');
    expect(res.headers.get('content-disposition')).toContain('bookings-export.csv');

    const csv = await res.text();
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Booking ID,Session Date,Session Time,Name,Email,Role,PF,Booking Timestamp,Status');
    expect(lines).toHaveLength(1);
  });

  it('returns CSV with booking rows', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });
    await createBooking({ sessionId: sessions[1].id, name: 'Bob', email: 'bob@test.com', role: 'QA', pf: 'PF2' });

    const res = await GET(makeGetRequest(undefined, token));
    expect(res.status).toBe(200);

    const csv = await res.text();
    const lines = csv.split('\n');
    // Header + 2 booking rows
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Alice');
    expect(lines[1]).toContain('alice@test.com');
    expect(lines[1]).toContain('PF1');
    expect(lines[1]).toContain('confirmed');
  });

  it('exports all required fields in each row', async () => {
    await createBooking({ sessionId: sessions[0].id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });

    const res = await GET(makeGetRequest(undefined, token));
    const csv = await res.text();
    const lines = csv.split('\n');
    const fields = lines[1].split(',');

    // 9 required fields: ID, session date, session time, name, email, role, PF, timestamp, status
    expect(fields.length).toBeGreaterThanOrEqual(9);
  });

  it('applies date filter to export', async () => {
    const s0 = sessions[0];
    const differentDateSession = sessions.find((s) => s.sessionDate !== s0.sessionDate)!;

    await createBooking({ sessionId: s0.id, name: 'Alice', email: 'alice@test.com', role: 'Dev', pf: 'PF1' });
    await createBooking({ sessionId: differentDateSession.id, name: 'Bob', email: 'bob@test.com', role: 'QA', pf: 'PF2' });

    const res = await GET(makeGetRequest(`date=${s0.sessionDate}`, token));
    const csv = await res.text();
    const lines = csv.split('\n').filter((l) => l.trim());

    // Header + only bookings for the filtered date
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Alice');
  });
});
