// Career Maze Session Booking & Tracking System — CalendarService
// Generates RFC 5545-compliant .ics files and parses them for round-trip verification.

import { createEvent } from 'ics';
import type { Booking, Session, CalendarEvent } from '@/models/types';

const SESSION_DURATION_HOURS = 3;

// ─── CalendarService ─────────────────────────────────────────────────────────

/**
 * Generate an RFC 5545-compliant .ics calendar invite for a booking.
 *
 * The event uses the session date and start time in Europe/London timezone
 * with a fixed 3-hour duration.
 *
 * Requirements: 6.1, 6.3, 6.4, 6.5
 */
export function generateIcs(booking: Booking, session: Session, baseUrl?: string, location?: string): string {
  const [year, month, day] = session.sessionDate.split('-').map(Number);
  const [hours, minutes] = session.startTime.split(':').map(Number);

  const cancelUrl = baseUrl
    ? `${baseUrl}/cancel/${booking.id}`
    : `http://localhost:3000/cancel/${booking.id}`;

  const { error, value } = createEvent({
    title: `Career Maze Session — ${booking.name}`,
    start: [year, month, day, hours, minutes],
    startInputType: 'local',
    startOutputType: 'local',
    duration: { hours: SESSION_DURATION_HOURS },
    uid: booking.id,
    location: location || undefined,
    description: `Booking reference: ${booking.referenceCode}\nAttendee: ${booking.name}\nRole: ${booking.role}\nPF: ${booking.pf}${location ? `\nLocation: ${location}` : ''}\n\nNeed to cancel? Visit:\n${cancelUrl}`,
    status: 'CONFIRMED',
  });

  if (error || !value) {
    throw new Error(`Failed to generate ICS: ${error?.message ?? 'unknown error'}`);
  }

  return injectTimezone(value);
}

/**
 * Parse an .ics string back to a CalendarEvent for round-trip verification.
 *
 * Extracts DTSTART, DURATION (or DTEND), SUMMARY, and TZID from the VEVENT
 * block using simple regex/string parsing.
 */
export function parseIcs(icsContent: string): CalendarEvent {
  // Extract the VEVENT block to avoid matching VTIMEZONE properties
  const veventMatch = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
  if (!veventMatch) {
    throw new Error('No VEVENT block found in ICS content');
  }
  const vevent = veventMatch[0];

  const summary = extractProperty(vevent, 'SUMMARY');
  const timezone = extractTimezone(icsContent);
  const startTime = extractDateTime(vevent, 'DTSTART');

  if (!startTime) {
    throw new Error('Failed to parse DTSTART from ICS content');
  }

  // Try DTEND first, fall back to DURATION
  let endTime = extractDateTime(vevent, 'DTEND');
  if (!endTime) {
    const durationMs = extractDuration(vevent);
    if (durationMs === null) {
      throw new Error('Failed to parse DTEND or DURATION from ICS content');
    }
    endTime = new Date(startTime.getTime() + durationMs);
  }

  return { startTime, endTime, summary, timezone };
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Inject a VTIMEZONE block for Europe/London and tag the VEVENT's DTSTART
 * with TZID=Europe/London.
 */
function injectTimezone(icsContent: string): string {
  const vtimezone = [
    'BEGIN:VTIMEZONE',
    'TZID:Europe/London',
    'BEGIN:STANDARD',
    'DTSTART:19701025T020000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0000',
    'TZNAME:GMT',
    'END:STANDARD',
    'BEGIN:DAYLIGHT',
    'DTSTART:19700329T010000',
    'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
    'TZOFFSETFROM:+0000',
    'TZOFFSETTO:+0100',
    'TZNAME:BST',
    'END:DAYLIGHT',
    'END:VTIMEZONE',
  ].join('\r\n');

  // Insert VTIMEZONE before VEVENT
  let result = icsContent.replace(
    'BEGIN:VEVENT',
    `${vtimezone}\r\nBEGIN:VEVENT`
  );

  // Tag the VEVENT's DTSTART with TZID. We target the DTSTART inside VEVENT
  // by replacing only the occurrence after BEGIN:VEVENT.
  result = result.replace(
    /(BEGIN:VEVENT[\s\S]*?)DTSTART:(\d{8}T\d{6})/,
    '$1DTSTART;TZID=Europe/London:$2'
  );

  return result;
}

/**
 * Extract a simple property value from ICS content.
 */
function extractProperty(content: string, property: string): string {
  const regex = new RegExp(`^${property}[^:]*:(.+)$`, 'm');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

/**
 * Extract the TZID from DTSTART or the VTIMEZONE block.
 */
function extractTimezone(icsContent: string): string {
  // Try DTSTART;TZID=... inside VEVENT
  const veventMatch = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/);
  if (veventMatch) {
    const dtMatch = veventMatch[0].match(/DTSTART;TZID=([^:]+):/);
    if (dtMatch) return dtMatch[1].trim();
  }

  // Fallback: VTIMEZONE TZID
  const tzMatch = icsContent.match(/^TZID:(.+)$/m);
  if (tzMatch) return tzMatch[1].trim();

  return 'UTC';
}

/**
 * Extract a date-time value from a DTSTART or DTEND property.
 * Parses the iCalendar date-time format: YYYYMMDDTHHMMSS
 */
function extractDateTime(content: string, property: string): Date | null {
  const regex = new RegExp(
    `^${property}[^:]*:(\\d{4})(\\d{2})(\\d{2})T(\\d{2})(\\d{2})(\\d{2})Z?$`,
    'm'
  );
  const match = content.match(regex);
  if (!match) return null;

  const [, y, mo, d, h, mi, s] = match.map(Number);
  // Construct as UTC — the timezone is carried separately in CalendarEvent
  return new Date(Date.UTC(y, mo - 1, d, h, mi, s));
}

/**
 * Extract DURATION property and convert to milliseconds.
 * Supports ISO 8601 duration subset: PT{n}H{n}M{n}S
 */
function extractDuration(content: string): number | null {
  const match = content.match(/^DURATION:PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/m);
  if (!match) return null;

  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;

  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
