// Career Maze Session Booking & Tracking System — Type Definitions

// ─── Enums ───────────────────────────────────────────────────────────────────

export type SlotStatus = 'Available' | 'Limited' | 'Full' | 'Waitlisted';

export type BookingStatus = 'confirmed' | 'cancelled';

// ─── Entity Types ────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  eventId: string;             // Which event this session belongs to
  sessionDate: string;         // ISO date string (YYYY-MM-DD)
  startTime: string;           // Time string (HH:MM:SS) in UTC
  bookingCount: number;        // 0–3
  slotStatus: SlotStatus;
  createdAt: Date;
}

export interface Booking {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  role: string;
  pf: string;
  status: BookingStatus;
  referenceCode: string;
  createdAt: Date;
  cancelledAt: Date | null;
}

export interface WaitlistEntry {
  id: string;
  sessionId: string;
  name: string;
  email: string;
  role: string;
  pf: string;
  createdAt: Date;
}

export interface Admin {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: Date;
}

export interface AdminSession {
  id: string;
  adminId: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

export interface AuditLog {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown> | null;
  performedBy: string;
  createdAt: Date;
}

// ─── Request / Response Interfaces ───────────────────────────────────────────

export interface BookingRequest {
  sessionId: string;
  name: string;
  email: string;
  role: string;
  pf: string;
}

export type BookingResult =
  | { status: 'confirmed'; booking: Booking }
  | { status: 'waitlisted'; waitlistEntry: WaitlistEntry }
  | { status: 'rejected'; reason: string };

// ─── Filter & Query Interfaces ───────────────────────────────────────────────

export interface SessionFilter {
  eventId?: string;                               // Filter by event
  date?: string;                                  // ISO date string
  timeRange?: { start: string; end: string };     // Time range (HH:MM)
  status?: SlotStatus;
}

// ─── Calendar Interfaces ─────────────────────────────────────────────────────

export interface CalendarEvent {
  startTime: Date;
  endTime: Date;
  summary: string;
  timezone: string;
}

// ─── Stats / Digest Interfaces ───────────────────────────────────────────────

export interface DailyStats {
  date: string;               // ISO date string
  totalBookings: number;
  fullSessions: number;
  emptySessions: number;
  waitlistCount: number;
}

// ─── Event Interface ─────────────────────────────────────────────────────────

export interface CareerMazeEvent {
  id: string;
  title: string;
  dates: string[];            // ISO date strings
  timeSlots: string[];        // London time strings (HH:MM)
  createdAt: Date;
}
