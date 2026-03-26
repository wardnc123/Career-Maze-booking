// Property test: Booking search returns matching results
// Feature: career-maze-booking, Property 13: Booking search returns matching results
// Validates: Requirements 8.6

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  searchBookings,
} from '@/services/bookingService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 13: Booking search returns matching results', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should return only bookings containing the query in name, email, or PF', async () => {
    /**
     * **Validates: Requirements 8.6**
     *
     * For any search query string, all returned bookings must contain the
     * query string (case-insensitive) in at least one of: attendee name,
     * email, or PF.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate a small set of bookings with random data
        fc.array(
          fc.record({
            sessionIndex: fc.integer({ min: 0, max: 359 }),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.emailAddress(),
            pf: fc.string({ minLength: 1, maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        // Generate a random search query (non-empty)
        fc.string({ minLength: 1, maxLength: 10 }),
        async (bookingInputs, query) => {
          // Reset for each iteration
          resetBookingStore();
          sessions = generateSessions();

          // Create bookings across random sessions
          for (const input of bookingInputs) {
            const session = sessions[input.sessionIndex];
            await createBooking({
              sessionId: session.id,
              name: input.name,
              email: input.email,
              role: 'TestRole',
              pf: input.pf,
            });
          }

          // Search with the random query
          const results = searchBookings(query);
          const q = query.toLowerCase();

          // Every returned booking must contain the query in name, email, or PF
          for (const booking of results) {
            const matchesName = booking.name.toLowerCase().includes(q);
            const matchesEmail = booking.email.toLowerCase().includes(q);
            const matchesPf = booking.pf.toLowerCase().includes(q);

            expect(matchesName || matchesEmail || matchesPf).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
