import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createBooking,
  cancelBooking,
  resetBookingStore,
  setNotificationService,
  getBookingsBySession,
  getWaitlistForSession,
  searchBookings,
  getStats,
  exportBookings,
  getAllBookings,
} from '../bookingService';
import { generateSessions } from '../sessionService';
import {
  createAdmin,
  login,
  validateSession,
  resetAuthStore,
  SESSION_TIMEOUT_MS,
} from '../authService';
import type { INotificationService } from '../notificationService';
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
  resetAuthStore();
});

// ─── Test 1: End-to-end booking flow ─────────────────────────────────────────
// Validates: Requirements 3.2, 5.1, 4.3, 10.1

describe('Integration: End-to-end booking flow', () => {
  it('create booking → confirm → fill session → waitlist → cancel → promote', async () => {
    const mockNS = createMockNotificationService();
    setNotificationService(mockNS);

    const session = sessions[0];

    // Step 1: Create a booking → verify confirmed status and reference code
    const result1 = await createBooking(
      makeRequest(session.id, { email: 'alice@test.com', name: 'Alice' })
    );
    expect(result1.status).toBe('confirmed');
    if (result1.status !== 'confirmed') throw new Error('Expected confirmed');
    expect(result1.booking.status).toBe('confirmed');
    expect(result1.booking.referenceCode).toMatch(/^CM-/);
    expect(result1.booking.email).toBe('alice@test.com');

    // Step 2: Create 2 more bookings to fill the session (capacity = 3)
    const result2 = await createBooking(
      makeRequest(session.id, { email: 'bob@test.com', name: 'Bob' })
    );
    expect(result2.status).toBe('confirmed');

    const result3 = await createBooking(
      makeRequest(session.id, { email: 'carol@test.com', name: 'Carol' })
    );
    expect(result3.status).toBe('confirmed');

    // Session should now be full
    expect(session.bookingCount).toBe(3);
    expect(session.slotStatus).toBe('Full');

    // Step 3: Create a 4th booking → verify waitlisted
    const result4 = await createBooking(
      makeRequest(session.id, { email: 'dave@test.com', name: 'Dave' })
    );
    expect(result4.status).toBe('waitlisted');
    if (result4.status !== 'waitlisted') throw new Error('Expected waitlisted');
    expect(result4.waitlistEntry.email).toBe('dave@test.com');
    expect(session.slotStatus).toBe('Waitlisted');

    // Verify waitlist has 1 entry
    const waitlistBefore = getWaitlistForSession(session.id);
    expect(waitlistBefore).toHaveLength(1);
    expect(waitlistBefore[0].email).toBe('dave@test.com');

    // Step 4: Cancel one confirmed booking → verify cancelled status
    if (result1.status !== 'confirmed') throw new Error('Expected confirmed');
    await cancelBooking(result1.booking.id, 'alice@test.com');

    const allBookings = getAllBookings();
    const cancelledBooking = allBookings.find((b) => b.id === result1.booking.id);
    expect(cancelledBooking?.status).toBe('cancelled');
    expect(cancelledBooking?.cancelledAt).toBeInstanceOf(Date);

    // Step 5: Verify the waitlisted attendee was promoted to confirmed
    const confirmedAfter = getBookingsBySession(session.id);
    const promotedEmails = confirmedAfter.map((b) => b.email);
    expect(promotedEmails).toContain('dave@test.com');
    expect(session.bookingCount).toBe(3); // decremented then incremented via promotion

    // Waitlist should now be empty
    const waitlistAfter = getWaitlistForSession(session.id);
    expect(waitlistAfter).toHaveLength(0);

    // Step 6: Verify notification service was called for confirmation, cancellation, and promotion
    await vi.waitFor(() => {
      // 3 confirmed bookings → 3 sendConfirmation calls
      expect(mockNS.sendConfirmation).toHaveBeenCalledTimes(3);
      // 1 cancellation
      expect(mockNS.sendCancellation).toHaveBeenCalledTimes(1);
      // 1 waitlist promotion
      expect(mockNS.sendWaitlistPromotion).toHaveBeenCalledTimes(1);
    });

    // Verify promotion notification was sent to the correct attendee
    const [promotedBooking] = mockNS.sendWaitlistPromotion.mock.calls[0];
    expect(promotedBooking.email).toBe('dave@test.com');

    // Verify cancellation notification was sent to the correct attendee
    const [cancelledB] = mockNS.sendCancellation.mock.calls[0];
    expect(cancelledB.email).toBe('alice@test.com');
  });
});

