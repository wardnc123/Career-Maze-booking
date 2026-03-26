import { NextRequest, NextResponse } from 'next/server';
import { createEvent, getEvents } from '@/services/sessionService';

/**
 * GET /api/admin/setup
 * Returns all events.
 */
export async function GET() {
  const events = getEvents();
  return NextResponse.json(events);
}

/**
 * POST /api/admin/setup
 * Creates a new event with title, dates, and time slots.
 * Body: { title: string, dates: string[], timeSlots: string[] }
 */
export async function POST(request: NextRequest) {
  let body: { title?: string; location?: string; dates?: string[]; timeSlots?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, location, dates, timeSlots } = body;

  if (!title || typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'Event title is required' }, { status: 400 });
  }
  if (!dates || !Array.isArray(dates) || dates.length === 0) {
    return NextResponse.json({ error: 'At least one date is required' }, { status: 400 });
  }
  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) {
    return NextResponse.json({ error: 'At least one time slot is required' }, { status: 400 });
  }

  const { event, sessions } = createEvent(title.trim(), dates, timeSlots, (location || '').trim());

  return NextResponse.json({
    message: 'Event created successfully',
    event,
    totalSessions: sessions.length,
  }, { status: 201 });
}
