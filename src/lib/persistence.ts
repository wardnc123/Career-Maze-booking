// Persistence layer using Vercel Blob Storage

import { put, list, del } from '@vercel/blob';
import type { Session, Booking, WaitlistEntry, CareerMazeEvent } from '@/models/types';

const BLOB_PATHNAME = 'career-maze-data.json';

export interface AppData {
  events: CareerMazeEvent[];
  sessions: Session[];
  bookings: Booking[];
  waitlistEntries: WaitlistEntry[];
}

// Cache the blob URL after first successful save/load
let knownBlobUrl: string | null = null;

export async function loadData(): Promise<AppData> {
  const empty: AppData = { events: [], sessions: [], bookings: [], waitlistEntries: [] };
  try {
    // Try to find the blob
    const { blobs } = await list({ limit: 100 });
    const match = blobs.find(b => b.pathname === BLOB_PATHNAME);
    
    if (!match) {
      console.log('[persistence] No data blob found among', blobs.length, 'blobs. Pathnames:', blobs.map(b => b.pathname));
      return empty;
    }

    knownBlobUrl = match.url;
    console.log('[persistence] Found blob at:', match.url);
    
    const response = await fetch(match.url, { cache: 'no-store' });
    if (!response.ok) {
      console.error('[persistence] Fetch failed:', response.status);
      return empty;
    }

    const raw = await response.json();
    const data: AppData = {
      events: (raw.events || []).map((e: Record<string, unknown>) => ({ ...e, createdAt: new Date(e.createdAt as string) })),
      sessions: (raw.sessions || []).map((s: Record<string, unknown>) => ({ ...s, createdAt: new Date(s.createdAt as string) })),
      bookings: (raw.bookings || []).map((b: Record<string, unknown>) => ({ ...b, createdAt: new Date(b.createdAt as string), cancelledAt: b.cancelledAt ? new Date(b.cancelledAt as string) : null })),
      waitlistEntries: (raw.waitlistEntries || []).map((w: Record<string, unknown>) => ({ ...w, createdAt: new Date(w.createdAt as string) })),
    };
    console.log(`[persistence] Loaded: ${data.events.length} events, ${data.sessions.length} sessions`);
    return data;
  } catch (err) {
    console.error('[persistence] Load error:', err);
    return empty;
  }
}

export async function saveData(data: AppData): Promise<void> {
  try {
    // Delete old blob first if we know its URL (to avoid duplicates)
    if (knownBlobUrl) {
      try { await del(knownBlobUrl); } catch { /* ignore delete errors */ }
    }
    
    console.log(`[persistence] Saving: ${data.events.length} events, ${data.sessions.length} sessions`);
    const blob = await put(BLOB_PATHNAME, JSON.stringify(data), {
      access: 'public',
      addRandomSuffix: false,
    });
    knownBlobUrl = blob.url;
    console.log('[persistence] Saved to:', blob.url);
  } catch (err) {
    console.error('[persistence] Save error:', err);
  }
}
