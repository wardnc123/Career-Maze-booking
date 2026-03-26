import { describe, it, expect, beforeEach } from 'vitest';
import { GET } from './route';
import { emit, resetListeners } from '@/lib/eventEmitter';

describe('GET /api/events (SSE)', () => {
  beforeEach(() => {
    resetListeners();
  });

  it('returns correct SSE headers', async () => {
    const response = await GET();

    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache');
    expect(response.headers.get('Connection')).toBe('keep-alive');
  });

  it('sends initial connection comment', async () => {
    const response = await GET();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    const { value } = await reader.read();
    const text = decoder.decode(value);
    expect(text).toBe(': connected\n\n');

    reader.cancel();
  });

  it('streams booking:created events to the client', async () => {
    const response = await GET();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Read initial comment
    await reader.read();

    // Emit an event
    emit({ type: 'booking:created', data: { sessionId: 's1', bookingId: 'b1' } });

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain('event: booking:created');
    expect(text).toContain('"sessionId":"s1"');
    expect(text).toContain('"bookingId":"b1"');

    reader.cancel();
  });

  it('streams session:updated events to the client', async () => {
    const response = await GET();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    await reader.read(); // initial comment

    emit({ type: 'session:updated', data: { sessionId: 's2', bookingCount: 2, slotStatus: 'Limited' } });

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain('event: session:updated');
    expect(text).toContain('"sessionId":"s2"');

    reader.cancel();
  });

  it('streams booking:cancelled events to the client', async () => {
    const response = await GET();
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    await reader.read(); // initial comment

    emit({ type: 'booking:cancelled', data: { sessionId: 's3', bookingId: 'b3' } });

    const { value } = await reader.read();
    const text = decoder.decode(value);

    expect(text).toContain('event: booking:cancelled');
    expect(text).toContain('"bookingId":"b3"');

    reader.cancel();
  });

  it('cleans up listener on stream cancel', async () => {
    const { listenerCount } = await import('@/lib/eventEmitter');

    const response = await GET();
    const reader = response.body!.getReader();

    await reader.read(); // initial comment
    expect(listenerCount()).toBe(1);

    await reader.cancel();
    expect(listenerCount()).toBe(0);
  });
});
