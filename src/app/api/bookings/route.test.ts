import { describe, it, expect, beforeEach } from 'vitest';
import { POST } from './route';
import { NextRequest } from 'next/server';
import { generateSessions } from '@/services/sessionService';
import { resetBookingStore } from '@/services/bookingService';
import type { Session } from '@/models/types';

let sessions: Session[];

function makePostRequest(body: unknown) {
  return new NextRequest(new URL('/api/bookings', 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  sessions = generateSessions();
  resetBookingStore();
});

describe('POST /api/bookings', () => {
  it('creates a confirmed booking and returns 201', async () => {
    const res = await POST(makePostRequest({
      sessionId: sessions[0].id,
      name: 'Alice Smith',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF-001',
    }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.status).toBe('confirmed');
    expect(body.booking.name).toBe('Alice Smith');
    expect(body.booking.email).toBe('alice@example.com');
    expect(body.booking.referenceCode).toBeDefined();
  });

  it('returns 200 for waitlisted booking when session is full', async () => {
    const sessionId = sessions[0].id;

    // Fill the session with 3 bookings
    for (let i = 0; i < 3; i++) {
      await POST(makePostRequest({
        sessionId,
        name: `User ${i}`,
        email: `user${i}@example.com`,
        role: 'Role',
        pf: `PF-${i}`,
      }));
    }

    // 4th booking should be waitlisted
    const res = await POST(makePostRequest({
      sessionId,
      name: 'Waitlisted User',
      email: 'waitlist@example.com',
      role: 'Role',
      pf: 'PF-W',
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('waitlisted');
    expect(body.waitlistEntry).toBeDefined();
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await POST(makePostRequest({
      sessionId: sessions[0].id,
      name: 'Alice',
      // email missing
      role: 'Engineer',
      pf: 'PF-001',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Please fill in all required fields');
    expect(body.missingFields).toContain('email');
  });

  it('returns 400 when all fields are missing', async () => {
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missingFields).toEqual(
      expect.arrayContaining(['name', 'email', 'role', 'pf', 'sessionId'])
    );
  });

  it('returns 400 for invalid email format', async () => {
    const res = await POST(makePostRequest({
      sessionId: sessions[0].id,
      name: 'Alice',
      email: 'not-an-email',
      role: 'Engineer',
      pf: 'PF-001',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Please enter a valid email address');
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest(new URL('/api/bookings', 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 409 for duplicate booking (same email, same session)', async () => {
    const sessionId = sessions[0].id;

    await POST(makePostRequest({
      sessionId,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF-001',
    }));

    const res = await POST(makePostRequest({
      sessionId,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF-001',
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('already have a booking');
  });

  it('returns 409 for session not found', async () => {
    const res = await POST(makePostRequest({
      sessionId: 'non-existent-session',
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF-001',
    }));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('Session not found');
  });

  it('returns 400 when fields are empty strings', async () => {
    const res = await POST(makePostRequest({
      sessionId: sessions[0].id,
      name: '',
      email: '',
      role: '',
      pf: '',
    }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.missingFields).toEqual(
      expect.arrayContaining(['name', 'email', 'role', 'pf'])
    );
  });
});
