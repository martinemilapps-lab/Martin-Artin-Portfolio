import { requireAdmin } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';
import { validateCampaignInput, parseBody } from '../_lib/validation.js';
import { logAuditEvent } from '../_lib/audit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  const { campaigns } = await parseBody(req);

  if (!Array.isArray(campaigns) || campaigns.length === 0) {
    return res.status(400).json({ error: 'Campaigns array is required and must not be empty.' });
  }

  if (campaigns.length > 50) {
    return res.status(400).json({ error: 'Cannot import more than 50 campaigns in a single batch.' });
  }

  try {
    // Validate all campaigns before beginning transaction
    const validatedCampaigns = campaigns.map((item, idx) => {
      try {
        const validated = validateCampaignInput(item);
        const id = validated.id || idx + 1;
        const displayOrder = typeof item.displayOrder === 'number' ? item.displayOrder : idx;
        return { ...validated, id, displayOrder };
      } catch (err) {
        throw new Error(`Validation error at campaign index ${idx}: ${err.message}`);
      }
    });

    await ensureDatabaseSchema();
    const client = getDbClient();
    const now = new Date().toISOString();

    // Prepare atomic transaction statements
    const statements = [
      { sql: 'DELETE FROM campaigns;', args: [] }
    ];

    for (const c of validatedCampaigns) {
      statements.push({
        sql: `INSERT INTO campaigns 
              (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          c.id,
          c.title,
          c.tagline,
          c.year,
          c.role,
          c.status,
          c.image,
          c.category,
          c.client,
          c.description,
          c.credits,
          c.link,
          c.caseStudyLink,
          c.clientLink,
          JSON.stringify(c.gallery),
          c.thumbnail,
          c.displayOrder,
          now
        ]
      });
    }

    // Execute atomic batch transaction (rolls back on failure)
    await client.batch(statements, 'write');

    await logAuditEvent(req, {
      eventType: 'CAMPAIGNS_IMPORT',
      actor: admin.userId,
      success: true,
      metadata: { count: validatedCampaigns.length }
    });

    return res.status(200).json({
      success: true,
      message: `Successfully imported ${validatedCampaigns.length} campaigns transactionally.`,
      importedCount: validatedCampaigns.length
    });
  } catch (err) {
    console.error('Error importing campaigns:', err);
    return res.status(400).json({ error: err.message || 'Failed to import campaigns.' });
  }
}
