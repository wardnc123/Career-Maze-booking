/**
 * Property-based tests for Email Template Service
 *
 * Feature: booking-platform, Properties 12, 13, 14
 *
 * **Validates: Requirements 13.3, 13.4, 13.5, 13.7**
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  renderEmailTemplate,
  getDefaultTemplate,
  validateTemplate,
  type NotificationType,
} from '@/services/emailTemplateService';
import type { EmailTemplate } from '@/models/types';

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** All supported placeholder keys */
const PLACEHOLDER_KEYS = [
  'userName',
  'userEmail',
  'programName',
  'eventTitle',
  'sessionDate',
  'sessionTime',
  'location',
  'referenceCode',
  'cancelUrl',
  'programLogo',
] as const;

/** Generate a non-empty safe string (no curly braces to avoid false placeholder matches) */
const arbSafeString = fc
  .stringOf(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_@./:'.split(''),
    ),
    { minLength: 1, maxLength: 40 },
  )
  .map((s) => s.trim() || 'value');

/** Generate a complete set of placeholder values */
const arbPlaceholders: fc.Arbitrary<Record<string, string>> = fc
  .tuple(...PLACEHOLDER_KEYS.map(() => arbSafeString))
  .map((values) => {
    const record: Record<string, string> = {};
    PLACEHOLDER_KEYS.forEach((key, i) => {
      record[key] = values[i];
    });
    return record;
  });

/** Generate a valid hex brand color */
const arbBrandColor = fc.hexaString({ minLength: 6, maxLength: 6 }).map((h) => `#${h}`);

/** Generate a random subset of placeholder tokens to embed in a template */
const arbPlaceholderSubset = fc.subarray([...PLACEHOLDER_KEYS], { minLength: 1 });

/** Generate an email template that contains specific placeholder tokens */
function arbTemplateWithPlaceholders(
  keys: readonly string[],
): fc.Arbitrary<EmailTemplate> {
  return fc.record({
    subject: fc.constant(
      `Subject with ${keys.map((k) => `{${k}}`).join(' and ')}`,
    ),
    bodyHtml: fc.constant(
      `<p>Body with ${keys.map((k) => `{${k}}`).join(', ')}</p>`,
    ),
  });
}

/** Generate an email template containing ALL supported placeholders */
const arbTemplateAllPlaceholders: fc.Arbitrary<EmailTemplate> = fc.constant({
  subject: 'Booking for {userName} - {programName} on {sessionDate}',
  bodyHtml: `
    <p>Hi {userName} ({userEmail}),</p>
    <p>Program: {programName}, Event: {eventTitle}</p>
    <p>Date: {sessionDate}, Time: {sessionTime}</p>
    <p>Location: {location}</p>
    <p>Reference: {referenceCode}</p>
    <p><a href="{cancelUrl}">Cancel</a></p>
    <img src="{programLogo}" />
  `,
});

/** Generate a notification type */
const arbNotificationType: fc.Arbitrary<NotificationType> = fc.constantFrom(
  'confirmation',
  'cancellation',
  'waitlist_promotion',
  'reminder',
);

// ─── Property 12: Email template placeholder rendering ───────────────────────

