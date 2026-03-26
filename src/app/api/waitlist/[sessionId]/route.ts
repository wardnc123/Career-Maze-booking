import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSession } from '@/services/authService';
import { getSession } from '@/services/sessionService';
import { getWaitlist } from '@/services/waitlistService';

/**
 * GET /api/waitlist/:sessionId
 * Returns waitlist entries for a session, ordered by creation time (FIFO).
 * Requires session-based authentication via Bearer token.
 *
 * Requirements: 12.1, 12.2
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const adminSession = validateSession(token);
  if (!adminSession) {
    return NextResponse.json(
      { error: 'Your session has expired. Please log in again' },
      { status: 401 }
    );
  }

  // Refresh session activity
  refreshSession(token);

  const { sessionId } = await params;

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json(
      { error: 'Session not found' },
      { status: 404 }
    );
  }

  const entries = await getWaitlist(sessionId);

  return NextResponse.json(entries, { status: 200 });
}
