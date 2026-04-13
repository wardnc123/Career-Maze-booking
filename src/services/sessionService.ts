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
// These are backed by the dataManager for persistence on Vercel.

import {
  getEventsStore, getSessionsStore,
  addEvent as dmAddEvent, addSession as dmAddSession,
  setSessionsStore, setEventsStore, removeSessionsById,
} from '@/lib/dataManager';

// Convenience getters that return the live arrays from dataManager
function getEvents_(): CareerMazeEvent[] { return getEventsStore(); }
function getSessions_(): Session[] { return getSessionsStore(); }

let initialized = false;

// ─── Event management ────────────────────────────────────────────────────────

/**
 * Create a new event with custom dates, time slots, and title.
 * Returns the created event and its sessions.
 */
export function createEvent(
  title: string, dates: string[], timeSlots: string[],
  location: string = '', timezone: string = 'Europe/London',
  programId: string = 'default-career-maze', maxAttendees: number = 3
): { event: CareerMazeEvent; sessions: Session[] } {
  const eventId = uuidv4();
  const event: CareerMazeEvent = {
    id: eventId,
    title,
    location,
    timezone,
    programId,
    dates: [...dates].sort(),
    timeSlots: [...timeSlots].sort(),
    createdAt: new Date(),
  };
  dmAddEvent(event);

  const generated: Session[] = [];
  for (const date of dates) {
    for (const localTime of timeSlots) {
      const session: Session = {
        id: uuidv4(), eventId, sessionDate: date,
        startTime: localTime + ':00',  // Store as local time HH:MM:SS in event timezone
        bookingCount: 0,
        maxAttendees,
        slotStatus: 'Available' as SlotStatus, createdAt: new Date(),
      };
      generated.push(session);
      dmAddSession(session);
    }
  }
  return { event, sessions: generated };
}

export function getEvents(): CareerMazeEvent[] {
  return [...getEvents_()];
}

export function getEvent(eventId: string): CareerMazeEvent | null {
  return getEvents_().find((e) => e.id === eventId) ?? null;
}

/** Delete an event and all its sessions. */
export function deleteEvent(eventId: string): boolean {
  const events = getEvents_();
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx === -1) return false;
  events.splice(idx, 1);
  // Remove all sessions for this event
  const sessionIds = new Set(getSessions_().filter((s) => s.eventId === eventId).map((s) => s.id));
  removeSessionsById(sessionIds);
  return true;
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
  updates: { title?: string; location?: string; timezone?: string; dates?: string[]; timeSlots?: string[]; maxAttendees?: number }
): { event: CareerMazeEvent; sessionsAdded: number; sessionsRemoved: number } | null {
  const event = getEvents_().find((e) => e.id === eventId);
  if (!event) return null;

  if (updates.title) event.title = updates.title;
  if (updates.location !== undefined) event.location = updates.location;
  if (updates.timezone !== undefined) event.timezone = updates.timezone;

  let sessionsAdded = 0;
  let sessionsRemoved = 0;

  const newDates = updates.dates ? [...updates.dates].sort() : event.dates;
  const newTimeSlots = updates.timeSlots ? [...updates.timeSlots].sort() : event.timeSlots;

  // Build set of desired (date, utcTime) combos
  const desiredCombos = new Set<string>();
  for (const date of newDates) {
    for (const localTime of newTimeSlots) {
      desiredCombos.add(`${date}|${localTime}:00`);
    }
  }

  // Build set of existing (date, utcTime) combos for this event
  const existingCombos = new Map<string, Session>();
  for (const s of getSessions_()) {
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
    removeSessionsById(toRemoveIds);
  }

  // Add sessions for new combos that don't exist yet
  const newMaxAttendees = updates.maxAttendees ?? 3;
  for (const combo of desiredCombos) {
    if (!existingCombos.has(combo)) {
      const parts = combo.split('|');
      dmAddSession({
        id: uuidv4(),
        eventId,
        sessionDate: parts[0],
        startTime: parts[1],
        bookingCount: 0,
        maxAttendees: newMaxAttendees,
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

// ─── Default session generation (for tests) ─────────────────────────────────

export function generateSessions(): Session[] {
  // Clear existing events and sessions to prevent accumulation across test runs
  setEventsStore([]);
  setSessionsStore([]);
  const dates = generateDateRange();
  const { sessions: generated } = createEvent('Career Maze August 2026', dates, [...ALL_SLOTS_LONDON]);
  initialized = true;
  return generated;
}

export function generateCustomSessions(dates: string[], timeSlots: string[]): Session[] {
  const { sessions: generated } = createEvent('Custom Event', dates, timeSlots);
  return generated;
}

function ensureInitialized(): void {
  if (!initialized) initialized = true;
}

// ─── Query functions ─────────────────────────────────────────────────────────

export function getSessions(filters?: SessionFilter): Session[] {
  const result = [...getSessions_()];
  if (!filters) return result;
  let filtered = result;
  if (filters.eventId) filtered = filtered.filter((s) => s.eventId === filters.eventId);
  if (filters.date) filtered = filtered.filter((s) => s.sessionDate === filters.date);
  if (filters.timeRange) {
    const { start, end } = filters.timeRange;
    filtered = filtered.filter((s) => { const t = s.startTime.slice(0, 5); return t >= start && t <= end; });
  }
  if (filters.status) filtered = filtered.filter((s) => s.slotStatus === filters.status);
  return filtered;
}

export function getSession(sessionId: string): Session | null {
  return getSessions_().find((s) => s.id === sessionId) ?? null;
}

export function getSessionsByDate(date: string): Session[] {
  return getSessions_().filter((s) => s.sessionDate === date);
}

export function getEventConfig(): { dates: string[]; timeSlots: string[] } {
  const allSessions = getSessions_();
  const dates = [...new Set(allSessions.map((s) => s.sessionDate))].sort();
  const timeSlots = [...new Set(allSessions.map((s) => utcToLondon(s.startTime)))].sort();
  return { dates, timeSlots };
}

// ─── Exported constants for testing ──────────────────────────────────────────

export {
  MORNING_SLOTS_LONDON, AFTERNOON_SLOTS_LONDON, ALL_SLOTS_LONDON,
  SESSIONS_PER_DAY, TOTAL_DAYS, TOTAL_SESSIONS, BST_OFFSET_HOURS,
  START_DATE, END_DATE, londonToUtc, generateDateRange, utcToLondon,
};
