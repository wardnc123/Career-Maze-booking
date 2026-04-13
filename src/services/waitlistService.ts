// Career Maze Session Booking & Tracking System — WaitlistService
// Standalone FIFO waitlist management per session.

import { v4 as uuidv4 } from 'uuid';
import type { Booking, BookingRequest, WaitlistEntry } from '@/models/types';
import { getSession } from '@/services/sessionService';
import { deriveSlotStatus } from '@/lib/slotStatus';

// ─── In-memory waitlist store ────────────────────────────────────────────────

let waitlistEntries: WaitlistEntry[] = [];

// ─── Reference code generation ───────────────────────────────────────────────

let referenceCounter = 0;

function generateReferenceCode(): string {
  referenceCounter++;
  const counter = referenceCounter.toString(36).toUpperCase().padStart(4, '0');
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `WL-${counter}${random}`;
}

// ─── WaitlistService ─────────────────────────────────────────────────────────

/**
 * Add an attendee to the waitlist for a session.
 * Requirements: 4.1
 */
export async function addToWaitlist(
  sessionId: string,
  data: BookingRequest
): Promise<WaitlistEntry> {
  const entry: WaitlistEntry = {
    id: uuidv4(),
    sessionId,
    name: data.name,
    email: data.email,
    role: data.role,
    pf: data.pf,
    createdAt: new Date(),
  };

  waitlistEntries.push(entry);
  return entry;
}

/**
 * Promote the earliest waitlist entry for a session to a confirmed booking.
 * Returns the new Booking, or null if the waitlist is empty.
 * Requirements: 4.2, 4.3
 */
export async function promoteNext(sessionId: string): Promise<Booking | null> {
  const sorted = waitlistEntries
    .filter((w) => w.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  if (sorted.length === 0) return null;

  const promoted = sorted[0];

  // Remove from waitlist
  waitlistEntries = waitlistEntries.filter((w) => w.id !== promoted.id);

  // Create confirmed booking from the promoted entry
  const booking: Booking = {
    id: uuidv4(),
    sessionId: promoted.sessionId,
    name: promoted.name,
    email: promoted.email,
    role: promoted.role,
    pf: promoted.pf,
    status: 'confirmed',
    referenceCode: generateReferenceCode(),
    customFields: null,
    createdAt: new Date(),
    cancelledAt: null,
  };

  // Update session counts if session exists in memory
  const session = getSession(sessionId);
  if (session) {
    session.bookingCount += 1;
    const remaining = waitlistEntries.filter((w) => w.sessionId === sessionId);
    session.slotStatus = deriveSlotStatus(session.bookingCount, remaining.length);
  }

  return booking;
}

/**
 * Get all waitlist entries for a session, ordered by createdAt (FIFO).
 * Requirements: 4.2
 */
export async function getWaitlist(sessionId: string): Promise<WaitlistEntry[]> {
  return waitlistEntries
    .filter((w) => w.sessionId === sessionId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

/**
 * Remove a waitlist entry by its ID.
 * Throws if the entry is not found.
 */
export async function removeFromWaitlist(waitlistEntryId: string): Promise<void> {
  const index = waitlistEntries.findIndex((w) => w.id === waitlistEntryId);
  if (index === -1) {
    throw new Error('Waitlist entry not found');
  }
  waitlistEntries.splice(index, 1);
}

// ─── Store management (for testing) ─────────────────────────────────────────

/**
 * Reset the in-memory waitlist store. Used in tests for isolation.
 */
export function resetWaitlistStore(): void {
  waitlistEntries = [];
  referenceCounter = 0;
}

/**
 * Get all waitlist entries (all sessions). Used for testing/admin.
 */
export function getAllWaitlistEntries(): WaitlistEntry[] {
  return [...waitlistEntries];
}
