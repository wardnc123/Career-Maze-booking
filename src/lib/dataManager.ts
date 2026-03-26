// Central data manager — bridges in-memory stores with Postgres persistence.
// Call ensureLoaded() at the start of any API route.
// Individual persist functions are called after mutations.

import { loadData, saveEvent, saveSessions, saveSession, saveBooking, saveWaitlistEntry, deleteWaitlistEntry, deleteEventFromDb, deleteSessionsFromDb } from './persistence';
import { initDb } from './db';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

let events: CareerMazeEvent[] = [];
let sessions: Session[] = [];
let bookings: Booking[] = [];
let waitlistEntries: WaitlistEntry[] = [];
let dbInitialized = false;

const isVercel = () => !!(process.env.POSTGRES_URL || process.env.DATABASE_URL);

export async function ensureLoaded(): Promise<void> {
  if (!isVercel()) return;
  if (!dbInitialized) { await initDb(); dbInitialized = true; }
  const data = await loadData();
  events = data.events;
  sessions = data.sessions;
  bookings = data.bookings;
  waitlistEntries = data.waitlistEntries;
}

// persist() is now a no-op — individual operations save directly to Postgres
export async function persist(): Promise<void> {}

// ─── Persist helpers (called by services after mutations) ────────────────────
export async function persistEvent(event: CareerMazeEvent) { if (isVercel()) await saveEvent(event); }
export async function persistSessions(s: Session[]) { if (isVercel()) await saveSessions(s); }
export async function persistSession(s: Session) { if (isVercel()) await saveSession(s); }
export async function persistBooking(b: Booking) { if (isVercel()) await saveBooking(b); }
export async function persistWaitlistEntry(w: WaitlistEntry) { if (isVercel()) await saveWaitlistEntry(w); }
export async function persistDeleteWaitlist(id: string) { if (isVercel()) await deleteWaitlistEntry(id); }
export async function persistDeleteEvent(eventId: string) { if (isVercel()) await deleteEventFromDb(eventId); }
export async function persistDeleteSessions(ids: string[]) { if (isVercel()) await deleteSessionsFromDb(ids); }

// ─── Accessors ───────────────────────────────────────────────────────────────
export function getEventsStore(): CareerMazeEvent[] { return events; }
export function getSessionsStore(): Session[] { return sessions; }
export function getBookingsStore(): Booking[] { return bookings; }
export function getWaitlistStore(): WaitlistEntry[] { return waitlistEntries; }

export function setEventsStore(e: CareerMazeEvent[]) { events = e; }
export function setSessionsStore(s: Session[]) { sessions = s; }
export function setBookingsStore(b: Booking[]) { bookings = b; }
export function setWaitlistStore(w: WaitlistEntry[]) { waitlistEntries = w; }

export function addSession(s: Session) { sessions.push(s); }
export function addEvent(e: CareerMazeEvent) { events.push(e); }
export function addBooking(b: Booking) { bookings.push(b); }
export function addWaitlistEntry(w: WaitlistEntry) { waitlistEntries.push(w); }

export function removeSessionsById(ids: Set<string>) { sessions = sessions.filter((s) => !ids.has(s.id)); }
export function removeWaitlistEntry(id: string) { waitlistEntries = waitlistEntries.filter((w) => w.id !== id); }
