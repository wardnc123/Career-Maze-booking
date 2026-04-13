// Property tests for extended session & booking services
// Feature: booking-platform

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createEvent,
  getEvent,
  getSessions,
  getSession,
} from '@/services/sessionService';
import {
  createBooking,
  getBookingsByEmail,
  exportBookings,
  resetBookingStore,
} from '@/services/bookingService';
import { createProgram } from '@/services/programService';
import {
  setEventsStore,
  setSessionsStore,
  setProgramsStore,
} from '@/lib/dataManager';
import type { BookingRequest } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetAll() {
  setEventsStore([]);
  setSessionsStore([]);
  setProgramsStore([]);
  resetBookingStore();
}

let uniqueCounter = 0;
function uid(): string {
  return `${++uniqueCounter}`;
}

function makeBookingRequest(
  sessionId: string,
  email: string,
  customFields?: Record<string, string>,
): BookingRequest & { customFields?: Record<string, string> } {
  return {
    sessionId,
    name: 'Test User',
    email,
    role: 'Engineer',
    pf: 'PF001',
    ...(customFields ? { customFields } : {}),
  };
}

// ─── Generators ──────────────────────────────────────────────────────────────

const validMaxAttendees = fc.constantFrom(1, 2, 3, 5, 10);
const validBrandColor = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);

