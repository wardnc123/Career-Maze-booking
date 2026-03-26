// Property test: Booking confirmation contains required fields
// Feature: career-maze-booking, Property 8: Booking confirmation contains required fields
// Validates: Requirements 3.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import { createBooking, resetBookingStore } from '@/services/bookingService';
import { getSession } from '@/services/sessionService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 8: Booking confirmation contains required fields', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should include sessionId, referenceCode, and all required booking fields in confirmed bookings', async () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any successfully created booking, the confirmation response must
     * include the session date, session time (retrievable via sessionId),
     * and a unique booking reference code starting with CM-.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 359 }),
        async (name, email, role, pf, sessionIndex) => {
          // Reset stores for each iteration to ensure isolation
          resetBookingStore();
          sessions = generateSessions();

          // Pick a different session per iteration to avoid overlap/duplicate issues
          const session = sessions[sessionIndex];
          expect(session).toBeDefined();

          const result = await createBooking({
            sessionId: session.id,
            name,
            email,
            role,
            pf,
          });

          // Session has capacity (bookingCount starts at 0), so booking must be confirmed
          expect(result.status).toBe('confirmed');

          if (result.status === 'confirmed') {
            const booking = result.booking;

            // 1. Booking has a sessionId that maps to a session with date and time
            expect(booking.sessionId).toBe(session.id);
            const lookedUpSession = getSession(booking.sessionId);
            expect(lookedUpSession).not.toBeNull();
            expect(lookedUpSession!.sessionDate).toBeTruthy();
            expect(lookedUpSession!.startTime).toBeTruthy();

            // 2. Reference code is a non-empty string starting with CM-
            expect(booking.referenceCode).toBeTruthy();
            expect(typeof booking.referenceCode).toBe('string');
            expect(booking.referenceCode.startsWith('CM-')).toBe(true);

            // 3. All required booking fields are populated
            expect(booking.id).toBeTruthy();
            expect(booking.name).toBe(name);
            expect(booking.email).toBe(email);
            expect(booking.role).toBe(role);
            expect(booking.pf).toBe(pf);
            expect(booking.status).toBe('confirmed');
            expect(booking.createdAt).toBeInstanceOf(Date);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
