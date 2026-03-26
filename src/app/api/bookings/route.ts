import { NextRequest, NextResponse } from 'next/server';
import { createBooking } from '@/services/bookingService';
import { wireServices } from '@/lib/startup';
import type { BookingRequest } from '@/models/types';

// Wire up notification service on first request
wireServices();

/**
 * POST /api/bookings
 * Create a new booking or add to waitlist.
 * No authentication required.
 *
 * Requirements: 3.1, 3.2, 5.1, 5.5, 12.1, 12.3
 */
export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, email, role, pf, sessionId } = body as Record<string, string>;

  const missingFields: string[] = [];
  if (!name || typeof name !== 'string' || !name.trim()) missingFields.push('name');
  if (!email || typeof email !== 'string' || !email.trim()) missingFields.push('email');
  if (!role || typeof role !== 'string' || !role.trim()) missingFields.push('role');
  if (!pf || typeof pf !== 'string' || !pf.trim()) missingFields.push('pf');
  if (!sessionId || typeof sessionId !== 'string' || !sessionId.trim()) missingFields.push('sessionId');

  if (missingFields.length > 0) {
    return NextResponse.json({ error: 'Please fill in all required fields', missingFields }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
  }

  const bookingRequest: BookingRequest = {
    sessionId: sessionId.trim(),
    name: name.trim(),
    email: email.trim(),
    role: role.trim(),
    pf: pf.trim(),
  };

  const result = await createBooking(bookingRequest);

  if (result.status === 'confirmed') {
    return NextResponse.json(result, { status: 201 });
  }
  if (result.status === 'waitlisted') {
    return NextResponse.json(result, { status: 200 });
  }
  return NextResponse.json({ error: result.reason }, { status: 409 });
}
