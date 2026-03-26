import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSession, getAdminUsername } from '@/services/authService';
import { searchBookings } from '@/services/bookingService';
import { auditLogServiceInstance } from '@/services/auditLogServiceInstance';

/**
 * GET /api/admin/search?q=<query>
 * Search bookings by attendee name, email, or PF.
 * Requires session-based authentication via Bearer token.
 *
 * Requirements: 8.6, 12.2
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

  const { searchParams } = request.nextUrl;
  const query = searchParams.get('q') ?? '';

  if (!query.trim()) {
    return NextResponse.json(
      { error: 'Search query parameter "q" is required' },
      { status: 400 }
    );
  }

  const results = searchBookings(query.trim());

  // Fire-and-forget: audit log for data access (Req 11.4)
  try {
    const adminUsername = getAdminUsername(token);
    auditLogServiceInstance.log({
      eventType: 'data_accessed',
      entityType: 'booking',
      entityId: query.trim(),
      performedBy: adminUsername,
      details: { action: 'search', query: query.trim(), resultCount: results.length },
    });
  } catch {
    // Audit failure must not break the search flow.
  }

  return NextResponse.json(results, { status: 200 });
}
