-- 001_initial_schema.sql
-- Career Maze Session Booking & Tracking System
-- Initial database schema migration

-- ENUM types
CREATE TYPE slot_status AS ENUM ('Available', 'Limited', 'Full', 'Waitlisted');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');

-- Enable pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Session table
CREATE TABLE session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    booking_count INTEGER NOT NULL DEFAULT 0 CHECK (booking_count >= 0 AND booking_count <= 3),
    slot_status slot_status NOT NULL DEFAULT 'Available',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_session_date_time UNIQUE (session_date, start_time)
);

-- Booking table
CREATE TABLE booking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES session(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    pf VARCHAR(100) NOT NULL,
    status booking_status NOT NULL DEFAULT 'confirmed',
    reference_code VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMP
);

-- Indexes on Booking
CREATE INDEX idx_booking_email_status ON booking (email, status);
CREATE INDEX idx_booking_session_status ON booking (session_id, status);

-- Waitlist Entry table
CREATE TABLE waitlist_entry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES session(id),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    pf VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Index on WaitlistEntry for FIFO promotion
CREATE INDEX idx_waitlist_session_created ON waitlist_entry (session_id, created_at);

-- Admin table
CREATE TABLE admin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Admin Session table
CREATE TABLE admin_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES admin(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);

-- Audit Log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    details JSONB,
    performed_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
