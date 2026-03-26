// Property test: API validation returns correct error codes
// Feature: career-maze-booking, Property 17: API validation returns correct error codes
// Validates: Requirements 3.1, 12.2, 12.3

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/bookings/route';
import { DELETE } from '@/app/api/bookings/[id]/route';
import { generateSessions } from '@/services/sessionService';
import { createBooking, resetBookingStore } from '@/services/bookingService';
import type { Session } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REQUIRED_FIELDS = ['name', 'email', 'role', 'pf', 'sessionId'] as const;

let sessions: Session[];

beforeAll(() => {
  sessions = generateSessions();
});

function makePostRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('/api/bookings', 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(
  id: string,
  body: unknown,
): { request: NextRequest; params: Promise<{ id: string }> } {
  return {
    request: new NextRequest(
      new URL(`/api/bookings/${id}`, 'http://localhost:3000'),
      {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ),
    params: Promise.resolve({ id }),
  };
}

/**
 * Arbitrary that produces a non-empty subset of required field names to omit.
 * At least one field is always omitted.
 */
const omittedFieldsArb = fc
  .subarray([...REQUIRED_FIELDS], { minLength: 1, maxLength: 5 })
  .filter((arr) => arr.length >= 1);

/**
 * Arbitrary that produces strings which are NOT valid emails.
 * Avoids generating anything that matches the simple email regex used by the API.
 */
const invalidEmailArb = fc.oneof(
  fc.constant('plaintext'),
  fc.constant('missing@tld'),
  fc.constant('@no-local.com'),
  fc.constant('spaces in@email.com'),
  fc.constant('no-at-sign.com'),
  fc.constant('double@@at.com'),
  fc.stringOf(fc.constantFrom('a', 'b', '1', '-', '_'), { minLength: 1, maxLength: 20 }),
);

describe('Feature: career-maze-booking, Property 17: API validation returns correct error codes', () => {
  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  // ─── POST /api/bookings — Missing fields ────────────────────────────────

  it('should return 400 when required fields are missing from POST /api/bookings', async () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any API request with missing required parameters, the system must
     * return HTTP 400 with a descriptive error message listing the missing fields.
     */
    await fc.assert(
      fc.asyncProperty(
        omittedFieldsArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 359 }),
        async (omittedFields, name, email, role, pf, sessionIndex) => {
          resetBookingStore();
          sessions = generateSessions();

          const session = sessions[sessionIndex];

          // Build a complete body, then remove the omitted fields
          const fullBody: Record<string, string> = {
            name,
            email,
            role,
            pf,
            sessionId: session.id,
          };

          const body: Record<string, string> = { ...fullBody };
          for (const field of omittedFields) {
            delete body[field];
          }

          const res = await POST(makePostRequest(body));
          const json = await res.json();

          expect(res.status).toBe(400);
          expect(json.error).toBeTruthy();
          expect(typeof json.error).toBe('string');

          // Every omitted field should appear in missingFields
          for (const field of omittedFields) {
            expect(json.missingFields).toContain(field);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // ─── POST /api/bookings — Invalid email ─────────────────────────────────

  it('should return 400 for invalid email formats in POST /api/bookings', async () => {
    /**
     * **Validates: Requirements 12.3**
     *
     * For any API request with an invalid email format (but all required
     * fields present), the system must return HTTP 400 with a descriptive
     * error message about the email.
     */
    await fc.assert(
      fc.asyncProperty(
        invalidEmailArb,
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 359 }),
        async (badEmail, name, role, pf, sessionIndex) => {
          resetBookingStore();
          sessions = generateSessions();

          const session = sessions[sessionIndex];

          // Only test emails that truly fail the regex /^[^\s@]+@[^\s@]+\.[^\s@]+$/
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          fc.pre(!emailRegex.test(badEmail));

          const body = {
            name,
            email: badEmail,
            role,
            pf,
            sessionId: session.id,
          };

          const res = await POST(makePostRequest(body));
          const json = await res.json();

          expect(res.status).toBe(400);
          expect(json.error).toBeTruthy();
          expect(typeof json.error).toBe('string');
        },
      ),
      { numRuns: 100 },
    );
  });

  // ─── POST /api/bookings — Empty/whitespace fields ──────────────────────

  it('should return 400 when fields are empty strings in POST /api/bookings', async () => {
    /**
     * **Validates: Requirements 3.1, 12.3**
     *
     * For any API request where required fields are present but set to
     * empty or whitespace-only strings, the system must return HTTP 400.
     */
    await fc.assert(
      fc.asyncProperty(
        omittedFieldsArb,
        fc.constantFrom('', '   ', '\t', '\n'),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.integer({ min: 0, max: 359 }),
        async (fieldsToBlank, blankValue, name, email, role, pf, sessionIndex) => {
          resetBookingStore();
          sessions = generateSessions();

          const session = sessions[sessionIndex];

          const body: Record<string, string> = {
            name,
            email,
            role,
            pf,
            sessionId: session.id,
          };

          // Set chosen fields to blank values
          for (const field of fieldsToBlank) {
            body[field] = blankValue;
          }

          const res = await POST(makePostRequest(body));
          const json = await res.json();

          expect(res.status).toBe(400);
          expect(json.error).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  // ─── DELETE /api/bookings/:id — Missing email ──────────────────────────

  it('should return 400 when email is missing or empty in DELETE /api/bookings/:id', async () => {
    /**
     * **Validates: Requirements 12.3**
     *
     * For any DELETE cancellation request with a missing or empty email field,
     * the system must return HTTP 400 with a descriptive error message.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 17 }),
        fc.oneof(
          fc.constant({}),
          fc.constant({ email: '' }),
          fc.constant({ email: '   ' }),
          fc.constant({ email: null }),
          fc.constant({ email: 123 }),
          fc.record({
            unrelated: fc.string({ minLength: 1, maxLength: 20 }),
          }),
        ),
        async (sessionIndex, body) => {
          resetBookingStore();
          sessions = generateSessions();

          const session = sessions[sessionIndex];

          // Create a booking so we have a valid ID to target
          const result = await createBooking({
            sessionId: session.id,
            name: 'Test User',
            email: 'test@example.com',
            role: 'Tester',
            pf: 'PF001',
          });

          if (result.status !== 'confirmed') return; // skip if not confirmed

          const { request, params } = makeDeleteRequest(result.booking.id, body);
          const res = await DELETE(request, { params });
          const json = await res.json();

          expect(res.status).toBe(400);
          expect(json.error).toBeTruthy();
          expect(typeof json.error).toBe('string');
        },
      ),
      { numRuns: 100 },
    );
  });
});
