// Property test: Admin session expiry after inactivity
// Feature: career-maze-booking, Property 15: Admin session expiry after inactivity
// Validates: Requirements 10.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createAdmin,
  login,
  validateSession,
  resetAuthStore,
  SESSION_TIMEOUT_MS,
} from '@/services/authService';

describe('Feature: career-maze-booking, Property 15: Admin session expiry after inactivity', () => {
  beforeEach(async () => {
    resetAuthStore();
    await createAdmin('admin', 'password123');
  });

  it('should expire sessions when last_active_at + 30 min < now, and keep active sessions valid', async () => {
    /**
     * **Validates: Requirements 10.4**
     *
     * For any admin session, if the time elapsed since last_active_at exceeds
     * 30 minutes, the session must be considered expired and validateSession
     * must return null. If the time elapsed is within 30 minutes,
     * validateSession must return the session.
     */
    await fc.assert(
      fc.asyncProperty(
        // Generate random offsets from 0 to 120 minutes (in milliseconds)
        fc.integer({ min: 0, max: 120 * 60 * 1000 }),
        async (offsetMs) => {
          // Create a fresh session for this iteration
          const session = await login('admin', 'password123');
          expect(session).not.toBeNull();

          // Set lastActiveAt to (now - offsetMs) to simulate elapsed inactivity
          session!.lastActiveAt = new Date(Date.now() - offsetMs);

          const result = validateSession(session!.id);

          if (offsetMs > SESSION_TIMEOUT_MS) {
            // Elapsed time exceeds 30 minutes — session must be expired
            expect(result).toBeNull();
          } else {
            // Elapsed time is within 30 minutes — session must be valid
            expect(result).not.toBeNull();
            expect(result!.id).toBe(session!.id);
          }
        },
      ),
      { numRuns: 100 },
    );
  }, 60_000);
});
