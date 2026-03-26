import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSession } from '@/services/authService';
import { getStats } from '@/services/bookingService';

/**
 * GET /api/admin/stats
 * Returns dashboard summary statistics: total bookings, full sessions, empty sessions, waitlist count.
 * Requires session-based authentication via Bearer token.
 *
 * Requirements: 8.4, 12.2
 */
export async function GET(request: NextRequest) {
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

  const session = validateSession(token);
  if (!session) {
    return NextResponse.json(
      { error: 'Your session has expired. Please log in again' },
      { status: 401 }
    );
  }

  // Refresh session activity
  refreshSession(token);

  const stats = getStats();

  return NextResponse.json(stats, { status: 200 });
}
