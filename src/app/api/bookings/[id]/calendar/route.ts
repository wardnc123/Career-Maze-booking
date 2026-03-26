import { NextRequest, NextResponse } from 'next/server';
import { getAllBookings } from '@/services/bookingService';
import { getSession, getEvent } from '@/services/sessionService';
import { generateIcs } from '@/services/calendarService';

/**
 * GET /api/bookings/:id/calendar
 * Returns an .ics calendar file for the given booking, including event location.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const booking = getAllBookings().find((b) => b.id === id);
  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const session = getSession(booking.sessionId);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const event = getEvent(session.eventId);
  const location = event?.location || '';

  const ics = generateIcs(booking, session, undefined, location);

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="career-maze-${booking.referenceCode}.ics"`,
    },
  });
}
