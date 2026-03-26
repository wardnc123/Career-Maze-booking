// Property test: Cancellation decrements count and handles waitlist
// Feature: career-maze-booking, Property 6: Cancellation decrements count and frees slot or promotes waitlist
// Validates: Requirements 5.1, 5.2, 5.3, 4.3

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  cancelBooking,
  resetBookingStore,
  getBookingsBySession,
  getWaitlistForSession,
  getAllBookings,
} from '@/services/bookingService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 6: Cancellation decrements count and frees slot or promotes waitlist', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should set status to cancelled, decrement count, and promote waitlist if entries exist', async () => {
    /**
     * **Validates: Requirements 5.1, 5.2, 5.3, 4.3**
     *
     * For any confirmed booking, cancelling it must set the booking status
     * to "cancelled", decrement the session's booking count by 1, and either
     * make the slot available (if no waitlist) or promote the earliest
     * waitlist entry to a confirmed booking (if waitlist entries exist).
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }),
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 0, max: 19 }),
        async (numConfirmed, numWaitlist, dayIndex) => {
          // Reset for each iteration
          resetBookingStore();
          sessions = generateSessions();

          // Pick a unique session from a different day to avoid overlap
          // Each day has 18 sessions; use the first session of the chosen day
          const sessionIndex = dayIndex * 18;
          const session = sessions[sessionIndex];
          expect(session).toBeDefined();

          // 1. Fill session with confirmed bookings
          const confirmedBookingIds: string[] = [];
          const confirmedEmails: string[] = [];
          for (let i = 0; i < numConfirmed; i++) {
            const email = `confirmed-${dayIndex}-${i}@test.com`;
            const result = await createBooking({
              sessionId: session.id,
              name: `Confirmed User ${i}`,
              email,
              role: 'Tester',
              pf: `PF${i}`,
            });
            expect(result.status).toBe('confirmed');
            if (result.status === 'confirmed') {
              confirmedBookingIds.push(result.booking.id);
              confirmedEmails.push(email);
            }
          }

          expect(session.bookingCount).toBe(numConfirmed);

          // If session is not full yet but we want waitlist entries,
          // we need to fill it to capacity first. Only add waitlist
          // entries when session is full (bookingCount === 3).
          let extraFillerIds: string[] = [];
          if (numWaitlist > 0 && numConfirmed < 3) {
            // Fill remaining slots to reach capacity
            for (let i = numConfirmed; i < 3; i++) {
              const email = `filler-${dayIndex}-${i}@test.com`;
              const result = await createBooking({
                sessionId: session.id,
                name: `Filler User ${i}`,
                email,
                role: 'Filler',
                pf: `PFF${i}`,
              });
              expect(result.status).toBe('confirmed');
              if (result.status === 'confirmed') {
                extraFillerIds.push(result.booking.id);
              }
            }
          }

          // 2. Add waitlist entries (session must be at capacity 3)
          const waitlistEmails: string[] = [];
          if (numWaitlist > 0) {
            expect(session.bookingCount).toBe(3);
            for (let i = 0; i < numWaitlist; i++) {
              const email = `waitlist-${dayIndex}-${i}@test.com`;
              const result = await createBooking({
                sessionId: session.id,
                name: `Waitlist User ${i}`,
                email,
                role: 'Waiter',
                pf: `PFW${i}`,
              });
              expect(result.status).toBe('waitlisted');
              waitlistEmails.push(email);
            }
          }

          const countBeforeCancel = session.bookingCount;
          const waitlistBeforeCancel = getWaitlistForSession(session.id);
          const waitlistCountBefore = waitlistBeforeCancel.length;
          const earliestWaitlistEmail =
            waitlistCountBefore > 0 ? waitlistBeforeCancel[0].email : null;

          // 3. Cancel the first confirmed booking
          const cancelId = confirmedBookingIds[0];
          const cancelEmail = confirmedEmails[0];
          await cancelBooking(cancelId, cancelEmail);

          // 4. Verify: booking status is 'cancelled'
          const allBookings = getAllBookings();
          const cancelledBooking = allBookings.find((b) => b.id === cancelId);
          expect(cancelledBooking).toBeDefined();
          expect(cancelledBooking!.status).toBe('cancelled');
          expect(cancelledBooking!.cancelledAt).toBeInstanceOf(Date);

          if (waitlistCountBefore > 0) {
            // Waitlist promotion happened: count should stay the same
            // (decremented by 1 for cancel, incremented by 1 for promotion)
            expect(session.bookingCount).toBe(countBeforeCancel);

            // The earliest waitlist entry should now be a confirmed booking
            const promotedBookings = getBookingsBySession(session.id).filter(
              (b) => b.email === earliestWaitlistEmail
            );
            expect(promotedBookings.length).toBe(1);
            expect(promotedBookings[0].status).toBe('confirmed');

            // Waitlist should have one fewer entry
            const waitlistAfter = getWaitlistForSession(session.id);
            expect(waitlistAfter.length).toBe(waitlistCountBefore - 1);
          } else {
            // No waitlist: count should be decremented by 1
            expect(session.bookingCount).toBe(countBeforeCancel - 1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
