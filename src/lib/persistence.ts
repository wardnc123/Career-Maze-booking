// Persistence layer using Vercel Blob Storage
// Saves and loads all in-memory data as a single JSON blob

import { put, head, list } from '@vercel/blob';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

const BLOB_KEY = 'career-maze-data.json';

export interface AppData {
  events: CareerMazeEvent[];
  sessions: Session[];
  bookings: Booking[];
  waitlistEntries: WaitlistEntry[];
}

const emptyData: AppData = { events: [], sessions: [], bookings: [], waitlistEntries: [] };

let cachedData: AppData | null = null;
let lastLoadTime = 0;
const CACHE_TTL_MS = 2000; // Re-read from blob every 2 seconds max

/**
 * Load data from Vercel Blob. Uses a short cache to avoid hitting blob on every request.
 */
export async function loadData(): Promise<AppData> {
  const now = Date.now();
  if (cachedData && (now - lastLoadTime) < CACHE_TTL_MS) {
    return cachedData;
  }

  try {
    // Find the blob by listing with prefix
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (blobs.length === 0) {
      cachedData = { ...emptyData };
      lastLoadTime = now;
      return cachedData;
    }

    const response = await fetch(blobs[0].url);
    if (!response.ok) {
      cachedData = { ...emptyData };
      lastLoadTime = now;
      return cachedData;
    }

    const raw = await response.json();
    // Restore Date objects from JSON strings
    const data: AppData = {
      events: (raw.events || []).map((e: Record<string, unknown>) => ({ ...e, createdAt: new Date(e.createdAt as string) })),
      sessions: (raw.sessions || []).map((s: Record<string, unknown>) => ({ ...s, createdAt: new Date(s.createdAt as string) })),
      bookings: (raw.bookings || []).map((b: Record<string, unknown>) => ({
        ...b,
        createdAt: new Date(b.createdAt as string),
        cancelledAt: b.cancelledAt ? new Date(b.cancelledAt as string) : null,
      })),
      waitlistEntries: (raw.waitlistEntries || []).map((w: Record<string, unknown>) => ({ ...w, createdAt: new Date(w.createdAt as string) })),
    };

    cachedData = data;
    lastLoadTime = now;
    return data;
  } catch (err) {
    console.error('[persistence] Failed to load data:', err);
    if (cachedData) return cachedData;
    return { ...emptyData };
  }
}

/**
 * Save data to Vercel Blob. Overwrites the existing blob.
 */
export async function saveData(data: AppData): Promise<void> {
  cachedData = data;
  lastLoadTime = Date.now();

  try {
    await put(BLOB_KEY, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
  } catch (err) {
    console.error('[persistence] Failed to save data:', err);
  }
}
