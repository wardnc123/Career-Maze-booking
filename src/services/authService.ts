// Career Maze Session Booking & Tracking System — AuthService
// Admin authentication with bcrypt password hashing and session management.

import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import type { Admin, AdminSession } from '@/models/types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Session inactivity timeout in milliseconds (30 minutes) */
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const BCRYPT_SALT_ROUNDS = 10;

// ─── In-memory stores ────────────────────────────────────────────────────────

let admins: Admin[] = [];
let adminSessions: AdminSession[] = [];

// ─── AuthService ─────────────────────────────────────────────────────────────

/**
 * Create an admin user with a bcrypt-hashed password.
 */
export async function createAdmin(username: string, password: string): Promise<Admin> {
  const existing = admins.find((a) => a.username === username);
  if (existing) {
    throw new Error('Admin with this username already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const admin: Admin = {
    id: uuidv4(),
    username,
    passwordHash,
    createdAt: new Date(),
  };

  admins.push(admin);
  return admin;
}

/**
 * Authenticate an admin and create a session.
 * Returns the session on success, null on invalid credentials.
 *
 * Requirements: 10.1, 10.2, 10.3
 */
export async function login(username: string, password: string): Promise<AdminSession | null> {
  const admin = admins.find((a) => a.username === username);
  if (!admin) {
    return null;
  }

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) {
    return null;
  }

  const now = new Date();
  const session: AdminSession = {
    id: uuidv4(),
    adminId: admin.id,
    createdAt: now,
    lastActiveAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TIMEOUT_MS),
  };

  adminSessions.push(session);
  return session;
}

/**
 * Destroy an admin session (logout).
 */
export function logout(sessionId: string): boolean {
  const index = adminSessions.findIndex((s) => s.id === sessionId);
  if (index === -1) {
    return false;
  }
  adminSessions.splice(index, 1);
  return true;
}

/**
 * Validate that a session exists and has not expired due to inactivity.
 * A session is expired if now > lastActiveAt + 30 minutes.
 *
 * Requirements: 10.4
 */
export function validateSession(sessionId: string): AdminSession | null {
  const session = adminSessions.find((s) => s.id === sessionId);
  if (!session) {
    return null;
  }

  const now = new Date();
  if (now.getTime() > session.lastActiveAt.getTime() + SESSION_TIMEOUT_MS) {
    // Session expired — remove it
    adminSessions = adminSessions.filter((s) => s.id !== sessionId);
    return null;
  }

  return session;
}

/**
 * Refresh a session's lastActiveAt and expiresAt to extend it.
 */
export function refreshSession(sessionId: string): AdminSession | null {
  const session = validateSession(sessionId);
  if (!session) {
    return null;
  }

  const now = new Date();
  session.lastActiveAt = now;
  session.expiresAt = new Date(now.getTime() + SESSION_TIMEOUT_MS);
  return session;
}

// ─── Admin lookup ────────────────────────────────────────────────────────────

/**
 * Get the admin username associated with a valid session token.
 * Returns the username string, or 'unknown' if the session/admin is not found.
 */
export function getAdminUsername(sessionId: string): string {
  const session = adminSessions.find((s) => s.id === sessionId);
  if (!session) return 'unknown';
  const admin = admins.find((a) => a.id === session.adminId);
  return admin?.username ?? 'unknown';
}

// ─── Store management (for testing) ─────────────────────────────────────────

/**
 * Reset all in-memory auth stores. Used in tests to ensure isolation.
 */
export function resetAuthStore(): void {
  admins = [];
  adminSessions = [];
}

// ─── Exported constants for testing ──────────────────────────────────────────

export { SESSION_TIMEOUT_MS };
