import { AuditLog } from '../models/AuditLog.js';
import { stripSensitive } from '../utils/sanitize.js';

export async function writeAudit(entry, session) {
  const [created] = await AuditLog.create([{
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    performedBy: entry.performedBy,
    previousValue: stripSensitive(entry.previousValue ?? null),
    newValue: stripSensitive(entry.newValue ?? null),
    metadata: stripSensitive(entry.metadata ?? null),
  }], { session });
  return created;
}
