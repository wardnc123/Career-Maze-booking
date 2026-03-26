import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runDigestJob } from '@/services/digestJob';
import { generateSessions } from '@/services/sessionService';
import { resetBookingStore, createBooking, getStats } from '@/services/bookingService';
import type { INotificationService } from '@/services/notificationService';
import type { DailyStats } from '@/models/types';

// Helper to create a mock NotificationService
function createMockNotificationService() {
  const digestCalls: DailyStats[] = [];
  const service: INotificationService = {
    sendConfirmation: vi.fn(),
    sendCancellation: vi.fn(),
    sendWaitlistPromotion: vi.fn(),
    sendReminder: vi.fn(),
    sendDailyDigest: vi.fn(async (stats: DailyStats) => {
      digestCalls.push(stats);
    }),
  };
  return { service, digestCalls };
}

describe('runDigestJob', () => {
  beforeEach(() => {
    resetBookingStore();
    generateSessions();
  });

  it('computes correct stats from current booking state with no bookings', async () => {
    const { service } = createMockNotificationService();
    const stats = await runDigestJob(service);

    expect(stats.totalBookings).toBe(0);
    expect(stats.fullSessions).toBe(0);
    expect(stats.emptySessions).toBe(360);
    expect(stats.waitlistCount).toBe(0);
  });

  it('computes correct stats after creating bookings', async () => {
    const { getSessions } = await import('@/services/sessionService');
    const allSessions = getSessions();
    const session = allSessions[0];

    // Create 3 bookings to fill a session
    await createBooking({ sessionId: session.id, name: 'A', email: 'a@test.com', role: 'Eng', pf: 'PF1' });
    await createBooking({ sessionId: session.id, name: 'B', email: 'b@test.com', role: 'Eng', pf: 'PF2' });
    await createBooking({ sessionId: session.id, name: 'C', email: 'c@test.com', role: 'Eng', pf: 'PF3' });

    // Add a waitlist entry
    await createBooking({ sessionId: session.id, name: 'D', email: 'd@test.com', role: 'Eng', pf: 'PF4' });

    const { service } = createMockNotificationService();
    const stats = await runDigestJob(service);

    expect(stats.totalBookings).toBe(3);
    expect(stats.fullSessions).toBe(1);
    expect(stats.emptySessions).toBe(359);
    expect(stats.waitlistCount).toBe(1);
  });

  it('calls sendDailyDigest with the correct stats', async () => {
    const { service, digestCalls } = createMockNotificationService();
    const stats = await runDigestJob(service);

    expect(service.sendDailyDigest).toHaveBeenCalledTimes(1);
    expect(digestCalls).toHaveLength(1);
    expect(digestCalls[0]).toEqual(stats);
  });

  it('returns the stats that were sent', async () => {
    const { service } = createMockNotificationService();
    const stats = await runDigestJob(service);

    // Verify the returned stats match what getStats() would produce
    const currentStats = getStats();
    expect(stats.totalBookings).toBe(currentStats.totalBookings);
    expect(stats.fullSessions).toBe(currentStats.fullSessions);
    expect(stats.emptySessions).toBe(currentStats.emptySessions);
    expect(stats.waitlistCount).toBe(currentStats.waitlistCount);
    expect(stats.date).toBe(new Date().toISOString().split('T')[0]);
  });
});
