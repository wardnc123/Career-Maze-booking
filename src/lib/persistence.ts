// Persistence layer using Neon Serverless Postgres
// Zero caching — every read hits the database directly

import { getDb } from './db';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

export interface AppData {
  events: CareerMazeEvent[];
  sessions: Session[];
  bookings: Booking[];
  waitlistEntries: WaitlistEntry[];
}

export async function loadData(): Promise<AppData> {
  const empty: AppData = { events: [], sessions: [], bookings: [], waitlistEntries: [] };
  try {
    const sql = getDb();

    const [eventsRows, sessionsRows, bookingsRows, waitlistRows] = await Promise.all([
      sql`SELECT * FROM events ORDER BY created_at`,
      sql`SELECT * FROM sessions ORDER BY session_date, start_time`,
      sql`SELECT * FROM bookings ORDER BY created_at`,
      sql`SELECT * FROM waitlist ORDER BY created_at`,
    ]);

    const events: CareerMazeEvent[] = eventsRows.map((r) => ({
      id: r.id, title: r.title, location: r.location || '',
      timezone: r.timezone || 'Europe/London',
      dates: r.dates || [], timeSlots: r.time_slots || [],
      createdAt: new Date(r.created_at),
    }));

    const sessions: Session[] = sessionsRows.map((r) => ({
      id: r.id, eventId: r.event_id, sessionDate: r.session_date,
      startTime: r.start_time, bookingCount: r.booking_count,
      slotStatus: r.slot_status as Session['slotStatus'],
      createdAt: new Date(r.created_at),
    }));

    const bookings: Booking[] = bookingsRows.map((r) => ({
      id: r.id, sessionId: r.session_id, name: r.name, email: r.email,
      role: r.role, pf: r.pf, status: r.status as Booking['status'],
      referenceCode: r.reference_code, createdAt: new Date(r.created_at),
      cancelledAt: r.cancelled_at ? new Date(r.cancelled_at) : null,
    }));

    const waitlistEntries: WaitlistEntry[] = waitlistRows.map((r) => ({
      id: r.id, sessionId: r.session_id, name: r.name, email: r.email,
      role: r.role, pf: r.pf, createdAt: new Date(r.created_at),
    }));

    return { events, sessions, bookings, waitlistEntries };
  } catch (err) {
    console.error('[db] Load error:', err);
    return empty;
  }
}

// ─── Individual save operations (called after mutations) ─────────────────────

export async function saveEvent(event: CareerMazeEvent) {
  const sql = getDb();
  await sql`INSERT INTO events (id, title, location, timezone, dates, time_slots, created_at)
    VALUES (${event.id}, ${event.title}, ${event.location}, ${event.timezone}, ${JSON.stringify(event.dates)}, ${JSON.stringify(event.timeSlots)}, ${event.createdAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET title = ${event.title}, location = ${event.location}, timezone = ${event.timezone}, dates = ${JSON.stringify(event.dates)}, time_slots = ${JSON.stringify(event.timeSlots)}`;
}

export async function saveSession(session: Session) {
  const sql = getDb();
  await sql`INSERT INTO sessions (id, event_id, session_date, start_time, booking_count, slot_status, created_at)
    VALUES (${session.id}, ${session.eventId}, ${session.sessionDate}, ${session.startTime}, ${session.bookingCount}, ${session.slotStatus}, ${session.createdAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET booking_count = ${session.bookingCount}, slot_status = ${session.slotStatus}`;
}

export async function saveSessions(sessions: Session[]) {
  if (sessions.length === 0) return;
  const sql = getDb();
  for (const s of sessions) {
    await sql`INSERT INTO sessions (id, event_id, session_date, start_time, booking_count, slot_status, created_at)
      VALUES (${s.id}, ${s.eventId}, ${s.sessionDate}, ${s.startTime}, ${s.bookingCount}, ${s.slotStatus}, ${s.createdAt.toISOString()})
      ON CONFLICT (id) DO UPDATE SET booking_count = ${s.bookingCount}, slot_status = ${s.slotStatus}`;
  }
}

export async function saveBooking(booking: Booking) {
  const sql = getDb();
  await sql`INSERT INTO bookings (id, session_id, name, email, role, pf, status, reference_code, created_at, cancelled_at)
    VALUES (${booking.id}, ${booking.sessionId}, ${booking.name}, ${booking.email}, ${booking.role}, ${booking.pf}, ${booking.status}, ${booking.referenceCode}, ${booking.createdAt.toISOString()}, ${booking.cancelledAt?.toISOString() || null})
    ON CONFLICT (id) DO UPDATE SET status = ${booking.status}, cancelled_at = ${booking.cancelledAt?.toISOString() || null}, name = ${booking.name}, email = ${booking.email}`;
}

export async function saveWaitlistEntry(entry: WaitlistEntry) {
  const sql = getDb();
  await sql`INSERT INTO waitlist (id, session_id, name, email, role, pf, created_at)
    VALUES (${entry.id}, ${entry.sessionId}, ${entry.name}, ${entry.email}, ${entry.role}, ${entry.pf}, ${entry.createdAt.toISOString()})
    ON CONFLICT (id) DO NOTHING`;
}

export async function deleteWaitlistEntry(id: string) {
  const sql = getDb();
  await sql`DELETE FROM waitlist WHERE id = ${id}`;
}

export async function deleteEventFromDb(eventId: string) {
  const sql = getDb();
  await sql`DELETE FROM waitlist WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ${eventId})`;
  await sql`DELETE FROM bookings WHERE session_id IN (SELECT id FROM sessions WHERE event_id = ${eventId})`;
  await sql`DELETE FROM sessions WHERE event_id = ${eventId}`;
  await sql`DELETE FROM events WHERE id = ${eventId}`;
}

export async function deleteSessionsFromDb(sessionIds: string[]) {
  if (sessionIds.length === 0) return;
  const sql = getDb();
  for (const id of sessionIds) {
    await sql`DELETE FROM sessions WHERE id = ${id}`;
  }
}

// Legacy saveData — kept for compatibility but now saves to Postgres
export async function saveData(data: AppData): Promise<void> {
  // No-op — individual operations handle persistence now
}
