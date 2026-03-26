import { subscribe } from '@/lib/eventEmitter';
import type { BookingEvent } from '@/lib/eventEmitter';

/**
 * GET /api/events — Server-Sent Events stream
 *
 * Streams booking events to connected clients in real time.
 * Events emitted: session:updated, booking:created, booking:cancelled
 *
 * Requirements: 2.3, 8.3
 */
export async function GET(): Promise<Response> {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Send an initial comment to establish the connection
      controller.enqueue(encoder.encode(': connected\n\n'));

      const listener = (event: BookingEvent) => {
        const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(payload));
        } catch {
          // Stream already closed
        }
      };

      unsubscribe = subscribe(listener);

      // Keep-alive: send a comment every 30s to prevent proxy timeouts
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keep-alive\n\n'));
        } catch {
          if (keepAlive) clearInterval(keepAlive);
        }
      }, 30_000);
    },

    cancel() {
      // Clean up when the client disconnects
      if (unsubscribe) unsubscribe();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
