import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getAllBookings } from '@/services/bookingService';
import { getSession } from '@/services/sessionService';
import { ensureLoaded, persistBooking, persistSession } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

/**
 * DELETE /api/admin/bookings/:id
 * Admin cancellation — no email verification needed.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureLoaded();
  const { id } = await params;

  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.status === 'cancelled') return NextResponse.json({ error: 'Already cancelled' }, { status: 409 });

  try {
    // Use the booking's own email to pass the verification check
    await cancelBooking(id, booking.email);

    // Persist changes
    const updated = getAllBookings().find((b) => b.id === id);
    if (updated) await persistBooking(updated);
    const session = getSession(booking.sessionId);
    if (session) await persistSession(session);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Booking cancelled by admin' }, { headers: noCacheHeaders });
}
