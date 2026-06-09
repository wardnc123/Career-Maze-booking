import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getAllBookings, getAllWaitlistEntries, getWaitlistForSession } from '@/services/bookingService';
import { getSession } from '@/services/sessionService';
import { deriveSlotStatus } from '@/lib/slotStatus';
import { ensureLoaded, persistBooking, persistSession, persistDeleteWaitlist } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import { getWaitlistStore, getBookingsStore } from '@/lib/dataManager';

/**
 * PATCH /api/admin/bookings/:id
 * Update booking fields (e.g. attended status).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureLoaded();
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

  if (typeof body.attended === 'boolean') {
    booking.attended = body.attended;
  }

  await persistBooking(booking);

  return NextResponse.json({ message: 'Booking updated', attended: booking.attended }, { headers: noCacheHeaders });
}

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

  // Check if we should skip waitlist promotion (force free the slot)
  const url = new URL(_request.url);
  const skipPromotion = url.searchParams.get('skipPromotion') === 'true';

  try {
    if (skipPromotion) {
      // Directly cancel without promoting from waitlist
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      const session = getSession(booking.sessionId);
      if (session) {
        session.bookingCount -= 1;
        session.slotStatus = deriveSlotStatus(session.bookingCount, getWaitlistForSession(booking.sessionId).length, session.maxAttendees);
        await persistSession(session);
      }
      await persistBooking(booking);
    } else {
      // Capture waitlist before cancellation to track who gets promoted
      const waitlistBefore = getWaitlistForSession(booking.sessionId);

      // Normal cancel with waitlist promotion
      await cancelBooking(id, booking.email);

      // Persist the cancelled booking
      const updated = getAllBookings().find((b) => b.id === id);
      if (updated) await persistBooking(updated);

      // Persist the session (updated booking count and slot status)
      const session = getSession(booking.sessionId);
      if (session) await persistSession(session);

      // If a waitlisted person was promoted, persist their new booking and delete their waitlist entry from DB
      if (waitlistBefore.length > 0) {
        const promotedEntry = waitlistBefore[0]; // first in queue gets promoted
        await persistDeleteWaitlist(promotedEntry.id);

        const promotedBooking = getBookingsStore().find(
          (b) => b.sessionId === booking.sessionId && b.promotedFromWaitlist && b.status === 'confirmed' && b.email.toLowerCase() === promotedEntry.email.toLowerCase()
        );
        if (promotedBooking) await persistBooking(promotedBooking);
      }
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Booking cancelled by admin' }, { headers: noCacheHeaders });
}
