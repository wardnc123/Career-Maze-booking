import type { SlotStatus } from '@/models/types';

/**
 * Derives the slot status for a session based on its current booking count,
 * waitlist count, and max attendees capacity.
 *
 * - Available: no bookings (bookingCount === 0)
 * - Limited: between 1 and maxAttendees-1 bookings
 * - Full: at capacity with no waitlist (bookingCount >= maxAttendees, waitlistCount === 0)
 * - Waitlisted: at capacity with waitlist entries (bookingCount >= maxAttendees, waitlistCount > 0)
 */
export function deriveSlotStatus(bookingCount: number, waitlistCount: number, maxAttendees: number = 3): SlotStatus {
  if (bookingCount === 0) return 'Available';
  if (bookingCount < maxAttendees) return 'Limited';
  if (waitlistCount > 0) return 'Waitlisted';
  return 'Full';
}
