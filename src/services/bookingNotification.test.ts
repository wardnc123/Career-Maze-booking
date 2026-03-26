import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createBooking,
  cancelBooking,
  resetBookingStore,
  setNotificationService,
} from './bookingService';
import { generateSessions } from './sessionService';
import { resetListeners, subscribe, type BookingEvent } from '@/lib/eventEmitter';
import type { INotificationService } from './notificationService';
import type { Session, BookingRequest } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let sessions: Session[];

function makeRequest(sessionId: string, overrides?: Partial<BookingRequest>): BookingRequest {
  return {
    sessionId,
    name: 'Test User',
    email: 'test@example.com',
    role: 'Engineer',
    pf: 'PF001',
    ...overrides,
  };
}

function createMockNotificationService(): INotificationService & {
  sendConfirmation: ReturnType<typeof vi.fn>;
  sendCancellation: ReturnType<typeof vi.fn>;
  sendWaitlistPromotion: ReturnType<typeof vi.fn>;
  sendReminder: ReturnType<typeof vi.fn>;
  sendDailyDigest: ReturnType<typeof vi.fn>;
} {
  return {
    sendConfirmation: vi.fn().mockResolvedValue(undefined),
    sendCancellation: vi.fn().mockResolvedValue(undefined),
    sendWaitlistPromotion: vi.fn().mockResolvedValue(undefined),
    sendReminder: vi.fn().mockResolvedValue(undefined),
    sendDailyDigest: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessions = generateSessions();
  resetBookingStore();
  resetListeners();
});

// ─── Notification wiring tests ───────────────────────────────────────────────

