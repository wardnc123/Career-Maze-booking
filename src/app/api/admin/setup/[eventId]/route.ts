import { NextRequest, NextResponse } from 'next/server';
import { getEvent, updateEvent, deleteEvent } from '@/services/sessionService';
import { ensureLoaded, persistEvent, persistSessions, persistDeleteEvent, persistDeleteSessions } from '@/lib/dataManager';
import { noCacheHeaders } from '@/lib/apiHeaders';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureLoaded();
  const { eventId } = await params;
  const event = getEvent(eventId);
  if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  return NextResponse.json(event, { headers: noCacheHeaders });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureLoaded();
  const { eventId } = await params;

  let body: { title?: string; location?: string; timezone?: string; dates?: string[]; timeSlots?: string[]; rooms?: Array<{ building: string; room: string }> };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, location, timezone, dates, timeSlots, rooms } = body;
  if (title !== undefined && (!title || !title.trim())) return NextResponse.json({ error: 'Title cannot be empty' }, { status: 400 });
  if (dates !== undefined && (!Array.isArray(dates) || dates.length === 0)) return NextResponse.json({ error: 'At least one date is required' }, { status: 400 });
  if (timeSlots !== undefined && (!Array.isArray(timeSlots) || timeSlots.length === 0)) return NextResponse.json({ error: 'At least one time slot is required' }, { status: 400 });

  const result = updateEvent(eventId, { title: title?.trim(), location: location !== undefined ? location.trim() : undefined, timezone: timezone !== undefined ? timezone.trim() : undefined, dates, timeSlots });
  if (!result) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

  // Update rooms if provided
  if (rooms !== undefined) {
    result.event.rooms = rooms;
  }

  // Persist changes to Postgres
  await persistEvent(result.event);
  // Save new sessions and delete removed ones
  const { getSessions } = await import('@/services/sessionService');
  const eventSessions = getSessions({ eventId });
  await persistSessions(eventSessions);

  return NextResponse.json({ message: 'Event updated', event: result.event, sessionsAdded: result.sessionsAdded, sessionsRemoved: result.sessionsRemoved }, { headers: noCacheHeaders });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  await ensureLoaded();
  const { eventId } = await params;
  const deleted = deleteEvent(eventId);
  if (!deleted) return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  await persistDeleteEvent(eventId);
  return NextResponse.json({ message: 'Event deleted' }, { headers: noCacheHeaders });
}
