import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getAllBookings, getAllWaitlistEntries, getWaitlistForSession } from '@/services/bookingService';
import { getSession } from '@/services/sessionService';
import { deriveSlotStatus } from '@/lib/slotStatus';
import { ensureLoaded, persistBooking, persistSession, persistDeleteWaitlist } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import { getWaitlistStore, getBookingsStore } from '@/lib/dataManager';

/**
 * DELETE /api/admin/bookings/:id
 * Admin cancellation — handles both bookings and waitlist entries.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureLoaded();
  const { id } = await params;

  // Check if it's a waitlist entry first
  const waitlistEntry = getAllWaitlistEntries().find((w) => w.id === id);
  if (waitlistEntry) {
    // Remove from in-memory waitlist
    const waitlist = getWaitlistStore();
    const idx = waitlist.findIndex((w) => w.id === id);
    if (idx !== -1) waitlist.splice(idx, 1);
    // Remove from database
    await persistDeleteWaitlist(id);
    // Update session slot status (may change from Waitlisted to Full)
    const session = getSession(waitlistEntry.sessionId);
    if (session) {
      const remainingWaitlist = getWaitlistForSession(waitlistEntry.sessionId);
      session.slotStatus = deriveSlotStatus(session.bookingCount, remainingWaitlist.length, session.maxAttendees);
      await persistSession(session);
    }
    return NextResponse.json({ message: 'Waitlist entry removed by admin' }, { headers: noCacheHeaders });
  }

  // Otherwise handle as a booking
  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 409 });

  try {
    await cancelBooking(id, booking.email);

    // Persist the cancelled booking
    const updated = getAllBookings().find((b) => b.id === id);
    if (updated) await persistBooking(updated);

    // Persist the session (updated booking count and slot status)
    const session = getSession(booking.sessionId);
    if (session) await persistSession(session);

    // If a waitlisted person was promoted, persist their new booking too
    const promotedBooking = getBookingsStore().find(
      (b) => b.sessionId === booking.sessionId && b.promotedFromWaitlist && b.status === 'confirmed' && b.createdAt.getTime() > Date.now() - 5000
    );
    if (promotedBooking) await persistBooking(promotedBooking);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Booking cancelled by admin' }, { headers: noCacheHeaders });
}
