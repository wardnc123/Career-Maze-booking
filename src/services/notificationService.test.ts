import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationService,
  EmailTransport,
  EmailMessage,
} from '@/services/notificationService';
import type { Booking, Session, DailyStats } from '@/models/types';

// ─── Test Fixtures ───────────────────────────────────────────────────────────

function makeSession(overrides?: Partial<Session>): Session {
  return {
    id: 'session-1',
    sessionDate: '2026-08-05',
    startTime: '09:00:00',
    bookingCount: 1,
    slotStatus: 'Limited',
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeBooking(overrides?: Partial<Booking>): Booking {
  return {
    id: 'booking-1',
    sessionId: 'session-1',
    name: 'Alice Smith',
    email: 'alice@example.com',
    role: 'Engineer',
    pf: 'PF-100',
    status: 'confirmed',
    referenceCode: 'CM-ABC123',
    createdAt: new Date('2026-08-01'),
    cancelledAt: null,
    ...overrides,
  };
}

function makeStats(overrides?: Partial<DailyStats>): DailyStats {
  return {
    date: '2026-08-05',
    totalBookings: 42,
    fullSessions: 10,
    emptySessions: 3,
    waitlistCount: 5,
    ...overrides,
  };
}

// ─── Mock Transport ──────────────────────────────────────────────────────────

function createMockTransport() {
  const sent: EmailMessage[] = [];
  const transport: EmailTransport = {
    sendMail: vi.fn(async (msg: EmailMessage) => {
      sent.push(msg);
    }),
  };
  return { transport, sent };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationService', () => {
  let mockTransport: ReturnType<typeof createMockTransport>;
  let service: NotificationService;

  beforeEach(() => {
    mockTransport = createMockTransport();
    service = new NotificationService(mockTransport.transport);
  });

  describe('sendConfirmation', () => {
    it('sends a confirmation email with .ics attachment', async () => {
      const booking = makeBooking();
      const session = makeSession();

      await service.sendConfirmation(booking, session);

      expect(mockTransport.sent).toHaveLength(1);
      const msg = mockTransport.sent[0];
      expect(msg.to).toBe('alice@example.com');
      expect(msg.subject).toContain('Booking Confirmed');
      expect(msg.subject).toContain('2026-08-05');
      expect(msg.html).toContain('Alice Smith');
      expect(msg.html).toContain('CM-ABC123');
      expect(msg.html).toContain('09:00:00');
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments![0].filename).toBe('career-maze-session.ics');
      expect(msg.attachments![0].contentType).toBe('text/calendar');
      expect(msg.attachments![0].content).toContain('VEVENT');
    });
  });

  describe('sendCancellation', () => {
    it('sends a cancellation email without attachment', async () => {
      const booking = makeBooking();
      const session = makeSession();

      await service.sendCancellation(booking, session);

      expect(mockTransport.sent).toHaveLength(1);
      const msg = mockTransport.sent[0];
      expect(msg.to).toBe('alice@example.com');
      expect(msg.subject).toContain('Booking Cancelled');
      expect(msg.html).toContain('Alice Smith');
      expect(msg.html).toContain('CM-ABC123');
      expect(msg.attachments).toBeUndefined();
    });
  });

  describe('sendWaitlistPromotion', () => {
    it('sends a promotion email with .ics attachment', async () => {
      const booking = makeBooking();
      const session = makeSession();

      await service.sendWaitlistPromotion(booking, session);

      expect(mockTransport.sent).toHaveLength(1);
      const msg = mockTransport.sent[0];
      expect(msg.to).toBe('alice@example.com');
      expect(msg.subject).toContain("You're In!");
      expect(msg.html).toContain('Waitlist Promotion');
      expect(msg.html).toContain('Alice Smith');
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments![0].content).toContain('VEVENT');
    });
  });

  describe('sendReminder', () => {
    it('sends a reminder email without attachment', async () => {
      const booking = makeBooking();
      const session = makeSession();

      await service.sendReminder(booking, session);

      expect(mockTransport.sent).toHaveLength(1);
      const msg = mockTransport.sent[0];
      expect(msg.to).toBe('alice@example.com');
      expect(msg.subject).toContain('Reminder');
      expect(msg.html).toContain('Session Reminder');
      expect(msg.html).toContain('2026-08-05');
      expect(msg.attachments).toBeUndefined();
    });
  });

  describe('sendDailyDigest', () => {
    it('sends digest to all admin emails', async () => {
      const adminEmails = ['admin1@example.com', 'admin2@example.com'];
      const svc = new NotificationService(mockTransport.transport, adminEmails);
      const stats = makeStats();

      await svc.sendDailyDigest(stats);

      expect(mockTransport.sent).toHaveLength(2);
      expect(mockTransport.sent[0].to).toBe('admin1@example.com');
      expect(mockTransport.sent[1].to).toBe('admin2@example.com');
      expect(mockTransport.sent[0].subject).toContain('Daily Digest');
      expect(mockTransport.sent[0].html).toContain('42'); // totalBookings
      expect(mockTransport.sent[0].html).toContain('10'); // fullSessions
      expect(mockTransport.sent[0].html).toContain('3');  // emptySessions
      expect(mockTransport.sent[0].html).toContain('5');  // waitlistCount
    });

    it('sends nothing when no admin emails configured', async () => {
      const svc = new NotificationService(mockTransport.transport, []);
      await svc.sendDailyDigest(makeStats());
      expect(mockTransport.sent).toHaveLength(0);
    });
  });

  describe('retry logic', () => {
    it('retries up to 3 times on failure then succeeds', async () => {
      let callCount = 0;
      const transport: EmailTransport = {
        sendMail: vi.fn(async () => {
          callCount++;
          if (callCount < 3) throw new Error('SMTP timeout');
        }),
      };
      const svc = new NotificationService(transport);

      await svc.sendConfirmation(makeBooking(), makeSession());

      expect(transport.sendMail).toHaveBeenCalledTimes(3);
    });

    it('throws after exhausting all retries', async () => {
      const transport: EmailTransport = {
        sendMail: vi.fn(async () => {
          throw new Error('SMTP down');
        }),
      };
      const svc = new NotificationService(transport);

      await expect(
        svc.sendConfirmation(makeBooking(), makeSession())
      ).rejects.toThrow('SMTP down');

      // 1 initial + 3 retries = 4 calls
      expect(transport.sendMail).toHaveBeenCalledTimes(4);
    });

    it('succeeds on first attempt without retries', async () => {
      await service.sendCancellation(makeBooking(), makeSession());
      expect(mockTransport.transport.sendMail).toHaveBeenCalledTimes(1);
    });
  });

  describe('ICS generation failure handling', () => {
    it('sends confirmation without attachment if ICS generation fails', async () => {
      // Use a session with invalid data that will cause ICS generation to fail
      const booking = makeBooking();
      const session = makeSession({ startTime: 'invalid-time' });

      await service.sendConfirmation(booking, session);

      expect(mockTransport.sent).toHaveLength(1);
      const msg = mockTransport.sent[0];
      expect(msg.to).toBe('alice@example.com');
      expect(msg.subject).toContain('Booking Confirmed');
      // No attachment due to ICS failure
      expect(msg.attachments).toBeUndefined();
    });
  });
});
