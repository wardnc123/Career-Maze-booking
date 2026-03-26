// Central data manager — bridges in-memory stores with Vercel Blob persistence.
// Call ensureLoaded() at the start of any API route, and persist() after mutations.

import { loadData, saveData, type AppData } from './persistence';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

// ─── In-memory stores (the source of truth during a request) ─────────────────

let events: CareerMazeEvent[] = [];
let sessions: Session[] = [];
let bookings: Booking[] = [];
let waitlistEntries: WaitlistEntry[] = [];
let loaded = false;

/**
 * Load data from blob storage into memory (if not already loaded).
 */
export async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!isVercel) {
    // Running locally — just use in-memory, no persistence
    loaded = true;
    return;
  }
  const data = await loadData();
  events = data.events;
  sessions = data.sessions;
  bookings = data.bookings;
  waitlistEntries = data.waitlistEntries;
  loaded = true;
}

/**
 * Save current in-memory state to blob storage.
 */
export async function persist(): Promise<void> {
  const isVercel = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (!isVercel) return; // Skip persistence locally
  await saveData({ events, sessions, bookings, waitlistEntries });
}

// ─── Accessors (used by services) ────────────────────────────────────────────

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
