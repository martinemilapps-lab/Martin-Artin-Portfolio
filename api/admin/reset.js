import { requireAdmin } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';
import { logAuditEvent } from '../_lib/audit.js';
import { DEFAULT_CAMPAIGNS } from '../../src/data/campaignsData.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  try {
    await ensureDatabaseSchema();
    const client = getDbClient();
    const now = new Date().toISOString();

    const statements = [
      { sql: 'DELETE FROM campaigns;', args: [] }
    ];

    for (let i = 0; i < DEFAULT_CAMPAIGNS.length; i++) {
      const c = DEFAULT_CAMPAIGNS[i];
      statements.push({
        sql: `INSERT INTO campaigns 
              (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          c.id,
          c.title,
          c.tagline || '',
          c.year || '',
          c.role || '',
          c.status || '',
          c.image,
          c.category || '',
          c.client || '',
          c.description || '',
          c.credits || '',
          c.link || '',
          c.caseStudyLink || '',
          c.clientLink || '',
          JSON.stringify(c.gallery || []),
          c.thumbnail || c.image,
          i,
          now
        ]
      });
    }

    await client.batch(statements, 'write');

    await logAuditEvent(req, {
      eventType: 'CAMPAIGNS_RESET',
      actor: admin.userId,
      success: true,
      metadata: { count: DEFAULT_CAMPAIGNS.length }
    });

    return res.status(200).json({
      success: true,
      message: 'Campaigns have been reset to factory defaults atomically.',
      campaigns: DEFAULT_CAMPAIGNS
    });
  } catch (err) {
    console.error('Error resetting campaigns:', err);
    return res.status(500).json({ error: 'Failed to reset campaigns.' });
  }
}
