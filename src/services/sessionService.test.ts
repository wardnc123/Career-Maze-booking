import { describe, it, expect, beforeAll } from 'vitest';
import {
  generateSessions,
  getSessions,
  getSession,
  getSessionsByDate,
  MORNING_SLOTS_LONDON,
  AFTERNOON_SLOTS_LONDON,
  ALL_SLOTS_LONDON,
  SESSIONS_PER_DAY,
  TOTAL_SESSIONS,
  BST_OFFSET_HOURS,
  START_DATE,
  END_DATE,
  londonToUtc,
  generateDateRange,
} from './sessionService';
import type { Session } from '@/models/types';

describe('SessionService', () => {
  let sessions: Session[];

  beforeAll(() => {
    sessions = generateSessions();
  });

  // ─── generateSessions ───────────────────────────────────────────────

  describe('generateSessions()', () => {
    it('produces exactly 360 sessions', () => {
      expect(sessions).toHaveLength(TOTAL_SESSIONS);
    });

    it('produces 18 sessions per day', () => {
      const dates = generateDateRange();
      for (const date of dates) {
        const daySessions = sessions.filter((s) => s.sessionDate === date);
        expect(daySessions).toHaveLength(SESSIONS_PER_DAY);
      }
    });

    it('covers exactly 20 days (Aug 3–22, 2026)', () => {
      const uniqueDates = new Set(sessions.map((s) => s.sessionDate));
      expect(uniqueDates.size).toBe(20);
      expect(uniqueDates.has(START_DATE)).toBe(true);
      expect(uniqueDates.has(END_DATE)).toBe(true);
    });

    it('all sessions have bookingCount 0 and status Available', () => {
      for (const s of sessions) {
        expect(s.bookingCount).toBe(0);
        expect(s.slotStatus).toBe('Available');
      }
    });

    it('all session IDs are unique', () => {
      const ids = sessions.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // ─── Time slot validation ──────────────────────────────────────────

  describe('time slots', () => {
    it('all start times have minutes in {00, 15, 30}', () => {
      for (const s of sessions) {
        const minutes = parseInt(s.startTime.split(':')[1], 10);
        expect([0, 15, 30]).toContain(minutes);
      }
    });

    it('all start times fall in morning or afternoon local time windows', () => {
      // Sessions store start times in local timezone (London) as HH:MM:SS
      const validLocalTimes = new Set(ALL_SLOTS_LONDON.map(t => t + ':00'));
      for (const s of sessions) {
        expect(validLocalTimes.has(s.startTime)).toBe(true);
      }
    });

    it('no sessions during lunch break (13:00–13:59 London)', () => {
      for (const s of sessions) {
        const hour = parseInt(s.startTime.split(':')[0], 10);
        expect(hour).not.toBe(13);
      }
    });
  });

  // ─── londonToUtc ───────────────────────────────────────────────────

  describe('londonToUtc()', () => {
    it('converts 09:00 London to 08:00:00 UTC', () => {
      expect(londonToUtc('09:00')).toBe('08:00:00');
    });

    it('converts 16:30 London to 15:30:00 UTC', () => {
      expect(londonToUtc('16:30')).toBe('15:30:00');
    });
  });

  // ─── getSessions ──────────────────────────────────────────────────

  describe('getSessions()', () => {
    it('returns all sessions when no filter is provided', () => {
      const result = getSessions();
      expect(result).toHaveLength(TOTAL_SESSIONS);
    });

    it('filters by date', () => {
      const result = getSessions({ date: '2026-08-05' });
      expect(result).toHaveLength(SESSIONS_PER_DAY);
      for (const s of result) {
        expect(s.sessionDate).toBe('2026-08-05');
      }
    });

    it('filters by time range (UTC)', () => {
      const result = getSessions({ timeRange: { start: '08:00', end: '08:30' } });
      for (const s of result) {
        const time = s.startTime.slice(0, 5);
        expect(time >= '08:00' && time <= '08:30').toBe(true);
      }
    });

    it('filters by status', () => {
      const result = getSessions({ status: 'Available' });
      expect(result).toHaveLength(TOTAL_SESSIONS); // all are Available initially
    });

    it('returns empty for non-existent date', () => {
      const result = getSessions({ date: '2026-07-01' });
      expect(result).toHaveLength(0);
    });
  });

  // ─── getSession ───────────────────────────────────────────────────

  describe('getSession()', () => {
    it('returns a session by ID', () => {
      const target = sessions[0];
      const result = getSession(target.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(target.id);
    });

    it('returns null for unknown ID', () => {
      expect(getSession('nonexistent-id')).toBeNull();
    });
  });

  // ─── getSessionsByDate ────────────────────────────────────────────

  describe('getSessionsByDate()', () => {
    it('returns 18 sessions for a valid date', () => {
      const result = getSessionsByDate('2026-08-10');
      expect(result).toHaveLength(SESSIONS_PER_DAY);
    });

    it('returns empty array for out-of-range date', () => {
      expect(getSessionsByDate('2026-09-01')).toHaveLength(0);
    });
  });
});
