import { describe, it, expect, beforeAll } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { generateSessions, TOTAL_SESSIONS } from '@/services/sessionService';

beforeAll(() => {
  generateSessions();
});

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/sessions', () => {
  it('returns all sessions when no filters provided', async () => {
    const res = await GET(makeRequest('/api/sessions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(TOTAL_SESSIONS);
  });

  it('filters sessions by date', async () => {
    const res = await GET(makeRequest('/api/sessions?date=2026-08-03'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((s: { sessionDate: string }) => s.sessionDate === '2026-08-03')).toBe(true);
  });

  it('filters sessions by status', async () => {
    const res = await GET(makeRequest('/api/sessions?status=Available'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((s: { slotStatus: string }) => s.slotStatus === 'Available')).toBe(true);
  });

  it('returns empty array for a date with no sessions', async () => {
    const res = await GET(makeRequest('/api/sessions?date=2026-07-01'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(0);
  });
});
