import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBooking,
  gdprDeleteByEmail,
  getAllBookings,
  getAllWaitlistEntries,
  resetBookingStore,
} from './bookingService';
import { generateSessions } from './sessionService';
import type { Session, BookingRequest } from '@/models/types';

let sessions: Session[];

function makeRequest(sessionId: string, overrides?: Partial<BookingRequest>): BookingRequest {
  return {
    sessionId,
    name: 'Test User',
    email: 'target@example.com',
    role: 'Engineer',
    pf: 'PF001',
    ...overrides,
  };
}

beforeEach(() => {
  sessions = generateSessions();
  resetBookingStore();
});

describe('gdprDeleteByEmail()', () => {
  it('anonymizes personal data in confirmed bookings', async () => {
    const session = sessions[0];
    await createBooking(makeRequest(session.id, { email: 'target@example.com' }));

    const result = gdprDeleteByEmail('target@example.com');

    expect(result.bookingsAnonymized).toBe(1);
    const all = getAllBookings();
    const anonymized = all.find((b) => b.sessionId === session.id);
    expect(anonymized?.name).toBe('[DELETED]');
    expect(anonymized?.email).toBe('[DELETED]');
    expect(anonymized?.role).toBe('[DELETED]');
    expect(anonymized?.pf).toBe('[DELETED]');
  });

  it('anonymizes personal data in waitlist entries', async () => {
    const session = sessions[0];
    // Fill session to capacity
    await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
    await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
    await createBooking(makeRequest(session.id, { email: 'c@test.com' }));
    // Add target to waitlist
    await createBooking(makeRequest(session.id, { email: 'target@example.com' }));

    const result = gdprDeleteByEmail('target@example.com');

    expect(result.waitlistEntriesAnonymized).toBe(1);
    const entries = getAllWaitlistEntries();
    const anonymized = entries.find((e) => e.sessionId === session.id);
    expect(anonymized?.name).toBe('[DELETED]');
    expect(anonymized?.email).toBe('[DELETED]');
    expect(anonymized?.role).toBe('[DELETED]');
    expect(anonymized?.pf).toBe('[DELETED]');
  });

  it('anonymizes across multiple bookings and waitlist entries', async () => {
    const s1 = sessions[0];
    const s2 = sessions.find((s) => s.sessionDate !== s1.sessionDate)!;

    // Two confirmed bookings on different days
    await createBooking(makeRequest(s1.id, { email: 'target@example.com' }));
    await createBooking(makeRequest(s2.id, { email: 'target@example.com' }));

    const result = gdprDeleteByEmail('target@example.com');
    expect(result.bookingsAnonymized).toBe(2);

    const all = getAllBookings();
    for (const b of all) {
      expect(b.name).toBe('[DELETED]');
      expect(b.email).toBe('[DELETED]');
    }
  });

  it('is case-insensitive on email matching', async () => {
    const session = sessions[0];
    await createBooking(makeRequest(session.id, { email: 'Target@Example.COM' }));

    const result = gdprDeleteByEmail('target@example.com');
    expect(result.bookingsAnonymized).toBe(1);
  });

  it('does not affect other attendees records', async () => {
    const session = sessions[0];
    await createBooking(makeRequest(session.id, { email: 'target@example.com', name: 'Target' }));
    await createBooking(makeRequest(session.id, { email: 'other@example.com', name: 'Other' }));

    gdprDeleteByEmail('target@example.com');

    const all = getAllBookings();
    const other = all.find((b) => b.name === 'Other');
    expect(other?.email).toBe('other@example.com');
    expect(other?.role).toBe('Engineer');
  });

  it('returns zero counts when no records match', () => {
    const result = gdprDeleteByEmail('nobody@example.com');
    expect(result.bookingsAnonymized).toBe(0);
    expect(result.waitlistEntriesAnonymized).toBe(0);
  });

  it('preserves non-personal fields (id, sessionId, status, referenceCode)', async () => {
    const session = sessions[0];
    const createResult = await createBooking(makeRequest(session.id, { email: 'target@example.com' }));
    if (createResult.status !== 'confirmed') throw new Error('Expected confirmed');

    const originalId = createResult.booking.id;
    const originalRef = createResult.booking.referenceCode;
    const originalSessionId = createResult.booking.sessionId;

    gdprDeleteByEmail('target@example.com');

    const all = getAllBookings();
    const anonymized = all.find((b) => b.id === originalId);
    expect(anonymized?.id).toBe(originalId);
    expect(anonymized?.sessionId).toBe(originalSessionId);
    expect(anonymized?.referenceCode).toBe(originalRef);
    expect(anonymized?.status).toBe('confirmed');
  });
});
