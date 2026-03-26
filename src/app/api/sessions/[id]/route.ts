import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/services/sessionService';

/**
 * GET /api/sessions/:id
 * Returns a single session by ID, or 404 if not found.
 * No authentication required.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {

  const { id } = await params;
  const session = getSession(id);

  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(session);
}
