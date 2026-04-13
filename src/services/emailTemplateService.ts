// Email Template Service — Rendering, validation, and default templates
// Feature: booking-platform (Requirements 13.1–13.7)

import type { EmailTemplate, ProgramEmailTemplates } from '@/models/types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NotificationType = 'confirmation' | 'cancellation' | 'waitlist_promotion' | 'reminder';

// ─── Constants ───────────────────────────────────────────────────────────────

const SUPPORTED_PLACEHOLDERS = [
  '{userName}',
  '{userEmail}',
  '{programName}',
  '{eventTitle}',
  '{sessionDate}',
  '{sessionTime}',
  '{location}',
  '{referenceCode}',
  '{cancelUrl}',
  '{programLogo}',
];

const REQUIRED_CONFIRMATION_PLACEHOLDERS = [
  '{userName}',
  '{sessionDate}',
  '{sessionTime}',
];

const PLACEHOLDER_REGEX = /\{(\w+)\}/g;

// ─── Sample data for preview ─────────────────────────────────────────────────

const PREVIEW_PLACEHOLDERS: Record<string, string> = {
  userName: 'Jane Doe',
  userEmail: 'jane.doe@example.com',
  programName: 'Sample Program',
  eventTitle: 'Sample Event',
  sessionDate: '2026-03-15',
  sessionTime: '10:00:00',
  location: 'Building A, Room 101',
  referenceCode: 'REF-SAMPLE',
  cancelUrl: 'https://example.com/cancel/sample',
  programLogo: 'https://example.com/logo.png',
};

// ─── Default Templates ───────────────────────────────────────────────────────

const DEFAULT_TEMPLATES: Record<NotificationType, EmailTemplate> = {
  confirmation: {
    subject: 'Booking Confirmed — {programName} Session on {sessionDate}',
    bodyHtml: `
      <h2>Booking Confirmed</h2>
      <p>Hi {userName},</p>
      <p>Your {programName} session has been confirmed.</p>
      <ul>
        <li><strong>Event:</strong> {eventTitle}</li>
        <li><strong>Date:</strong> {sessionDate}</li>
        <li><strong>Time:</strong> {sessionTime}</li>
        <li><strong>Location:</strong> {location}</li>
        <li><strong>Reference:</strong> {referenceCode}</li>
      </ul>
      <p>A calendar invite is attached to this email.</p>
      <p><a href="{cancelUrl}">Cancel this booking</a></p>
    `,
  },
  cancellation: {
    subject: 'Booking Cancelled — {programName} Session on {sessionDate}',
    bodyHtml: `
      <h2>Booking Cancelled</h2>
      <p>Hi {userName},</p>
      <p>Your {programName} session booking has been cancelled.</p>
      <ul>
        <li><strong>Date:</strong> {sessionDate}</li>
        <li><strong>Time:</strong> {sessionTime}</li>
        <li><strong>Reference:</strong> {referenceCode}</li>
      </ul>
      <p>If this was a mistake, you can rebook from the booking page.</p>
    `,
  },
  waitlist_promotion: {
    subject: "You're In! {programName} Session on {sessionDate}",
    bodyHtml: `
      <h2>Waitlist Promotion</h2>
      <p>Hi {userName},</p>
      <p>A spot has opened up and your {programName} booking is now confirmed!</p>
      <ul>
        <li><strong>Date:</strong> {sessionDate}</li>
        <li><strong>Time:</strong> {sessionTime}</li>
        <li><strong>Reference:</strong> {referenceCode}</li>
      </ul>
      <p>A calendar invite is attached to this email.</p>
      <p><a href="{cancelUrl}">Cancel this booking</a></p>
    `,
  },
  reminder: {
    subject: 'Reminder: {programName} Session Tomorrow — {sessionDate}',
    bodyHtml: `
      <h2>Session Reminder</h2>
      <p>Hi {userName},</p>
      <p>This is a reminder that your {programName} session is coming up tomorrow.</p>
      <ul>
        <li><strong>Date:</strong> {sessionDate}</li>
        <li><strong>Time:</strong> {sessionTime}</li>
        <li><strong>Location:</strong> {location}</li>
        <li><strong>Reference:</strong> {referenceCode}</li>
      </ul>
      <p>See you there!</p>
    `,
  },
};


// ─── Core Functions ──────────────────────────────────────────────────────────

/**
 * Replace all supported placeholders in a string with their values.
 * Unsupported placeholder tokens (not in SUPPORTED_PLACEHOLDERS) are left as-is.
 */
function replacePlaceholders(text: string, placeholders: Record<string, string>): string {
  return text.replace(PLACEHOLDER_REGEX, (match, key) => {
    if (key in placeholders) {
      return placeholders[key];
    }
    return match;
  });
}

/**
 * Wrap email body with header/footer and brand color styling.
 */
function wrapHtml(
  bodyHtml: string,
  brandColor: string,
  headerHtml?: string,
  footerHtml?: string,
): string {
  const header = headerHtml
    ? headerHtml
    : `<div style="background-color: ${brandColor}; padding: 16px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 20px;">Booking Notification</h1>
      </div>`;

  const footer = footerHtml
    ? footerHtml
    : `<div style="padding: 12px; text-align: center; font-size: 12px; color: #666;">
        <p>This is an automated notification.</p>
      </div>`;

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  ${header}
  <div style="padding: 20px;">
    ${bodyHtml}
  </div>
  ${footer}
</div>`;
}

/**
 * Render an email template by replacing placeholders and wrapping with brand styling.
 * Requirements: 13.3, 13.4
 */
export function renderEmailTemplate(
  template: EmailTemplate,
  placeholders: Record<string, string>,
  brandColor: string,
): { subject: string; html: string } {
  const subject = replacePlaceholders(template.subject, placeholders);
  const bodyHtml = replacePlaceholders(template.bodyHtml, placeholders);
  const headerHtml = template.headerHtml
    ? replacePlaceholders(template.headerHtml, placeholders)
    : undefined;
  const footerHtml = template.footerHtml
    ? replacePlaceholders(template.footerHtml, placeholders)
    : undefined;

  const html = wrapHtml(bodyHtml, brandColor, headerHtml, footerHtml);

  return { subject, html };
}

/**
 * Get the default email template for a notification type.
 * Requirements: 13.5
 */
export function getDefaultTemplate(type: NotificationType): EmailTemplate {
  return { ...DEFAULT_TEMPLATES[type] };
}

/**
 * Validate an email template for a given notification type.
 * For confirmation templates, required placeholders must be present.
 * Requirements: 13.7
 */
export function validateTemplate(
  template: EmailTemplate,
  type: NotificationType,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (type === 'confirmation') {
    const combined = template.subject + template.bodyHtml;
    for (const placeholder of REQUIRED_CONFIRMATION_PLACEHOLDERS) {
      if (!combined.includes(placeholder)) {
        errors.push(`Missing required placeholder: ${placeholder}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Render a preview of an email template using sample data.
 * Requirements: 13.6
 */
export function renderPreview(
  template: EmailTemplate,
  brandColor: string,
): { subject: string; html: string } {
  return renderEmailTemplate(template, PREVIEW_PLACEHOLDERS, brandColor);
}
