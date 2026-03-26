import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/services/authService';

/**
 * POST /api/auth/login
 * Authenticate an admin user and return a session token.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { username, password } = body as Record<string, string>;

  if (!username || typeof username !== 'string' || !username.trim()) {
    return NextResponse.json(
      { error: 'Username is required' },
      { status: 400 }
    );
  }

  if (!password || typeof password !== 'string' || !password.trim()) {
    return NextResponse.json(
      { error: 'Password is required' },
      { status: 400 }
    );
  }

  const session = await login(username.trim(), password);

  if (!session) {
    return NextResponse.json(
      { error: 'Invalid username or password' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    { token: session.id, expiresAt: session.expiresAt.toISOString() },
    { status: 200 }
  );
}
