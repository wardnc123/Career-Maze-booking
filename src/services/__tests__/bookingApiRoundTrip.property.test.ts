// Property test: Booking API round-trip
// Feature: career-maze-booking, Property 16: Booking API round-trip
// Validates: Requirements 12.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bookings/route';
import { generateSessions } from '@/services/sessionService';
import { resetBookingStore, getBookingsByEmail } from '@/services/bookingService';
import type { Session } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let sessions: Session[];

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('/api/bookings', 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Arbitrary for valid names: non-empty alphanumeric strings with spaces.
 */
const nameArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), {
    minLength: 2,
    maxLength: 30,
  })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for valid roles.
 */
const roleArb = fc
  .stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz '.split('')), {
    minLength: 2,
    maxLength: 30,
  })
  .filter((s) => s.trim().length > 0);

/**
 * Arbitrary for valid PF values.
 */
const pfArb = fc
  .stringOf(fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('')), {
    minLength: 2,
    maxLength: 10,
  })
  .filter((s) => s.trim().length > 0);

describe('Feature: career-maze-booking, Property 16: Booking API round-trip', () => {
  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should round-trip: creating a booking via POST API then retrieving via service returns matching fields', async () => {
    /**
     * **Validates: Requirements 12.4**
     *
     * For any valid booking creation request, creating a booking via the POST API
     * and then looking it up via the booking service must return a booking object
     * whose name, email, role, PF, session ID, and status match the original request data.
     */
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        fc.emailAddress(),
        roleArb,
        pfArb,
        fc.integer({ min: 0, max: 299 }),
        async (name, email, role, pf, sessionIndex) => {
          // Reset state for each iteration to avoid overlap/duplicate rejections
          resetBookingStore();
          sessions = generateSessions();

          const session = sessions[sessionIndex];

          const body = {
            name,
            email,
            role,
            pf,
            sessionId: session.id,
          };

          // Create booking via POST API
          const res = await POST(makePostRequest(body));
          const json = await res.json();

          // Should be confirmed (session is fresh with 0 bookings)
          expect(res.status).toBe(201);
          expect(json.status).toBe('confirmed');
          expect(json.booking).toBeDefined();

          // Retrieve via booking service
          const found = getBookingsByEmail(email);
          expect(found.length).toBeGreaterThanOrEqual(1);

          const match = found.find((b) => b.id === json.booking.id);
          expect(match).toBeDefined();

          // Verify all fields match the original request
          expect(match!.name).toBe(name.trim());
          expect(match!.email).toBe(email.trim());
          expect(match!.role).toBe(role.trim());
          expect(match!.pf).toBe(pf.trim());
          expect(match!.sessionId).toBe(session.id);
          expect(match!.status).toBe('confirmed');
        },
      ),
      { numRuns: 100 },
    );
  });
});
