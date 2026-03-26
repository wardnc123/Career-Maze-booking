// Career Maze Session Booking & Tracking System — BookingService
// Core business logic for creating, cancelling, and querying bookings.

import { v4 as uuidv4 } from 'uuid';
import type {
  Booking,
  BookingRequest,
  BookingResult,
  WaitlistEntry,
} from '@/models/types';
import { hasOverlap } from '@/lib/overlap';
import { deriveSlotStatus } from '@/lib/slotStatus';
import { getSession, getSessions } from '@/services/sessionService';
import type { INotificationService } from '@/services/notificationService';
import type { IAuditLogService } from '@/services/auditLogService';
import { emit } from '@/lib/eventEmitter';

// ─── In-memory stores ────────────────────────────────────────────────────────

let bookings: Booking[] = [];
let waitlistEntries: WaitlistEntry[] = [];

// In-memory lock set for session-level concurrency control
const sessionLocks = new Set<string>();

// ─── Notification service (injectable, fire-and-forget) ──────────────────────

let notificationService: INotificationService | null = null;

/**
 * Set the notification service instance used for sending emails.
 * Pass `null` to disable notifications (useful in tests).
 */
export function setNotificationService(service: INotificationService | null): void {
  notificationService = service;
}

// ─── Audit log service (injectable, fire-and-forget) ─────────────────────────

let auditLogService: IAuditLogService | null = null;

/**
 * Set the audit log service instance used for logging data operations.
 * Pass `null` to disable audit logging (useful in tests).
 */
export function setAuditLogService(service: IAuditLogService | null): void {
  auditLogService = service;
}

/**
 * Fire-and-forget audit log helper. Catches errors to prevent
 * audit failures from breaking the main operation flow.
 */
function fireAuditLog(eventType: string, entityType: string, entityId: string, performedBy: string, details?: Record<string, unknown>): void {
  if (!auditLogService) return;
  try {
    auditLogService.log({ eventType, entityType, entityId, performedBy, details });
  } catch {
    // Audit failure must not break the main operation flow.
  }
}

/**
 * Fire-and-forget notification helper. Catches errors to prevent
 * notification failures from breaking the booking flow.
 */
function fireNotification(fn: () => Promise<void>): void {
  fn().catch(() => {
    // Notification failure must not break the booking flow.
    // Errors are swallowed here; the NotificationService itself
    // handles retries and logging internally.
  });
}

// ─── Reference code generation ───────────────────────────────────────────────

let referenceCounter = 0;

/**
 * Generate a unique human-readable reference code.
 * Format: CM-XXXXXXXX (CM prefix + counter + random suffix)
 */
