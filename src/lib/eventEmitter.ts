// Career Maze Session Booking & Tracking System — Event Emitter
// Simple pub/sub event bus for SSE integration.
// BookingService emits events; the SSE endpoint subscribes to forward them to clients.

export type BookingEventType = 'session:updated' | 'booking:created' | 'booking:cancelled';

export interface BookingEvent {
  type: BookingEventType;
  data: Record<string, unknown>;
}

type Listener = (event: BookingEvent) => void;

const listeners = new Set<Listener>();

/**
 * Subscribe to booking events. Returns an unsubscribe function.
 */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Emit a booking event to all subscribers.
 */
export function emit(event: BookingEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Swallow listener errors to avoid breaking other subscribers
    }
  }
}

/**
 * Get the current number of active listeners (useful for testing/debugging).
 */
export function listenerCount(): number {
  return listeners.size;
}

/**
 * Remove all listeners. Used in tests to ensure isolation.
 */
export function resetListeners(): void {
  listeners.clear();
}
