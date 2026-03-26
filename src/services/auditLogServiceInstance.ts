// Shared singleton AuditLogService instance for use across the application.

import { AuditLogService, InMemoryAuditLogStore } from '@/services/auditLogService';

const store = new InMemoryAuditLogStore();
export const auditLogServiceInstance = new AuditLogService(store);
