// Property test: Slot status derivation
// Feature: career-maze-booking, Property 2: Slot status derivation
// Validates: Requirements 2.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { deriveSlotStatus } from '@/lib/slotStatus';

describe('Feature: career-maze-booking, Property 2: Slot status derivation', () => {
  it('should derive correct slot status for any valid bookingCount and waitlistCount', () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * For any session with bookingCount in [0, 3] and waitlistCount in [0, 50]:
     * - Available when bookingCount === 0
     * - Limited when bookingCount is 1 or 2
     * - Full when bookingCount === 3 and waitlistCount === 0
     * - Waitlisted when bookingCount === 3 and waitlistCount > 0
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 50 }),
        (bookingCount, waitlistCount) => {
          const status = deriveSlotStatus(bookingCount, waitlistCount);

          if (bookingCount === 0) {
            expect(status).toBe('Available');
          } else if (bookingCount >= 1 && bookingCount <= 2) {
            expect(status).toBe('Limited');
          } else if (bookingCount === 3 && waitlistCount === 0) {
            expect(status).toBe('Full');
          } else if (bookingCount === 3 && waitlistCount > 0) {
            expect(status).toBe('Waitlisted');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
