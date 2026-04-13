-- 003_programs.sql
-- Multi-program booking platform migration
-- Creates the programs table, adds program_id to events, max_attendees to sessions,
-- custom_fields to bookings, inserts the default Career Maze program, and links existing events.

-- Create programs table
CREATE TABLE IF NOT EXISTS programs (
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
);

-- Add program_id column to events table (nullable initially for migration)
ALTER TABLE events ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES programs(id);

-- Add max_attendees column to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS max_attendees INTEGER NOT NULL DEFAULT 3;

-- Add custom_fields JSONB column to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS custom_fields JSONB;

-- Insert default Career Maze program
INSERT INTO programs (id, name, brand_color, session_duration_minutes, slot_interval_minutes, max_attendees, custom_form_fields, calendar_invite_title_template, active, created_at)
VALUES (
  'default-career-maze',
  'Career Maze',
  '#1a1a2e',
  180,
  15,
  3,
  '[{"name":"role","label":"Role","type":"text","required":true},{"name":"pf","label":"PF","type":"text","required":true}]',
  '{programName} Session — {userName}',
  true,
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Link existing events to the default program
UPDATE events SET program_id = 'default-career-maze' WHERE program_id IS NULL;

-- Make program_id NOT NULL after migration
ALTER TABLE events ALTER COLUMN program_id SET NOT NULL;
