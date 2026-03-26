// Database connection and operations using Neon Serverless Postgres
import { neon } from '@neondatabase/serverless';

function getDb() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL not set');
  return neon(url);
}

// ─── Schema initialization ───────────────────────────────────────────────────

export async function initDb() {
  const sql = getDb();
  await sql`CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    location TEXT DEFAULT '',
    timezone TEXT DEFAULT 'Europe/London',
    dates JSONB NOT NULL DEFAULT '[]',
    time_slots JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    session_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    booking_count INT DEFAULT 0,
    slot_status TEXT DEFAULT 'Available',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    pf TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    reference_code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ
  )`;
  await sql`CREATE TABLE IF NOT EXISTS waitlist (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    pf TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
}
