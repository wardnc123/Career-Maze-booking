// Career Maze Session Booking & Tracking System — SessionService
// Generates and queries session schedules, supporting multiple events.

import { v4 as uuidv4 } from 'uuid';
import type { Session, SessionFilter, SlotStatus, CareerMazeEvent } from '@/models/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const START_DATE = '2026-08-03';
const END_DATE = '2026-08-22';

const MORNING_SLOTS_LONDON = [
  '09:00', '09:15', '09:30',
  '10:00', '10:15', '10:30',
  '11:00', '11:15', '11:30',
  '12:00',
] as const;

const AFTERNOON_SLOTS_LONDON = [
  '14:00', '14:15', '14:30',
  '15:00', '15:15',
] as const;

const ALL_SLOTS_LONDON = [...MORNING_SLOTS_LONDON, ...AFTERNOON_SLOTS_LONDON];
const SESSIONS_PER_DAY = 15;
const TOTAL_DAYS = 20;
const TOTAL_SESSIONS = SESSIONS_PER_DAY * TOTAL_DAYS;
const BST_OFFSET_HOURS = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function londonToUtc(londonTime: string): string {
  const [h, m] = londonTime.split(':').map(Number);
  const utcHour = h - BST_OFFSET_HOURS;
  return `${String(utcHour).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
}

function utcToLondon(utcTime: string): string {
  const [h, m] = utcTime.split(':').map(Number);
  const londonHour = h + BST_OFFSET_HOURS;
  return `${String(londonHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateDateRange(): string[] {
  const dates: string[] = [];
  const current = new Date(START_DATE + 'T00:00:00Z');
  const end = new Date(END_DATE + 'T00:00:00Z');
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

// ─── In-memory stores ────────────────────────────────────────────────────────

let sessions: Session[] = [];
let events: CareerMazeEvent[] = [];
let initialized = false;

// ─── Event management ────────────────────────────────────────────────────────

/**
 * Create a new event with custom dates, time slots, and title.
 * Returns the created event and its sessions.
 */
export function createEvent(title: string, dates: string[], timeSlots: string[]): { event: CareerMazeEvent; sessions: Session[] } {
  const eventId = uuidv4();
  const event: CareerMazeEvent = {
    id: eventId,
    title,
    dates: [...dates].sort(),
    timeSlots: [...timeSlots].sort(),
    createdAt: new Date(),
  };
  events.push(event);

  const generated: Session[] = [];
  for (const date of dates) {
    for (const londonTime of timeSlots) {
      const session: Session = {
        id: uuidv4(),
        eventId,
        sessionDate: date,
        startTime: londonToUtc(londonTime),
        bookingCount: 0,
        slotStatus: 'Available' as SlotStatus,
        createdAt: new Date(),
      };
      generated.push(session);
    }
  }
  sessions.push(...generated);

  return { event, sessions: generated };
}

/** Get all events. */
export function getEvents(): CareerMazeEvent[] {
  ensureInitialized();
  return [...events];
}

/** Get a single event by ID. */
export function getEvent(eventId: string): CareerMazeEvent | null {
  ensureInitialized();
  return events.find((e) => e.id === eventId) ?? null;
}

/**
 * Update an existing event's title, dates, and/or time slots.
 * - Title change: updates the event record only.
 * - Dates/time slots change: removes sessions that no longer match,
 *   adds new sessions for newly added date/slot combos,
 *   preserves existing sessions (and their bookings) that still match.
 */
export function updateEvent(
  eventId: string,
  updates: { title?: string; dates?: string[]; timeSlots?: string[] }
): { event: CareerMazeEvent; sessionsAdded: number; sessionsRemoved: number } | null {
  ensureInitialized();
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;

  if (updates.title) event.title = updates.title;

  let sessionsAdded = 0;
  let sessionsRemoved = 0;

  const newDates = updates.dates ? [...updates.dates].sort() : event.dates;
  const newTimeSlots = updates.timeSlots ? [...updates.timeSlots].sort() : event.timeSlots;

  // Build set of desired (date, utcTime) combos
  const desiredCombos = new Set<string>();
  for (const date of newDates) {
    for (const londonTime of newTimeSlots) {
      desiredCombos.add(`${date}|${londonToUtc(londonTime)}`);
    }
  }

  // Build set of existing (date, utcTime) combos for this event
  const existingCombos = new Map<string, Session>();
  for (const s of sessions) {
    if (s.eventId === eventId) {
      existingCombos.set(`${s.sessionDate}|${s.startTime}`, s);
    }
  }

  // Remove sessions that are no longer in the desired set
  const toRemoveIds = new Set<string>();
  for (const [combo, session] of existingCombos) {
    if (!desiredCombos.has(combo)) {
      toRemoveIds.add(session.id);
      sessionsRemoved++;
    }
  }
  if (toRemoveIds.size > 0) {
    sessions = sessions.filter((s) => !toRemoveIds.has(s.id));
  }

  // Add sessions for new combos that don't exist yet
  for (const combo of desiredCombos) {
    if (!existingCombos.has(combo)) {
      const [date, utcTime] = combo.split('|');
      sessions.push({
        id: uuidv4(),
        eventId,
        sessionDate: date,
        startTime: utcTime,
        bookingCount: 0,
        slotStatus: 'Available' as SlotStatus,
        createdAt: new Date(),
      });
      sessionsAdded++;
    }
  }

  event.dates = newDates;
  event.timeSlots = newTimeSlots;

  return { event, sessionsAdded, sessionsRemoved };
}

// ─── Default session generation (for tests and initial load) ─────────────────

export function generateSessions(): Session[] {
  const dates = generateDateRange();
  const eventId = uuidv4();

  // Create a default event
  const event: CareerMazeEvent = {
    id: eventId,
    title: 'Career Maze August 2026',
    dates: [...dates],
    timeSlots: [...ALL_SLOTS_LONDON],
    createdAt: new Date(),
  };

  const generated: Session[] = [];
  for (const date of dates) {
    for (const londonTime of ALL_SLOTS_LONDON) {
      const session: Session = {
        id: uuidv4(),
        eventId,
        sessionDate: date,
        startTime: londonToUtc(londonTime),
        bookingCount: 0,
        slotStatus: 'Available' as SlotStatus,
        createdAt: new Date(),
      };
      generated.push(session);
    }
  }

  sessions = generated;
  events = [event];
  initialized = true;
  return generated;
}

export function generateCustomSessions(dates: string[], timeSlots: string[]): Session[] {
  const { sessions: generated } = createEvent('Custom Event', dates, timeSlots);
  return generated;
}

function ensureInitialized(): void {
  if (!initialized) {
    // Start with empty stores — admin creates events via /admin/setup
    initialized = true;
  }
}

// ─── Query functions ─────────────────────────────────────────────────────────

export function getSessions(filters?: SessionFilter): Session[] {
  ensureInitialized();
  let result = [...sessions];
  if (!filters) return result;
  if (filters.eventId) result = result.filter((s) => s.eventId === filters.eventId);
  if (filters.date) result = result.filter((s) => s.sessionDate === filters.date);
  if (filters.timeRange) {
    const { start, end } = filters.timeRange;
    result = result.filter((s) => { const t = s.startTime.slice(0, 5); return t >= start && t <= end; });
  }
  if (filters.status) result = result.filter((s) => s.slotStatus === filters.status);
  return result;
}

export function getSession(sessionId: string): Session | null {
  ensureInitialized();
  return sessions.find((s) => s.id === sessionId) ?? null;
}

export function getSessionsByDate(date: string): Session[] {
  ensureInitialized();
  return sessions.filter((s) => s.sessionDate === date);
}

export function getEventConfig(): { dates: string[]; timeSlots: string[] } {
  ensureInitialized();
  const dates = [...new Set(sessions.map((s) => s.sessionDate))].sort();
  const timeSlots = [...new Set(sessions.map((s) => utcToLondon(s.startTime)))].sort();
  return { dates, timeSlots };
}

// ─── Exported constants for testing ──────────────────────────────────────────

export {
  MORNING_SLOTS_LONDON, AFTERNOON_SLOTS_LONDON, ALL_SLOTS_LONDON,
  SESSIONS_PER_DAY, TOTAL_DAYS, TOTAL_SESSIONS, BST_OFFSET_HOURS,
  START_DATE, END_DATE, londonToUtc, generateDateRange, utcToLondon,
};
