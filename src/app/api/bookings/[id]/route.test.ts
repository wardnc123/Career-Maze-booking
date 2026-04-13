import { describe, it, expect, beforeEach } from 'vitest';
import { DELETE } from './route';
import { NextRequest } from 'next/server';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  getAllBookings,
} from '@/services/bookingService';
import type { Session, Booking } from '@/models/types';

let sessions: Session[];

function makeDeleteRequest(id: string, body: unknown) {
  return {
    request: new NextRequest(
      new URL(`/api/bookings/${id}`, 'http://localhost:3000'),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    ),
    params: Promise.resolve({ id }),
  };
}

async function createTestBooking(sessionId: string, email = 'alice@example.com'): Promise<Booking> {
  const result = await createBooking({
    sessionId,
    name: 'Alice Smith',
    email,
    role: 'Engineer',
    pf: 'PF-001',
  });
  if (result.status !== 'confirmed') throw new Error('Expected confirmed booking');
  return result.booking;
}

beforeEach(() => {
  sessions = generateSessions();
  resetBookingStore();
});

describe('DELETE /api/bookings/:id', () => {
  it('cancels a booking and returns 200', async () => {
    const booking = await createTestBooking(sessions[0].id);
    const { request, params } = makeDeleteRequest(booking.id, {
      email: 'alice@example.com',
    });

    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.message).toBe('Booking cancelled successfully');

    // Verify booking is actually cancelled
    const cancelled = getAllBookings().find((b) => b.id === booking.id);
    expect(cancelled?.status).toBe('cancelled');
  });

  it('returns 404 for non-existent booking', async () => {
    const { request, params } = makeDeleteRequest('non-existent-id', {
      email: 'alice@example.com',
    });

    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Booking not found');
  });

  it('returns 403 when email does not match', async () => {
    const booking = await createTestBooking(sessions[0].id);
    const { request, params } = makeDeleteRequest(booking.id, {
      email: 'wrong@example.com',
    });

    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('You are not authorized to cancel this booking');
  });

  it('returns 400 when email is missing from body', async () => {
    const booking = await createTestBooking(sessions[0].id);
    const { request, params } = makeDeleteRequest(booking.id, {});

    const res = await DELETE(request, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Email is required');
  });

  it('returns 400 for invalid JSON body', async () => {
    const booking = await createTestBooking(sessions[0].id);
    const req = new NextRequest(
      new URL(`/api/bookings/${booking.id}`, 'http://localhost:3000'),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: 'not json',
      }
    );

    const res = await DELETE(req, { params: Promise.resolve({ id: booking.id }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON body');
  });

  it('returns 409 when booking is already cancelled', async () => {
    const booking = await createTestBooking(sessions[0].id);

    // Cancel once
    const { request: req1, params: p1 } = makeDeleteRequest(booking.id, {
      email: 'alice@example.com',
    });
    await DELETE(req1, { params: p1 });

    // Try to cancel again
    const { request: req2, params: p2 } = makeDeleteRequest(booking.id, {
      email: 'alice@example.com',
    });
    const res = await DELETE(req2, { params: p2 });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toBe('This booking has already been cancelled');
  });

  it('handles case-insensitive email matching', async () => {
    const booking = await createTestBooking(sessions[0].id, 'Alice@Example.COM');
    const { request, params } = makeDeleteRequest(booking.id, {
      email: 'alice@example.com',
    });

    const res = await DELETE(request, { params });
    expect(res.status).toBe(200);
  });
});