describe('Feature: booking-platform, Property 12: Email template placeholder rendering', () => {
  it('replaces every placeholder with its corresponding value, leaving no unreplaced tokens', () => {
    /**
     * **Validates: Requirements 13.3, 13.4**
     *
     * For any email template containing supported placeholders and any set
     * of valid placeholder values, rendering the template should replace
     * every placeholder with its corresponding value, and the output should
     * contain no unreplaced placeholder tokens.
     */
    fc.assert(
      fc.property(
        arbTemplateAllPlaceholders,
        arbPlaceholders,
        arbBrandColor,
        (template, placeholders, brandColor) => {
          const result = renderEmailTemplate(template, placeholders, brandColor);

          // Every placeholder value should appear in the output
          for (const key of PLACEHOLDER_KEYS) {
            const value = placeholders[key];
            const inSubject = result.subject.includes(value);
            const inHtml = result.html.includes(value);
            // The value should appear somewhere in the rendered output
            // (subject or html, depending on where the placeholder was)
            expect(inSubject || inHtml).toBe(true);
          }

          // No unreplaced supported placeholder tokens should remain
          for (const key of PLACEHOLDER_KEYS) {
            const token = `{${key}}`;
            expect(result.subject).not.toContain(token);
            expect(result.html).not.toContain(token);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('replaces placeholders in subject and body independently', () => {
    /**
     * **Validates: Requirements 13.3, 13.4**
     */
    fc.assert(
      fc.property(
        arbPlaceholderSubset,
        arbPlaceholders,
        arbBrandColor,
        (keys, placeholders, brandColor) => {
          const template = {
            subject: keys.map((k) => `{${k}}`).join(' '),
            bodyHtml: keys.map((k) => `<span>{${k}}</span>`).join(''),
          };

          const result = renderEmailTemplate(template, placeholders, brandColor);

          for (const key of keys) {
            expect(result.subject).toContain(placeholders[key]);
            expect(result.html).toContain(placeholders[key]);
          }

          // No unreplaced tokens for the keys we used
          for (const key of keys) {
            expect(result.subject).not.toContain(`{${key}}`);
            expect(result.html).not.toContain(`{${key}}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 13: Email template validation rejects missing required placeholders ─

describe('Feature: booking-platform, Property 13: Email template validation rejects missing required placeholders', () => {
  it('returns valid: false with errors for confirmation templates missing required placeholders', () => {
    /**
     * **Validates: Requirements 13.7**
     *
     * For any confirmation email template that is missing one or more of the
     * required placeholders ({userName}, {sessionDate}, {sessionTime}),
     * validation should return valid: false with errors identifying the
     * missing placeholders.
     */
    const requiredPlaceholders = ['{userName}', '{sessionDate}', '{sessionTime}'];

    // Generate a non-empty subset of required placeholders to omit
    const arbMissingSubset = fc.subarray(requiredPlaceholders, { minLength: 1 });

    fc.assert(
      fc.property(arbMissingSubset, (missingPlaceholders) => {
        // Build a template that includes only the placeholders NOT in the missing set
        const included = requiredPlaceholders.filter(
          (p) => !missingPlaceholders.includes(p),
        );

        const template: EmailTemplate = {
          subject: `Subject ${included.join(' ')}`,
          bodyHtml: `<p>Body ${included.join(' ')}</p>`,
        };

        const result = validateTemplate(template, 'confirmation');

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(missingPlaceholders.length);

        // Each missing placeholder should be identified in the errors
        for (const missing of missingPlaceholders) {
          const hasError = result.errors.some((e) => e.includes(missing));
          expect(hasError).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('returns valid: true when all required placeholders are present in confirmation template', () => {
    /**
     * **Validates: Requirements 13.7**
     */
    fc.assert(
      fc.property(arbSafeString, (extraContent) => {
        const template: EmailTemplate = {
          subject: `Booking for {userName} on {sessionDate}`,
          bodyHtml: `<p>Time: {sessionTime} ${extraContent}</p>`,
        };

        const result = validateTemplate(template, 'confirmation');
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      }),
      { numRuns: 100 },
    );
  });

  it('does not enforce required placeholders for non-confirmation types', () => {
    /**
     * **Validates: Requirements 13.7**
     */
    const nonConfirmationTypes: NotificationType[] = [
      'cancellation',
      'waitlist_promotion',
      'reminder',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...nonConfirmationTypes),
        (type) => {
          // Template with NO required placeholders
          const template: EmailTemplate = {
            subject: 'Some subject',
            bodyHtml: '<p>Some body</p>',
          };

          const result = validateTemplate(template, type);
          expect(result.valid).toBe(true);
          expect(result.errors).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 14: Default email template fallback ────────────────────────────

describe('Feature: booking-platform, Property 14: Default email template fallback', () => {
  it('default templates contain programName, session details, and referenceCode placeholders', () => {
    /**
     * **Validates: Requirements 13.5**
     *
     * For any program that has no custom email template for a given
     * notification type, the system should use the default template, and the
     * rendered output should contain the program name, session details, and
     * reference code.
     */
    fc.assert(
      fc.property(
        arbNotificationType,
        arbPlaceholders,
        arbBrandColor,
        (type, placeholders, brandColor) => {
          const defaultTemplate = getDefaultTemplate(type);
          const result = renderEmailTemplate(defaultTemplate, placeholders, brandColor);

          // Rendered output should contain the program name
          expect(result.subject + result.html).toContain(placeholders.programName);

          // Rendered output should contain session date
          expect(result.html).toContain(placeholders.sessionDate);

          // Rendered output should contain session time
          expect(result.html).toContain(placeholders.sessionTime);

          // Rendered output should contain reference code
          expect(result.html).toContain(placeholders.referenceCode);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('default templates have no unreplaced placeholder tokens after rendering', () => {
    /**
     * **Validates: Requirements 13.5**
     */
    fc.assert(
      fc.property(
        arbNotificationType,
        arbPlaceholders,
        arbBrandColor,
        (type, placeholders, brandColor) => {
          const defaultTemplate = getDefaultTemplate(type);
          const result = renderEmailTemplate(defaultTemplate, placeholders, brandColor);

          for (const key of PLACEHOLDER_KEYS) {
            const token = `{${key}}`;
            expect(result.subject).not.toContain(token);
            expect(result.html).not.toContain(token);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
