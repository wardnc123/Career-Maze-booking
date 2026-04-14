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
    await sql`CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      logo_url TEXT,
      brand_color TEXT NOT NULL DEFAULT '#1a1a2e',
      session_duration_minutes INTEGER NOT NULL DEFAULT 180,
      slot_interval_minutes INTEGER NOT NULL DEFAULT 15,
      max_attendees INTEGER NOT NULL DEFAULT 3,
      custom_form_fields JSONB NOT NULL DEFAULT '[]',
      calendar_invite_title_template TEXT NOT NULL DEFAULT '{programName} Session — {userName}',
      email_templates JSONB NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      location TEXT DEFAULT '',
      timezone TEXT DEFAULT 'Europe/London',
      program_id TEXT,
      dates JSONB NOT NULL DEFAULT '[]',
      time_slots JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    // Ensure program_id column exists on events table (may have been created before programs feature)
    try {
      await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS program_id TEXT`;
    } catch { /* column already exists */ }
    // Ensure max_attendees column exists on sessions table
    try {
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_attendees INTEGER NOT NULL DEFAULT 3`;
    } catch { /* column already exists */ }
    // Ensure custom_fields column exists on bookings table
    try {
      await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_fields JSONB`;
    } catch { /* column already exists */ }
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      session_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      booking_count INT DEFAULT 0,
      max_attendees INTEGER NOT NULL DEFAULT 3,
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
      custom_fields JSONB,
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
