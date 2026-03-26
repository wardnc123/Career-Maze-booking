import { NextRequest, NextResponse } from 'next/server';
import { validateSession, logout } from '@/services/authService';

/**
 * POST /api/auth/logout
 * Destroy an admin session. Requires Bearer token in Authorization header.
 *
 * Requirements: 10.4
 */
export async function POST(request: NextRequest) {
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

  logout(token);

  return NextResponse.json(
    { message: 'Logged out successfully' },
    { status: 200 }
  );
}
