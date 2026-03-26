import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSession, getAdminUsername } from '@/services/authService';
import { exportBookings } from '@/services/bookingService';
import { auditLogServiceInstance } from '@/services/auditLogServiceInstance';
import type { SessionFilter, SlotStatus } from '@/models/types';

/**
 * GET /api/admin/export?format=csv&date=...&status=...
 * Export bookings as CSV with all required fields.
 * Supports optional filters: date, status.
 * Requires session-based authentication via Bearer token.
 *
 * Requirements: 9.1, 9.2, 9.3, 12.2
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
  const date = searchParams.get('date') ?? undefined;
  const status = searchParams.get('status') as SlotStatus | undefined;

  const filters: SessionFilter = {};
  if (date) filters.date = date;
  if (status) filters.status = status;

  const csv = exportBookings(Object.keys(filters).length > 0 ? filters : undefined);

  // Fire-and-forget: audit log for data export (Req 11.4)
  try {
    const adminUsername = getAdminUsername(token);
    auditLogServiceInstance.log({
      eventType: 'data_exported',
      entityType: 'booking',
      entityId: 'export',
      performedBy: adminUsername,
      details: { action: 'export', format: 'csv', filters },
    });
  } catch {
    // Audit failure must not break the export flow.
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bookings-export.csv"',
    },
  });
}
