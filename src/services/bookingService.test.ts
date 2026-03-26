import { describe, it, expect, beforeEach } from 'vitest';
import {
  createBooking,
  cancelBooking,
  getBookingsBySession,
  getBookingsByEmail,
  searchBookings,
  getWaitlistForSession,
  resetBookingStore,
  generateReferenceCode,
  getAllBookings,
} from './bookingService';
import { generateSessions, getSession } from './sessionService';
import type { Session, BookingRequest } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let sessions: Session[];

function makeRequest(sessionId: string, overrides?: Partial<BookingRequest>): BookingRequest {
  return {
    sessionId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'Engineer',
    pf: 'PF001',
    ...overrides,
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessions = generateSessions();
  resetBookingStore();
});

// ─── createBooking ───────────────────────────────────────────────────────────

describe('BookingService', () => {
  describe('createBooking()', () => {
    it('creates a confirmed booking for a session with capacity', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));

      expect(result.status).toBe('confirmed');
      if (result.status === 'confirmed') {
        expect(result.booking.sessionId).toBe(session.id);
        expect(result.booking.status).toBe('confirmed');
        expect(result.booking.referenceCode).toBeTruthy();
        expect(result.booking.name).toBe('Test User');
        expect(result.booking.email).toBe('test@example.com');
      }
    });

    it('increments session bookingCount on confirmed booking', async () => {
      const session = sessions[0];
      expect(session.bookingCount).toBe(0);

      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      expect(session.bookingCount).toBe(1);

      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      expect(session.bookingCount).toBe(2);
    });

    it('updates slotStatus to Limited after first booking', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id));
      expect(session.slotStatus).toBe('Limited');
    });

    it('waitlists when session has 3 confirmed bookings', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'c@test.com' }));

      const result = await createBooking(makeRequest(session.id, { email: 'd@test.com' }));
      expect(result.status).toBe('waitlisted');
      if (result.status === 'waitlisted') {
        expect(result.waitlistEntry.sessionId).toBe(session.id);
        expect(result.waitlistEntry.email).toBe('d@test.com');
      }
    });

    it('sets slotStatus to Full when 3 bookings and no waitlist', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'c@test.com' }));
      expect(session.slotStatus).toBe('Full');
    });

    it('sets slotStatus to Waitlisted when full with waitlist entries', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'c@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'd@test.com' }));
      expect(session.slotStatus).toBe('Waitlisted');
    });

    it('rejects booking for non-existent session', async () => {
      const result = await createBooking(makeRequest('nonexistent-id'));
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toContain('Session not found');
      }
    });

    it('rejects duplicate booking (same email, same session)', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id));
      const result = await createBooking(makeRequest(session.id));
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toContain('already have a booking');
      }
    });

    it('rejects booking with 3-hour overlap', async () => {
      // Book the first session
      const session1 = sessions[0];
      await createBooking(makeRequest(session1.id));

      // Find a session on the same date that overlaps (within 3 hours)
      const s1 = getSession(session1.id)!;
      const sameDateSessions = sessions.filter(
        (s) => s.sessionDate === s1.sessionDate && s.id !== session1.id
      );
      // The next session (15 min later) should overlap
      const overlapping = sameDateSessions[0];
      expect(overlapping).toBeDefined();

      const result = await createBooking(makeRequest(overlapping.id));
      expect(result.status).toBe('rejected');
      if (result.status === 'rejected') {
        expect(result.reason).toContain('3 hours');
      }
    });

    it('allows booking for non-overlapping session (different day)', async () => {
      const session1 = sessions[0]; // Aug 3
      await createBooking(makeRequest(session1.id));

      // Find a session on a different date
      const differentDay = sessions.find((s) => s.sessionDate !== session1.sessionDate)!;
      const result = await createBooking(makeRequest(differentDay.id));
      expect(result.status).toBe('confirmed');
    });

    it('generates unique reference codes', async () => {
      const session = sessions[0];
      const r1 = await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      const r2 = await createBooking(makeRequest(session.id, { email: 'b@test.com' }));

      if (r1.status === 'confirmed' && r2.status === 'confirmed') {
        expect(r1.booking.referenceCode).not.toBe(r2.booking.referenceCode);
      }
    });
  });

  // ─── cancelBooking ─────────────────────────────────────────────────

  describe('cancelBooking()', () => {
    it('cancels a confirmed booking', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      await cancelBooking(result.booking.id, 'test@example.com');

      const all = getAllBookings();
      const cancelled = all.find((b) => b.id === result.booking.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.cancelledAt).toBeInstanceOf(Date);
    });

    it('decrements session bookingCount on cancellation', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      expect(session.bookingCount).toBe(1);
      await cancelBooking(result.booking.id, 'test@example.com');
      expect(session.bookingCount).toBe(0);
    });

    it('updates slotStatus after cancellation', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      expect(session.slotStatus).toBe('Limited');
      await cancelBooking(result.booking.id, 'test@example.com');
      expect(session.slotStatus).toBe('Available');
    });

    it('promotes earliest waitlist entry on cancellation', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      const r3 = await createBooking(makeRequest(session.id, { email: 'c@test.com' }));

      // Add to waitlist
      await createBooking(makeRequest(session.id, { email: 'wait1@test.com', name: 'Waiter 1' }));
      await createBooking(makeRequest(session.id, { email: 'wait2@test.com', name: 'Waiter 2' }));

      expect(session.bookingCount).toBe(3);
      expect(getWaitlistForSession(session.id)).toHaveLength(2);

      // Cancel one confirmed booking
      if (r3.status !== 'confirmed') throw new Error('Expected confirmed');
      await cancelBooking(r3.booking.id, 'c@test.com');

      // Waitlist entry should have been promoted
      expect(session.bookingCount).toBe(3); // decremented then incremented
      expect(getWaitlistForSession(session.id)).toHaveLength(1);

      // The promoted booking should be for wait1 (FIFO)
      const confirmed = getBookingsBySession(session.id);
      const promotedEmails = confirmed.map((b) => b.email);
      expect(promotedEmails).toContain('wait1@test.com');
    });

    it('throws error for non-existent booking', async () => {
      await expect(cancelBooking('nonexistent', 'test@example.com')).rejects.toThrow(
        'Booking not found'
      );
    });

    it('throws error for email mismatch', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      await expect(cancelBooking(result.booking.id, 'wrong@example.com')).rejects.toThrow(
        'not authorized'
      );
    });

    it('throws error when cancelling already cancelled booking', async () => {
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      await cancelBooking(result.booking.id, 'test@example.com');
      await expect(cancelBooking(result.booking.id, 'test@example.com')).rejects.toThrow(
        'already been cancelled'
      );
    });
  });

  // ─── Query functions ───────────────────────────────────────────────

  describe('getBookingsBySession()', () => {
    it('returns confirmed bookings for a session', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));

      const result = getBookingsBySession(session.id);
      expect(result).toHaveLength(2);
      result.forEach((b) => expect(b.status).toBe('confirmed'));
    });

    it('excludes cancelled bookings', async () => {
      const session = sessions[0];
      const r = await createBooking(makeRequest(session.id));
      if (r.status !== 'confirmed') throw new Error('Expected confirmed');

      await cancelBooking(r.booking.id, 'test@example.com');
      expect(getBookingsBySession(session.id)).toHaveLength(0);
    });

    it('returns empty array for session with no bookings', () => {
      expect(getBookingsBySession('some-id')).toHaveLength(0);
    });
  });

  describe('getBookingsByEmail()', () => {
    it('returns all bookings for an email (including cancelled)', async () => {
      const s1 = sessions[0];
      // Use a session on a different day to avoid overlap
      const s2 = sessions.find((s) => s.sessionDate !== s1.sessionDate)!;

      await createBooking(makeRequest(s1.id, { email: 'user@test.com' }));
      await createBooking(makeRequest(s2.id, { email: 'user@test.com' }));

      const result = getBookingsByEmail('user@test.com');
      expect(result).toHaveLength(2);
    });

    it('is case-insensitive', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'User@Test.COM' }));

      const result = getBookingsByEmail('user@test.com');
      expect(result).toHaveLength(1);
    });
  });

  describe('searchBookings()', () => {
    it('finds bookings by name', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { name: 'Alice Smith', email: 'alice@test.com' }));

      const result = searchBookings('Alice');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Alice Smith');
    });

    it('finds bookings by email', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'unique@domain.com' }));

      const result = searchBookings('unique@domain');
      expect(result).toHaveLength(1);
    });

    it('finds bookings by PF', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { pf: 'PF999', email: 'pf@test.com' }));

      const result = searchBookings('PF999');
      expect(result).toHaveLength(1);
    });

    it('returns empty for non-matching query', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id));

      const result = searchBookings('zzz-no-match');
      expect(result).toHaveLength(0);
    });

    it('search is case-insensitive', async () => {
      const session = sessions[0];
      await createBooking(makeRequest(session.id, { name: 'Bob Jones', email: 'bob@test.com' }));

      expect(searchBookings('bob jones')).toHaveLength(1);
      expect(searchBookings('BOB')).toHaveLength(1);
    });
  });

  // ─── Reference code generation ─────────────────────────────────────

  describe('generateReferenceCode()', () => {
    it('returns a string starting with CM-', () => {
      const code = generateReferenceCode();
      expect(code).toMatch(/^CM-/);
    });

    it('generates unique codes on successive calls', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateReferenceCode());
      }
      expect(codes.size).toBe(100);
    });
  });

  // ─── Waitlist helpers ──────────────────────────────────────────────

  describe('getWaitlistForSession()', () => {
    it('returns waitlist entries ordered by createdAt', async () => {
      const session = sessions[0];
      // Fill session
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'c@test.com' }));

      // Add waitlist entries
      await createBooking(makeRequest(session.id, { email: 'w1@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'w2@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'w3@test.com' }));

      const waitlist = getWaitlistForSession(session.id);
      expect(waitlist).toHaveLength(3);
      // FIFO order
      expect(waitlist[0].email).toBe('w1@test.com');
      expect(waitlist[1].email).toBe('w2@test.com');
      expect(waitlist[2].email).toBe('w3@test.com');
    });

    it('returns empty array for session with no waitlist', () => {
      expect(getWaitlistForSession('some-id')).toHaveLength(0);
    });
  });
});
