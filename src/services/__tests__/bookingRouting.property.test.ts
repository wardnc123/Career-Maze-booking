// Property test: Booking routing by capacity
// Feature: career-maze-booking, Property 4: Booking routing by capacity
// Validates: Requirements 3.2, 3.3, 4.1

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import { createBooking, resetBookingStore } from '@/services/bookingService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 4: Booking routing by capacity', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should confirm when < 3 bookings and waitlist when = 3 bookings', async () => {
    /**
     * **Validates: Requirements 3.2, 3.3, 4.1**
     *
     * For any session with fewer than 3 confirmed bookings, a new booking
     * must be confirmed and the session's bookingCount incremented by 1.
     * For any session with exactly 3 confirmed bookings, a new booking
     * must be waitlisted and the bookingCount must remain unchanged.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 19 }),
        async (preExisting, sessionDayIndex) => {
          // Reset stores for each run to ensure isolation
          resetBookingStore();
          sessions = generateSessions();

          // Pick a unique session per day to avoid overlap issues.
          // Each day has 18 sessions; use different days via sessionDayIndex
          // and pick the first session of that day (index = dayIndex * 18).
          const sessionIndex = sessionDayIndex * 18;
          const session = sessions[sessionIndex];
          expect(session).toBeDefined();

          // Create pre-existing bookings with unique emails
          for (let i = 0; i < preExisting; i++) {
            const result = await createBooking({
              sessionId: session.id,
              name: `Pre-Existing User ${i}`,
              email: `preexisting${i}@test.com`,
              role: 'Tester',
              pf: 'PF001',
            });
            expect(result.status).toBe('confirmed');
          }

          // Verify bookingCount matches pre-existing count
          expect(session.bookingCount).toBe(preExisting);

          // Attempt one more booking with a unique email
          const result = await createBooking({
            sessionId: session.id,
            name: 'New Attendee',
            email: `newattendee-${preExisting}-${sessionDayIndex}@test.com`,
            role: 'Attendee',
            pf: 'PF002',
          });

          if (preExisting < 3) {
            // Should be confirmed and bookingCount incremented
            expect(result.status).toBe('confirmed');
            expect(session.bookingCount).toBe(preExisting + 1);
          } else {
            // preExisting === 3: should be waitlisted, bookingCount unchanged
            expect(result.status).toBe('waitlisted');
            expect(session.bookingCount).toBe(3);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