export function generateReferenceCode(): string {
  referenceCounter++;
  const counter = referenceCounter.toString(36).toUpperCase().padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CM-${counter}${random}`;
}

// ─── Locking helpers ─────────────────────────────────────────────────────────

async function acquireLock(sessionId: string): Promise<void> {
  // Spin-wait for lock (in-memory, so contention is minimal)
  while (sessionLocks.has(sessionId)) {
    await new Promise((r) => setTimeout(r, 1));
  }
  sessionLocks.add(sessionId);
}

function releaseLock(sessionId: string): void {
  sessionLocks.delete(sessionId);
}

// ─── BookingService ──────────────────────────────────────────────────────────

/**
 * Create a booking or add to waitlist if session is full.
 *
 * - Validates session exists
 * - Checks 3-hour overlap with existing confirmed bookings for the same email
 * - If capacity < 3 → confirmed booking
 * - If capacity = 3 → waitlisted
 * - Updates session bookingCount and slotStatus
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1
 */
export async function createBooking(data: BookingRequest): Promise<BookingResult> {
  const session = getSession(data.sessionId);
  if (!session) {
    return { status: 'rejected', reason: 'Session not found' };
  }

  await acquireLock(data.sessionId);
  try {
    // Check for duplicate booking (same email, same session, confirmed)
    const duplicate = bookings.find(
      (b) =>
        b.sessionId === data.sessionId &&
        b.email.toLowerCase() === data.email.toLowerCase() &&
        b.status === 'confirmed'
    );
    if (duplicate) {
      return { status: 'rejected', reason: 'You already have a booking for this session' };
    }

    // Check 3-hour overlap with existing confirmed bookings for this email
    const confirmedForEmail = bookings.filter(
      (b) => b.email.toLowerCase() === data.email.toLowerCase() && b.status === 'confirmed'
    );
    if (confirmedForEmail.length > 0) {
      const existingStartTimes = confirmedForEmail.map((b) => {
        const s = getSession(b.sessionId);
        if (!s) return null;
        return {
          startTime: new Date(`${s.sessionDate}T${s.startTime}Z`),
        };
      }).filter((x): x is { startTime: Date } => x !== null);

      const newStartTime = new Date(`${session.sessionDate}T${session.startTime}Z`);
      if (hasOverlap(existingStartTimes, newStartTime)) {
        return {
          status: 'rejected',
          reason: 'You already have a booking within 3 hours of this session',
        };
      }
    }

    // Capacity check
    if (session.bookingCount < 3) {
      // Confirmed booking
      const booking: Booking = {
        id: uuidv4(),
        sessionId: data.sessionId,
        name: data.name,
        email: data.email,
        role: data.role,
        pf: data.pf,
        status: 'confirmed',
        referenceCode: generateReferenceCode(),
        createdAt: new Date(),
        cancelledAt: null,
      };

      bookings.push(booking);
      session.bookingCount += 1;
      session.slotStatus = deriveSlotStatus(
        session.bookingCount,
        getWaitlistForSession(data.sessionId).length
      );

      // Fire-and-forget: confirmation email (Req 7.1)
      if (notificationService) {
        fireNotification(() => notificationService!.sendConfirmation(booking, session));
      }

      // Fire-and-forget: audit log (Req 11.4)
      fireAuditLog('booking_created', 'booking', booking.id, booking.email, {
        sessionId: session.id,
        referenceCode: booking.referenceCode,
      });

      // SSE events
      emit({ type: 'booking:created', data: { sessionId: session.id, bookingId: booking.id } });
      emit({
        type: 'session:updated',
        data: { sessionId: session.id, bookingCount: session.bookingCount, slotStatus: session.slotStatus },
      });

      return { status: 'confirmed', booking };
    } else {
      // Session full → waitlist
      const entry: WaitlistEntry = {
        id: uuidv4(),
        sessionId: data.sessionId,
        name: data.name,
        email: data.email,
        role: data.role,
        pf: data.pf,
        createdAt: new Date(),
      };

      waitlistEntries.push(entry);
      session.slotStatus = deriveSlotStatus(
        session.bookingCount,
        getWaitlistForSession(data.sessionId).length
      );

      return { status: 'waitlisted', waitlistEntry: entry };
    }
  } finally {
    releaseLock(data.sessionId);
  }
}

/**
 * Cancel a confirmed booking.
 *
 * - Verifies email matches the booking
 * - Sets status to 'cancelled', records cancelledAt
 * - Decrements session bookingCount
 * - Promotes earliest waitlist entry if one exists
 *
 * Requirements: 5.1, 5.2, 5.3
 */
export async function cancelBooking(bookingId: string, email: string): Promise<void> {
  const booking = bookings.find((b) => b.id === bookingId);
  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error('You are not authorized to cancel this booking');
  }

  if (booking.status === 'cancelled') {
    throw new Error('This booking has already been cancelled');
  }

  const session = getSession(booking.sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  await acquireLock(booking.sessionId);
  try {
    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    session.bookingCount -= 1;

    // Fire-and-forget: cancellation email (Req 7.2)
    if (notificationService) {
      fireNotification(() => notificationService!.sendCancellation(booking, session));
    }

    // Fire-and-forget: audit log (Req 11.4)
    fireAuditLog('booking_cancelled', 'booking', booking.id, email, {
      sessionId: session.id,
    });

    // SSE: booking cancelled
    emit({ type: 'booking:cancelled', data: { sessionId: session.id, bookingId: booking.id } });

    // Waitlist promotion: promote earliest entry if available
    const waitlist = getWaitlistForSession(booking.sessionId);
    if (waitlist.length > 0) {
      const promoted = waitlist[0];
      // Remove from waitlist
      waitlistEntries = waitlistEntries.filter((w) => w.id !== promoted.id);

      // Create confirmed booking for promoted entry
      const promotedBooking: Booking = {
        id: uuidv4(),
        sessionId: promoted.sessionId,
        name: promoted.name,
        email: promoted.email,
        role: promoted.role,
        pf: promoted.pf,
        status: 'confirmed',
        referenceCode: generateReferenceCode(),
        createdAt: new Date(),
        cancelledAt: null,
      };

      bookings.push(promotedBooking);
      session.bookingCount += 1;

      // Fire-and-forget: waitlist promotion email (Req 7.3)
      if (notificationService) {
        fireNotification(() => notificationService!.sendWaitlistPromotion(promotedBooking, session));
      }

      // Fire-and-forget: audit log for waitlist promotion (Req 11.4)
      fireAuditLog('waitlist_promoted', 'booking', promotedBooking.id, 'system', {
        sessionId: session.id,
        promotedFrom: promoted.id,
      });
    }

    session.slotStatus = deriveSlotStatus(
      session.bookingCount,
      getWaitlistForSession(booking.sessionId).length
    );

    // SSE: session updated after cancellation (and possible promotion)
    emit({
      type: 'session:updated',
      data: { sessionId: session.id, bookingCount: session.bookingCount, slotStatus: session.slotStatus },
    });
  } finally {
    releaseLock(booking.sessionId);
  }
}

// ─── Query functions ─────────────────────────────────────────────────────────

/**
 * Get all confirmed bookings for a session.
 */
export function getBookingsBySession(sessionId: string): Booking[] {
  return bookings.filter(
    (b) => b.sessionId === sessionId && b.status === 'confirmed'
  );
}

/**
 * Get all bookings for an attendee by email.
 */
export function getBookingsByEmail(email: string): Booking[] {
  return bookings.filter(
    (b) => b.email.toLowerCase() === email.toLowerCase()
  );
}

/**
 * Search bookings by name, email, or PF.
 */
export function searchBookings(query: string): Booking[] {
  const q = query.toLowerCase();
  return bookings.filter(
    (b) =>
      b.name.toLowerCase().includes(q) ||
      b.email.toLowerCase().includes(q) ||
      b.pf.toLowerCase().includes(q)
  );
}

// ─── Waitlist helpers ────────────────────────────────────────────────────────

/**
 * Get waitlist entries for a session, ordered by createdAt (FIFO).
 */
export function getWaitlistForSession(sessionId: string): WaitlistEntry[] {
  return waitlistEntries
    .filter((w) => w.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

// ─── Stats & Export ──────────────────────────────────────────────────────────

/**
 * Compute summary statistics for all sessions.
 *
 * Requirements: 8.4, 7.5
 */
export function getStats(): { totalBookings: number; fullSessions: number; emptySessions: number; waitlistCount: number } {
  const allSessions = getSessions() as import('@/models/types').Session[];

  const totalBookings = bookings.filter((b) => b.status === 'confirmed').length;
  const fullSessions = allSessions.filter((s) => s.bookingCount >= 3).length;
  const emptySessions = allSessions.filter((s) => s.bookingCount === 0).length;
  const waitlistCount = waitlistEntries.length;

  return { totalBookings, fullSessions, emptySessions, waitlistCount };
}

/**
 * Export bookings as CSV string. Includes all required fields per Requirement 9.1:
 * booking ID, session date, session time, attendee name, email, role, PF, booking timestamp, status.
 *
 * Requirements: 9.1, 9.2
 */
export function exportBookings(filters?: import('@/models/types').SessionFilter): string {
  // Get sessions matching filters to determine which bookings to include
  const filteredSessions = getSessions(filters) as import('@/models/types').Session[];
  const sessionIds = new Set(filteredSessions.map((s) => s.id));
  const sessionMap = new Map(filteredSessions.map((s) => [s.id, s]));

  // Filter bookings to those in matching sessions
  const filteredBookings = bookings.filter((b) => sessionIds.has(b.sessionId));

  // CSV header
  const header = 'Booking ID,Session Date,Session Time,Name,Email,Role,PF,Booking Timestamp,Status';

  // CSV rows
  const rows = filteredBookings.map((b) => {
    const session = sessionMap.get(b.sessionId);
    const sessionDate = session?.sessionDate ?? '';
    const sessionTime = session?.startTime ?? '';
    return [
      b.id,
      sessionDate,
      sessionTime,
      escapeCsvField(b.name),
      escapeCsvField(b.email),
      escapeCsvField(b.role),
      escapeCsvField(b.pf),
      b.createdAt.toISOString(),
      b.status,
    ].join(',');
  });

  return [header, ...rows].join('\n');
}

/** Escape a CSV field: wrap in quotes if it contains commas, quotes, or newlines. */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ─── GDPR Data Deletion ──────────────────────────────────────────────────────

const DELETED_PLACEHOLDER = '[DELETED]';

/**
 * Anonymize all personal data for a given attendee email.
 * Replaces name, email, role, and PF with "[DELETED]" in all
 * Booking and WaitlistEntry records matching the email.
 *
 * Requirements: 11.3
 */
export function gdprDeleteByEmail(email: string): { bookingsAnonymized: number; waitlistEntriesAnonymized: number } {
  const lowerEmail = email.toLowerCase();

  let bookingsAnonymized = 0;
  for (const booking of bookings) {
    if (booking.email.toLowerCase() === lowerEmail) {
      booking.name = DELETED_PLACEHOLDER;
      booking.email = DELETED_PLACEHOLDER;
      booking.role = DELETED_PLACEHOLDER;
      booking.pf = DELETED_PLACEHOLDER;
      bookingsAnonymized++;
    }
  }

  let waitlistEntriesAnonymized = 0;
  for (const entry of waitlistEntries) {
    if (entry.email.toLowerCase() === lowerEmail) {
      entry.name = DELETED_PLACEHOLDER;
      entry.email = DELETED_PLACEHOLDER;
      entry.role = DELETED_PLACEHOLDER;
      entry.pf = DELETED_PLACEHOLDER;
      waitlistEntriesAnonymized++;
    }
  }

  return { bookingsAnonymized, waitlistEntriesAnonymized };
}

// ─── Store management (for testing) ─────────────────────────────────────────

/**
 * Reset all in-memory stores. Used in tests to ensure isolation.
 */
export function resetBookingStore(): void {
  bookings = [];
  waitlistEntries = [];
  referenceCounter = 0;
  sessionLocks.clear();
  notificationService = null;
  auditLogService = null;
}

/**
 * Get all bookings (including cancelled). Used for testing/admin.
 */
export function getAllBookings(): Booking[] {
  return [...bookings];
}

/**
 * Get all waitlist entries. Used for testing/admin.
 */
export function getAllWaitlistEntries(): WaitlistEntry[] {
  return [...waitlistEntries];
}
