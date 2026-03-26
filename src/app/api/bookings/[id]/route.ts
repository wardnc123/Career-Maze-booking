import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getAllBookings } from '@/services/bookingService';
import { wireServices } from '@/lib/startup';

// Wire up notification service on first request
wireServices();

/**
 * DELETE /api/bookings/:id
 * Cancel a confirmed booking. Requires email in request body for verification.
 * Notifications (cancellation email, waitlist promotion) are handled
 * internally by BookingService via the wired NotificationService.
 *
 * Requirements: 5.1, 5.5, 12.1, 12.3
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { email } = body as Record<string, string>;

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json({ error: 'Email is required for cancellation verification' }, { status: 400 });
  }

  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  if (booking.email.toLowerCase() !== email.trim().toLowerCase()) {
    return NextResponse.json({ error: 'You are not authorized to cancel this booking' }, { status: 403 });
  }

  try {
    await cancelBooking(id, email.trim());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Cancellation failed';
    if (message === 'This booking has already been cancelled') {
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ message: 'Booking cancelled successfully' }, { status: 200 });
}
