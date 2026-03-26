import { NextResponse } from 'next/server';
import { getAllBookings } from '@/services/bookingService';
import { getSession, getEvent } from '@/services/sessionService';
import { ensureLoaded } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

export async function GET() {
  await ensureLoaded();
  const bookings = getAllBookings();
  const enriched = bookings.map(b => {
    const session = getSession(b.sessionId);
    const event = session ? getEvent(session.eventId) : null;
    return {
      id: b.id, name: b.name, email: b.email, role: b.role, pf: b.pf,
      status: b.status, referenceCode: b.referenceCode,
      sessionDate: session?.sessionDate || '', startTime: session?.startTime || '',
      eventTitle: event?.title || '', eventLocation: event?.location || '',
    };
  });
  return NextResponse.json(enriched, { headers: noCacheHeaders });
}
