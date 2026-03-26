// Database connection using Neon Serverless Postgres
import { neon } from '@neondatabase/serverless';

export function getDbUrl(): string | null {
  // Check all possible env var names that Vercel/Neon might set
  return process.env.POSTGRES_URL
    || process.env.DATABASE_URL
    || process.env.POSTGRES_URL_NON_POOLING
    || process.env.NEON_DATABASE_URL
    || null;
}

export function getDb() {
  const url = getDbUrl();
  if (!url) {
    console.error('[db] No database URL found. Checked: POSTGRES_URL, DATABASE_URL, POSTGRES_URL_NON_POOLING, NEON_DATABASE_URL');
    throw new Error('No database URL configured');
  }
  return neon(url);
}

export async function initDb() {
  try {
    const sql = getDb();
    console.log('[db] Initializing tables...');
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
      event_id TEXT NOT NULL,
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
    console.log('[db] Tables initialized successfully');
  } catch (err) {
    console.error('[db] Failed to initialize tables:', err);
    throw err;
  }
}
