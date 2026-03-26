import { describe, it, expect, beforeEach } from 'vitest';
import {
  AuditLogService,
  InMemoryAuditLogStore,
} from '@/services/auditLogService';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('AuditLogService', () => {
  let store: InMemoryAuditLogStore;
  let service: AuditLogService;

  beforeEach(() => {
    store = new InMemoryAuditLogStore();
    service = new AuditLogService(store);
  });

  describe('log', () => {
    it('logs a booking_created event with correct fields', () => {
      const entry = service.log({
        eventType: 'booking_created',
        entityType: 'booking',
        entityId: 'booking-1',
        details: { sessionId: 'session-1', referenceCode: 'CM-0001ABCD' },
        performedBy: 'alice@example.com',
      });

      expect(entry.id).toBeDefined();
      expect(entry.eventType).toBe('booking_created');
      expect(entry.entityType).toBe('booking');
      expect(entry.entityId).toBe('booking-1');
      expect(entry.details).toEqual({ sessionId: 'session-1', referenceCode: 'CM-0001ABCD' });
      expect(entry.performedBy).toBe('alice@example.com');
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    it('logs a booking_cancelled event', () => {
      const entry = service.log({
        eventType: 'booking_cancelled',
        entityType: 'booking',
        entityId: 'booking-2',
        details: { reason: 'user_requested' },
        performedBy: 'bob@example.com',
      });

      expect(entry.eventType).toBe('booking_cancelled');
      expect(entry.entityType).toBe('booking');
      expect(entry.entityId).toBe('booking-2');
      expect(entry.details).toEqual({ reason: 'user_requested' });
      expect(entry.performedBy).toBe('bob@example.com');
    });

    it('logs a data_accessed event', () => {
      const entry = service.log({
        eventType: 'data_accessed',
        entityType: 'booking',
        entityId: 'booking-3',
        details: { action: 'export', format: 'csv' },
        performedBy: 'admin-user',
      });

      expect(entry.eventType).toBe('data_accessed');
      expect(entry.entityType).toBe('booking');
      expect(entry.entityId).toBe('booking-3');
      expect(entry.details).toEqual({ action: 'export', format: 'csv' });
      expect(entry.performedBy).toBe('admin-user');
    });

    it('defaults details to null when not provided', () => {
      const entry = service.log({
        eventType: 'booking_created',
        entityType: 'booking',
        entityId: 'booking-4',
        performedBy: 'carol@example.com',
      });

      expect(entry.details).toBeNull();
    });

    it('generates unique IDs for each entry', () => {
      const entry1 = service.log({
        eventType: 'booking_created',
        entityType: 'booking',
        entityId: 'booking-1',
        performedBy: 'alice@example.com',
      });
      const entry2 = service.log({
        eventType: 'booking_created',
        entityType: 'booking',
        entityId: 'booking-2',
        performedBy: 'bob@example.com',
      });

      expect(entry1.id).not.toBe(entry2.id);
    });
  });

  describe('getAll', () => {
    it('returns all logged entries', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      service.log({ eventType: 'booking_cancelled', entityType: 'booking', entityId: 'b-2', performedBy: 'b@x.com' });
      service.log({ eventType: 'data_accessed', entityType: 'session', entityId: 's-1', performedBy: 'admin' });

      const all = service.getAll();
      expect(all).toHaveLength(3);
    });

    it('returns empty array when no entries exist', () => {
      expect(service.getAll()).toHaveLength(0);
    });
  });

  describe('getByEntityId', () => {
    it('returns entries matching the entity ID', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      service.log({ eventType: 'booking_cancelled', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-2', performedBy: 'b@x.com' });

      const results = service.getByEntityId('b-1');
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.entityId === 'b-1')).toBe(true);
    });

    it('returns empty array for unknown entity ID', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      expect(service.getByEntityId('unknown')).toHaveLength(0);
    });
  });

  describe('getByEventType', () => {
    it('returns entries matching the event type', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      service.log({ eventType: 'booking_cancelled', entityType: 'booking', entityId: 'b-2', performedBy: 'b@x.com' });
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-3', performedBy: 'c@x.com' });

      const results = service.getByEventType('booking_created');
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.eventType === 'booking_created')).toBe(true);
    });

    it('returns empty array for unknown event type', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      expect(service.getByEventType('unknown_event')).toHaveLength(0);
    });
  });

  describe('reset', () => {
    it('clears all entries', () => {
      service.log({ eventType: 'booking_created', entityType: 'booking', entityId: 'b-1', performedBy: 'a@x.com' });
      service.log({ eventType: 'booking_cancelled', entityType: 'booking', entityId: 'b-2', performedBy: 'b@x.com' });

      service.reset();
      expect(service.getAll()).toHaveLength(0);
    });
  });
});
