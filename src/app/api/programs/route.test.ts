import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from './route';
import { GET as GET_BY_ID, PUT } from './[id]/route';
import { POST as POST_PREVIEW } from './[id]/email-templates/preview/route';
import { NextRequest } from 'next/server';
import { setProgramsStore } from '@/lib/dataManager';
import { createProgram } from '@/services/programService';
import type { Program } from '@/models/types';

function makePostRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePutRequest(url: string, body: unknown) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'), { method: 'GET' });
}

const validProgramBody = {
  name: 'Test Program',
  brandColor: '#ff0000',
  sessionDurationMinutes: 60,
  slotIntervalMinutes: 30,
  maxAttendees: 5,
  customFormFields: [],
};

beforeEach(() => {
  setProgramsStore([]);
});

describe('GET /api/programs', () => {
  it('returns empty array when no programs exist', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('returns all programs', async () => {
    createProgram({ ...validProgramBody, name: 'Program A' });
    createProgram({ ...validProgramBody, name: 'Program B' });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].name).toBe('Program A');
    expect(body[1].name).toBe('Program B');
  });
});

describe('POST /api/programs', () => {
  it('creates a program and returns 201', async () => {
    const res = await POST(makePostRequest('/api/programs', validProgramBody));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe('Test Program');
    expect(body.brandColor).toBe('#ff0000');
    expect(body.sessionDurationMinutes).toBe(60);
    expect(body.slotIntervalMinutes).toBe(30);
    expect(body.maxAttendees).toBe(5);
    expect(body.id).toBeDefined();
    expect(body.active).toBe(true);
  });

  it('returns 400 for missing name', async () => {
    const res = await POST(makePostRequest('/api/programs', { ...validProgramBody, name: '' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Program name is required');
  });

  it('returns 400 for missing brand color', async () => {
    const res = await POST(makePostRequest('/api/programs', { ...validProgramBody, brandColor: '' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Brand color is required');
  });

  it('returns 400 for duplicate program name', async () => {
    await POST(makePostRequest('/api/programs', validProgramBody));
    const res = await POST(makePostRequest('/api/programs', validProgramBody));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('A program with this name already exists');
  });

  it('returns 400 for invalid session duration', async () => {
    const res = await POST(makePostRequest('/api/programs', { ...validProgramBody, sessionDurationMinutes: 45 }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid session duration');
  });

  it('returns 400 for invalid slot interval', async () => {
    const res = await POST(makePostRequest('/api/programs', { ...validProgramBody, slotIntervalMinutes: 20 }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid slot interval');
  });

  it('returns 400 for invalid max attendees', async () => {
    const res = await POST(makePostRequest('/api/programs', { ...validProgramBody, maxAttendees: 4 }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid max attendees');
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new NextRequest(new URL('/api/programs', 'http://localhost:3000'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });
});


describe('GET /api/programs/[id]', () => {
  it('returns a program by id', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });

    const res = await GET_BY_ID(makeGetRequest(`/api/programs/${program.id}`), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('Test Program');
    expect(body.id).toBe(program.id);
  });

  it('returns 404 for non-existent program', async () => {
    const params = Promise.resolve({ id: 'non-existent' });
    const res = await GET_BY_ID(makeGetRequest('/api/programs/non-existent'), { params });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Program not found');
  });
});

describe('PUT /api/programs/[id]', () => {
  it('updates a program and returns updated data', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });

    const res = await PUT(
      makePutRequest(`/api/programs/${program.id}`, { name: 'Updated Name', brandColor: '#00ff00' }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('Updated Name');
    expect(body.brandColor).toBe('#00ff00');
  });

  it('returns 404 for non-existent program', async () => {
    const params = Promise.resolve({ id: 'non-existent' });
    const res = await PUT(
      makePutRequest('/api/programs/non-existent', { name: 'Updated' }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Program not found');
  });

  it('returns 400 for duplicate name on update', async () => {
    createProgram({ ...validProgramBody, name: 'Program A' });
    const programB = createProgram({ ...validProgramBody, name: 'Program B' });
    const params = Promise.resolve({ id: programB.id });

    const res = await PUT(
      makePutRequest(`/api/programs/${programB.id}`, { name: 'Program A' }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('A program with this name already exists');
  });

  it('returns 400 for invalid session duration on update', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });

    const res = await PUT(
      makePutRequest(`/api/programs/${program.id}`, { sessionDurationMinutes: 45 }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Invalid session duration');
  });

  it('returns 400 for invalid JSON', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });
    const req = new NextRequest(new URL(`/api/programs/${program.id}`, 'http://localhost:3000'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await PUT(req, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });
});

describe('POST /api/programs/[id]/email-templates/preview', () => {
  it('renders a template preview', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });

    const res = await POST_PREVIEW(
      makePostRequest(`/api/programs/${program.id}/email-templates/preview`, {
        template: {
          subject: 'Hello {userName}',
          bodyHtml: '<p>Welcome {userName} to {programName}</p>',
        },
      }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subject).toContain('Jane Doe');
    expect(body.html).toContain('Jane Doe');
    expect(body.html).toContain('Sample Program');
  });

  it('returns 404 for non-existent program', async () => {
    const params = Promise.resolve({ id: 'non-existent' });
    const res = await POST_PREVIEW(
      makePostRequest('/api/programs/non-existent/email-templates/preview', {
        template: { subject: 'Test', bodyHtml: '<p>Test</p>' },
      }),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('Program not found');
  });

  it('returns 400 when template is missing', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });

    const res = await POST_PREVIEW(
      makePostRequest(`/api/programs/${program.id}/email-templates/preview`, {}),
      { params },
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Template with subject and bodyHtml is required');
  });

  it('returns 400 for invalid JSON', async () => {
    const program = createProgram(validProgramBody);
    const params = Promise.resolve({ id: program.id });
    const req = new NextRequest(
      new URL(`/api/programs/${program.id}/email-templates/preview`, 'http://localhost:3000'),
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'not json' },
    );
    const res = await POST_PREVIEW(req, { params });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('Invalid JSON');
  });
});
