import { requireAdmin } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';
import { logAuditEvent } from '../_lib/audit.js';
import { parseBody } from '../_lib/validation.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  const { campaignIds, campaigns } = await parseBody(req);
  let ids = [];

  if (Array.isArray(campaignIds)) {
    ids = campaignIds.map(Number).filter(id => !isNaN(id) && id > 0);
  } else if (Array.isArray(campaigns)) {
    ids = campaigns.map(c => Number(c.id)).filter(id => !isNaN(id) && id > 0);
  }

  if (ids.length === 0) {
    return res.status(400).json({ error: 'A non-empty list of campaign IDs is required for reordering.' });
  }

  try {
    await ensureDatabaseSchema();
    const client = getDbClient();

    // Prepare batch update statements
    const now = new Date().toISOString();
    const statements = ids.map((id, index) => ({
      sql: 'UPDATE campaigns SET display_order = ?, updated_at = ? WHERE id = ?;',
      args: [index, now, id]
    }));

    // Execute atomic batch
    await client.batch(statements, 'write');

    await logAuditEvent(req, {
      eventType: 'CAMPAIGNS_REORDER',
      actor: admin.userId,
      success: true,
      metadata: { count: ids.length, newOrder: ids }
    });

    return res.status(200).json({
      success: true,
      message: 'Campaign display order updated atomically.',
      reorderedCount: ids.length
    });
  } catch (err) {
    console.error('Error reordering campaigns:', err);
    return res.status(500).json({ error: 'Failed to reorder campaigns.' });
  }
}
