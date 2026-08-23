import { getDbClient, ensureDatabaseSchema } from './_lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureDatabaseSchema();
    const client = getDbClient();

    const result = await client.execute(`
      SELECT 
        id, 
        title, 
        tagline, 
        year, 
        role, 
        status, 
        image, 
        category, 
        client, 
        description, 
        credits, 
        link, 
        case_study_link, 
        client_link, 
        gallery, 
        thumbnail, 
        display_order,
        updated_at
      FROM campaigns
      ORDER BY display_order ASC;
    `);

    const campaigns = result.rows.map(row => {
      let parsedGallery = [];
      try {
        parsedGallery = row.gallery ? JSON.parse(String(row.gallery)) : [];
      } catch {
        parsedGallery = [];
      }

      return {
        id: Number(row.id),
        title: String(row.title || ''),
        tagline: String(row.tagline || ''),
        year: String(row.year || ''),
        role: String(row.role || ''),
        status: String(row.status || ''),
        image: String(row.image || ''),
        category: String(row.category || ''),
        client: String(row.client || ''),
        description: String(row.description || ''),
        credits: String(row.credits || ''),
        link: String(row.link || ''),
        caseStudyLink: String(row.case_study_link || ''),
        clientLink: String(row.client_link || ''),
        gallery: Array.isArray(parsedGallery) ? parsedGallery : [],
        thumbnail: String(row.thumbnail || row.image || ''),
        displayOrder: Number(row.display_order || 0),
        updatedAt: row.updated_at ? String(row.updated_at) : null
      };
    });

    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({
      success: true,
      campaigns
    });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    return res.status(500).json({ error: 'Failed to retrieve campaigns.' });
  }
}
