// Persistence layer using Vercel Blob Storage
// Saves and loads all in-memory data as a single JSON blob

import { put, list } from '@vercel/blob';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

const BLOB_KEY = 'career-maze-data.json';

export interface AppData {
  events: CareerMazeEvent[];
  sessions: Session[];
  bookings: Booking[];
  waitlistEntries: WaitlistEntry[];
}

const emptyData: AppData = { events: [], sessions: [], bookings: [], waitlistEntries: [] };

/**
 * Load data from Vercel Blob. Always fetches fresh (no caching).
 */
export async function loadData(): Promise<AppData> {
  try {
    const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
    if (blobs.length === 0) {
      console.log('[persistence] No blob found, starting fresh');
      return { ...emptyData, events: [], sessions: [], bookings: [], waitlistEntries: [] };
    }

    const blobUrl = blobs[0].url;
    console.log('[persistence] Loading from blob:', blobUrl);
    const response = await fetch(blobUrl, { cache: 'no-store' });
    if (!response.ok) {
      console.error('[persistence] Blob fetch failed:', response.status);
      return { ...emptyData };
    }

    const raw = await response.json();

    const data: AppData = {
      events: (raw.events || []).map((e: Record<string, unknown>) => ({
        ...e,
        createdAt: new Date(e.createdAt as string),
      })),
      sessions: (raw.sessions || []).map((s: Record<string, unknown>) => ({
        ...s,
        createdAt: new Date(s.createdAt as string),
      })),
      bookings: (raw.bookings || []).map((b: Record<string, unknown>) => ({
        ...b,
        createdAt: new Date(b.createdAt as string),
        cancelledAt: b.cancelledAt ? new Date(b.cancelledAt as string) : null,
      })),
      waitlistEntries: (raw.waitlistEntries || []).map((w: Record<string, unknown>) => ({
        ...w,
        createdAt: new Date(w.createdAt as string),
      })),
    };

    console.log(`[persistence] Loaded: ${data.events.length} events, ${data.sessions.length} sessions, ${data.bookings.length} bookings`);
    return data;
  } catch (err) {
    console.error('[persistence] Failed to load:', err);
    return { ...emptyData };
  }
}

/**
 * Save data to Vercel Blob. Overwrites the existing blob.
 */
export async function saveData(data: AppData): Promise<void> {
  try {
    console.log(`[persistence] Saving: ${data.events.length} events, ${data.sessions.length} sessions, ${data.bookings.length} bookings`);
    await put(BLOB_KEY, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    console.log('[persistence] Save complete');
  } catch (err) {
    console.error('[persistence] Failed to save:', err);
  }
}
