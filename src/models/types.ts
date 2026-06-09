// Career Maze Session Booking & Tracking System — Type Definitions

// ─── Enums ───────────────────────────────────────────────────────────────────

export type SlotStatus = 'Available' | 'Limited' | 'Full' | 'Waitlisted';

export type BookingStatus = 'confirmed' | 'cancelled';

// ─── Program Types ───────────────────────────────────────────────────────────

export interface CustomFormField {
  name: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  headerHtml?: string;
  footerHtml?: string;
}

export interface ProgramEmailTemplates {
  confirmation?: EmailTemplate;
  cancellation?: EmailTemplate;
  waitlist_promotion?: EmailTemplate;
  reminder?: EmailTemplate;
}

export interface Program {
  id: string;
  name: string;
  logoUrl: string | null;
  brandColor: string;
  sessionDurationMinutes: number;
  slotIntervalMinutes: number;
  maxAttendees: number;
  customFormFields: CustomFormField[];
  calendarInviteTitleTemplate: string;
  emailTemplates: ProgramEmailTemplates;
  active: boolean;
  createdAt: Date;
}

// ─── Entity Types ────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  eventId: string;             // Which event this session belongs to
  sessionDate: string;         // ISO date string (YYYY-MM-DD)
  startTime: string;           // Time string (HH:MM:SS) in UTC
  bookingCount: number;        // 0–N (where N = maxAttendees)
  maxAttendees: number;        // Snapshot from program at creation time
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
  customFields: Record<string, string> | null;
  promotedFromWaitlist?: boolean;
  vpAlias?: string;
  level?: string;
  attended?: boolean;
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
  location: string;           // Site/building location
  timezone: string;           // IANA timezone e.g. 'Europe/London', 'America/New_York'
  programId: string;          // Foreign key to Program
  dates: string[];            // ISO date strings
  timeSlots: string[];        // Local time strings (HH:MM) in the event's timezone
  createdAt: Date;
}
