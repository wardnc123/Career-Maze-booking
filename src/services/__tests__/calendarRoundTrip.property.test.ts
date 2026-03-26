// Property test: Calendar invite round-trip
// Feature: career-maze-booking, Property 7: Calendar invite round-trip
// Validates: Requirements 6.1, 6.4, 6.5

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import { generateIcs, parseIcs } from '@/services/calendarService';
import type { Booking, Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 7: Calendar invite round-trip', () => {
  let sessions: Session[];

  beforeEach(() => {
    sessions = generateSessions();
  });

  it('should preserve date, start time, 3-hour duration, and timezone after ICS generate-then-parse', () => {
    /**
     * **Validates: Requirements 6.1, 6.4, 6.5**
     *
     * For any confirmed booking and its associated session, generating an .ics
     * calendar invite and then parsing it back must produce an event with the
     * same session date, start time (in Europe/London timezone), and 3-hour
     * duration as the original.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 359 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (sessionIndex, name, email, role, pf) => {
          const session = sessions[sessionIndex];
          expect(session).toBeDefined();

          // Build a mock confirmed Booking
          const booking: Booking = {
            id: `booking-${sessionIndex}`,
            sessionId: session.id,
            name,
            email,
            role,
            pf,
            status: 'confirmed',
            referenceCode: `CM-${sessionIndex.toString().padStart(4, '0')}`,
            createdAt: new Date(),
            cancelledAt: null,
          };

          // Generate ICS then parse it back
          const icsContent = generateIcs(booking, session);
          const parsed = parseIcs(icsContent);

          // Extract expected date components from session
          const [expectedYear, expectedMonth, expectedDay] = session.sessionDate
            .split('-')
            .map(Number);

          // Extract expected time components from session startTime
          const [expectedHours, expectedMinutes] = session.startTime
            .split(':')
            .map(Number);

          // 1. Verify correct date (year, month, day)
          expect(parsed.startTime.getUTCFullYear()).toBe(expectedYear);
          expect(parsed.startTime.getUTCMonth()).toBe(expectedMonth - 1); // JS months are 0-indexed
          expect(parsed.startTime.getUTCDate()).toBe(expectedDay);

          // 2. Verify correct start time (hours, minutes)
          expect(parsed.startTime.getUTCHours()).toBe(expectedHours);
          expect(parsed.startTime.getUTCMinutes()).toBe(expectedMinutes);

          // 3. Verify 3-hour duration (endTime - startTime = 3h)
          const durationMs = parsed.endTime.getTime() - parsed.startTime.getTime();
          expect(durationMs).toBe(3 * 60 * 60 * 1000);

          // 4. Verify timezone is Europe/London
          expect(parsed.timezone).toBe('Europe/London');
        },
      ),
      { numRuns: 100 },
    );
  });
});
