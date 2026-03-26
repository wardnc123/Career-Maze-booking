import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/services/sessionService';
import { ensureLoaded } from '@/lib/dataManager';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureLoaded();
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  return NextResponse.json(session);
}
