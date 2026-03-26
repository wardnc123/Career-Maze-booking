// Central data manager — bridges in-memory stores with Vercel Blob persistence.
// Call ensureLoaded() at the start of any API route, and persist() after mutations.

import { loadData, saveData } from './persistence';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

// ─── In-memory stores ────────────────────────────────────────────────────────

let events: CareerMazeEvent[] = [];
let sessions: Session[] = [];
let bookings: Booking[] = [];
let waitlistEntries: WaitlistEntry[] = [];
let loadedAt = 0; // timestamp of last load

const isVercel = () => !!process.env.BLOB_READ_WRITE_TOKEN;

/**
 * Load data from blob storage into memory.
 * On Vercel: always reloads if more than 1 second since last load (handles cold starts and concurrent functions).
 * Locally: no-op, uses in-memory only.
 */
export async function ensureLoaded(): Promise<void> {
  if (!isVercel()) return;

  const now = Date.now();
  // Reload if never loaded or stale (>1s old)
  if (loadedAt > 0 && (now - loadedAt) < 1000) return;

  const data = await loadData();
  events = data.events;
  sessions = data.sessions;
  bookings = data.bookings;
  waitlistEntries = data.waitlistEntries;
  loadedAt = now;
}

/**
 * Save current in-memory state to blob storage.
 */
export async function persist(): Promise<void> {
  if (!isVercel()) return;
  await saveData({ events, sessions, bookings, waitlistEntries });
  loadedAt = Date.now(); // Mark as fresh after save
}

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
