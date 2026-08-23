import { getDbClient, ensureDatabaseSchema } from './db.js';
import { getClientIp } from './rateLimiter.js';

/**
 * Record a structured event in the audit log
 */
export async function logAuditEvent(req, {
  eventType,
  actor = 'anonymous',
  resourceType = null,
  resourceId = null,
  success = true,
  metadata = null
}) {
  try {
    await ensureDatabaseSchema();
    const client = getDbClient();
    const ip = req ? getClientIp(req) : 'internal';
    const timestamp = new Date().toISOString();
    
    // Ensure metadata does not contain sensitive secrets
    let safeMetadataStr = null;
    if (metadata && typeof metadata === 'object') {
      const sanitizedMeta = { ...metadata };
      delete sanitizedMeta.password;
      delete sanitizedMeta.newPassword;
      delete sanitizedMeta.currentPassword;
      delete sanitizedMeta.token;
      delete sanitizedMeta.authToken;
      delete sanitizedMeta.sessionSecret;
      safeMetadataStr = JSON.stringify(sanitizedMeta);
    } else if (typeof metadata === 'string') {
      safeMetadataStr = metadata;
    }

    await client.execute({
      sql: `INSERT INTO audit_logs (timestamp, event_type, actor, resource_type, resource_id, ip, success, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      args: [
        timestamp,
        eventType,
        actor,
        resourceType,
        resourceId ? String(resourceId) : null,
        ip,
        success ? 1 : 0,
        safeMetadataStr
      ]
    });
  } catch (err) {
    // Non-blocking: audit log failure should not crash application, but log to server console
    console.error('Failed to write audit log entry:', err);
  }
}
