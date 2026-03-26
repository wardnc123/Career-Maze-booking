import { NextRequest, NextResponse } from 'next/server';
import { cancelBooking, getAllBookings } from '@/services/bookingService';
import { wireServices } from '@/lib/startup';
import { ensureLoaded, persist } from '@/lib/dataManager';

wireServices();

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureLoaded();
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const { email } = body as Record<string, string>;
  if (!email || typeof email !== 'string' || !email.trim()) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  if (booking.email.toLowerCase() !== email.trim().toLowerCase()) return NextResponse.json({ error: 'You are not authorized to cancel this booking' }, { status: 403 });

  try {
    await cancelBooking(id, email.trim());
    await persist();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Cancellation failed';
    if (msg === 'This booking has already been cancelled') return NextResponse.json({ error: msg }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ message: 'Booking cancelled successfully' });
}
