import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createEvent, getEvents } from '@/services/sessionService';
import { ensureLoaded, persistEvent, persistSessions, addEvent as dmAddEvent, addSession as dmAddSession } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';
import type { Session, SlotStatus, CareerMazeEvent } from '@/models/types';

export async function GET() {
  await ensureLoaded();
  return NextResponse.json(getEvents(), { headers: noCacheHeaders });
}

export async function POST(request: NextRequest) {
  await ensureLoaded();

  let body: { title?: string; location?: string; timezone?: string; dates?: string[]; timeSlots?: string[]; slotsPerDate?: Record<string, string[]>; programId?: string; maxAttendees?: number; allowMultiSlot?: boolean; rooms?: Array<{ building: string; room: string }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, location, timezone, dates, timeSlots, slotsPerDate, programId, maxAttendees, allowMultiSlot, rooms } = body;
  if (!title || typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Event title is required' }, { status: 400 });
  if (!dates || !Array.isArray(dates) || dates.length === 0) return NextResponse.json({ error: 'At least one date is required' }, { status: 400 });
  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) return NextResponse.json({ error: 'At least one time slot is required' }, { status: 400 });

  // Validate slotsPerDate if provided
  if (slotsPerDate && typeof slotsPerDate === 'object') {
    for (const [date, slots] of Object.entries(slotsPerDate)) {
      if (!Array.isArray(slots) || slots.length === 0) {
        return NextResponse.json({ error: `Invalid slots for date ${date}: must be a non-empty array` }, { status: 400 });
      }
    }
  }

  const hasPerDayOverrides = slotsPerDate && typeof slotsPerDate === 'object' && Object.keys(slotsPerDate).length > 0;

  let event: CareerMazeEvent;
  let sessions: Session[];

  if (!hasPerDayOverrides) {
    // No per-day overrides — use the existing createEvent path
    const result = createEvent(title.trim(), dates, timeSlots, (location || '').trim(), (timezone || 'Europe/London').trim(), programId || 'default-career-maze', maxAttendees || 3);
    event = result.event;
    sessions = result.sessions;
  } else {
    // Per-day overrides — build event and sessions manually
    const eventId = uuidv4();
    const maxAtt = maxAttendees || 3;
    event = {
      id: eventId,
      title: title.trim(),
      location: (location || '').trim(),
      timezone: (timezone || 'Europe/London').trim(),
      programId: programId || 'default-career-maze',
      dates: [...dates].sort(),
      timeSlots: [...timeSlots].sort(),
      createdAt: new Date(),
    };
    dmAddEvent(event);

    sessions = [];
    for (const date of dates) {
      const slotsForDay = slotsPerDate[date] || timeSlots;
      for (const localTime of slotsForDay) {
        const session: Session = {
          id: uuidv4(),
          eventId,
          sessionDate: date,
          startTime: localTime + ':00',
          bookingCount: 0,
          maxAttendees: maxAtt,
          slotStatus: 'Available' as SlotStatus,
          createdAt: new Date(),
        };
        sessions.push(session);
        dmAddSession(session);
      }
    }
  }

  // Persist to Postgres
  try {
    event.allowMultiSlot = allowMultiSlot || false;
    event.rooms = rooms || [];
    await persistEvent(event);
    await persistSessions(sessions);
  } catch (err) {
    console.error('[setup] Persist error:', err);
    return NextResponse.json({ error: 'Failed to save event to database', detail: String(err) }, { status: 500, headers: noCacheHeaders });
  }

  return NextResponse.json({ message: 'Event created successfully', event, totalSessions: sessions.length }, { status: 201, headers: noCacheHeaders });
}
