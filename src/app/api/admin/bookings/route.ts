import { NextResponse } from 'next/server';
import { getAllBookings, getAllWaitlistEntries } from '@/services/bookingService';
import { getSession, getEvent } from '@/services/sessionService';
import { ensureLoaded } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

export async function GET() {
  await ensureLoaded();
  const bookings = getAllBookings();
  const waitlist = getAllWaitlistEntries();

  const enrichedBookings = bookings.map(b => {
    const session = getSession(b.sessionId);
    const event = session ? getEvent(session.eventId) : null;
    return {
      id: b.id, name: b.name, email: b.email, role: b.role, pf: b.pf,
      status: b.status, referenceCode: b.referenceCode,
      promotedFromWaitlist: b.promotedFromWaitlist || false,
      isWaitlisted: false,
      vpAlias: b.vpAlias || '',
      level: b.level || '',
      tenure: b.tenure || '',
      attended: b.attended || false,
      sessionDate: session?.sessionDate || '', startTime: session?.startTime || '',
      eventTitle: event?.title || '', eventLocation: event?.location || '',
    };
  });

  const enrichedWaitlist = waitlist.map(w => {
    const session = getSession(w.sessionId);
    const event = session ? getEvent(session.eventId) : null;
    return {
      id: w.id, name: w.name, email: w.email, role: w.role, pf: w.pf,
      status: 'waitlisted' as string, referenceCode: '',
      promotedFromWaitlist: false,
      isWaitlisted: true,
      level: '',
      tenure: '',
      sessionDate: session?.sessionDate || '', startTime: session?.startTime || '',
      eventTitle: event?.title || '', eventLocation: event?.location || '',
    };
  });

  return NextResponse.json([...enrichedBookings, ...enrichedWaitlist], { headers: noCacheHeaders });
}