// ─── Test 2: Admin flow ──────────────────────────────────────────────────────
// Validates: Requirements 10.1, 9.1, 8.4, 8.6

describe('Integration: Admin login → dashboard → search → export', () => {
  it('admin login → stats → search → export → session validation', async () => {
    // Step 1: Create an admin user
    const admin = await createAdmin('admin1', 'securePass123');
    expect(admin.username).toBe('admin1');

    // Step 2: Login → verify token returned
    const session = await login('admin1', 'securePass123');
    expect(session).not.toBeNull();
    expect(session!.id).toBeDefined();
    expect(session!.adminId).toBe(admin.id);

    // Step 3: Create some bookings across different sessions
    const s1 = sessions[0];
    const s2 = sessions.find((s) => s.sessionDate !== s1.sessionDate)!;

    await createBooking(makeRequest(s1.id, { email: 'user1@test.com', name: 'User One', pf: 'PF100' }));
    await createBooking(makeRequest(s1.id, { email: 'user2@test.com', name: 'User Two', pf: 'PF200' }));
    await createBooking(makeRequest(s1.id, { email: 'user3@test.com', name: 'User Three', pf: 'PF300' }));
    await createBooking(makeRequest(s2.id, { email: 'user4@test.com', name: 'User Four', pf: 'PF400' }));

    // Add a waitlisted booking
    await createBooking(makeRequest(s1.id, { email: 'wait1@test.com', name: 'Waiter One' }));

    // Step 4: Call getStats() → verify correct counts
    const stats = getStats();
    expect(stats.totalBookings).toBe(4); // 4 confirmed
    expect(stats.fullSessions).toBe(1); // s1 has 3 bookings
    expect(stats.waitlistCount).toBe(1); // 1 waitlisted

    // Step 5: Call searchBookings() → verify results match
    const searchByName = searchBookings('User One');
    expect(searchByName).toHaveLength(1);
    expect(searchByName[0].name).toBe('User One');

    const searchByEmail = searchBookings('user2@test.com');
    expect(searchByEmail).toHaveLength(1);
    expect(searchByEmail[0].email).toBe('user2@test.com');

    const searchByPf = searchBookings('PF300');
    expect(searchByPf).toHaveLength(1);
    expect(searchByPf[0].pf).toBe('PF300');

    const searchNoMatch = searchBookings('nonexistent-query');
    expect(searchNoMatch).toHaveLength(0);

    // Step 6: Call exportBookings() → verify CSV contains expected data
    const csv = exportBookings();
    const lines = csv.split('\n');

    // Header + 4 confirmed bookings + 1 waitlisted (waitlisted is in waitlist store, not bookings)
    // exportBookings exports from the bookings array, which includes confirmed bookings
    expect(lines[0]).toBe('Booking ID,Session Date,Session Time,Name,Email,Role,PF,Booking Timestamp,Status');
    // Should have at least 4 data rows (the 4 confirmed bookings)
    expect(lines.length).toBeGreaterThanOrEqual(5); // header + 4 rows

    // Verify CSV contains our booking data
    expect(csv).toContain('user1@test.com');
    expect(csv).toContain('user2@test.com');
    expect(csv).toContain('user3@test.com');
    expect(csv).toContain('user4@test.com');
    expect(csv).toContain('User One');
    expect(csv).toContain('PF100');

    // Step 7: Verify session validation works (valid token accepted, expired rejected)
    // Valid session should be accepted
    const validSession = validateSession(session!.id);
    expect(validSession).not.toBeNull();
    expect(validSession!.id).toBe(session!.id);

    // Expired session should be rejected
    session!.lastActiveAt = new Date(Date.now() - SESSION_TIMEOUT_MS - 1000);
    const expiredSession = validateSession(session!.id);
    expect(expiredSession).toBeNull();
  });
});
