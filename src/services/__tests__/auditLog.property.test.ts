// Property test: Audit logging for data operations
// Feature: career-maze-booking, Property 19: Audit logging for data operations
// Validates: Requirements 11.4

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import {
  InMemoryAuditLogStore,
  AuditLogService,
} from '@/services/auditLogService';

describe('Feature: career-maze-booking, Property 19: Audit logging for data operations', () => {
  let store: InMemoryAuditLogStore;
  let service: AuditLogService;

  beforeEach(() => {
    store = new InMemoryAuditLogStore();
    service = new AuditLogService(store);
  });

  it('should create an audit log entry with correct event type, entity reference, and performer for each operation', () => {
    /**
     * **Validates: Requirements 11.4**
     *
     * For any booking creation, cancellation, or data access operation,
     * the system must create an audit log entry with the correct event type,
     * entity reference, and performer identity.
     */
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('booking_created'),
          fc.constant('booking_cancelled'),
          fc.constant('data_accessed'),
        ),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (eventType, entityType, entityId, performer, detailValue) => {
          service.reset();

          const entry = service.log({
            eventType,
            entityType,
            entityId,
            details: { info: detailValue },
            performedBy: performer,
          });

          // Verify the returned entry matches input
          expect(entry.eventType).toBe(eventType);
          expect(entry.entityType).toBe(entityType);
          expect(entry.entityId).toBe(entityId);
          expect(entry.performedBy).toBe(performer);
          expect(entry.details).toEqual({ info: detailValue });
          expect(entry.id).toBeDefined();
          expect(entry.createdAt).toBeInstanceOf(Date);

          // Verify the entry is persisted in the store
          const allEntries = service.getAll();
          expect(allEntries.length).toBe(1);

          const stored = allEntries[0];
          expect(stored.eventType).toBe(eventType);
          expect(stored.entityType).toBe(entityType);
          expect(stored.entityId).toBe(entityId);
          expect(stored.performedBy).toBe(performer);

          // Verify retrieval by entity ID
          const byEntity = service.getByEntityId(entityId);
          expect(byEntity.length).toBe(1);
          expect(byEntity[0].id).toBe(entry.id);

          // Verify retrieval by event type
          const byType = service.getByEventType(eventType);
          expect(byType.length).toBe(1);
          expect(byType[0].id).toBe(entry.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});
