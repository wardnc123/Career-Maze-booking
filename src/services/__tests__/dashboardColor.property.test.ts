// Property test: Dashboard color indicator mapping
// Feature: career-maze-booking, Property 11: Dashboard color indicator mapping
// Validates: Requirements 8.2

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getIndicatorColor } from '@/lib/dashboardColor';

describe('Feature: career-maze-booking, Property 11: Dashboard color indicator mapping', () => {
  it('should map booking counts to correct color indicators', () => {
    /**
     * **Validates: Requirements 8.2**
     *
     * For any session, the color indicator must be Green when booking count
     * is 0 or 1, Yellow when booking count is 2, and Red when booking count is 3.
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        (bookingCount) => {
          const result = getIndicatorColor(bookingCount);

          if (bookingCount <= 1) {
            expect(result.label).toBe('Green');
            expect(result.bg).toContain('green');
            expect(result.text).toContain('green');
          } else if (bookingCount === 2) {
            expect(result.label).toBe('Yellow');
            expect(result.bg).toContain('yellow');
            expect(result.text).toContain('yellow');
          } else {
            // bookingCount === 3
            expect(result.label).toBe('Red');
            expect(result.bg).toContain('red');
            expect(result.text).toContain('red');
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