// ─── Property 3 ──────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 3: Event-to-program association', () => {
  beforeEach(() => resetAll());

  it('events created within a program have correct programId', () => {
    /**
     * **Validates: Requirements 1.2, 5.1, 5.2**
     *
     * For any event created within a program, the event's programId should
     * equal the program's ID, and querying events filtered by that programId
     * should include the created event.
     */
    fc.assert(
      fc.property(validMaxAttendees, validBrandColor, (maxAtt, color) => {
        resetAll();

        const program = createProgram({
          name: `P3-${uid()}`,
          brandColor: color,
          sessionDurationMinutes: 180,
          slotIntervalMinutes: 15,
          maxAttendees: maxAtt,
          customFormFields: [],
        });

        const { event } = createEvent(
          'Test Event',
          ['2026-08-10'],
          ['09:00'],
          '',
          'Europe/London',
          program.id,
          program.maxAttendees,
        );

        expect(event.programId).toBe(program.id);

        const retrieved = getEvent(event.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.programId).toBe(program.id);

        const sessions = getSessions({ eventId: event.id });
        expect(sessions.length).toBeGreaterThan(0);
        for (const s of sessions) {
          expect(s.eventId).toBe(event.id);
          expect(s.maxAttendees).toBe(maxAtt);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 4 ──────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 4: Max attendees snapshot immutability', () => {
  beforeEach(() => resetAll());

  it('updating program maxAttendees does not change existing sessions', () => {
    /**
     * **Validates: Requirements 4.3**
     *
     * For any program with existing sessions, updating the program's
     * maxAttendees value should not change the maxAttendees of any
     * previously created session.
     */
    const twoDistinctMaxAttendees = fc
      .tuple(validMaxAttendees, validMaxAttendees)
      .filter(([a, b]) => a !== b);

    fc.assert(
      fc.property(twoDistinctMaxAttendees, ([initialMax, updatedMax]) => {
        resetAll();

        const program = createProgram({
          name: `P4-${uid()}`,
          brandColor: '#112233',
          sessionDurationMinutes: 180,
          slotIntervalMinutes: 15,
          maxAttendees: initialMax,
          customFormFields: [],
        });

        const { sessions: beforeSessions } = createEvent(
          'Before Event',
          ['2026-08-10'],
          ['09:00'],
          '',
          'Europe/London',
          program.id,
          program.maxAttendees,
        );

        const beforeIds = beforeSessions.map((s) => s.id);

        // Simulate program update
        program.maxAttendees = updatedMax;

        const { sessions: afterSessions } = createEvent(
          'After Event',
          ['2026-08-11'],
          ['10:00'],
          '',
          'Europe/London',
          program.id,
          program.maxAttendees,
        );

        for (const id of beforeIds) {
          const session = getSession(id);
          expect(session).not.toBeNull();
          expect(session!.maxAttendees).toBe(initialMax);
        }

        for (const s of afterSessions) {
          expect(s.maxAttendees).toBe(updatedMax);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5 ──────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 5: Session capacity enforcement', () => {
  it('session becomes Full at maxAttendees, next booking goes to waitlist', async () => {
    /**
     * **Validates: Requirements 7.4**
     *
     * For any session with maxAttendees = N, after exactly N confirmed
     * bookings the session's slotStatus should be 'Full', and the next
     * booking attempt should result in a waitlist entry.
     */
    const maxValues = [1, 2, 3, 5, 10];
    for (let run = 0; run < 100; run++) {
      const maxAtt = maxValues[run % maxValues.length];
      resetAll();

      const tag = uid();
      const program = createProgram({
        name: `P5-${tag}`,
        brandColor: '#112233',
        sessionDurationMinutes: 180,
        slotIntervalMinutes: 15,
        maxAttendees: maxAtt,
        customFormFields: [],
      });

      const { sessions } = createEvent(
        'Test Event',
        ['2026-08-10'],
        ['09:00'],
        '',
        'Europe/London',
        program.id,
        maxAtt,
      );

      const sessionId = sessions[0].id;

      // Book exactly maxAttendees
      for (let i = 0; i < maxAtt; i++) {
        const result = await createBooking(
          makeBookingRequest(sessionId, `p5-${tag}-user${i}@test.com`),
        );
        expect(result.status).toBe('confirmed');
      }

      const fullSession = getSession(sessionId)!;
      expect(fullSession).not.toBeNull();
      expect(fullSession.bookingCount).toBe(maxAtt);
      expect(fullSession.slotStatus).toBe('Full');

      // Next booking should be waitlisted
      const waitlistResult = await createBooking(
        makeBookingRequest(sessionId, `p5-${tag}-overflow@test.com`),
      );
      expect(waitlistResult.status).toBe('waitlisted');

      const waitlistedSession = getSession(sessionId)!;
      expect(waitlistedSession).not.toBeNull();
      expect(waitlistedSession.slotStatus).toBe('Waitlisted');
    }
  });
});

// ─── Property 6 ──────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 6: Cross-program overlap detection', () => {
  it('overlapping bookings across programs are rejected', async () => {
    /**
     * **Validates: Requirements 7.5**
     *
     * For any user email with a confirmed booking in program A, attempting
     * to book a session in program B that overlaps in time should be rejected.
     */
    const timeSlots = ['09:00', '10:00', '11:00'];
    for (let run = 0; run < 100; run++) {
      const timeSlot = timeSlots[run % timeSlots.length];
      resetAll();

      const tag = uid();

      const programA = createProgram({
        name: `P6A-${tag}`,
        brandColor: '#111111',
        sessionDurationMinutes: 180,
        slotIntervalMinutes: 15,
        maxAttendees: 3,
        customFormFields: [],
      });

      const programB = createProgram({
        name: `P6B-${tag}`,
        brandColor: '#222222',
        sessionDurationMinutes: 180,
        slotIntervalMinutes: 15,
        maxAttendees: 3,
        customFormFields: [],
      });

      const { sessions: sessionsA } = createEvent(
        'Event A',
        ['2026-08-10'],
        [timeSlot],
        '',
        'Europe/London',
        programA.id,
        3,
      );

      const { sessions: sessionsB } = createEvent(
        'Event B',
        ['2026-08-10'],
        [timeSlot],
        '',
        'Europe/London',
        programB.id,
        3,
      );

      const email = `p6-${tag}@test.com`;

      const resultA = await createBooking(
        makeBookingRequest(sessionsA[0].id, email),
      );
      expect(resultA.status).toBe('confirmed');

      const resultB = await createBooking(
        makeBookingRequest(sessionsB[0].id, email),
      );
      expect(resultB.status).toBe('rejected');
      if (resultB.status === 'rejected') {
        expect(resultB.reason).toContain('3 hours');
      }
    }
  });
});

// ─── Property 7 ──────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 7: Custom form fields round-trip', () => {
  it('custom field values survive booking creation and retrieval', async () => {
    /**
     * **Validates: Requirements 7.2, 7.3**
     *
     * For any program with custom form fields and any booking submitted
     * with values for those fields, retrieving the booking should return
     * the same custom field values that were submitted.
     */
    const sampleFields = [
      { department: 'Engineering' },
      { role: 'Manager', team: 'Platform' },
      { location: 'London', floor: '3', desk: 'A12' },
      { project: 'Alpha' },
      { skill: 'TypeScript', level: 'Senior', years: '5' },
    ];

    for (let run = 0; run < 100; run++) {
      const fields = sampleFields[run % sampleFields.length];
      resetAll();

      const tag = uid();
      const program = createProgram({
        name: `P7-${tag}`,
        brandColor: '#334455',
        sessionDurationMinutes: 180,
        slotIntervalMinutes: 15,
        maxAttendees: 3,
        customFormFields: [],
      });

      const { sessions } = createEvent(
        'CF Event',
        ['2026-08-10'],
        ['09:00'],
        '',
        'Europe/London',
        program.id,
        3,
      );

      const email = `p7-${tag}@test.com`;
      const request = makeBookingRequest(sessions[0].id, email, fields);

      const result = await createBooking(request as any);
      expect(result.status).toBe('confirmed');

      if (result.status === 'confirmed') {
        expect(result.booking.customFields).toEqual(fields);

        const bookings = getBookingsByEmail(email);
        const found = bookings.find((b) => b.id === result.booking.id);
        expect(found).toBeDefined();
        expect(found!.customFields).toEqual(fields);
      }
    }
  });
});

// ─── Property 10 ─────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 10: Cross-program booking grouping', () => {
  it('bookings group correctly by program', async () => {
    /**
     * **Validates: Requirements 9.1**
     *
     * For any user email with bookings across multiple programs, querying
     * bookings for that email and grouping by program should produce groups
     * where every booking in each group belongs to the correct program.
     */
    const programCounts = [2, 3, 4];
    for (let run = 0; run < 100; run++) {
      const numPrograms = programCounts[run % programCounts.length];
      resetAll();

      const tag = uid();
      const email = `p10-${tag}@test.com`;
      const programSessionMap = new Map<string, string[]>();

      for (let i = 0; i < numPrograms; i++) {
        const program = createProgram({
          name: `P10-${tag}-${i}`,
          brandColor: '#112233',
          sessionDurationMinutes: 180,
          slotIntervalMinutes: 15,
          maxAttendees: 3,
          customFormFields: [],
        });

        // Use different dates to avoid overlap
        const date = `2026-08-${String(10 + i).padStart(2, '0')}`;
        const { sessions } = createEvent(
          `Event ${i}`,
          [date],
          ['09:00'],
          '',
          'Europe/London',
          program.id,
          3,
        );

        programSessionMap.set(program.id, sessions.map((s) => s.id));

        const result = await createBooking(
          makeBookingRequest(sessions[0].id, email),
        );
        expect(result.status).toBe('confirmed');
      }

      const allBookings = getBookingsByEmail(email).filter(
        (b) => b.status === 'confirmed',
      );
      expect(allBookings.length).toBe(numPrograms);

      for (const booking of allBookings) {
        const session = getSession(booking.sessionId);
        expect(session).not.toBeNull();
        const event = getEvent(session!.eventId);
        expect(event).not.toBeNull();

        const programSessions = programSessionMap.get(event!.programId);
        expect(programSessions).toBeDefined();
        expect(programSessions).toContain(booking.sessionId);
      }
    }
  });
});

// ─── Property 11 ─────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 11: CSV export includes program name', () => {
  it('exported CSV has Program column with correct values', async () => {
    /**
     * **Validates: Requirements 5.4**
     *
     * For any set of bookings across programs, the CSV export should
     * contain a "Program" column and each row's program value should
     * match the program name of the booking's session's event.
     */
    const programCounts = [1, 2, 3];
    for (let run = 0; run < 100; run++) {
      const numPrograms = programCounts[run % programCounts.length];
      resetAll();

      const tag = uid();
      const programNames: string[] = [];

      for (let i = 0; i < numPrograms; i++) {
        const name = `P11-${tag}-${i}`;
        programNames.push(name);

        const program = createProgram({
          name,
          brandColor: '#aabbcc',
          sessionDurationMinutes: 180,
          slotIntervalMinutes: 15,
          maxAttendees: 3,
          customFormFields: [],
        });

        const date = `2026-08-${String(10 + i).padStart(2, '0')}`;
        const { sessions } = createEvent(
          `CSV Event ${i}`,
          [date],
          ['09:00'],
          '',
          'Europe/London',
          program.id,
          3,
        );

        await createBooking(
          makeBookingRequest(sessions[0].id, `p11-${tag}-${i}@test.com`),
        );
      }

      const csv = exportBookings();
      const lines = csv.split('\n');

      const header = lines[0];
      expect(header).toContain('Program');

      const headerCols = header.split(',');
      const programColIndex = headerCols.indexOf('Program');
      expect(programColIndex).toBeGreaterThan(-1);

      // Data rows should exist and have correct program names
      expect(lines.length).toBe(numPrograms + 1); // header + data rows
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',');
        const programValue = cols[programColIndex];
        expect(programNames).toContain(programValue);
      }
    }
  });
});
