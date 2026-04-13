// Property tests for Program Service
// Feature: booking-platform

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  createProgram,
  updateProgram,
  getProgram,
  getPrograms,
  getProgramByName,
} from '@/services/programService';
import type { CreateProgramInput } from '@/services/programService';
import { setProgramsStore } from '@/lib/dataManager';
import type { CustomFormField } from '@/models/types';

// ─── Generators ──────────────────────────────────────────────────────────────

const validSessionDurations = fc.constantFrom(30, 60, 120, 180);
const validSlotIntervals = fc.constantFrom(15, 30, 60);
const validMaxAttendees = fc.constantFrom(1, 2, 3, 5, 10);

const validBrandColor = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);

const customFormFieldArb: fc.Arbitrary<CustomFormField> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
  label: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  type: fc.constantFrom('text' as const, 'select' as const, 'textarea' as const),
  required: fc.boolean(),
  options: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }), { nil: undefined }),
});

const validProgramName = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

const validCreateProgramInput: fc.Arbitrary<CreateProgramInput> = fc.record({
  name: validProgramName,
  brandColor: validBrandColor,
  sessionDurationMinutes: validSessionDurations,
  slotIntervalMinutes: validSlotIntervals,
  maxAttendees: validMaxAttendees,
  customFormFields: fc.array(customFormFieldArb, { minLength: 0, maxLength: 3 }),
  calendarInviteTitleTemplate: fc.option(
    fc.string({ minLength: 1, maxLength: 100 }),
    { nil: undefined },
  ),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Feature: booking-platform, Property 1: Program creation round-trip', () => {
  beforeEach(() => {
    setProgramsStore([]);
  });

  it('should store and retrieve all fields matching the original input', () => {
    /**
     * **Validates: Requirements 1.1, 3.2**
     *
     * For any valid program configuration, creating a program and then
     * retrieving it by ID should return a program with all fields matching
     * the original input.
     */
    fc.assert(
      fc.property(validCreateProgramInput, (input) => {
        setProgramsStore([]);

        const created = createProgram(input);
        const retrieved = getProgram(created.id);

        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
        expect(retrieved!.name).toBe(input.name.trim());
        expect(retrieved!.brandColor).toBe(input.brandColor);
        expect(retrieved!.sessionDurationMinutes).toBe(input.sessionDurationMinutes);
        expect(retrieved!.slotIntervalMinutes).toBe(input.slotIntervalMinutes);
        expect(retrieved!.maxAttendees).toBe(input.maxAttendees);
        expect(retrieved!.customFormFields).toEqual(input.customFormFields);
        expect(retrieved!.active).toBe(true);
        expect(retrieved!.createdAt).toBeInstanceOf(Date);

        if (input.calendarInviteTitleTemplate) {
          expect(retrieved!.calendarInviteTitleTemplate).toBe(
            input.calendarInviteTitleTemplate,
          );
        } else {
          expect(retrieved!.calendarInviteTitleTemplate).toBe(
            '{programName} Session — {userName}',
          );
        }
      }),
      { numRuns: 100 },
    );
  });
});


