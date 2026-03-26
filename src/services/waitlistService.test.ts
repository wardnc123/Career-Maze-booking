import { describe, it, expect, beforeEach } from 'vitest';
import {
  addToWaitlist,
  promoteNext,
  getWaitlist,
  removeFromWaitlist,
  resetWaitlistStore,
} from '@/services/waitlistService';
import { generateSessions } from '@/services/sessionService';
import type { BookingRequest, Session } from '@/models/types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

let sessions: Session[] = [];

function makeRequest(overrides: Partial<BookingRequest> = {}): BookingRequest {
  return {
    sessionId: sessions[0].id,
    name: 'Test User',
    email: 'test@example.com',
    role: 'Engineer',
    pf: 'PF-001',
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('WaitlistService', () => {
  beforeEach(() => {
    resetWaitlistStore();
    sessions = generateSessions();
  });

  describe('addToWaitlist', () => {
    it('should add an entry and return a WaitlistEntry with correct fields', async () => {
      const req = makeRequest();
      const entry = await addToWaitlist(req.sessionId, req);

      expect(entry.id).toBeDefined();
      expect(entry.sessionId).toBe(req.sessionId);
      expect(entry.name).toBe(req.name);
      expect(entry.email).toBe(req.email);
      expect(entry.role).toBe(req.role);
      expect(entry.pf).toBe(req.pf);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('should allow multiple entries for the same session', async () => {
      const sid = sessions[0].id;
      await addToWaitlist(sid, makeRequest({ email: 'a@test.com' }));
      await addToWaitlist(sid, makeRequest({ email: 'b@test.com' }));
      await addToWaitlist(sid, makeRequest({ email: 'c@test.com' }));

      const list = await getWaitlist(sid);
      expect(list).toHaveLength(3);
    });
  });

  describe('getWaitlist', () => {
    it('should return entries in FIFO order by createdAt', async () => {
      const sid = sessions[0].id;

      // Add entries with controlled timestamps
      const e1 = await addToWaitlist(sid, makeRequest({ name: 'First' }));
      // Small delay to ensure distinct timestamps
      const e2 = await addToWaitlist(sid, makeRequest({ name: 'Second' }));
      const e3 = await addToWaitlist(sid, makeRequest({ name: 'Third' }));

      const list = await getWaitlist(sid);
      expect(list[0].id).toBe(e1.id);
      expect(list[1].id).toBe(e2.id);
      expect(list[2].id).toBe(e3.id);

      // Verify ascending order
      for (let i = 1; i < list.length; i++) {
        expect(list[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          list[i - 1].createdAt.getTime()
        );
      }
    });

    it('should return empty array for a session with no waitlist', async () => {
      const list = await getWaitlist(sessions[5].id);
      expect(list).toEqual([]);
    });

    it('should only return entries for the requested session', async () => {
      const sid1 = sessions[0].id;
      const sid2 = sessions[1].id;

      await addToWaitlist(sid1, makeRequest({ name: 'Session1' }));
      await addToWaitlist(sid2, makeRequest({ name: 'Session2' }));

      const list1 = await getWaitlist(sid1);
      const list2 = await getWaitlist(sid2);

      expect(list1).toHaveLength(1);
      expect(list1[0].name).toBe('Session1');
      expect(list2).toHaveLength(1);
      expect(list2[0].name).toBe('Session2');
    });
  });

  describe('promoteNext', () => {
    it('should promote the earliest entry and return a confirmed Booking', async () => {
      const sid = sessions[0].id;
      const e1 = await addToWaitlist(sid, makeRequest({ name: 'First', email: 'first@test.com' }));
      await addToWaitlist(sid, makeRequest({ name: 'Second', email: 'second@test.com' }));

      const booking = await promoteNext(sid);

      expect(booking).not.toBeNull();
      expect(booking!.name).toBe('First');
      expect(booking!.email).toBe('first@test.com');
      expect(booking!.status).toBe('confirmed');
      expect(booking!.referenceCode).toBeDefined();
      expect(booking!.sessionId).toBe(sid);
      expect(booking!.cancelledAt).toBeNull();
    });

    it('should remove the promoted entry from the waitlist', async () => {
      const sid = sessions[0].id;
      await addToWaitlist(sid, makeRequest({ name: 'First' }));
      await addToWaitlist(sid, makeRequest({ name: 'Second' }));

      await promoteNext(sid);

      const remaining = await getWaitlist(sid);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].name).toBe('Second');
    });

    it('should return null when waitlist is empty', async () => {
      const result = await promoteNext(sessions[0].id);
      expect(result).toBeNull();
    });

    it('should promote entries in FIFO order across multiple promotions', async () => {
      const sid = sessions[0].id;
      await addToWaitlist(sid, makeRequest({ name: 'A' }));
      await addToWaitlist(sid, makeRequest({ name: 'B' }));
      await addToWaitlist(sid, makeRequest({ name: 'C' }));

      const b1 = await promoteNext(sid);
      const b2 = await promoteNext(sid);
      const b3 = await promoteNext(sid);
      const b4 = await promoteNext(sid);

      expect(b1!.name).toBe('A');
      expect(b2!.name).toBe('B');
      expect(b3!.name).toBe('C');
      expect(b4).toBeNull();
    });
  });

  describe('removeFromWaitlist', () => {
    it('should remove the specified entry', async () => {
      const sid = sessions[0].id;
      const e1 = await addToWaitlist(sid, makeRequest({ name: 'Keep' }));
      const e2 = await addToWaitlist(sid, makeRequest({ name: 'Remove' }));

      await removeFromWaitlist(e2.id);

      const list = await getWaitlist(sid);
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe(e1.id);
    });

    it('should throw when entry does not exist', async () => {
      await expect(removeFromWaitlist('nonexistent-id')).rejects.toThrow(
        'Waitlist entry not found'
      );
    });
  });
});
