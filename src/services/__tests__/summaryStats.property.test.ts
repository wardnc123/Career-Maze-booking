// Property test: Summary statistics accuracy
// Feature: career-maze-booking, Property 10: Summary statistics accuracy
// Validates: Requirements 7.5, 8.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  getStats,
  getAllBookings,
  getAllWaitlistEntries,
} from '@/services/bookingService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 10: Summary statistics accuracy', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should return stats that match actual booking and waitlist record counts', async () => {
    /**
     * **Validates: Requirements 7.5, 8.4**
     *
     * For any set of sessions and bookings, the computed summary statistics
     * (totalBookings, fullSessions, emptySessions, waitlistCount) must equal
     * the values derived by counting the actual booking and waitlist records.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate a random number of bookings to create (across random sessions)
        fc.array(
          fc.record({
            sessionIndex: fc.integer({ min: 0, max: 299 }),
            name: fc.string({ minLength: 1, maxLength: 30 }),
            email: fc.emailAddress(),
            role: fc.string({ minLength: 1, maxLength: 20 }),
            pf: fc.string({ minLength: 1, maxLength: 10 }),
          }),
          { minLength: 0, maxLength: 30 },
        ),
        async (bookingRequests) => {
          // Reset for each iteration
          resetBookingStore();
          sessions = generateSessions();

          // Create bookings across random sessions
          for (const req of bookingRequests) {
            const session = sessions[req.sessionIndex];
            await createBooking({
              sessionId: session.id,
              name: req.name,
              email: req.email,
              role: req.role,
              pf: req.pf,
            });
          }

          // Get computed stats
          const stats = getStats();

          // Manually count from actual records
          const allBookings = getAllBookings();
          const allWaitlist = getAllWaitlistEntries();

          const actualTotalBookings = allBookings.filter(
            (b) => b.status === 'confirmed',
          ).length;
          const actualWaitlistCount = allWaitlist.length;

          // Count full and empty sessions from the generated sessions
          const actualFullSessions = sessions.filter(
            (s) => s.bookingCount >= 3,
          ).length;
          const actualEmptySessions = sessions.filter(
            (s) => s.bookingCount === 0,
          ).length;

          // Verify computed stats match actual counts
          expect(stats.totalBookings).toBe(actualTotalBookings);
          expect(stats.fullSessions).toBe(actualFullSessions);
          expect(stats.emptySessions).toBe(actualEmptySessions);
          expect(stats.waitlistCount).toBe(actualWaitlistCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
