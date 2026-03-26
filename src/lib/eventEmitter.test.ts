import { describe, it, expect, beforeEach } from 'vitest';
import {
  subscribe,
  emit,
  listenerCount,
  resetListeners,
  type BookingEvent,
} from './eventEmitter';

describe('eventEmitter', () => {
  beforeEach(() => {
    resetListeners();
  });

  it('delivers events to subscribers', () => {
    const received: BookingEvent[] = [];
    subscribe((e) => received.push(e));

    const event: BookingEvent = {
      type: 'booking:created',
      data: { sessionId: 's1', bookingId: 'b1' },
    };
    emit(event);

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual(event);
  });

  it('supports multiple subscribers', () => {
    const a: BookingEvent[] = [];
    const b: BookingEvent[] = [];
    subscribe((e) => a.push(e));
    subscribe((e) => b.push(e));

    emit({ type: 'session:updated', data: { sessionId: 's1' } });

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('unsubscribe removes the listener', () => {
    const received: BookingEvent[] = [];
    const unsub = subscribe((e) => received.push(e));

    emit({ type: 'booking:cancelled', data: { sessionId: 's1', bookingId: 'b1' } });
    expect(received).toHaveLength(1);

    unsub();
    emit({ type: 'booking:created', data: { sessionId: 's2', bookingId: 'b2' } });
    expect(received).toHaveLength(1); // no new event
  });

  it('tracks listener count', () => {
    expect(listenerCount()).toBe(0);
    const unsub1 = subscribe(() => {});
    const unsub2 = subscribe(() => {});
    expect(listenerCount()).toBe(2);
    unsub1();
    expect(listenerCount()).toBe(1);
    unsub2();
    expect(listenerCount()).toBe(0);
  });

  it('swallows errors from individual listeners without affecting others', () => {
    const received: BookingEvent[] = [];
    subscribe(() => { throw new Error('boom'); });
    subscribe((e) => received.push(e));

    emit({ type: 'session:updated', data: {} });

    expect(received).toHaveLength(1);
  });

  it('resetListeners clears all subscribers', () => {
    subscribe(() => {});
    subscribe(() => {});
    expect(listenerCount()).toBe(2);
    resetListeners();
    expect(listenerCount()).toBe(0);
  });
});
