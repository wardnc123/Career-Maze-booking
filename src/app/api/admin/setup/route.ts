import { NextRequest, NextResponse } from 'next/server';
import { createEvent, getEvents } from '@/services/sessionService';
import { ensureLoaded, persist } from '@/lib/dataManager';

export async function GET() {
  await ensureLoaded();
  return NextResponse.json(getEvents());
}

export async function POST(request: NextRequest) {
  await ensureLoaded();

  let body: { title?: string; location?: string; dates?: string[]; timeSlots?: string[] };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { title, location, dates, timeSlots } = body;
  if (!title || typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'Event title is required' }, { status: 400 });
  if (!dates || !Array.isArray(dates) || dates.length === 0) return NextResponse.json({ error: 'At least one date is required' }, { status: 400 });
  if (!timeSlots || !Array.isArray(timeSlots) || timeSlots.length === 0) return NextResponse.json({ error: 'At least one time slot is required' }, { status: 400 });

  const { event, sessions } = createEvent(title.trim(), dates, timeSlots, (location || '').trim());
  await persist();

  return NextResponse.json({ message: 'Event created successfully', event, totalSessions: sessions.length }, { status: 201 });
}
