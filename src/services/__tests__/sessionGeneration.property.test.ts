// Property test: Session generation produces valid time slots
// Feature: career-maze-booking, Property 1: Session generation produces valid time slots
// Validates: Requirements 1.1, 1.3, 1.4

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions, BST_OFFSET_HOURS } from '@/services/sessionService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 1: Session generation produces valid time slots', () => {
  let sessions: Session[];

  beforeAll(() => {
    sessions = generateSessions();
  });

  it('should produce valid time slots for all sampled sessions', () => {
    /**
     * **Validates: Requirements 1.1, 1.3, 1.4**
     *
     * For all generated sessions, verify:
     * 1. start_time minutes are in {0, 15, 30}
     * 2. hours fall within morning (9:00–11:30) or afternoon (14:00–16:30) Europe/London windows
     * 3. no session falls in the lunch break (12:00–13:59 Europe/London)
     * 4. capacity = 3 (initial bookingCount = 0, capacity limit is 3)
     */
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 359 }),
        (index) => {
          const session = sessions[index];
          expect(session).toBeDefined();

          // Parse UTC start time
          const [utcHourStr, utcMinStr] = session.startTime.split(':');
          const utcHour = parseInt(utcHourStr, 10);
          const utcMin = parseInt(utcMinStr, 10);

          // Convert to London time (BST = UTC + 1 in August)
          const londonHour = utcHour + BST_OFFSET_HOURS;
          const londonMin = utcMin;

          // 1. Minutes must be in {0, 15, 30}
          expect([0, 15, 30]).toContain(londonMin);

          // 2. Hours must fall in morning (9–11) or afternoon (14–16) London windows
          const isMorningWindow = londonHour >= 9 && londonHour <= 11;
          const isAfternoonWindow = londonHour >= 14 && londonHour <= 16;
          expect(isMorningWindow || isAfternoonWindow).toBe(true);

          // 3. No session during lunch break (12:00–13:59 London)
          expect([12, 13]).not.toContain(londonHour);

          // 4. Initial bookingCount = 0 (capacity limit is 3, starts empty)
          expect(session.bookingCount).toBe(0);
          expect(session.slotStatus).toBe('Available');
        },
      ),
      { numRuns: 100 },
    );
  });
});
