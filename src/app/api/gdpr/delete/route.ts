import { NextRequest, NextResponse } from 'next/server';
import { validateSession, refreshSession, getAdminUsername } from '@/services/authService';
import { gdprDeleteByEmail } from '@/services/bookingService';
import { auditLogServiceInstance } from '@/services/auditLogServiceInstance';

/**
 * POST /api/gdpr/delete
 * Anonymize all personal data for a given attendee email (GDPR right to erasure).
 * Requires admin authentication via Bearer token.
 *
 * Requirements: 11.3
 */
export async function POST(request: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
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

  refreshSession(token);

  // ── Parse body ──────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { email } = body as { email?: string };

  if (!email || typeof email !== 'string' || !email.trim()) {
    return NextResponse.json(
      { error: 'Email is required' },
      { status: 400 }
    );
  }

  // ── Execute deletion ────────────────────────────────────────────────────
  const result = gdprDeleteByEmail(email.trim());

  // Fire-and-forget: audit log for data deletion (Req 11.4)
  try {
    const adminUsername = getAdminUsername(token);
    auditLogServiceInstance.log({
      eventType: 'data_deleted',
      entityType: 'attendee',
      entityId: email.trim(),
      performedBy: adminUsername,
      details: {
        bookingsAnonymized: result.bookingsAnonymized,
        waitlistEntriesAnonymized: result.waitlistEntriesAnonymized,
      },
    });
  } catch {
    // Audit failure must not break the deletion flow.
  }

  return NextResponse.json({
    message: 'Personal data anonymized successfully',
    bookingsAnonymized: result.bookingsAnonymized,
    waitlistEntriesAnonymized: result.waitlistEntriesAnonymized,
    totalRecordsProcessed: result.bookingsAnonymized + result.waitlistEntriesAnonymized,
  });
}
