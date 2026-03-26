import { describe, it, expect } from 'vitest';
import { generateIcs, parseIcs } from '@/services/calendarService';
import type { Booking, Session } from '@/models/types';

// ─── Test fixtures ───────────────────────────────────────────────────────────

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-001',
    sessionDate: '2026-08-03',
    startTime: '09:00:00',
    bookingCount: 1,
    slotStatus: 'Limited',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-001',
    sessionId: 'session-001',
    name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'Engineer',
    pf: 'PF-42',
    status: 'confirmed',
    referenceCode: 'CM-0001ABCD',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    cancelledAt: null,
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CalendarService', () => {
  describe('generateIcs', () => {
    it('produces valid ICS content with required fields', () => {
      const ics = generateIcs(makeBooking(), makeSession());

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('END:VCALENDAR');
      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('END:VEVENT');
    });

    it('includes Europe/London timezone in DTSTART and VTIMEZONE', () => {
      const ics = generateIcs(makeBooking(), makeSession());

      expect(ics).toContain('TZID:Europe/London');
      expect(ics).toContain('DTSTART;TZID=Europe/London:');
    });

    it('includes VTIMEZONE block for Europe/London with GMT and BST', () => {
      const ics = generateIcs(makeBooking(), makeSession());

      expect(ics).toContain('BEGIN:VTIMEZONE');
      expect(ics).toContain('END:VTIMEZONE');
      expect(ics).toContain('TZNAME:GMT');
      expect(ics).toContain('TZNAME:BST');
    });

    it('sets correct start time for the session', () => {
      const session = makeSession({ startTime: '10:30:00' });
      const ics = generateIcs(makeBooking(), session);

      expect(ics).toContain('DTSTART;TZID=Europe/London:20260803T103000');
    });

    it('specifies 3-hour duration', () => {
      const ics = generateIcs(makeBooking(), makeSession());

      expect(ics).toContain('DURATION:PT3H');
    });

    it('includes booking details in summary and description', () => {
      const booking = makeBooking({ name: 'Bob Jones', referenceCode: 'CM-TEST1234' });
      const ics = generateIcs(booking, makeSession());

      expect(ics).toContain('SUMMARY:Career Maze Session');
      expect(ics).toContain('CM-TEST1234');
    });

    it('uses booking id as UID', () => {
      const booking = makeBooking({ id: 'unique-booking-id' });
      const ics = generateIcs(booking, makeSession());

      expect(ics).toContain('unique-booking-id');
    });
  });

  describe('parseIcs', () => {
    it('extracts start time, summary, and timezone', () => {
      const ics = generateIcs(makeBooking(), makeSession());
      const event = parseIcs(ics);

      expect(event.summary).toContain('Career Maze Session');
      expect(event.timezone).toBe('Europe/London');
      expect(event.startTime).toBeInstanceOf(Date);
      expect(event.endTime).toBeInstanceOf(Date);
    });

    it('parses correct start time and computes end from DURATION', () => {
      const session = makeSession({ sessionDate: '2026-08-10', startTime: '14:15:00' });
      const ics = generateIcs(makeBooking(), session);
      const event = parseIcs(ics);

      expect(event.startTime.getUTCFullYear()).toBe(2026);
      expect(event.startTime.getUTCMonth()).toBe(7); // August = 7 (0-indexed)
      expect(event.startTime.getUTCDate()).toBe(10);
      expect(event.startTime.getUTCHours()).toBe(14);
      expect(event.startTime.getUTCMinutes()).toBe(15);

      // 3-hour duration: 14:15 → 17:15
      expect(event.endTime.getUTCHours()).toBe(17);
      expect(event.endTime.getUTCMinutes()).toBe(15);
    });

    it('throws on invalid ICS content', () => {
      expect(() => parseIcs('not valid ics')).toThrow();
    });
  });

  describe('round-trip', () => {
    it('generate then parse preserves session date and 3-hour duration', () => {
      const session = makeSession({ sessionDate: '2026-08-15', startTime: '11:00:00' });
      const booking = makeBooking();

      const ics = generateIcs(booking, session);
      const event = parseIcs(ics);

      // Verify date
      expect(event.startTime.getUTCFullYear()).toBe(2026);
      expect(event.startTime.getUTCMonth()).toBe(7);
      expect(event.startTime.getUTCDate()).toBe(15);

      // Verify start time
      expect(event.startTime.getUTCHours()).toBe(11);
      expect(event.startTime.getUTCMinutes()).toBe(0);

      // Verify 3-hour duration
      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      expect(durationMs).toBe(3 * 60 * 60 * 1000);

      // Verify timezone
      expect(event.timezone).toBe('Europe/London');
    });

    it('round-trip works for afternoon session', () => {
      const session = makeSession({ sessionDate: '2026-08-20', startTime: '14:30:00' });
      const ics = generateIcs(makeBooking(), session);
      const event = parseIcs(ics);

      expect(event.startTime.getUTCHours()).toBe(14);
      expect(event.startTime.getUTCMinutes()).toBe(30);

      const durationMs = event.endTime.getTime() - event.startTime.getTime();
      expect(durationMs).toBe(3 * 60 * 60 * 1000);
      expect(event.timezone).toBe('Europe/London');
    });
  });
});
