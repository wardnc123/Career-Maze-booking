// Property test: Reminder job selects correct sessions and attendees
// Feature: career-maze-booking, Property 9: Reminder job selects correct sessions and attendees
// Validates: Requirements 7.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions, getSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  getBookingsBySession,
} from '@/services/bookingService';
import { runReminderJob } from '@/services/reminderJob';
import type { Booking, Session } from '@/models/types';

/**
 * Mock NotificationService that tracks which (booking, session) pairs received reminders.
 */
function createTrackingNotificationService() {
  const reminders: Array<{ booking: Booking; session: Session }> = [];
  const service = {
    sendConfirmation: async () => {},
    sendCancellation: async () => {},
    sendWaitlistPromotion: async () => {},
    sendReminder: async (booking: Booking, session: Session) => {
      reminders.push({ booking, session });
    },
    sendDailyDigest: async () => {},
  };
  return { service: service as any, reminders };
}

describe('Feature: career-maze-booking, Property 9: Reminder job selects correct sessions and attendees', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should select exactly sessions within 24 hours and target all confirmed attendees', async () => {
    /**
     * **Validates: Requirements 7.4**
     *
     * For any random "now" timestamp and any set of bookings across random sessions,
     * the reminder job must:
     * 1. Process exactly those sessions starting within the next 24 hours of "now"
     * 2. Send reminders to all confirmed attendees for each selected session
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate a random "now" offset in hours from the start of the event window.
        // Event runs Aug 3-22, 2026. Sessions have UTC times from 08:00 to 15:30.
        // We pick "now" anywhere from 24h before Aug 3 to 24h after Aug 22 end.
        fc.integer({ min: -24, max: 20 * 24 + 24 }),
        // Generate random bookings: pick random session indices and unique emails
        fc.array(
          fc.record({
            sessionIndex: fc.integer({ min: 0, max: 359 }),
            attendeeIndex: fc.integer({ min: 0, max: 99 }),
          }),
          { minLength: 0, maxLength: 20 },
        ),
        async (nowOffsetHours, bookingSpecs) => {
          // Reset stores for each iteration
          resetBookingStore();
          sessions = generateSessions();

          // Compute "now" as an offset from the start of the event window
          const eventStart = new Date('2026-08-03T00:00:00Z');
          const now = new Date(eventStart.getTime() + nowOffsetHours * 60 * 60 * 1000);
          const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);

          // Create bookings with unique emails per attendeeIndex to avoid overlap rejections
          const createdBookings: Array<{ sessionId: string; email: string }> = [];
          for (const spec of bookingSpecs) {
            const session = sessions[spec.sessionIndex];
            const email = `attendee${spec.attendeeIndex}@test.com`;
            const result = await createBooking({
              sessionId: session.id,
              name: `Attendee ${spec.attendeeIndex}`,
              email,
              role: 'Tester',
              pf: `PF${spec.attendeeIndex}`,
            });
            if (result.status === 'confirmed') {
              createdBookings.push({ sessionId: session.id, email });
            }
          }

          // Run the reminder job
          const { service, reminders } = createTrackingNotificationService();
          await runReminderJob(service, now);

          // Determine which sessions should have been selected:
          // Sessions where sessionStart > now AND sessionStart <= now + 24h
          const expectedSessionIds = new Set<string>();
          for (const session of sessions) {
            const sessionStart = new Date(`${session.sessionDate}T${session.startTime}Z`);
            if (sessionStart > now && sessionStart <= twentyFourHoursLater) {
              expectedSessionIds.add(session.id);
            }
          }

          // PROPERTY 1: Only sessions within 24 hours are processed
          const remindedSessionIds = new Set(reminders.map((r) => r.session.id));
          for (const sessionId of remindedSessionIds) {
            expect(expectedSessionIds.has(sessionId)).toBe(true);
          }

          // PROPERTY 2: All confirmed attendees for sessions within 24h receive reminders
          for (const sessionId of expectedSessionIds) {
            const confirmedBookings = getBookingsBySession(sessionId);
            const remindersForSession = reminders.filter((r) => r.session.id === sessionId);
            const remindedEmails = new Set(remindersForSession.map((r) => r.booking.email));

            // Every confirmed attendee must have received a reminder
            for (const booking of confirmedBookings) {
              expect(remindedEmails.has(booking.email)).toBe(true);
            }

            // No extra reminders beyond confirmed attendees
            expect(remindersForSession.length).toBe(confirmedBookings.length);
          }

          // PROPERTY 3: No reminders sent for sessions outside the 24h window
          for (const reminder of reminders) {
            expect(expectedSessionIds.has(reminder.session.id)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
