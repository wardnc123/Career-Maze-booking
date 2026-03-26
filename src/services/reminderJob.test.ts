import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runReminderJob } from '@/services/reminderJob';
import { generateSessions, getSessions } from '@/services/sessionService';
import { resetBookingStore, createBooking } from '@/services/bookingService';
import type { NotificationService } from '@/services/notificationService';
import type { Booking, Session } from '@/models/types';

// Helper to create a mock NotificationService
function createMockNotificationService() {
  const calls: Array<{ booking: Booking; session: Session }> = [];
  const service = {
    sendConfirmation: vi.fn(),
    sendCancellation: vi.fn(),
    sendWaitlistPromotion: vi.fn(),
    sendReminder: vi.fn(async (booking: Booking, session: Session) => {
      calls.push({ booking, session });
    }),
    sendDailyDigest: vi.fn(),
  } as unknown as NotificationService;
  return { service, calls };
}

describe('runReminderJob', () => {
  beforeEach(() => {
    resetBookingStore();
    generateSessions();
  });

  it('sends reminders for sessions within the next 24 hours', async () => {
    const allSessions = getSessions();
    // Pick a session and create a confirmed booking for it
    const targetSession = allSessions[0];
    const sessionStart = new Date(`${targetSession.sessionDate}T${targetSession.startTime}Z`);

    await createBooking({
      sessionId: targetSession.id,
      name: 'Alice Test',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF001',
    });

    // Set "now" to 12 hours before the session starts (within 24h window)
    const now = new Date(sessionStart.getTime() - 12 * 60 * 60 * 1000);

    const { service, calls } = createMockNotificationService();
    const result = await runReminderJob(service, now);

    // The target session should be included
    const reminderForTarget = calls.find(
      (c) => c.session.id === targetSession.id && c.booking.email === 'alice@example.com'
    );
    expect(reminderForTarget).toBeDefined();
    expect(result.remindersSent).toBeGreaterThanOrEqual(1);
  });

  it('does not send reminders for sessions more than 24 hours away', async () => {
    const allSessions = getSessions();
    const targetSession = allSessions[0];
    const sessionStart = new Date(`${targetSession.sessionDate}T${targetSession.startTime}Z`);

    await createBooking({
      sessionId: targetSession.id,
      name: 'Bob Test',
      email: 'bob@example.com',
      role: 'Designer',
      pf: 'PF002',
    });

    // Set "now" to 48 hours before the session (outside 24h window)
    const now = new Date(sessionStart.getTime() - 48 * 60 * 60 * 1000);

    const { service, calls } = createMockNotificationService();
    const result = await runReminderJob(service, now);

    // The target session should NOT be included since it's >24h away
    const reminderForTarget = calls.find(
      (c) => c.session.id === targetSession.id
    );
    expect(reminderForTarget).toBeUndefined();
  });

  it('sends reminders to all confirmed attendees for a selected session', async () => {
    const allSessions = getSessions();
    const targetSession = allSessions[0];
    const sessionStart = new Date(`${targetSession.sessionDate}T${targetSession.startTime}Z`);

    // Book 3 attendees (max capacity)
    await createBooking({
      sessionId: targetSession.id,
      name: 'Alice',
      email: 'alice@example.com',
      role: 'Engineer',
      pf: 'PF001',
    });
    await createBooking({
      sessionId: targetSession.id,
      name: 'Bob',
      email: 'bob@example.com',
      role: 'Designer',
      pf: 'PF002',
    });
    await createBooking({
      sessionId: targetSession.id,
      name: 'Charlie',
      email: 'charlie@example.com',
      role: 'Manager',
      pf: 'PF003',
    });

    // Set "now" to 6 hours before the session
    const now = new Date(sessionStart.getTime() - 6 * 60 * 60 * 1000);

    const { service, calls } = createMockNotificationService();
    await runReminderJob(service, now);

    // All 3 confirmed attendees for this session should get reminders
    const remindersForTarget = calls.filter(
      (c) => c.session.id === targetSession.id
    );
    const emails = remindersForTarget.map((c) => c.booking.email).sort();
    expect(emails).toContain('alice@example.com');
    expect(emails).toContain('bob@example.com');
    expect(emails).toContain('charlie@example.com');
    expect(remindersForTarget).toHaveLength(3);
  });

  it('does not send reminders for sessions already in the past', async () => {
    const allSessions = getSessions();
    const targetSession = allSessions[0];
    const sessionStart = new Date(`${targetSession.sessionDate}T${targetSession.startTime}Z`);

    await createBooking({
      sessionId: targetSession.id,
      name: 'Dave',
      email: 'dave@example.com',
      role: 'Analyst',
      pf: 'PF004',
    });

    // Set "now" to 1 hour AFTER the session starts (session is in the past)
    const now = new Date(sessionStart.getTime() + 1 * 60 * 60 * 1000);

    const { service, calls } = createMockNotificationService();
    await runReminderJob(service, now);

    const reminderForTarget = calls.find(
      (c) => c.session.id === targetSession.id
    );
    expect(reminderForTarget).toBeUndefined();
  });

  it('returns correct summary counts', async () => {
    const allSessions = getSessions();
    // Pick two sessions on the same day (they'll be close in time)
    const session1 = allSessions[0];
    const session2 = allSessions[1];

    await createBooking({
      sessionId: session1.id,
      name: 'Eve',
      email: 'eve@example.com',
      role: 'Engineer',
      pf: 'PF005',
    });
    await createBooking({
      sessionId: session2.id,
      name: 'Frank',
      email: 'frank@example.com',
      role: 'Designer',
      pf: 'PF006',
    });

    // Set "now" so both sessions are within 24h
    const session1Start = new Date(`${session1.sessionDate}T${session1.startTime}Z`);
    const now = new Date(session1Start.getTime() - 6 * 60 * 60 * 1000);

    const { service } = createMockNotificationService();
    const result = await runReminderJob(service, now);

    // At minimum, the 2 bookings we created should get reminders
    // (there may be more sessions in the 24h window but with 0 bookings)
    expect(result.remindersSent).toBeGreaterThanOrEqual(2);
    expect(result.sessionsProcessed).toBeGreaterThanOrEqual(2);
  });
});
