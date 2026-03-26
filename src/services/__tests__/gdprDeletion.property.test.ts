// Property test: GDPR data deletion removes personal data
// Feature: career-maze-booking, Property 18: GDPR data deletion removes personal data
// Validates: Requirements 11.3

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  gdprDeleteByEmail,
  getAllBookings,
  getAllWaitlistEntries,
} from '@/services/bookingService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 18: GDPR data deletion removes personal data', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should ensure no booking or waitlist entry contains attendee personal data after deletion', async () => {
    /**
     * **Validates: Requirements 11.3**
     *
     * For any attendee who requests data deletion, after processing the deletion,
     * no booking or waitlist entry in the system must contain that attendee's
     * name, email, role, or PF.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate random attendee data
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0 && s !== '[DELETED]'),
          email: fc.emailAddress(),
          role: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0 && s !== '[DELETED]'),
          pf: fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0 && s !== '[DELETED]'),
        }),
        // Generate how many bookings/waitlist entries to create (pick distinct sessions)
        fc.integer({ min: 1, max: 6 }),
        async (attendee, count) => {
          resetBookingStore();
          sessions = generateSessions();

          // Use sessions spread across different dates to avoid overlap rejection
          // Pick sessions that are far apart (different days) to avoid 3-hour overlap
          const distinctDaySessions: Session[] = [];
          const usedDates = new Set<string>();
          for (const s of sessions) {
            if (!usedDates.has(s.sessionDate)) {
              distinctDaySessions.push(s);
              usedDates.add(s.sessionDate);
            }
            if (distinctDaySessions.length >= count) break;
          }

          // Create some confirmed bookings for the attendee
          const confirmedCount = Math.min(Math.ceil(count / 2), distinctDaySessions.length);
          for (let i = 0; i < confirmedCount; i++) {
            await createBooking({
              sessionId: distinctDaySessions[i].id,
              name: attendee.name,
              email: attendee.email,
              role: attendee.role,
              pf: attendee.pf,
            });
          }

          // Create some waitlist entries by filling sessions first, then adding the attendee
          const waitlistCount = Math.min(count - confirmedCount, distinctDaySessions.length - confirmedCount);
          for (let i = confirmedCount; i < confirmedCount + waitlistCount; i++) {
            const session = distinctDaySessions[i];
            // Fill the session to capacity with other attendees
            for (let j = 0; j < 3; j++) {
              await createBooking({
                sessionId: session.id,
                name: `Filler${j}`,
                email: `filler${j}-${i}@other.com`,
                role: 'FillerRole',
                pf: `FPF${j}`,
              });
            }
            // Now the attendee goes to waitlist
            await createBooking({
              sessionId: session.id,
              name: attendee.name,
              email: attendee.email,
              role: attendee.role,
              pf: attendee.pf,
            });
          }

          // Perform GDPR deletion
          gdprDeleteByEmail(attendee.email);

          // Verify: no booking contains the attendee's personal data
          const allBookings = getAllBookings();
          const allWaitlist = getAllWaitlistEntries();

          for (const booking of allBookings) {
            expect(booking.name).not.toBe(attendee.name);
            expect(booking.email.toLowerCase()).not.toBe(attendee.email.toLowerCase());
            expect(booking.role).not.toBe(attendee.role);
            expect(booking.pf).not.toBe(attendee.pf);
          }

          for (const entry of allWaitlist) {
            expect(entry.name).not.toBe(attendee.name);
            expect(entry.email.toLowerCase()).not.toBe(attendee.email.toLowerCase());
            expect(entry.role).not.toBe(attendee.role);
            expect(entry.pf).not.toBe(attendee.pf);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
