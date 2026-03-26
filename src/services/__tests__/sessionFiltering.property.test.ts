// Property test: Session and booking filtering
// Feature: career-maze-booking, Property 12: Session and booking filtering
// Validates: Requirements 8.5, 9.2

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  generateSessions,
  getSessions,
  START_DATE,
  END_DATE,
  generateDateRange,
} from '@/services/sessionService';
import { resetBookingStore } from '@/services/bookingService';
import type { Session, SessionFilter, SlotStatus } from '@/models/types';

/** All valid slot statuses */
const SLOT_STATUSES: SlotStatus[] = ['Available', 'Limited', 'Full', 'Waitlisted'];

/** Check whether a session satisfies a given filter */
function satisfiesFilter(session: Session, filter: SessionFilter): boolean {
  if (filter.date && session.sessionDate !== filter.date) return false;

  if (filter.timeRange) {
    const time = session.startTime.slice(0, 5); // HH:MM
    if (time < filter.timeRange.start || time > filter.timeRange.end) return false;
  }

  if (filter.status && session.slotStatus !== filter.status) return false;

  return true;
}

describe('Feature: career-maze-booking, Property 12: Session and booking filtering', () => {
  let sessions: Session[];
  let dates: string[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
    dates = generateDateRange();
  });

  it('should return only sessions matching all active filter criteria and exclude none that match', () => {
    /**
     * **Validates: Requirements 8.5, 9.2**
     *
     * For any filter combination (date, time range, capacity status),
     * the returned sessions must all satisfy every active filter criterion,
     * and no session satisfying all criteria may be excluded from the results.
     */
    // Arbitrary for an optional date filter — pick from the valid date range
    const dateArb = fc.oneof(
      fc.constant(undefined),
      fc.integer({ min: 0, max: 19 }).map((i) => dates[i]),
    );

    // Arbitrary for an optional time range filter — two HH:MM strings where start <= end
    const timeRangeArb = fc.oneof(
      fc.constant(undefined),
      fc
        .tuple(
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
          fc.integer({ min: 0, max: 23 }),
          fc.integer({ min: 0, max: 59 }),
        )
        .map(([h1, m1, h2, m2]) => {
          const t1 = `${String(h1).padStart(2, '0')}:${String(m1).padStart(2, '0')}`;
          const t2 = `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}`;
          // Ensure start <= end
          return t1 <= t2 ? { start: t1, end: t2 } : { start: t2, end: t1 };
        }),
    );

    // Arbitrary for an optional status filter
    const statusArb = fc.oneof(
      fc.constant(undefined),
      fc.constantFrom(...SLOT_STATUSES),
    );

    fc.assert(
      fc.property(dateArb, timeRangeArb, statusArb, (date, timeRange, status) => {
        // Reset and regenerate for each run
        resetBookingStore();
        sessions = generateSessions();

        const filter: SessionFilter = {};
        if (date !== undefined) filter.date = date;
        if (timeRange !== undefined) filter.timeRange = timeRange;
        if (status !== undefined) filter.status = status;

        const filtered = getSessions(filter);
        const allSessions = getSessions();

        // 1. Every returned session must satisfy ALL active filter criteria
        for (const session of filtered) {
          expect(satisfiesFilter(session, filter)).toBe(true);
        }

        // 2. No session satisfying all criteria is excluded from results
        const filteredIds = new Set(filtered.map((s) => s.id));
        for (const session of allSessions) {
          if (satisfiesFilter(session, filter)) {
            expect(filteredIds.has(session.id)).toBe(true);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});
