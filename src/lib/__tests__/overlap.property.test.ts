// Property test: 3-hour overlap detection
// Feature: career-maze-booking, Property 3: 3-hour overlap detection
// Validates: Requirements 1.5, 3.5

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hasOverlap } from '@/lib/overlap';

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

describe('Feature: career-maze-booking, Property 3: 3-hour overlap detection', () => {
  it('should reject overlapping 3-hour windows (|t1 - t2| < 3 hours)', () => {
    /**
     * **Validates: Requirements 1.5, 3.5**
     *
     * Generate two random dates where the absolute difference is less than 3 hours.
     * The hasOverlap function must return true since the 3-hour windows overlap.
     */
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2026-08-03T00:00:00Z'), max: new Date('2026-08-22T23:59:59Z') }),
        fc.integer({ min: 0, max: THREE_HOURS_MS - 1 }),
        fc.boolean(),
        (baseTime, offsetMs, direction) => {
          const t1 = baseTime;
          const t2 = new Date(
            direction
              ? t1.getTime() + offsetMs
              : t1.getTime() - offsetMs,
          );

          const existing = [{ startTime: t1 }];
          expect(hasOverlap(existing, t2)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should allow non-overlapping 3-hour windows (|t1 - t2| >= 3 hours)', () => {
    /**
     * **Validates: Requirements 1.5, 3.5**
     *
     * Generate two random dates where the absolute difference is >= 3 hours.
     * The hasOverlap function must return false since the 3-hour windows do not overlap.
     */
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2026-08-03T00:00:00Z'), max: new Date('2026-08-22T23:59:59Z') }),
        fc.integer({ min: THREE_HOURS_MS, max: 48 * 60 * 60 * 1000 }),
        fc.boolean(),
        (baseTime, offsetMs, direction) => {
          const t1 = baseTime;
          const t2 = new Date(
            direction
              ? t1.getTime() + offsetMs
              : t1.getTime() - offsetMs,
          );

          const existing = [{ startTime: t1 }];
          expect(hasOverlap(existing, t2)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should always detect overlap when both times are identical (reflexive)', () => {
    /**
     * **Validates: Requirements 1.5, 3.5**
     *
     * For any date, hasOverlap with the same time must return true,
     * since identical windows fully overlap.
     */
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2026-08-03T00:00:00Z'), max: new Date('2026-08-22T23:59:59Z') }),
        (time) => {
          const existing = [{ startTime: time }];
          expect(hasOverlap(existing, time)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});
