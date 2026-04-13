// Property test: Export contains all required fields
// Feature: career-maze-booking, Property 14: Export contains all required fields
// Validates: Requirements 9.1

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { generateSessions } from '@/services/sessionService';
import {
  createBooking,
  resetBookingStore,
  exportBookings,
} from '@/services/bookingService';
import type { Session } from '@/models/types';

const REQUIRED_COLUMNS = [
  'Booking ID',
  'Session Date',
  'Session Time',
  'Name',
  'Email',
  'Role',
  'PF',
  'Booking Timestamp',
  'Status',
] as const;

describe('Feature: career-maze-booking, Property 14: Export contains all required fields', () => {
  let sessions: Session[];

  beforeEach(() => {
    resetBookingStore();
    sessions = generateSessions();
  });

  it('should produce CSV with all 9 required columns and one row per confirmed booking', async () => {
    /**
     * **Validates: Requirements 9.1**
     *
     * For any set of bookings, the exported CSV must contain one row per
     * booking, and each row must include: booking ID, session date, session
     * time, attendee name, email, role, PF, booking timestamp, and status.
     */
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            sessionIndex: fc.integer({ min: 0, max: 299 }),
            name: fc.stringMatching(/^[A-Za-z ]{1,20}$/),
            email: fc.emailAddress(),
            role: fc.stringMatching(/^[A-Za-z]{1,15}$/),
            pf: fc.stringMatching(/^[A-Za-z0-9]{1,8}$/),
          }),
          { minLength: 1, maxLength: 20 },
        ),
        async (bookingInputs) => {
          resetBookingStore();
          sessions = generateSessions();

          // Track confirmed bookings
          let confirmedCount = 0;
          for (const input of bookingInputs) {
            const session = sessions[input.sessionIndex];
            const result = await createBooking({
              sessionId: session.id,
              name: input.name,
              email: input.email,
              role: input.role,
              pf: input.pf,
            });
            if (result.status === 'confirmed') {
              confirmedCount++;
            }
          }

          // Export and parse CSV
          const csv = exportBookings();
          const lines = csv.split('\n');

          // Header row must contain all 9 required columns
          const header = lines[0];
          for (const col of REQUIRED_COLUMNS) {
            expect(header).toContain(col);
          }

          // Data rows: one per booking (confirmed + cancelled)
          const dataRows = lines.slice(1).filter((l) => l.trim().length > 0);

          // At minimum, we should have confirmedCount rows (all are confirmed, none cancelled in this test)
          expect(dataRows.length).toBe(confirmedCount);

          // Each data row must have all 9 field values (non-empty)
          for (const row of dataRows) {
            const fields = row.split(',');
            expect(fields.length).toBeGreaterThanOrEqual(REQUIRED_COLUMNS.length);

            const [bookingId, sessionDate, sessionTime, name, email, role, pf, timestamp, status] = fields;

            // All required fields must be non-empty
            expect(bookingId.length).toBeGreaterThan(0);
            expect(sessionDate.length).toBeGreaterThan(0);
            expect(sessionTime.length).toBeGreaterThan(0);
            expect(name.length).toBeGreaterThan(0);
            expect(email.length).toBeGreaterThan(0);
            expect(role.length).toBeGreaterThan(0);
            expect(pf.length).toBeGreaterThan(0);
            expect(timestamp.length).toBeGreaterThan(0);
            expect(status.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
