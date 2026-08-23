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

    const start = performance.now();
    const countRes = await client.execute('SELECT COUNT(*) as count FROM campaigns;');
    const latencyMs = Math.round(performance.now() - start);

    const count = Number(countRes.rows[0]?.count || 0);

    return res.status(200).json({
      status: 'online',
      healthy: true,
      latencyMs,
      campaignsCount: count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Database health check failed:', err);
    return res.status(503).json({
      status: 'offline',
      healthy: false,
      error: 'Database connection check failed.'
    });
  }
}
