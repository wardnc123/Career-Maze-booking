/**
 * Property-based tests for Calendar Service — Program Configuration
 *
 * Feature: booking-platform, Property 8: Calendar invite reflects program config
 *
 * **Validates: Requirements 8.1, 8.2, 8.3**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateIcs, parseIcs, type ProgramConfig } from '@/services/calendarService';
import type { Booking, Session } from '@/models/types';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid session date string (YYYY-MM-DD) */
const arbSessionDate = fc.date({
  min: new Date('2025-01-01'),
  max: new Date('2030-12-31'),
}).map(d => d.toISOString().slice(0, 10));

/** Generate a valid start time string (HH:MM:SS) */
const arbStartTime = fc.tuple(
  fc.integer({ min: 0, max: 23 }),
  fc.integer({ min: 0, max: 59 }),
).map(([h, m]) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);

/** Generate a valid session duration from allowed values */
const arbDurationMinutes = fc.constantFrom(30, 60, 120, 180);

/** Generate a non-empty alphanumeric program name (no special chars that break ICS) */
const arbProgramName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split('')),
  { minLength: 1, maxLength: 30 },
).map(s => s.trim() || 'Program');

/** Generate a non-empty alphanumeric user name */
const arbUserName = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ '.split('')),
  { minLength: 1, maxLength: 30 },
).map(s => s.trim() || 'User');

/** Generate a calendar invite title template that contains both placeholders */
const arbTemplate = fc.constantFrom(
  '{programName} Session — {userName}',
  '{userName} @ {programName}',
  'Booking: {programName} for {userName}',
  '{programName} - {userName} Session',
);

/** Generate a full ProgramConfig */
const arbProgramConfig = fc.tuple(arbTemplate, arbDurationMinutes, arbProgramName).map(
  ([calendarInviteTitleTemplate, sessionDurationMinutes, programName]): ProgramConfig => ({
    calendarInviteTitleTemplate,
    sessionDurationMinutes,
    programName,
  }),
);

/** Generate a minimal Session */
const arbSession = fc.tuple(arbSessionDate, arbStartTime).map(
  ([sessionDate, startTime]): Session => ({
    id: 'session-prop',
    eventId: 'event-prop',
    sessionDate,
    startTime,
    bookingCount: 0,
    maxAttendees: 3,
    slotStatus: 'Available',
    createdAt: new Date(),
  }),
);

/** Generate a minimal Booking */
const arbBooking = arbUserName.map(
  (name): Booking => ({
    id: `booking-${Date.now()}`,
    sessionId: 'session-prop',
    name,
    email: 'test@example.com',
    role: 'Tester',
    pf: 'PF-1',
    status: 'confirmed',
    referenceCode: 'REF-0001',
    customFields: null,
    createdAt: new Date(),
    cancelledAt: null,
  }),
);

// ─── Property 8: Calendar invite reflects program configuration ──────────────

describe('Feature: booking-platform, Property 8: Calendar invite reflects program config', () => {
  it('SUMMARY matches the rendered template with placeholders replaced', () => {
    fc.assert(
      fc.property(
        arbBooking,
        arbSession,
        arbProgramConfig,
        (booking, session, programConfig) => {
          const ics = generateIcs(booking, session, undefined, undefined, undefined, programConfig);
          const parsed = parseIcs(ics);

          // Build expected summary by replacing placeholders
          const expectedSummary = programConfig.calendarInviteTitleTemplate
            .replace(/\{programName\}/g, programConfig.programName)
            .replace(/\{userName\}/g, booking.name);

          expect(parsed.summary).toBe(expectedSummary);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('Duration (DTEND - DTSTART) matches sessionDurationMinutes', () => {
    fc.assert(
      fc.property(
        arbBooking,
        arbSession,
        arbProgramConfig,
        (booking, session, programConfig) => {
          const ics = generateIcs(booking, session, undefined, undefined, undefined, programConfig);
          const parsed = parseIcs(ics);

          const durationMs = parsed.endTime.getTime() - parsed.startTime.getTime();
          const expectedMs = programConfig.sessionDurationMinutes * 60 * 1000;

          expect(durationMs).toBe(expectedMs);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('DESCRIPTION contains the program name', () => {
    fc.assert(
      fc.property(
        arbBooking,
        arbSession,
        arbProgramConfig,
        (booking, session, programConfig) => {
          const ics = generateIcs(booking, session, undefined, undefined, undefined, programConfig);

          // The raw ICS should contain the program name in the description
          expect(ics).toContain(programConfig.programName);
        },
      ),
      { numRuns: 100 },
    );
  });
});
