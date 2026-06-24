import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/services/sessionService';
import { ensureLoaded } from '@/lib/dataManager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureLoaded();
  const { id: rawId } = await params;

  // Support comma-separated IDs (for multi-slot booking)
  const ids = decodeURIComponent(rawId).split(',');

  if (ids.length === 1) {
    const session = getSession(ids[0]);
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    return NextResponse.json(session);
  }

  // Multiple IDs: return array
  const sessions = ids.map(id => getSession(id)).filter(Boolean);
  if (sessions.length === 0) return NextResponse.json({ error: 'No sessions found' }, { status: 404 });
  return NextResponse.json(sessions);
}
