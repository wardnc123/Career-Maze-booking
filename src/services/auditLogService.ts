// Career Maze Session Booking & Tracking System — AuditLogService
// Logs booking creation, cancellation, and data access events for audit purposes.

import { v4 as uuidv4 } from 'uuid';
import type { AuditLog } from '@/models/types';

// ─── AuditLogService Interface ───────────────────────────────────────────────

export interface IAuditLogService {
  log(entry: AuditLogInput): AuditLog;
  getAll(): AuditLog[];
  getByEntityId(entityId: string): AuditLog[];
  getByEventType(eventType: string): AuditLog[];
  reset(): void;
}

export interface AuditLogInput {
  eventType: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  performedBy: string;
}

// ─── AuditLogStore Interface ─────────────────────────────────────────────────

export interface AuditLogStore {
  insert(entry: AuditLog): void;
  findAll(): AuditLog[];
  findByEntityId(entityId: string): AuditLog[];
  findByEventType(eventType: string): AuditLog[];
  clear(): void;
}

// ─── In-Memory Store ─────────────────────────────────────────────────────────

export class InMemoryAuditLogStore implements AuditLogStore {
  private entries: AuditLog[] = [];

  insert(entry: AuditLog): void {
    this.entries.push(entry);
  }

  findAll(): AuditLog[] {
    return [...this.entries];
  }

  findByEntityId(entityId: string): AuditLog[] {
    return this.entries.filter((e) => e.entityId === entityId);
  }

  findByEventType(eventType: string): AuditLog[] {
    return this.entries.filter((e) => e.eventType === eventType);
  }

  clear(): void {
    this.entries = [];
  }
}

// ─── AuditLogService Implementation ─────────────────────────────────────────

export class AuditLogService implements IAuditLogService {
  private store: AuditLogStore;

  constructor(store: AuditLogStore) {
    this.store = store;
  }

  /**
   * Log an audit event.
   * Requirements: 11.4
   */
  log(input: AuditLogInput): AuditLog {
    const entry: AuditLog = {
      id: uuidv4(),
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details ?? null,
      performedBy: input.performedBy,
      createdAt: new Date(),
    };

    this.store.insert(entry);
    return entry;
  }

  /**
   * Get all audit log entries.
   */
  getAll(): AuditLog[] {
    return this.store.findAll();
  }

  /**
   * Get audit log entries for a specific entity.
   */
  getByEntityId(entityId: string): AuditLog[] {
    return this.store.findByEntityId(entityId);
  }

  /**
   * Get audit log entries by event type.
   */
  getByEventType(eventType: string): AuditLog[] {
    return this.store.findByEventType(eventType);
  }

  /**
   * Clear all audit log entries. Used in tests.
   */
  reset(): void {
    this.store.clear();
  }
}