describe('Feature: booking-platform, Property 2: Program name uniqueness enforcement', () => {
  beforeEach(() => {
    setProgramsStore([]);
  });

  it('should reject second creation with same name (case-insensitive)', () => {
    /**
     * **Validates: Requirements 1.5, 3.1**
     *
     * For any two program creation attempts with the same name
     * (case-insensitive), the second attempt should be rejected with an
     * appropriate error, and the total number of programs should not increase.
     */
    fc.assert(
      fc.property(
        validCreateProgramInput,
        fc.constantFrom('lower', 'upper', 'mixed') as fc.Arbitrary<string>,
        (input, caseVariant) => {
          setProgramsStore([]);

          // Create the first program
          createProgram(input);
          const countAfterFirst = getPrograms().length;
          expect(countAfterFirst).toBe(1);

          // Build a case-variant of the name
          let variantName: string;
          if (caseVariant === 'upper') {
            variantName = input.name.toUpperCase();
          } else if (caseVariant === 'lower') {
            variantName = input.name.toLowerCase();
          } else {
            // mixed case: alternate chars
            variantName = input.name
              .split('')
              .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
              .join('');
          }

          // Second creation with same name (case-insensitive) should throw
          expect(() =>
            createProgram({ ...input, name: variantName }),
          ).toThrow('A program with this name already exists');

          // Count should not have increased
          expect(getPrograms().length).toBe(countAfterFirst);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('Feature: booking-platform, Property 15: Program API invalid input rejection', () => {
  beforeEach(() => {
    setProgramsStore([]);
  });

  it('should reject invalid session duration, slot interval, and max attendees', () => {
    /**
     * **Validates: Requirements 11.5**
     *
     * For any program creation request with invalid data (session duration
     * not in {30, 60, 120, 180}, slot interval not in {15, 30, 60}, max
     * attendees not in {1, 2, 3, 5, 10}), the service should throw an error.
     */
    const invalidDuration = fc
      .integer({ min: 1, max: 500 })
      .filter((n) => ![30, 60, 120, 180].includes(n));

    const invalidInterval = fc
      .integer({ min: 1, max: 500 })
      .filter((n) => ![15, 30, 60].includes(n));

    const invalidMaxAttendees = fc
      .integer({ min: 0, max: 500 })
      .filter((n) => ![1, 2, 3, 5, 10].includes(n));

    // Test invalid session duration
    fc.assert(
      fc.property(validProgramName, validBrandColor, invalidDuration, (name, color, duration) => {
        setProgramsStore([]);
        expect(() =>
          createProgram({
            name,
            brandColor: color,
            sessionDurationMinutes: duration,
            slotIntervalMinutes: 15,
            maxAttendees: 3,
            customFormFields: [],
          }),
        ).toThrow('Invalid session duration');
      }),
      { numRuns: 100 },
    );

    // Test invalid slot interval
    fc.assert(
      fc.property(validProgramName, validBrandColor, invalidInterval, (name, color, interval) => {
        setProgramsStore([]);
        expect(() =>
          createProgram({
            name,
            brandColor: color,
            sessionDurationMinutes: 60,
            slotIntervalMinutes: interval,
            maxAttendees: 3,
            customFormFields: [],
          }),
        ).toThrow('Invalid slot interval');
      }),
      { numRuns: 100 },
    );

    // Test invalid max attendees
    fc.assert(
      fc.property(validProgramName, validBrandColor, invalidMaxAttendees, (name, color, max) => {
        setProgramsStore([]);
        expect(() =>
          createProgram({
            name,
            brandColor: color,
            sessionDurationMinutes: 60,
            slotIntervalMinutes: 15,
            maxAttendees: max,
            customFormFields: [],
          }),
        ).toThrow('Invalid max attendees');
      }),
      { numRuns: 100 },
    );
  });
});

describe('Feature: booking-platform, Property 16: Default calendar invite template fallback', () => {
  beforeEach(() => {
    setProgramsStore([]);
  });

  it('should default calendarInviteTitleTemplate when not provided', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * For any program created without a calendarInviteTitleTemplate, the
     * template should default to "{programName} Session — {userName}".
     */
    fc.assert(
      fc.property(
        validProgramName,
        validBrandColor,
        validSessionDurations,
        validSlotIntervals,
        validMaxAttendees,
        (name, color, duration, interval, maxAtt) => {
          setProgramsStore([]);

          const program = createProgram({
            name,
            brandColor: color,
            sessionDurationMinutes: duration,
            slotIntervalMinutes: interval,
            maxAttendees: maxAtt,
            customFormFields: [],
            // calendarInviteTitleTemplate intentionally omitted
          });

          expect(program.calendarInviteTitleTemplate).toBe(
            '{programName} Session — {userName}',
          );

          // Also verify via retrieval
          const retrieved = getProgram(program.id);
          expect(retrieved!.calendarInviteTitleTemplate).toBe(
            '{programName} Session — {userName}',
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
