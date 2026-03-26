import { describe, it, expect, beforeAll } from 'vitest';
import { GET } from './route';
import { NextRequest } from 'next/server';
import { generateSessions } from '@/services/sessionService';
import type { Session } from '@/models/types';

let sessions: Session[];

beforeAll(() => {
  sessions = generateSessions();
});

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/sessions/:id', () => {
  it('returns a session by ID', async () => {
    const target = sessions[0];
    const res = await GET(
      makeRequest(`/api/sessions/${target.id}`),
      { params: Promise.resolve({ id: target.id }) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe(target.id);
    expect(body.sessionDate).toBe(target.sessionDate);
    expect(body.startTime).toBe(target.startTime);
  });

  it('returns 404 for a non-existent session', async () => {
    const res = await GET(
      makeRequest('/api/sessions/non-existent-id'),
      { params: Promise.resolve({ id: 'non-existent-id' }) }
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Session not found');
  });
});
