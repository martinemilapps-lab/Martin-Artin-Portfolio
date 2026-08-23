import { requireAdmin } from '../_lib/auth.js';
import { getDbClient, ensureDatabaseSchema } from '../_lib/db.js';
import { validateCampaignInput, parseBody } from '../_lib/validation.js';
import { logAuditEvent } from '../_lib/audit.js';

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401 response already sent

  await ensureDatabaseSchema();
  const client = getDbClient();

  // POST: Create a new campaign
  if (req.method === 'POST') {
    try {
      const validated = validateCampaignInput(await parseBody(req));

      // Determine ID if not provided
      let newId = validated.id;
      if (!newId) {
        const maxIdRes = await client.execute('SELECT MAX(id) as maxId FROM campaigns;');
        newId = (Number(maxIdRes.rows[0]?.maxId) || 0) + 1;
      }

      // Determine display_order
      let displayOrder = validated.displayOrder;
      if (typeof displayOrder !== 'number' || isNaN(displayOrder)) {
        const maxOrderRes = await client.execute('SELECT MAX(display_order) as maxOrder FROM campaigns;');
        displayOrder = (Number(maxOrderRes.rows[0]?.maxOrder) || 0) + 1;
      }

      const now = new Date().toISOString();

      await client.execute({
        sql: `INSERT INTO campaigns 
              (id, title, tagline, year, role, status, image, category, client, description, credits, link, case_study_link, client_link, gallery, thumbnail, display_order, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        args: [
          newId,
          validated.title,
          validated.tagline,
          validated.year,
          validated.role,
          validated.status,
          validated.image,
          validated.category,
          validated.client,
          validated.description,
          validated.credits,
          validated.link,
          validated.caseStudyLink,
          validated.clientLink,
          JSON.stringify(validated.gallery),
          validated.thumbnail,
          displayOrder,
          now
        ]
      });

      await logAuditEvent(req, {
        eventType: 'CAMPAIGN_CREATE',
        actor: admin.userId,
        resourceType: 'campaign',
        resourceId: newId,
        success: true,
        metadata: { title: validated.title }
      });

      return res.status(201).json({
        success: true,
        message: 'Campaign created successfully.',
        campaign: { ...validated, id: newId, displayOrder, updatedAt: now }
      });
    } catch (err) {
      console.error('Error creating campaign:', err);
      return res.status(400).json({ error: err.message || 'Failed to create campaign.' });
    }
  }

  // PUT: Update an existing campaign
  if (req.method === 'PUT') {
    try {
      const validated = validateCampaignInput(await parseBody(req));
      const targetId = req.query.id ? Number(req.query.id) : validated.id;

      if (!targetId || isNaN(targetId)) {
        return res.status(400).json({ error: 'Valid campaign ID is required for update.' });
      }

      const now = new Date().toISOString();

      const updateRes = await client.execute({
        sql: `UPDATE campaigns SET
                title = ?,
                tagline = ?,
                year = ?,
                role = ?,
                status = ?,
                image = ?,
                category = ?,
                client = ?,
                description = ?,
                credits = ?,
                link = ?,
                case_study_link = ?,
                client_link = ?,
                gallery = ?,
                thumbnail = ?,
                updated_at = ?
              WHERE id = ?;`,
        args: [
          validated.title,
          validated.tagline,
          validated.year,
          validated.role,
          validated.status,
          validated.image,
          validated.category,
          validated.client,
          validated.description,
          validated.credits,
          validated.link,
          validated.caseStudyLink,
          validated.clientLink,
          JSON.stringify(validated.gallery),
          validated.thumbnail,
          now,
          targetId
        ]
      });

      if (updateRes.rowsAffected === 0) {
        return res.status(404).json({ error: `Campaign with ID ${targetId} not found.` });
      }

      await logAuditEvent(req, {
        eventType: 'CAMPAIGN_UPDATE',
        actor: admin.userId,
        resourceType: 'campaign',
        resourceId: targetId,
        success: true,
        metadata: { title: validated.title }
      });

      return res.status(200).json({
        success: true,
        message: 'Campaign updated successfully.',
        campaign: { ...validated, id: targetId, updatedAt: now }
      });
    } catch (err) {
      console.error('Error updating campaign:', err);
      return res.status(400).json({ error: err.message || 'Failed to update campaign.' });
    }
  }

  // DELETE: Delete an existing campaign
  if (req.method === 'DELETE') {
    try {
      const targetId = req.query.id ? Number(req.query.id) : (req.body?.id ? Number(req.body.id) : null);

      if (!targetId || isNaN(targetId)) {
        return res.status(400).json({ error: 'Valid campaign ID is required for deletion.' });
      }

      const deleteRes = await client.execute({
        sql: 'DELETE FROM campaigns WHERE id = ?;',
        args: [targetId]
      });

      if (deleteRes.rowsAffected === 0) {
        return res.status(404).json({ error: `Campaign with ID ${targetId} not found.` });
      }

      await logAuditEvent(req, {
        eventType: 'CAMPAIGN_DELETE',
        actor: admin.userId,
        resourceType: 'campaign',
        resourceId: targetId,
        success: true
      });

      return res.status(200).json({
        success: true,
        message: 'Campaign deleted successfully.',
        deletedId: targetId
      });
    } catch (err) {
      console.error('Error deleting campaign:', err);
      return res.status(500).json({ error: 'Failed to delete campaign.' });
    }
  }

  res.setHeader('Allow', ['POST', 'PUT', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