describe('BookingService — Notification wiring', () => {
  describe('createBooking() notifications', () => {
    it('sends confirmation email on confirmed booking (Req 7.1)', async () => {
      const mockNS = createMockNotificationService();
      setNotificationService(mockNS);

      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      expect(result.status).toBe('confirmed');

      // Allow fire-and-forget promise to resolve
      await vi.waitFor(() => {
        expect(mockNS.sendConfirmation).toHaveBeenCalledTimes(1);
      });

      const [booking, sess] = mockNS.sendConfirmation.mock.calls[0];
      expect(booking.email).toBe('test@example.com');
      expect(sess.id).toBe(session.id);
    });

    it('does not send notification when no service is set', async () => {
      // notificationService is null after resetBookingStore
      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      expect(result.status).toBe('confirmed');
      // No error thrown — notifications are optional
    });

    it('does not block booking when notification fails', async () => {
      const mockNS = createMockNotificationService();
      mockNS.sendConfirmation.mockRejectedValue(new Error('SMTP down'));
      setNotificationService(mockNS);

      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      expect(result.status).toBe('confirmed');
    });

    it('does not send confirmation for waitlisted booking', async () => {
      const mockNS = createMockNotificationService();
      setNotificationService(mockNS);

      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'c@test.com' }));

      mockNS.sendConfirmation.mockClear();
      const result = await createBooking(makeRequest(session.id, { email: 'd@test.com' }));
      expect(result.status).toBe('waitlisted');

      // Give time for any async calls
      await new Promise((r) => setTimeout(r, 10));
      expect(mockNS.sendConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('cancelBooking() notifications', () => {
    it('sends cancellation email on booking cancellation (Req 7.2)', async () => {
      const mockNS = createMockNotificationService();
      setNotificationService(mockNS);

      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      mockNS.sendConfirmation.mockClear();
      await cancelBooking(result.booking.id, 'test@example.com');

      await vi.waitFor(() => {
        expect(mockNS.sendCancellation).toHaveBeenCalledTimes(1);
      });

      const [booking, sess] = mockNS.sendCancellation.mock.calls[0];
      expect(booking.id).toBe(result.booking.id);
      expect(sess.id).toBe(session.id);
    });

    it('sends waitlist promotion email when waitlist entry is promoted (Req 7.3)', async () => {
      const mockNS = createMockNotificationService();
      setNotificationService(mockNS);

      const session = sessions[0];
      await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
      const r3 = await createBooking(makeRequest(session.id, { email: 'c@test.com' }));
      await createBooking(makeRequest(session.id, { email: 'wait@test.com', name: 'Waiter' }));

      if (r3.status !== 'confirmed') throw new Error('Expected confirmed');

      mockNS.sendConfirmation.mockClear();
      await cancelBooking(r3.booking.id, 'c@test.com');

      await vi.waitFor(() => {
        expect(mockNS.sendWaitlistPromotion).toHaveBeenCalledTimes(1);
      });

      const [promotedBooking] = mockNS.sendWaitlistPromotion.mock.calls[0];
      expect(promotedBooking.email).toBe('wait@test.com');
    });

    it('does not send promotion email when no waitlist entries exist', async () => {
      const mockNS = createMockNotificationService();
      setNotificationService(mockNS);

      const session = sessions[0];
      const result = await createBooking(makeRequest(session.id));
      if (result.status !== 'confirmed') throw new Error('Expected confirmed');

      await cancelBooking(result.booking.id, 'test@example.com');

      await new Promise((r) => setTimeout(r, 10));
      expect(mockNS.sendWaitlistPromotion).not.toHaveBeenCalled();
    });
  });
});

// ─── SSE event emission tests ────────────────────────────────────────────────

describe('BookingService — SSE event emission', () => {
  it('emits booking:created and session:updated on confirmed booking', async () => {
    const events: BookingEvent[] = [];
    subscribe((e) => events.push(e));

    const session = sessions[0];
    const result = await createBooking(makeRequest(session.id));
    if (result.status !== 'confirmed') throw new Error('Expected confirmed');

    const created = events.find((e) => e.type === 'booking:created');
    expect(created).toBeDefined();
    expect(created!.data.sessionId).toBe(session.id);
    expect(created!.data.bookingId).toBe(result.booking.id);

    const updated = events.find((e) => e.type === 'session:updated');
    expect(updated).toBeDefined();
    expect(updated!.data.sessionId).toBe(session.id);
    expect(updated!.data.bookingCount).toBe(1);
  });

  it('emits booking:cancelled and session:updated on cancellation', async () => {
    const session = sessions[0];
    const result = await createBooking(makeRequest(session.id));
    if (result.status !== 'confirmed') throw new Error('Expected confirmed');

    const events: BookingEvent[] = [];
    subscribe((e) => events.push(e));

    await cancelBooking(result.booking.id, 'test@example.com');

    const cancelled = events.find((e) => e.type === 'booking:cancelled');
    expect(cancelled).toBeDefined();
    expect(cancelled!.data.sessionId).toBe(session.id);
    expect(cancelled!.data.bookingId).toBe(result.booking.id);

    const updated = events.find((e) => e.type === 'session:updated');
    expect(updated).toBeDefined();
    expect(updated!.data.bookingCount).toBe(0);
  });

  it('emits session:updated with correct count after waitlist promotion', async () => {
    const session = sessions[0];
    await createBooking(makeRequest(session.id, { email: 'a@test.com' }));
    await createBooking(makeRequest(session.id, { email: 'b@test.com' }));
    const r3 = await createBooking(makeRequest(session.id, { email: 'c@test.com' }));
    await createBooking(makeRequest(session.id, { email: 'wait@test.com' }));

    if (r3.status !== 'confirmed') throw new Error('Expected confirmed');

    const events: BookingEvent[] = [];
    subscribe((e) => events.push(e));

    await cancelBooking(r3.booking.id, 'c@test.com');

    // After cancel + promotion, bookingCount should still be 3
    const sessionUpdates = events.filter((e) => e.type === 'session:updated');
    const lastUpdate = sessionUpdates[sessionUpdates.length - 1];
    expect(lastUpdate.data.bookingCount).toBe(3);
  });
});
