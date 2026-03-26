import type { SlotStatus } from '@/models/types';

/**
 * Derives the slot status for a session based on its current booking count
 * and waitlist count.
 *
 * - Available: no bookings (bookingCount === 0)
 * - Limited: 1 or 2 bookings (bookingCount 1–2)
 * - Full: at capacity with no waitlist (bookingCount === 3, waitlistCount === 0)
 * - Waitlisted: at capacity with waitlist entries (bookingCount === 3, waitlistCount > 0)
 */
export function deriveSlotStatus(bookingCount: number, waitlistCount: number): SlotStatus {
  if (bookingCount === 0) return 'Available';
  if (bookingCount < 3) return 'Limited';
  if (waitlistCount > 0) return 'Waitlisted';
  return 'Full';
}
