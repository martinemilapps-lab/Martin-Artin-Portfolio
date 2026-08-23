import { requireAdmin } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  try {
    await ensureDatabaseSchema();
    const client = getDbClient();

    const result = await client.execute(`
      SELECT id, timestamp, event_type, actor, resource_type, resource_id, ip, success, metadata
      FROM audit_logs
      ORDER BY id DESC
      LIMIT 100;
    `);

    const logs = result.rows.map(row => ({
      id: Number(row.id),
      timestamp: String(row.timestamp),
      eventType: String(row.event_type),
      actor: String(row.actor || 'anonymous'),
      resourceType: row.resource_type ? String(row.resource_type) : null,
      resourceId: row.resource_id ? String(row.resource_id) : null,
      ip: String(row.ip || 'unknown'),
      success: Boolean(row.success),
      metadata: row.metadata ? (typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata) : null
    }));

    return res.status(200).json({
      success: true,
      logs
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit logs.' });
  }
}
