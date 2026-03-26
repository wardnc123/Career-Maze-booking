import { NextRequest, NextResponse } from 'next/server';
import { getBookingsByEmail } from '@/services/bookingService';
import { getSession, getEvent } from '@/services/sessionService';
import { ensureLoaded } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

export async function GET(request: NextRequest) {
  await ensureLoaded();
  const email = request.nextUrl.searchParams.get('email');
  if (!email || !email.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  const bookings = getBookingsByEmail(email.trim());

  const enriched = bookings.map(b => {
    const session = getSession(b.sessionId);
    const event = session ? getEvent(session.eventId) : null;
    return { ...b, sessionDate: session?.sessionDate, startTime: session?.startTime, eventTitle: event?.title };
  });

  return NextResponse.json(enriched, { headers: noCacheHeaders });
}
