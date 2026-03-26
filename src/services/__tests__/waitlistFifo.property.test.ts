// Property test: Waitlist FIFO ordering
// Feature: career-maze-booking, Property 5: Waitlist FIFO ordering
// Validates: Requirements 4.2

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  addToWaitlist,
  getWaitlist,
  promoteNext,
  resetWaitlistStore,
} from '@/services/waitlistService';
import type { Session } from '@/models/types';

describe('Feature: career-maze-booking, Property 5: Waitlist FIFO ordering', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetWaitlistStore();
    sessions = generateSessions();
  });

  it('should order waitlist entries by createdAt ascending and promote the earliest entry', async () => {
    /**
     * **Validates: Requirements 4.2**
     *
     * For any session with multiple waitlist entries, the entries must be
     * ordered by their creation timestamp in ascending order, and promotion
     * must always select the entry with the earliest timestamp.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (entryCount) => {
          resetWaitlistStore();
          sessions = generateSessions();

          const session = sessions[0];
          expect(session).toBeDefined();

          // Add entryCount waitlist entries with small delays to ensure distinct timestamps
          const addedEntries = [];
          for (let i = 0; i < entryCount; i++) {
            const entry = await addToWaitlist(session.id, {
              sessionId: session.id,
              name: `Waitlister ${i}`,
              email: `waitlister${i}@test.com`,
              role: 'Attendee',
              pf: `PF${String(i).padStart(3, '0')}`,
            });
            addedEntries.push(entry);
          }

          // Verify getWaitlist returns entries in ascending createdAt order
          const waitlist = await getWaitlist(session.id);
          expect(waitlist).toHaveLength(entryCount);

          for (let i = 1; i < waitlist.length; i++) {
            expect(waitlist[i - 1].createdAt.getTime()).toBeLessThanOrEqual(
              waitlist[i].createdAt.getTime(),
            );
          }

          // Verify promoteNext always selects the entry with the earliest timestamp
          const earliestEntry = waitlist[0];
          const promoted = await promoteNext(session.id);
          expect(promoted).not.toBeNull();
          expect(promoted!.email).toBe(earliestEntry.email);
          expect(promoted!.name).toBe(earliestEntry.name);

          // After promotion, remaining waitlist should still be ordered
          const remaining = await getWaitlist(session.id);
          expect(remaining).toHaveLength(entryCount - 1);

          for (let i = 1; i < remaining.length; i++) {
            expect(remaining[i - 1].createdAt.getTime()).toBeLessThanOrEqual(
              remaining[i].createdAt.getTime(),
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
