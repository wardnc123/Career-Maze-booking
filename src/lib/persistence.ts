// Persistence layer using Neon Serverless Postgres
// Zero caching — every read hits the database directly

import { getDb } from './db';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent, Program } from '@/models/types';

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
      programId: r.program_id || 'default-career-maze',
      dates: r.dates || [], timeSlots: r.time_slots || [],
      allowMultiSlot: r.allow_multi_slot || false,
      rooms: r.rooms || [],
      createdAt: new Date(r.created_at),
    }));

    const sessions: Session[] = sessionsRows.map((r) => ({
      id: r.id, eventId: r.event_id, sessionDate: r.session_date,
      startTime: r.start_time, bookingCount: r.booking_count,
      maxAttendees: r.max_attendees ?? 3,
      slotStatus: r.slot_status as Session['slotStatus'],
      createdAt: new Date(r.created_at),
    }));

    const bookings: Booking[] = bookingsRows.map((r) => ({
      id: r.id, sessionId: r.session_id, name: r.name, email: r.email,
      role: r.role, pf: r.pf, status: r.status as Booking['status'],
      referenceCode: r.reference_code,
      customFields: r.custom_fields || null,
      alias: r.alias || '',
      vpAlias: r.vp_alias || '',
      level: r.level || '',
      tenure: r.tenure || '',
      attended: r.attended || false,
      createdAt: new Date(r.created_at),
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
  await sql`INSERT INTO events (id, title, location, timezone, program_id, dates, time_slots, allow_multi_slot, rooms, created_at)
    VALUES (${event.id}, ${event.title}, ${event.location}, ${event.timezone}, ${event.programId}, ${JSON.stringify(event.dates)}, ${JSON.stringify(event.timeSlots)}, ${event.allowMultiSlot || false}, ${JSON.stringify(event.rooms || [])}, ${event.createdAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET title = ${event.title}, location = ${event.location}, timezone = ${event.timezone}, program_id = ${event.programId}, dates = ${JSON.stringify(event.dates)}, time_slots = ${JSON.stringify(event.timeSlots)}, allow_multi_slot = ${event.allowMultiSlot || false}, rooms = ${JSON.stringify(event.rooms || [])}`;
}

export async function saveSession(session: Session) {
  const sql = getDb();
  await sql`INSERT INTO sessions (id, event_id, session_date, start_time, booking_count, max_attendees, slot_status, created_at)
    VALUES (${session.id}, ${session.eventId}, ${session.sessionDate}, ${session.startTime}, ${session.bookingCount}, ${session.maxAttendees}, ${session.slotStatus}, ${session.createdAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET booking_count = ${session.bookingCount}, slot_status = ${session.slotStatus}`;
}

export async function saveSessions(sessions: Session[]) {
  if (sessions.length === 0) return;
  const sql = getDb();
  for (const s of sessions) {
    await sql`INSERT INTO sessions (id, event_id, session_date, start_time, booking_count, max_attendees, slot_status, created_at)
      VALUES (${s.id}, ${s.eventId}, ${s.sessionDate}, ${s.startTime}, ${s.bookingCount}, ${s.maxAttendees}, ${s.slotStatus}, ${s.createdAt.toISOString()})
      ON CONFLICT (id) DO UPDATE SET booking_count = ${s.bookingCount}, slot_status = ${s.slotStatus}`;
  }
}

export async function saveBooking(booking: Booking) {
  const sql = getDb();
  await sql`INSERT INTO bookings (id, session_id, name, email, role, pf, status, reference_code, custom_fields, alias, vp_alias, level, tenure, attended, created_at, cancelled_at)
    VALUES (${booking.id}, ${booking.sessionId}, ${booking.name}, ${booking.email}, ${booking.role}, ${booking.pf}, ${booking.status}, ${booking.referenceCode}, ${booking.customFields ? JSON.stringify(booking.customFields) : null}, ${booking.alias || ''}, ${booking.vpAlias || ''}, ${booking.level || ''}, ${booking.tenure || ''}, ${booking.attended || false}, ${booking.createdAt.toISOString()}, ${booking.cancelledAt?.toISOString() || null})
    ON CONFLICT (id) DO UPDATE SET status = ${booking.status}, cancelled_at = ${booking.cancelledAt?.toISOString() || null}, name = ${booking.name}, email = ${booking.email}, alias = ${booking.alias || ''}, vp_alias = ${booking.vpAlias || ''}, level = ${booking.level || ''}, tenure = ${booking.tenure || ''}, attended = ${booking.attended || false}`;
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

export async function deleteProgramFromDb(programId: string) {
  const sql = getDb();
  try {
    // Delete in correct order to respect foreign key constraints
    await sql`DELETE FROM waitlist WHERE session_id IN (SELECT id FROM sessions WHERE event_id IN (SELECT id FROM events WHERE program_id = ${programId}))`;
    await sql`DELETE FROM bookings WHERE session_id IN (SELECT id FROM sessions WHERE event_id IN (SELECT id FROM events WHERE program_id = ${programId}))`;
    await sql`DELETE FROM sessions WHERE event_id IN (SELECT id FROM events WHERE program_id = ${programId})`;
    await sql`DELETE FROM events WHERE program_id = ${programId}`;
    await sql`DELETE FROM programs WHERE id = ${programId}`;
  } catch (err) {
    console.error('[persistence] deleteProgramFromDb error:', err);
    // If cascading delete fails, try removing the foreign key constraint and force delete
    try {
      await sql`UPDATE events SET program_id = NULL WHERE program_id = ${programId}`;
    } catch { /* column might not be nullable, ignore */ }
    try {
      await sql`DELETE FROM programs WHERE id = ${programId}`;
    } catch (err2) {
      console.error('[persistence] force delete program error:', err2);
      throw err2;
    }
  }
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

// ─── Program persistence ─────────────────────────────────────────────────────

export async function loadPrograms(): Promise<Program[]> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM programs ORDER BY created_at`;
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      logoUrl: r.logo_url || null,
      brandColor: r.brand_color || '#1a1a2e',
      sessionDurationMinutes: r.session_duration_minutes ?? 180,
      slotIntervalMinutes: r.slot_interval_minutes ?? 15,
      maxAttendees: r.max_attendees ?? 3,
      customFormFields: r.custom_form_fields || [],
      calendarInviteTitleTemplate: r.calendar_invite_title_template || '{programName} Session — {userName}',
      emailTemplates: r.email_templates || {},
      active: r.active ?? true,
      createdAt: new Date(r.created_at),
    }));
  } catch (err) {
    console.error('[db] Load programs error:', err);
    return [];
  }
}

export async function saveProgram(program: Program): Promise<void> {
  const sql = getDb();
  await sql`INSERT INTO programs (id, name, logo_url, brand_color, session_duration_minutes, slot_interval_minutes, max_attendees, custom_form_fields, calendar_invite_title_template, email_templates, active, created_at)
    VALUES (${program.id}, ${program.name}, ${program.logoUrl}, ${program.brandColor}, ${program.sessionDurationMinutes}, ${program.slotIntervalMinutes}, ${program.maxAttendees}, ${JSON.stringify(program.customFormFields)}, ${program.calendarInviteTitleTemplate}, ${JSON.stringify(program.emailTemplates)}, ${program.active}, ${program.createdAt.toISOString()})
    ON CONFLICT (id) DO UPDATE SET name = ${program.name}, logo_url = ${program.logoUrl}, brand_color = ${program.brandColor}, session_duration_minutes = ${program.sessionDurationMinutes}, slot_interval_minutes = ${program.slotIntervalMinutes}, max_attendees = ${program.maxAttendees}, custom_form_fields = ${JSON.stringify(program.customFormFields)}, calendar_invite_title_template = ${program.calendarInviteTitleTemplate}, email_templates = ${JSON.stringify(program.emailTemplates)}, active = ${program.active}`;
}
