import { NextRequest, NextResponse } from 'next/server';
import { getSessions } from '@/services/sessionService';
import type { SessionFilter, SlotStatus } from '@/models/types';

/**
 * GET /api/sessions?eventId=...&date=...&status=...
 * Returns sessions with optional filters. No authentication required.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const eventId = searchParams.get('eventId') ?? undefined;
  const date = searchParams.get('date') ?? undefined;
  const status = searchParams.get('status') as SlotStatus | undefined;

  const filters: SessionFilter = {};
  if (eventId) filters.eventId = eventId;
  if (date) filters.date = date;
  if (status) filters.status = status;

  const sessions = getSessions(Object.keys(filters).length > 0 ? filters : undefined);
  return NextResponse.json(sessions);
}
