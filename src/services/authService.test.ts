import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAdmin,
  login,
  logout,
  validateSession,
  refreshSession,
  resetAuthStore,
  SESSION_TIMEOUT_MS,
} from './authService';

beforeEach(() => {
  resetAuthStore();
});

describe('AuthService', () => {
  // ─── createAdmin ─────────────────────────────────────────────────

  describe('createAdmin()', () => {
    it('creates an admin with a hashed password', async () => {
      const admin = await createAdmin('admin1', 'secret123');
      expect(admin.username).toBe('admin1');
      expect(admin.passwordHash).not.toBe('secret123');
      expect(admin.id).toBeDefined();
    });

    it('throws if username already exists', async () => {
      await createAdmin('admin1', 'secret123');
      await expect(createAdmin('admin1', 'other')).rejects.toThrow(
        'Admin with this username already exists'
      );
    });
  });

  // ─── login ───────────────────────────────────────────────────────

  describe('login()', () => {
    it('returns a session for valid credentials', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');
      expect(session).not.toBeNull();
      expect(session!.id).toBeDefined();
      expect(session!.adminId).toBeDefined();
      expect(session!.lastActiveAt).toBeInstanceOf(Date);
      expect(session!.expiresAt).toBeInstanceOf(Date);
    });

    it('returns null for wrong password', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'wrongpassword');
      expect(session).toBeNull();
    });

    it('returns null for non-existent username', async () => {
      const session = await login('nobody', 'secret123');
      expect(session).toBeNull();
    });

    it('sets expiresAt to 30 minutes after creation', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');
      expect(session).not.toBeNull();
      const diff = session!.expiresAt.getTime() - session!.createdAt.getTime();
      expect(diff).toBe(SESSION_TIMEOUT_MS);
    });
  });

  // ─── logout ──────────────────────────────────────────────────────

  describe('logout()', () => {
    it('destroys an existing session', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');
      expect(logout(session!.id)).toBe(true);
      expect(validateSession(session!.id)).toBeNull();
    });

    it('returns false for non-existent session', () => {
      expect(logout('nonexistent-id')).toBe(false);
    });
  });

  // ─── validateSession ─────────────────────────────────────────────

  describe('validateSession()', () => {
    it('returns session for a valid, active session', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');
      const validated = validateSession(session!.id);
      expect(validated).not.toBeNull();
      expect(validated!.id).toBe(session!.id);
    });

    it('returns null for non-existent session', () => {
      expect(validateSession('nonexistent')).toBeNull();
    });

    it('returns null and removes expired session (30-min inactivity)', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');

      // Simulate expiry by backdating lastActiveAt
      session!.lastActiveAt = new Date(Date.now() - SESSION_TIMEOUT_MS - 1000);

      const validated = validateSession(session!.id);
      expect(validated).toBeNull();
    });
  });

  // ─── refreshSession ──────────────────────────────────────────────

  describe('refreshSession()', () => {
    it('updates lastActiveAt and expiresAt', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');
      const originalLastActive = session!.lastActiveAt.getTime();

      // Small delay to ensure time difference
      await new Promise((r) => setTimeout(r, 10));

      const refreshed = refreshSession(session!.id);
      expect(refreshed).not.toBeNull();
      expect(refreshed!.lastActiveAt.getTime()).toBeGreaterThanOrEqual(originalLastActive);
    });

    it('returns null for expired session', async () => {
      await createAdmin('admin1', 'secret123');
      const session = await login('admin1', 'secret123');

      // Simulate expiry
      session!.lastActiveAt = new Date(Date.now() - SESSION_TIMEOUT_MS - 1000);

      expect(refreshSession(session!.id)).toBeNull();
    });

    it('returns null for non-existent session', () => {
      expect(refreshSession('nonexistent')).toBeNull();
    });
  });
});
